import React from 'react';
import { TextInput as RNTextInput, TextInputProps, StyleSheet } from 'react-native';

// Same weight->Inter-family mapping as AppText.tsx.
const WEIGHT_TO_INTER_FAMILY: Record<string, string> = {
  '100': 'Inter_100Thin',
  '200': 'Inter_200ExtraLight',
  '300': 'Inter_300Light',
  normal: 'Inter_400Regular',
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
};

// Drop-in replacement for react-native's TextInput — mirrors AppText.tsx:
// picks the matching static Inter file from whatever fontWeight a screen's
// existing style already sets (typed text and the placeholder both render
// through this), instead of every TextInput style needing its own
// fontFamily entry. Respects an explicit fontFamily if a caller set one.
// Forwards its ref — a couple of screens (taskForm/srTaskForm's OTP boxes)
// hold a ref to each box to auto-focus the next one.
export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(({ style, ...rest }, ref) => {
  const flattened = (StyleSheet.flatten(style) || {}) as { fontWeight?: string | number; fontFamily?: string };
  const fontFamily = flattened.fontFamily || WEIGHT_TO_INTER_FAMILY[String(flattened.fontWeight ?? '400')] || 'Inter_400Regular';
  return <RNTextInput ref={ref} {...rest} style={[style, { fontFamily }]} />;
});
