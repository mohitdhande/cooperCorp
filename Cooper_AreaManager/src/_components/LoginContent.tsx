import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, ActivityIndicator, Image, KeyboardAvoidingView, ScrollView, Platform, Alert, Keyboard } from 'react-native';
import { TextInput } from '@/_components/AppTextInput';
import { Text } from '@/_components/AppText';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { Eye, EyeOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLoginController } from '../controllers/authController';
import { LOGIN_LOGO_SIZE } from '@/constants/branding';
import { LoadingOverlay } from '@/_components/shared/LoadingOverlay';
import { useFieldFocusChain } from '@/utils/useFieldFocusChain';

const DOT = '●';

type Props = {
  // When arriving straight from the splash video (app/index.tsx swaps this
  // component in in-place, no navigation), the video itself already served
  // as the entrance's "hold" beat — so the logo should start rising the
  // instant this mounts instead of pausing for another second first.
  // Standalone visits (the /screens/login route itself, e.g. post-logout)
  // leave this false and keep the original hold.
  skipInitialHold?: boolean;
};

// Renders the login experience and delegates the auth workflow to the
// controller hook. Used both as the standalone /screens/login route and,
// in-place (no navigation), as what app/index.tsx's splash video becomes
// once it finishes — see `skipInitialHold` above.
export function LoginContent({ skipInitialHold = false }: Props) {
  // useWindowDimensions (not Dimensions.get, read once at module load) so
  // the card stays correctly sized if the window resizes — e.g. Android
  // split-screen/multi-window — instead of freezing at the app's first size.
  const { width } = useWindowDimensions();
  // The Figma frame holding the fields (Frame96) is Width: Fill on its
  // 420px reference screen — i.e. it spans the full screen width, not a
  // shrunk 90% card floating inset from the edges. Only capped at 400 for
  // very wide viewports (tablets/web); every real phone width passes
  // through unchanged.
  const cardWidth = Math.min(width, 400);
  // Matches the design's 48px horizontal padding at its 420px reference
  // width, scaled proportionally instead of hardcoded so it holds the same
  // ratio on any device width.
  const cardHorizontalPadding = cardWidth * (48 / 420);

  const {
    username,
    setUsername,
    password,
    setPassword,
    loading,
    loginError,
    showPassword,
    togglePasswordVisibility,
    handleLogin,
    isLockedOut,
  } = useLoginController();

  const { register, focusNext } = useFieldFocusChain();

  // No forgot-password flow exists yet — surface that explicitly instead of
  // leaving the tap silently do nothing (which reads as the app being stuck).
  const handleForgotPassword = () => {
    Alert.alert('Forgot Password', 'Please contact your admin to reset your password.');
  };

  // Centered by default (matches the rest of the screen's resting look),
  // but switched to top-aligned while the keyboard is open — a centered
  // layout in the *shorter* space left after the keyboard appears is what
  // previously left the Login button sitting right at the keyboard's edge
  // instead of reachable by scrolling. Top-aligned only during that window
  // keeps it reachable without giving up centering the rest of the time.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Entrance animation: the logo holds at the screen's true vertical center
  // for a beat (unless `skipInitialHold`), then eases up into its resting
  // spot at the top of the card; once it finishes rising, the fields wait
  // another beat before fading in.
  //
  // The starting offset isn't a guessed fraction of screen height — the
  // card is already vertically centered on screen (`scrollContent`'s
  // justifyContent: 'center'), so the card's own vertical center coincides
  // with the screen's. That means the distance from the logo's resting spot
  // down to true center is just (half the card's content height) minus
  // (the logo's own distance from the card's top) — both computable from
  // this file's own known layout constants, and independent of device
  // height (which cancels out of the math). At the moment this animation
  // runs, `loginError` is always empty, so the fields' height is fixed.
  const CARD_PADDING_VERTICAL = 24; // styles.card.paddingVertical
  const BRAND_SUBTITLE_GAP = 8; // styles.brandHeader.gap — space between the logo and the "Gentset E-FSR" subtitle
  const BRAND_SUBTITLE_HEIGHT = 22; // styles.brandSubtitle — Figma: 125 Hug x 22 Hug
  const BRAND_HEADER_HEIGHT = LOGIN_LOGO_SIZE + BRAND_SUBTITLE_GAP + BRAND_SUBTITLE_HEIGHT;
  const BRAND_HEADER_MARGIN_BOTTOM = 36; // styles.brandHeader.marginBottom
  // Frame107 in Figma groups the password field + "Forgot Password?" link
  // with their own 12px internal gap — tighter than the 24px rhythm between
  // the other top-level fieldsGroup children (email input, this group, the
  // Login button).
  const PASSWORD_GROUP_GAP = 12; // styles.passwordGroup.gap
  const FIELDS_GAP = 24; // styles.fieldsGroup.gap
  // Height of each fieldsGroup child in order: email input, password group
  // (password field + "Forgot Password?" link, gapped by PASSWORD_GROUP_GAP —
  // its link height is estimated from its 14px font), Login button, bottom
  // spacer.
  const PASSWORD_GROUP_HEIGHT = 54 + PASSWORD_GROUP_GAP + 20;
  const FIELD_HEIGHTS = [54, PASSWORD_GROUP_HEIGHT, 54, 40];
  const fieldsGroupHeight = FIELD_HEIGHTS.reduce((sum, h) => sum + h, 0) + FIELDS_GAP * (FIELD_HEIGHTS.length - 1);
  const cardContentHeight = CARD_PADDING_VERTICAL + BRAND_HEADER_HEIGHT + BRAND_HEADER_MARGIN_BOTTOM + fieldsGroupHeight + CARD_PADDING_VERTICAL;
  // How far above the card's (= screen's) true center the brand block's
  // (logo + subtitle, animated together) resting center sits — translating
  // it down by exactly this much starts it dead center, matching the splash
  // video's centering.
  const logoRestOffsetFromCenter = (cardContentHeight / 2) - (CARD_PADDING_VERTICAL + BRAND_HEADER_HEIGHT / 2);

  const LOGO_HOLD_MS = skipInitialHold ? 0 : 1000;
  const LOGO_RISE_DURATION_MS = 650;
  const FIELDS_DELAY_AFTER_RISE_MS = 1000; // wait 1s after the logo finishes rising
  const fieldsStartDelay = LOGO_HOLD_MS + LOGO_RISE_DURATION_MS + FIELDS_DELAY_AFTER_RISE_MS;

  const logoTranslateY = useSharedValue(logoRestOffsetFromCenter);
  const fieldsOpacity = useSharedValue(0);
  const fieldsTranslateY = useSharedValue(18);

  useEffect(() => {
    logoTranslateY.value = withDelay(LOGO_HOLD_MS, withTiming(0, { duration: LOGO_RISE_DURATION_MS, easing: Easing.out(Easing.cubic) }));
    fieldsOpacity.value = withDelay(fieldsStartDelay, withTiming(1, { duration: 450 }));
    fieldsTranslateY.value = withDelay(fieldsStartDelay, withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoTranslateY.value }],
  }));
  const fieldsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fieldsOpacity.value,
    transform: [{ translateY: fieldsTranslateY.value }],
  }));

  // The password field displays dots while typing but still needs a real
  // TextInput (not secureTextEntry) so the eye-toggle can reveal it in place.
  // This diffs the masked display value against the real one to recover edits.
  const handleMaskedPasswordChange = (input: string) => {
    if (showPassword) {
      setPassword(input);
      return;
    }
    if (input.length >= password.length) {
      let real = '';
      let pi = 0;
      for (let i = 0; i < input.length; i++) {
        if (input[i] === DOT) {
          real += password[pi] ?? '';
          pi++;
        } else {
          real += input[i];
        }
      }
      setPassword(real);
    } else {
      const oldMasked = DOT.repeat(password.length);
      let prefix = 0;
      while (prefix < input.length && prefix < oldMasked.length && input[prefix] === oldMasked[prefix]) {
        prefix++;
      }
      let suffixOld = oldMasked.length;
      let suffixNew = input.length;
      while (suffixOld > prefix && suffixNew > prefix && oldMasked[suffixOld - 1] === input[suffixNew - 1]) {
        suffixOld--;
        suffixNew--;
      }
      setPassword(password.slice(0, prefix) + password.slice(suffixOld));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading && <LoadingOverlay />}
      {/* Android's own softwareKeyboardLayoutMode is "pan" (app.json) — the
          OS already shifts the whole screen up for the focused input;
          pairing that with behavior="height" double-compensated and left
          a large empty gap above the keyboard. undefined on Android leaves
          the OS's native pan as the only mechanism; iOS still needs its
          own "padding" here. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, width: '100%' }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, keyboardVisible && styles.scrollContentKeyboard]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[styles.card, { width: cardWidth, paddingHorizontal: cardHorizontalPadding }]}>

            {/* Brand header — starts held at the screen's true vertical
                center, eases up into its resting spot here at mount. */}
            <Animated.View style={[styles.brandHeader, logoAnimatedStyle]}>
              <Image source={require('@/assets/Logo.png')} style={styles.brandLogo} />
              <Text style={styles.brandSubtitle}>Genset E-FSR</Text>
            </Animated.View>

            {/* Fields — fade/slide in as the logo above arrives. */}
            <Animated.View style={[styles.fieldsGroup, fieldsAnimatedStyle]}>
              <TextInput
                placeholder="Email ID or Mobile Number"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => focusNext('password')}
              />

              {/* Frame107 — password field + "Forgot Password?" link, gapped
                  12px apart (tighter than the 24px rhythm between this group
                  and its siblings above/below). */}
              <View style={styles.passwordGroup}>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    ref={register('password')}
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={styles.passwordInput}
                    value={showPassword ? password : DOT.repeat(password.length)}
                    onChangeText={handleMaskedPasswordChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={togglePasswordVisibility}
                  >
                    {showPassword ? (
                      <Eye size={20} color="rgba(255,255,255,0.55)" />
                    ) : (
                      <EyeOff size={20} color="rgba(255,255,255,0.55)" />
                    )}
                  </TouchableOpacity>
                </View>


                <TouchableOpacity style={styles.forgotPasswordContainer} onPress={handleForgotPassword}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>

                
                {/* Error message */}
                {loginError ? (
                  <Text style={styles.loginErrorText}>{loginError}</Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.button, (loading || isLockedOut) && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading || isLockedOut}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.buttonText}>Login</Text>
                }
              </TouchableOpacity>

              {/* Extra padding so button stays visible above keyboard */}
              <View style={{ height: 40 }} />
            </Animated.View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#11101C',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  // Applied only while the keyboard is open (see `keyboardVisible` above) —
  // a centered card that's taller than the space left after the keyboard
  // appears leaves the Login button sitting right at the keyboard's edge
  // instead of reachable by scrolling. Top-aligned keeps it reachable.
  scrollContentKeyboard: {
    justifyContent: 'flex-start',
  },
  card: {
    backgroundColor: '#11101C',
    borderRadius: 24,
    paddingVertical: 24,
  },
  brandHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 36,
  },
  brandLogo: { width: LOGIN_LOGO_SIZE, height: LOGIN_LOGO_SIZE },
  brandSubtitle: {
    fontSize: 18,
    lineHeight: 22,
    color: '#E76124',
  },
  // 24px gap between every stacked item (email, password group, button, …) —
  // matches the design's rhythm; replaced the old per-field marginBottom
  // values so the spacing stays consistent instead of ad hoc per element.
  fieldsGroup: {
    gap: 24,
  },
  // Frame107 — password field + "Forgot Password?" link grouped with their
  // own tighter 12px gap, distinct from fieldsGroup's 24px rhythm.
  passwordGroup: {
    gap: 12,
  },
  input: {
    height: 54, borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 10,
    fontSize: 18, color: '#FFFFFF',
    backgroundColor: '#303036',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54, borderRadius: 24,
    paddingLeft: 24, paddingRight: 10,
    backgroundColor: '#303036',
  },
  passwordInput: {
    flex: 1,
    fontSize: 18, color: '#FFFFFF',
    paddingVertical: 10,
  },
  eyeButton: {
    paddingHorizontal: 14, height: 54,
    justifyContent: 'center', alignItems: 'center',
  },
  loginErrorText: {
    color: '#F26722',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  forgotPasswordContainer: { alignSelf: 'flex-end' },
  forgotPasswordText: { color: '#F26722', fontSize: 14, fontWeight: '600' },
  button: {
    height: 54, borderRadius: 24, backgroundColor: '#E76124',
    justifyContent: 'center', alignItems: 'center',
  },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '400' },
  buttonDisabled: { opacity: 0.7 },
});
