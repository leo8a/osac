import { getPowerActionErrorTitle } from './powerActionErrorTitle';
import {
  type ComputeInstancePowerAction,
  usePatchComputeInstance,
} from '../../api/v1/compute-instance';
import { useTranslation } from '../../hooks/useTranslation';
import { getErrorMessage } from '../../utils/error';
import { useToast } from '../Toast/useToast';

/** Runs a VM lifecycle power action and surfaces a toast if it fails. */
export const useVmPowerAction = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const patchVm = usePatchComputeInstance();

  const runPowerAction = (vmId: string, powerAction: ComputeInstancePowerAction) => {
    patchVm.mutate(
      { id: vmId, powerAction },
      {
        onError: (error) => {
          addToast({
            variant: 'danger',
            title: getPowerActionErrorTitle(t, powerAction),
            description: getErrorMessage(error),
          });
        },
      },
    );
  };

  return { runPowerAction };
};
