import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';

// Maps every fontWeight value already used across the app's existing
// StyleSheets to the matching static Inter weight file — Inter is loaded as
// separate named fonts (Inter_600SemiBold, etc.), not a single family whose
// weight varies via `fontWeight`, so each style's existing fontWeight has to
// be translated into the right fontFamily rather than left to the OS to
// resolve on its own.
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

// Drop-in replacement for react-native's Text — every screen already sets
// fontWeight/fontSize/color per its own design, so this only adds the
// fontFamily each one is missing, picked from its existing fontWeight,
// instead of every StyleSheet needing its own fontFamily entry. Respects an
// explicit fontFamily if a caller already set one.
export function Text({ style, ...rest }: TextProps) {
  const flattened = (StyleSheet.flatten(style) || {}) as { fontWeight?: string | number; fontFamily?: string };
  const fontFamily = flattened.fontFamily || WEIGHT_TO_INTER_FAMILY[String(flattened.fontWeight ?? '400')] || 'Inter_400Regular';
  return <RNText {...rest} style={[style, { fontFamily }]} />;
}
