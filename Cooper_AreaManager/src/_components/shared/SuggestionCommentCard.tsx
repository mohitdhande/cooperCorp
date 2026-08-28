import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { TextInput } from '@/_components/AppTextInput';
import { Text } from '@/_components/AppText';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  style?: StyleProp<ViewStyle>;
};

// "Suggestion Comment" — shared by Commissioning's Step 6 and Service's
// Step 5 (both engineer and area-manager branches), previously three
// separately hand-written copies with three different card/input looks.
// No manual focus-border state needed here — the shared TextInput
// (AppTextInput.tsx) already highlights its own border on focus.
export function SuggestionCommentCard({ value, onChangeText, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>SUGGESTION COMMENT</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter suggestion comments (one per line)..."
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16 },
  title: { fontSize: 13, fontWeight: '700', color: '#1F2937', letterSpacing: 0.5, marginBottom: 12 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', minHeight: 90,
  },
});
