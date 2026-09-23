# AMD GPU Passthrough Prerequisites Guide (AMD EPYC / Instinct)

Host-level prerequisites for running GPU-passthrough VMs (VMaaS / OpenShift
Virtualization) on AMD EPYC + Instinct systems. Covers BIOS, kernel command
line, and the IOMMU/ACS checks that determine whether an Instinct GPU can be
handed to a guest.

Validated on Supermicro **H14DSG-OD** (2× **AMD EPYC 9575F**, 8× **Instinct
MI325X**, PCI `1002:74a5`); other AMD EPYC + Instinct platforms are expected to
behave similarly.

> **NOTE:** References: AMD [GPU Operator + KubeVirt](https://instinct.docs.amd.com/projects/gpu-operator/en/latest/kubevirt/kubevirt.html)

---

## 1. BIOS settings

The AMD GPU Operator + KubeVirt guide requires the following (attribute names
are Supermicro; menu paths follow the AMD docs):

| Setting            | Menu path                     | Value     | Why it matters                                                               |
| ------------------ | ----------------------------- | --------- | ---------------------------------------------------------------------------- |
| SR-IOV Support     | Advanced / PCI Subsystem      | `enabled` | Required for VF passthrough / partitioning; harmless for PF.                 |
| Above 4G Decoding  | Advanced / PCI Subsystem      | `enabled` | Maps the GPU's large PCI BARs above the 4 GB boundary.                       |
| PCIe ARI Support   | Advanced / PCI Subsystem      | `enabled` | Alternative Routing-ID; correct multi-function enumeration.                  |
| IOMMU              | Advanced / NB Configuration   | `enabled` | DMA remapping; without it no vfio device assignment is possible.             |
| ACS Enabled        | Advanced / NB Configuration   | `enabled` | Splits each GPU into its own IOMMU group, required for passthrough.          |

> **ACS is the setting most often wrong.** With ACS enabled each GPU is isolated
> in its own IOMMU group; without it, PCIe switches lump each GPU with NICs/NVMe
> so the group is not viable for passthrough.

---

## 2. Kernel command line (RHCOS)

> In an OSAC environment the host runs OpenShift on RHCOS, so kernel args are
> owned by the Machine Config Operator — deliver them with a `MachineConfig`, not
> `grubby`/grub (grub edits are reverted on reboot). AMD's docs assume bare-metal
> RHEL + `grubby`.

The AMD GPU Operator + KubeVirt guide requires these kernel args:

```
iommu=on amd_iommu=on modprobe.blacklist=amdgpu
```

| Parameter                   | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `iommu=on` / `amd_iommu=on` | Enable the AMD IOMMU (DMA remapping) — mandatory for vfio.           |
| `modprobe.blacklist=amdgpu` | Host does not bind `amdgpu`; the GPU operator binds `vfio-pci`.      |

Sample `MachineConfig` per pool (master + worker):

```yaml
apiVersion: machineconfiguration.openshift.io/v1
kind: MachineConfig
metadata:
  labels:
    machineconfiguration.openshift.io/role: master
  name: 99-amd-instinct-kernel-params-master
spec:
  kernelArguments:
    - iommu=on
    - amd_iommu=on                    # Intel hosts: use intel_iommu=on
    - modprobe.blacklist=amdgpu
---
apiVersion: machineconfiguration.openshift.io/v1
kind: MachineConfig
metadata:
  labels:
    machineconfiguration.openshift.io/role: worker
  name: 99-amd-instinct-kernel-params-worker
spec:
  kernelArguments:
    - iommu=on
    - amd_iommu=on                    # Intel hosts: use intel_iommu=on
    - modprobe.blacklist=amdgpu
```

> **NOTE:** Applying a `MachineConfig` drains and reboots each node in the pool, one at a
time.

Verify (after the nodes have rebooted into the new config):

```bash
oc debug node/<node> -- chroot /host cat /proc/cmdline
```

---

## 3. KubeVirt host-device configuration (automatic via OSAC)

AMD's [Configure KubeVirt](https://instinct.docs.amd.com/projects/gpu-operator/en/latest/kubevirt/kubevirt.html#configure-kubevirt)
step enables the `HostDevices` feature gate and adds the GPU to
`permittedHostDevices` on the KubeVirt / HyperConverged CR:

```yaml
spec:
  configuration:
    developerConfiguration:
      featureGates:
        - HostDevices
    permittedHostDevices:
      pciHostDevices:
        - pciVendorSelector: "1002:74a5"   # GPU vendor:device ID
          resourceName: amd.com/gpu
```

**In an OSAC environment this is automatic — no manual CR edit.** Creating a GPU
instance type with `--gpu-pci-device-selector` wires the same `pciHostDevices`
entry into the HyperConverged CR. The selector is the GPU's PCI `vendor:device`
ID and works for both **PF and VF** (both surface as the `amd.com/gpu` resource):

```bash
osac create instancetype \
  --name g1-mi325x \
  --vcpus 2 \
  --memory-gib 4 \
  --gpu-pci-device-selector 1002:74a5 \
  --gpu-resource-name amd.com/gpu \
  --gpu-count 1
```

Verify the resulting config on the cluster:

```bash
oc get kubevirt -n openshift-cnv kubevirt-kubevirt-hyperconverged \
  -o jsonpath='{.spec.configuration.permittedHostDevices}{"\n"}'

# {"pciHostDevices":[{"pciVendorSelector":"1002:74a5","resourceName":"amd.com/gpu"}]}
```

---

## 4. `vfio-pci` binding

Passthrough requires the GPU bound to `vfio-pci` (not `amdgpu`). OSAC VMaaS is
self-service *on top of* admin-prepared nodes — it provisions VMs against GPU
capacity the cluster admin has already exposed and offers no node-prep knobs
(`ComputeInstance` has no driver/firmware fields). So binding the GPU to
`vfio-pci` is a **prerequisite the admin completes before sharing the resource**.

AMD supports doing this either **manually** (bind the PF/VF to `vfio-pci` by hand)
or via the **AMD GPU Operator** `DeviceConfig`. This guide recommends the GPU
Operator — it binds the driver, keeps it across reboots/upgrades, and its device
plugin advertises the `amd.com/gpu` resource referenced by `permittedHostDevices`
(§3).

### PF passthrough (whole GPU)

Apply a `DeviceConfig` with `driverType: pf-passthrough`; the operator binds each
matching PF straight to `vfio-pci` (no host `amdgpu`):

```yaml
apiVersion: amd.com/v1alpha1
kind: DeviceConfig
metadata:
  name: amdgpu-pf-passthrough
  namespace: openshift-amd-gpu
spec:
  driver:
    enable: true                 # operator manages the out-of-tree driver
    driverType: pf-passthrough   # bind the PF directly to vfio-pci
    vfioConfig:
      deviceIDs:
        - "74a5"                 # MI325X PF; omit to use the operator's built-in Instinct list
  selector:
    "feature.node.kubernetes.io/amd-gpu": "true"
```

Confirm the driver in use and the advertised resource:

```bash
oc debug node/<node> -- chroot /host bash -c \
  'for g in $(lspci -Dnn -d 1002:74a5 | cut -d" " -f1); do
     echo "$g -> $(lspci -ks $g | awk "/Kernel driver/{print \$NF}")"; done'

# Starting pod/smc6216gpupartner-acceleratorsredhatlab-debug-hv47j ...
# To use host binaries, run `chroot /host`. Instead, if you need to access host namespaces, run `nsenter -a -t 1`.
# 0000:05:00.0 -> vfio-pci
# 0000:15:00.0 -> vfio-pci
# 0000:65:00.0 -> vfio-pci
# 0000:75:00.0 -> vfio-pci
# 0000:85:00.0 -> vfio-pci
# 0000:95:00.0 -> vfio-pci
# 0000:e5:00.0 -> vfio-pci
# 0000:f5:00.0 -> vfio-pci
```

```bash
oc get node/<node> -oyaml | grep -i allocatable -A 2

#  allocatable:
#    amd.com/gpu: "8"
#    cpu: 252880m
```

### VF passthrough (SR-IOV)

_TODO — covered separately. Requires the AMD GIM driver and host SR-IOV
configuration in addition to the operator `DeviceConfig`._

---

With the prerequisites above satisfied, the node is ready to host both plain AMD
VMs and GPU-passthrough VMs via the VMaaS service in OSAC.

---

## Annexe — Verify Guest VM

Once a GPU-passthrough VM is running, log into the guest and confirm the GPU is
present on the guest PCI bus. The passed-through MI325X should enumerate with its
native vendor:device ID (`1002:74a5`) — no host `amdgpu` involved:

```bash
[fedora@fedora-gpu-pf ~]$ lspci -nnkk | grep -i 1002 -A 1

# 09:00.0 Processing accelerators [1200]: Advanced Micro Devices, Inc. [AMD/ATI] Aqua Vanjaram [Instinct MI325X] [1002:74a5]
#     Subsystem: Advanced Micro Devices, Inc. [AMD/ATI] Aqua Vanjaram [Instinct MI325X] [1002:74a5]
# 0a:00.0 Unclassified device [00ff]: Red Hat, Inc. Virtio 1.0 balloon [1af4:1045] (rev 01)
```

Seeing the Instinct GPU on the guest bus confirms the full passthrough path —
BIOS → kernel → vfio binding → KubeVirt host device → guest — is working
end to end.
