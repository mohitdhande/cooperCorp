import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, StyleProp, ViewStyle, Keyboard } from 'react-native';
import { TextInput } from '@/_components/AppTextInput';
import { Search, XCircle } from 'lucide-react-native';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  // Fires on the return key (toggle variant) or the trailing search icon
  // (pill variant) — the caller's own async search call, if it has one.
  onSubmit?: () => void;
  // Fires when the X is tapped — defaults to onChangeText('') when omitted,
  // but several screens need to reset more than just the text (e.g. a
  // stale searchError/searchResults from a previous query), so they pass
  // their own handleClearSearch here instead.
  onClear?: () => void;
  placeholder?: string;
  // 'toggle' (default): collapsed behind an icon button until tapped, then
  // expands — used by the task-list/approvals screens. 'pill': always
  // expanded, matching New Job's/New Service Job's own prominent search
  // field with a tappable search icon instead of a collapse toggle.
  variant?: 'toggle' | 'pill';
  // 'toggle' variant only — each screen's collapsed icon button looks
  // different (orange circle vs. plain white square) rather than one fixed
  // style, so this stays caller-driven instead of hardcoded.
  toggleStyle?: StyleProp<ViewStyle>;
  toggleIconColor?: string;
  // Row-level layout (flex/margins) the container needs to fit into its
  // parent row — left to the caller rather than assumed here.
  containerStyle?: StyleProp<ViewStyle>;
};

// Shared search field — ported from the reference design's own
// MobileSearchBar: tapping the X clears the text AND collapses back to the
// icon button in one action (not two taps), matching its clear()/collapse()
// being the same call.
export function SearchBar({
  value, onChangeText, onSubmit, onClear, placeholder = 'Search...',
  variant = 'toggle', toggleStyle, toggleIconColor = '#FFFFFF', containerStyle,
}: Props) {
  const [expanded, setExpanded] = useState(variant === 'pill');

  const handleClear = () => {
    if (onClear) onClear();
    else onChangeText('');
    setExpanded(false);
  };

  // Tapping the search icon (or the keyboard's own return/search key)
  // should always put the keyboard away — it wasn't before, since onSubmit
  // alone only ran the caller's search call and left focus (and the
  // keyboard) sitting on the input.
  const handleSubmit = () => {
    Keyboard.dismiss();
    onSubmit?.();
  };

  if (variant === 'pill') {
    return (
      <View style={[styles.pillBox, containerStyle]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
        />
        {!!value && (
          <TouchableOpacity onPress={handleClear} style={{ marginRight: 8 }}>
            <XCircle size={18} color="#D1D5DB" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleSubmit}>
          <Search size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    );
  }

  if (!expanded) {
    return (
      <TouchableOpacity
        style={[styles.toggleButton, toggleStyle]}
        onPress={() => setExpanded(true)}
      >
        <Search size={20} color={toggleIconColor} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.toggleBox, containerStyle]}>
      <Search size={18} color="#9CA3AF" />
      <TextInput
        autoFocus
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
      />
      {!!value && (
        <TouchableOpacity onPress={handleClear}>
          <XCircle size={18} color="#D1D5DB" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  toggleBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 48, paddingHorizontal: 14,
  },
  pillBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    borderWidth: 1, borderColor: '#FFC3A8',
    height: 52, paddingHorizontal: 18,
  },
  input: { flex: 1, fontSize: 15, color: '#1F2937' },
});
