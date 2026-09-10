import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { forgotPassword, resetPasswordWithOtp } from '../viewModel/LoginAPis';
import { parseApiError } from '../utils/apiError';

// Drives the two-step Forgot Password flow: Step 1 collects an email/
// username/mobile ("login") and requests an OTP; Step 2 collects that OTP
// plus a new password and completes the reset. Per the backend's own
// contract (POST /auth/forgot-password), Step 1 always succeeds into Step 2
// regardless of whether the account actually exists — the response is
// intentionally generic, there's nothing else to branch the UI on.
export function useForgotPasswordController() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [login, setLogin] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [sendingOtp, setSendingOtp] = useState(false);
  const [sendOtpError, setSendOtpError] = useState('');

  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSendOtp = useCallback(async () => {
    if (!login.trim()) {
      setSendOtpError('Please enter your email or mobile number.');
      return;
    }
    setSendingOtp(true);
    setSendOtpError('');
    try {
      await forgotPassword(login.trim());
      setStep(2);
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to send OTP. Please try again.');
      setSendOtpError(message);
    } finally {
      setSendingOtp(false);
    }
  }, [login]);

  // Same call as handleSendOtp — already on step 2, so this doesn't move
  // the step forward again, just re-sends and clears any stale error.
  // Requesting this invalidates any earlier unused OTP for this account
  // (server-side), so the old code stops working the moment this succeeds.
  const handleResendOtp = useCallback(async () => {
    if (!login.trim()) return;
    setSendingOtp(true);
    setSendOtpError('');
    setResetError('');
    try {
      await forgotPassword(login.trim());
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to resend OTP. Please try again.');
      setSendOtpError(message);
    } finally {
      setSendingOtp(false);
    }
  }, [login]);

  const handleResetPassword = useCallback(async () => {
    setResetError('');
    if (!otp.trim() || otp.trim().length !== 6) {
      setResetError('Please enter the 6-digit code.');
      return;
    }
    if (!newPassword || !confirmPassword) {
      setResetError('Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('New password and confirmation do not match.');
      return;
    }

    setResetting(true);
    try {
      await resetPasswordWithOtp(login.trim(), otp.trim(), newPassword);
      setResetSuccess(true);
    } catch (error: any) {
      const { code, message } = parseApiError(error, 'Failed to reset password. Please try again.');
      setResetError(code === 'OTP_INVALID' ? 'Incorrect or expired code. Please check and try again.' : message);
    } finally {
      setResetting(false);
    }
  }, [login, otp, newPassword, confirmPassword]);

  const goBackToStep1 = useCallback(() => {
    setStep(1);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
  }, []);

  const goToLogin = useCallback(() => router.replace('/screens/login' as any), [router]);

  return {
    step, login, setLogin, otp, setOtp, newPassword, setNewPassword, confirmPassword, setConfirmPassword,
    showPasswords, setShowPasswords,
    sendingOtp, sendOtpError, handleSendOtp, handleResendOtp,
    resetting, resetError, resetSuccess, handleResetPassword,
    goBackToStep1, goToLogin,
  };
}
