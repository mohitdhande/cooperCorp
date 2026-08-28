import { useCallback, useState } from 'react';
import { parseApiError } from '../../utils/apiError';
import { putOrQueue } from '../../utils/syncEngine';
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

      const trimmed = suggestionComment?.trim();
      const body = trimmed ? { suggestionComment: trimmed } : {};
      const assetLabel = formatAssetLabel(gensetNumber, engineNumber, taskId);
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
