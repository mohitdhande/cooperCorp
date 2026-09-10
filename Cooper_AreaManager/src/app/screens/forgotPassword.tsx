import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/_components/AppText';
import { TextInput } from '@/_components/AppTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react-native';
import { useForgotPasswordController } from '../../controllers/forgotPasswordController';

// Two-step Forgot Password flow — Step 1 (email/mobile -> Send OTP) matches
// the reference design exactly (circular logo + brand header, light card on
// a light background, indigo primary button). Step 2 (OTP + new password)
// has no reference design of its own, so it's built to match Step 1's same
// visual language instead of inventing a different look.
export default function ForgotPasswordScreen() {
  const {
    step, login, setLogin, otp, setOtp, newPassword, setNewPassword, confirmPassword, setConfirmPassword,
    showPasswords, setShowPasswords,
    sendingOtp, sendOtpError, handleSendOtp, handleResendOtp,
    resetting, resetError, resetSuccess, handleResetPassword,
    goBackToStep1, goToLogin,
  } = useForgotPasswordController();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.brandRow}>
              <Image source={require('@/assets/logo_circular.png')} style={styles.brandLogo} />
              <View>
                <Text style={styles.brandTitle}>Cooper Corp</Text>
                <Text style={styles.brandSubtitle}>Genset E-FSR</Text>
              </View>
            </View>

            {resetSuccess ? (
              <>
                <View style={styles.successIconCircle}>
                  <CheckCircle2 size={32} color="#16A34A" />
                </View>
                <Text style={styles.title}>Password reset</Text>
                <Text style={styles.description}>Your password has been changed. You can now sign in with your new password.</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={goToLogin}>
                  <Text style={styles.primaryButtonText}>Back to sign in</Text>
                </TouchableOpacity>
              </>
            ) : step === 1 ? (
              <>
                <Text style={styles.title}>Reset your password</Text>
                <Text style={styles.description}>Enter your email or mobile number and we will send you a one-time code.</Text>

                <Text style={styles.label}>EMAIL OR MOBILE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email address or mobile number"
                  placeholderTextColor="#9CA3AF"
                  value={login}
                  onChangeText={setLogin}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                {!!sendOtpError && <Text style={styles.errorText}>{sendOtpError}</Text>}

                <TouchableOpacity
                  style={[styles.primaryButton, sendingOtp && styles.buttonDisabled]}
                  onPress={handleSendOtp}
                  disabled={sendingOtp}
                >
                  {sendingOtp ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Send OTP</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backLink} onPress={goToLogin}>
                  <Text style={styles.backLinkText}>Back to sign in</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.title}>Enter the code</Text>
                <Text style={styles.description}>
                  We sent a 6-digit code to {login}. It expires in 10 minutes.
                </Text>

                <Text style={styles.label}>6-DIGIT CODE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="000000"
                  placeholderTextColor="#9CA3AF"
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <Text style={[styles.label, { marginTop: 16 }]}>NEW PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showPasswords}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                />

                <Text style={[styles.label, { marginTop: 16 }]}>CONFIRM NEW PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showPasswords}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />

                <TouchableOpacity style={styles.showPasswordsRow} onPress={() => setShowPasswords((v) => !v)}>
                  {showPasswords ? <EyeOff size={16} color="#6B7280" /> : <Eye size={16} color="#6B7280" />}
                  <Text style={styles.showPasswordsText}>Show passwords</Text>
                </TouchableOpacity>

                {!!resetError && <Text style={styles.errorText}>{resetError}</Text>}

                <TouchableOpacity
                  style={[styles.primaryButton, resetting && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={resetting}
                >
                  {resetting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Reset Password</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backLink} onPress={handleResendOtp} disabled={sendingOtp}>
                  <Text style={styles.backLinkText}>{sendingOtp ? 'Resending…' : 'Resend code'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.backLink} onPress={goBackToStep1}>
                  <Text style={styles.backLinkText}>Back</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    width: '100%', maxWidth: 420, alignSelf: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 24,
    padding: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24,
    elevation: 4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 },
  brandLogo: { width: 48, height: 48, borderRadius: 24 },
  brandTitle: { fontSize: 18, fontWeight: '800', color: '#1E1951' },
  brandSubtitle: { fontSize: 13, fontWeight: '700', color: '#F26722' },

  successIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  description: { fontSize: 14, fontWeight: '400', color: '#6B7280', lineHeight: 20, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#4B5563', letterSpacing: 0.5, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14, fontSize: 15, color: '#1F2937',
    height: 50,
  },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '600', marginTop: 12 },
  primaryButton: {
    width: '100%', height: 54, borderRadius: 100,
    backgroundColor: '#4F46E5',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  backLink: { alignSelf: 'center', marginTop: 16 },
  backLinkText: { color: '#4F46E5', fontSize: 14, fontWeight: '600' },
  showPasswordsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  showPasswordsText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
});
