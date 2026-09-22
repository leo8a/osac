import type { TFunction } from 'i18next';

import type { ComputeInstancePowerAction } from '../../api/v1/compute-instance';

export const getPowerActionErrorTitle = (
  t: TFunction,
  action: ComputeInstancePowerAction,
): string => {
  switch (action) {
    case 'start':
      return t('Failed to start virtual machine');
    case 'stop':
      return t('Failed to stop virtual machine');
    case 'restart':
      return t('Failed to restart virtual machine');
  }
};
