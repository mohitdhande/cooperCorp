import { useCallback, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { getToken } from '../../utils/tokenStore';
import { generateCommissioningOtp, verifyCommissioningOtp } from '../../viewModel/commisionAPi';
import { parseApiError } from '../../utils/apiError';
import { putOrQueue } from '../../utils/syncEngine';

type UseTaskFormOtpArgs = {
  taskId: string;
  showToast: (message: string, type: 'success' | 'error') => void;
  // Offline queueing (handleMarkComplete's putOrQueue below) is scoped to
  // engineer only — see the same note on useTaskForm.ts's own role load.
  isEngineer: boolean;
};

// Handles OTP generation, entry, validation, and task completion for the final step.
export function useTaskFormOtp({ taskId, showToast, isEngineer }: UseTaskFormOtpArgs) {
  const [otpGenerated, setOtpGenerated] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string[]>(['', '', '', '']);
  const [customerOtp, setCustomerOtp] = useState<string[]>(['', '', '', '']);
  const otpInputRefs = useRef<Array<TextInput | null>>([null, null, null, null]);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [markCompleteLoading, setMarkCompleteLoading] = useState(false);
  const [markCompleteError, setMarkCompleteError] = useState('');

  // Marks the task complete as soon as photos are done (step 6), ahead of —
  // and independent from — the OTP verification below. Same underlying
  // endpoint the OTP step already calls, just triggered earlier; OTP
  // verification still runs its own course afterward, unaffected by this.
  // Queued via putOrQueue like the other engineer saves — safe to do
  // offline since it's a one-time status transition (the dedupeKey means
  // even a double-tap while still offline collapses into a single queued
  // PUT, not two competing "complete" calls once connectivity returns).
  const handleMarkComplete = useCallback(async (): Promise<boolean> => {
    setMarkCompleteLoading(true);
    setMarkCompleteError('');
    try {
      if (!taskId) return false;

      const { queued } = await putOrQueue(`/api/commissioning/${taskId}/complete`, {}, `Complete task (${taskId})`, `commissioning_complete_${taskId}`, isEngineer);
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
  }, [taskId, showToast, isEngineer]);

  const handleGenerateOtp = useCallback(async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      const token = await getToken();
      if (!token || !taskId) return;

      const data = await generateCommissioningOtp(token, taskId);
      const digits = String(data.code).split('');
      setGeneratedOtp(digits);
      setCustomerOtp(['', '', '', '']);
      setOtpGenerated(true);
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to generate OTP. Please try again.');
      setOtpError(message);
    } finally {
      setOtpLoading(false);
    }
  }, [taskId]);

  const handleRegenerateOtp = useCallback(async () => {
    setOtpGenerated(false);
    setCustomerOtp(['', '', '', '']);
    setGeneratedOtp(['', '', '', '']);
    await handleGenerateOtp();
  }, [handleGenerateOtp]);

  const handleChangeCustomerOtpDigit = useCallback((index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    setCustomerOtp(prev => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (digit && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleVerifyAndComplete = useCallback(async () => {
    const code = customerOtp.join('');
    if (code.length < 4) return;

    setOtpLoading(true);
    setOtpError('');
    try {
      const token = await getToken();
      if (!token || !taskId) return;

      const verifyData = await verifyCommissioningOtp(token, taskId, code);
      if (!verifyData.verified) {
        setOtpError('Incorrect OTP. Please ask the customer to check the code.');
        return;
      }

      // The task was already marked complete back at step 6 — calling
      // completeCommissioningTask again here fails ("Entry must be in
      // progress") since the backend rejects completing an already-
      // completed entry. Verifying the OTP is all that's left to do.
      setTaskCompleted(true);
      showToast('OTP verified — task completed successfully!', 'success');
    } catch (error: any) {
      const { code: errorCode, message } = parseApiError(error, 'Verification failed. Please try again.');
      if (errorCode === 'OTP_LOCKED') {
        // Too many failed attempts — force the customer-facing OTP back to
        // "not generated" so the only way forward is a fresh code.
        setOtpGenerated(false);
        setCustomerOtp(['', '', '', '']);
        setGeneratedOtp(['', '', '', '']);
      }
      setOtpError(message);
    } finally {
      setOtpLoading(false);
    }
  }, [customerOtp, showToast, taskId]);

  return {
    otpGenerated,
    generatedOtp,
    customerOtp,
    otpInputRefs,
    otpLoading,
    otpError,
    taskCompleted,
    markCompleteLoading,
    markCompleteError,
    handleGenerateOtp,
    handleRegenerateOtp,
    handleChangeCustomerOtpDigit,
    handleVerifyAndComplete,
    handleMarkComplete,
  };
}
