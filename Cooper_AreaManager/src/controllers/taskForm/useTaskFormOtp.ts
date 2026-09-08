import { useCallback, useState } from 'react';
import { parseApiError } from '../../utils/apiError';
import { putOrQueue, runSync } from '../../utils/syncEngine';
import { getPendingBody } from '../../utils/offlineQueue';
import { checkLocationBlocked } from '../../utils/locationLogger';
import { showLocationOffAlert } from '../../utils/locationOffAlert';
import { logLocationForAction } from '../../utils/locationLogger';
import { formatAssetLabel } from '../../utils/reportFormatters';

type UseTaskFormOtpArgs = {
  taskId: string;
  showToast: (message: string, type: 'success' | 'error') => void;
  // Offline queueing (handleMarkComplete's putOrQueue below) is scoped to
  // engineer only — see the same note on useTaskForm.ts's own role load.
  isEngineer: boolean;
  // Just for the putOrQueue description below (see formatAssetLabel) — a
  // failed/pending sync banner showing "Task 68f2a91c..." means nothing to
  // an engineer, the genset/engine serial numbers do.
  gensetNumber?: string;
  engineNumber?: string;
};

// Marks the task complete at the end of step 6. OTP generation/verification
// used to live here too, but now happens from the View Report screen
// instead (taskReportController.ts) — Complete navigates straight there
// once this succeeds, rather than staying on this form for an in-place OTP
// step.
export function useTaskFormOtp({ taskId, showToast, isEngineer, gensetNumber, engineNumber }: UseTaskFormOtpArgs) {
  const [markCompleteLoading, setMarkCompleteLoading] = useState(false);
  const [markCompleteError, setMarkCompleteError] = useState('');

  // Queued via putOrQueue like the other engineer saves — safe to do
  // offline since it's a one-time status transition (the dedupeKey means
  // even a double-tap while still offline collapses into a single queued
  // PUT, not two competing "complete" calls once connectivity returns).
  const handleMarkComplete = useCallback(async (suggestionComment?: string): Promise<boolean> => {
    setMarkCompleteLoading(true);
    setMarkCompleteError('');
    try {
      if (!taskId) return false;

      // Same hard gate as Start/photo upload (checkLocationBlocked's own
      // comment) — Complete needs a real location, not just a best-effort
      // one. Checked before anything else: if GPS/permission is off, no
      // API call is made at all, just the Turn On/Open Settings alert.
      const blockReason = await checkLocationBlocked();
      if (blockReason) {
        showLocationOffAlert(blockReason);
        return false;
      }

      // Start can get queued locally instead of reaching the server right
      // away when Start was tapped offline (see commissioningTasksController
      // .ts's own handleStartTask) — the app still lets the engineer fill
      // out the whole form regardless, trusting that local "started" state.
      // If that queued Start still hasn't actually synced by the time
      // Complete is attempted, the server still thinks this task is stuck
      // at ACCEPTED and rejects Complete with "Entry must be in progress to
      // complete" — a confusing error with no obvious cause on screen.
      // Give the queue one real chance to catch up first (runSync replays
      // every pending action, oldest first, so this also flushes anything
      // else still waiting); only block Complete if Start is still stuck
      // afterward, with a message that actually explains why instead of
      // just surfacing the server's own cryptic rejection.
      if (await getPendingBody(`commissioning_start_${taskId}`)) {
        await runSync();
        if (await getPendingBody(`commissioning_start_${taskId}`)) {
          const msg = "This task hasn't reached the server as \"Started\" yet — you appear to be offline. It'll finish syncing once you're back online; please try Complete again after that.";
          setMarkCompleteError(msg);
          showToast(msg, 'error');
          return false;
        }
      }

      const trimmed = suggestionComment?.trim();
      const body = trimmed ? { suggestionComment: trimmed } : {};
      const assetLabel = formatAssetLabel(gensetNumber, engineNumber, taskId);
      // Location is captured only at Start, photo upload, and Complete —
      // see the same note in syncEngine.ts's own putOrQueue.
      logLocationForAction(`Complete task (${assetLabel})`);
      const { queued } = await putOrQueue(`/api/commissioning/${taskId}/complete`, body, `Complete task (${assetLabel})`, `commissioning_complete_${taskId}`, isEngineer);
      showToast(queued ? 'Saved on this device — will sync later' : 'Task marked complete!', 'success');
      return true;
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to mark task complete. Please try again.');
      setMarkCompleteError(message);
      showToast(message, 'error');
      return false;
    } finally {
      setMarkCompleteLoading(false);
    }
  }, [taskId, showToast, isEngineer, gensetNumber, engineNumber]);

  return {
    markCompleteLoading,
    markCompleteError,
    handleMarkComplete,
  };
}
