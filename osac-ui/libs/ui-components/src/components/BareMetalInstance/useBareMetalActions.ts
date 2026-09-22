import type { BareMetalInstance } from '@osac/types';
import { BareMetalInstanceState } from '@osac/types';

import { usePatchBareMetalInstance } from '../../api/v1/baremetal-instance';

export const useBareMetalActions = (instance: BareMetalInstance) => {
  const patch = usePatchBareMetalInstance();

  const state = instance.status?.state;
  const canStart = state === BareMetalInstanceState.STOPPED;
  const canStop = state === BareMetalInstanceState.RUNNING;
  const canRestart = state === BareMetalInstanceState.RUNNING;
  const canDelete = state !== BareMetalInstanceState.DELETING;

  const start = () => {
    if (canStart) {
      patch.mutate({ id: instance.id, action: 'start' });
    }
  };

  const stop = () => {
    if (canStop) {
      patch.mutate({ id: instance.id, action: 'stop' });
    }
  };

  const restart = () => {
    if (canRestart) {
      patch.mutate({
        id: instance.id,
        action: 'restart',
        currentTrigger: instance.spec?.restartTrigger ?? 0n,
      });
    }
  };

  return { canStart, canStop, canRestart, canDelete, start, stop, restart };
};
