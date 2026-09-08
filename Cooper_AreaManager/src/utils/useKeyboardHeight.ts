import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Live height (in px) of the on-screen keyboard — 0 while it's hidden.
 *
 * React Native's <Modal> on Android opens its own window that does NOT
 * pan or resize for the keyboard, and RN's Modal on iOS doesn't avoid it
 * either. So a bottom sheet rendered inside a Modal (e.g. the Client OTP
 * verification sheet) has its lower content — the multiline remark field
 * and the Generate / Verify / Save & Close buttons — covered by the
 * keyboard unless we lift it ourselves. Feed this value into the sheet's
 * bottom padding and its scroll-area max height so every control stays
 * fully visible above the keyboard, not just partially.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS reports the frame a touch earlier via the "Will" events, which
    // keeps the lift in sync with the keyboard's slide-in animation;
    // Android only reliably fires the "Did" events.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setHeight(e?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
