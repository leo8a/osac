import { type ExternalIP, ExternalIPs } from '@osac/types';
import DeleteResourceModal from '@osac/ui-components/components/Resource/DeleteResourceModal.tsx';

import { canDeleteExternalIp, externalIpDisplayName } from './utils';
import { useDeleteResource } from '../../api/use-resource';
import { useTranslation } from '../../hooks/useTranslation';

interface ExternalIpDeleteModalProps {
  externalIp: ExternalIP;
  onClose: () => void;
  onSuccess: () => void;
}

const ExternalIpDeleteModal = ({ externalIp, onClose, onSuccess }: ExternalIpDeleteModalProps) => {
  const { t } = useTranslation();
  const deleteExternalIp = useDeleteResource(ExternalIPs);

  return (
    <DeleteResourceModal
      resourceName={externalIpDisplayName(externalIp)}
      label={
        canDeleteExternalIp(externalIp)
          ? t(
              'This permanently releases the external IP back to its pool. This action cannot be undone.',
            )
          : t(
              'This external IP is in use and cannot be deleted until it is detached from a workload.',
            )
      }
      errorLabel={t('Failed to delete external IP')}
      onClose={onClose}
      onSuccess={onSuccess}
      mutation={deleteExternalIp}
      variables={{ id: externalIp.id }}
    />
  );
};

export default ExternalIpDeleteModal;
