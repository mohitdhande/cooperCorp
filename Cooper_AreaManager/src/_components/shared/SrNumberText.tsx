import { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { Text } from '@/_components/AppText';
import { formatSrNumber } from '../../utils/reportFormatters';

type Props = {
  srNumber: string;
  style?: any;
  numberOfLines?: number;
};

// Tap to toggle between the parsed human-readable date ("14 Aug 26 · 255",
// the default) and the raw SR number ("14082600000255"). Shared by every
// spot in the app that shows a task's srNumber — the caller keeps its own
// pill/container styling and just renders this in place of a plain <Text>,
// so the same tap-to-reveal behavior is guaranteed identical everywhere
// instead of being hand-rolled (and inconsistently applied, or missing
// entirely) per screen.
export function SrNumberText({ srNumber, style, numberOfLines }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <TouchableOpacity onPress={() => setShowRaw((v) => !v)} hitSlop={6} activeOpacity={0.6}>
      <Text style={style} numberOfLines={numberOfLines}>
        {showRaw ? srNumber : formatSrNumber(srNumber)}
      </Text>
    </TouchableOpacity>
  );
}
