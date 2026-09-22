import type { TFunction } from 'i18next';

import type { ExternalIP } from '@osac/types';
import type { ExternalIpAttachedTargetKind } from '@osac/ui-components/api/v1/external-ip-data';

export const externalIpDisplayName = (externalIp: ExternalIP): string =>
  externalIp.status?.address?.trim() || externalIp.metadata?.name?.trim() || externalIp.id;

export const canDeleteExternalIp = (externalIp: ExternalIP): boolean =>
  externalIp.status?.attached !== true;

export const attachedTargetKindLabel = (
  t: TFunction,
  kind: ExternalIpAttachedTargetKind,
): string => {
  switch (kind) {
    case 'baremetalInstance':
      return t('Bare metal');
    case 'cluster':
      return t('Cluster');
    case 'natGateway':
      return t('NAT gateway');
    case 'computeInstance':
      return t('Virtual machine');
  }
};
