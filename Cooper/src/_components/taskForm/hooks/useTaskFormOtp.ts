import { useCallback, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { completeCommissioningTask, generateCommissioningOtp, verifyCommissioningOtp } from '@/viewModel/commisionAPi';

type UseTaskFormOtpArgs = {
  taskId: string;
  showToast: (message: string, type: 'success' | 'error') => void;
};

// Handles OTP generation, entry, validation, and task completion for the final step.
export function useTaskFormOtp({ taskId, showToast }: UseTaskFormOtpArgs) {
  const [otpGenerated, setOtpGenerated] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string[]>(['', '', '', '']);
  const [customerOtp, setCustomerOtp] = useState<string[]>(['', '', '', '']);
  const otpInputRefs = useRef<Array<TextInput | null>>([null, null, null, null]);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [taskCompleted, setTaskCompleted] = useState(false);

  const handleGenerateOtp = useCallback(async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !taskId) return;

      const data = await generateCommissioningOtp(token, taskId);
      const digits = String(data.code).split('');
      setGeneratedOtp(digits);
      setCustomerOtp(['', '', '', '']);
      setOtpGenerated(true);
    } catch (error: any) {
      setOtpError(error.response?.data?.message || 'Failed to generate OTP. Please try again.');
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
      const token = await AsyncStorage.getItem('token');
      if (!token || !taskId) return;

      const verifyData = await verifyCommissioningOtp(token, taskId, code);
      if (!verifyData.verified) {
        setOtpError('Incorrect OTP. Please ask the customer to check the code.');
        return;
      }

      await completeCommissioningTask(token, taskId);
      setTaskCompleted(true);
      showToast('Task completed successfully!', 'success');
    } catch (error: any) {
      setOtpError(error.response?.data?.message || 'Verification failed. Please try again.');
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
    handleGenerateOtp,
    handleRegenerateOtp,
    handleChangeCustomerOtpDigit,
    handleVerifyAndComplete,
  };
}
