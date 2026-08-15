import { useCallback, useRef } from 'react';
import { TextInput } from 'react-native';

// Reusable "tap Next on the keyboard, jump to the next field" chain — same
// trick already used for the SR form's OTP boxes (see scrollCardIntoView/
// otpInputRefs in srTaskForm.tsx), generalized to any named sequence of
// text fields instead of 4 identical digit boxes.
//
// Usage:
//   const { register, focusNext } = useFieldFocusChain();
//   <TextInput ref={register('lastName')} returnKeyType="next"
//     submitBehavior="submit" onSubmitEditing={() => focusNext('email')} />
//   <TextInput ref={register('email')} ... onSubmitEditing={() => focusNext('phone')} />
//   <TextInput ref={register('phone')} returnKeyType="done" onSubmitEditing={handleSubmit} />
//
// submitBehavior="submit" (not the deprecated blurOnSubmit={false}) is what
// keeps the keyboard open across the jump — without it, the keyboard
// blurs/closes on every "Next" tap and has to reopen for the next field.
// The last field in a chain should skip focusNext entirely (returnKeyType
// "done"/"go" + its own submit handler) rather than calling focusNext with
// no further field to land on.
export function useFieldFocusChain() {
  const refs = useRef<Record<string, TextInput | null>>({});

  // Returns a ref-callback rather than taking (id, el) directly, so it can
  // be dropped straight into a TextInput's `ref` prop: ref={register('foo')}.
  const register = useCallback((id: string) => (el: TextInput | null) => {
    refs.current[id] = el;
  }, []);

  const focusNext = useCallback((id: string) => {
    refs.current[id]?.focus();
  }, []);

  return { register, focusNext };
}
