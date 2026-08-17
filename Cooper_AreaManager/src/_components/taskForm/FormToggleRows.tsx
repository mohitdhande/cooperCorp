import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TextInput } from '@/_components/AppTextInput';
import { Text } from '@/_components/AppText';
import { X, Check } from 'lucide-react-native';

type CheckToggleRowProps = {
  // null hides the numeric prefix entirely — for rows nested under one
  // already-numbered group heading (e.g. Electricity Board (Mains)'s own
  // phase rows, all grouped under item 11) rather than each getting its
  // own sequential number.
  index: number | null;
  question: string;
  value: string;
  comment: string;
  hasNA?: boolean;
  onSetValue: (v: string) => void;
  onSetComment: (v: string) => void;
};

type TwoOptionToggleRowProps = {
  index: string;
  question: string;
  subtext?: string;
  optionA: string;
  optionB: string;
  value: string;
  onSetValue: (v: string) => void;
  commentTriggerValue?: string;
  comment?: string;
  onSetComment?: (v: string) => void;
};

type MultiOptionToggleRowProps = {
  index: string;
  question: string;
  options: string[];
  value: string;
  onSetValue: (v: string) => void;
};

type ToggleRowCoreProps = {
  indexLabel: string;
  alt: boolean;
  question: string;
  subtext?: string;
  optionA: string;
  optionB: string;
  value: string;
  onSetValue: (v: string) => void;
  hasNA?: boolean;
  naValue?: string;
  commentTriggerValue?: string;
  comment?: string;
  onSetComment?: (v: string) => void;
  commentPlaceholder?: string;
};

// Shared rendering for a checklist row: a zero-padded/numbered index +
// question label on the left, a joined X/check(/N/A) pill on the right,
// zebra-striped against its neighbors, plus an optional comment box that
// reveals once `value` matches `commentTriggerValue`. Both CheckToggleRow
// (Commissioning's fixed OK/Not OK/N/A checks) and TwoOptionToggleRow
// (Revalidation's per-row option pairs — Ok/Replaced, Ok/Arrested, Dusty/
// Clean, ...) are thin wrappers over this — they used to be two separately
// hand-written components with their own copy of this exact layout, which
// is how the X/check-to-option binding drifted apart between them (one
// correct, one backwards) instead of ever needing fixing in more than one
// place. The X button is always bound to optionB (the "needs attention"
// state — Replaced/Not OK/Arrested/Corrected/Dusty — and whatever
// commentTriggerValue actually is) and the check button to optionA (the
// "Ok" state), never a positional optionA-under-X split.
//
// Matching is case-insensitive against the stored value (trim + uppercase)
// — CheckToggleRow's original behavior, kept here since commissioningChecks
// can carry values loaded straight from the backend, not just ones this
// button pair itself wrote.
function ToggleRowCore({
  indexLabel, alt, question, subtext, optionA, optionB, value, onSetValue,
  hasNA = false, naValue = 'N/A', commentTriggerValue, comment, onSetComment,
  commentPlaceholder = 'Add a comment...',
}: ToggleRowCoreProps) {
  const normalized = value?.trim().toUpperCase();
  const isA = normalized === optionA.toUpperCase();
  const isB = normalized === optionB.toUpperCase();
  const isNA = hasNA && normalized === naValue.toUpperCase();
  const showComment = !!commentTriggerValue && normalized === commentTriggerValue.toUpperCase() && !!onSetComment;

  return (
    <View style={[styles.row, alt && styles.rowAlt]}>
      <View style={styles.rowMain}>
        {/* flex:1 goes on this wrapping View, not the Text itself — a Text
            node with flex:1 that then wraps to 2 lines miscalculates the
            row's remaining width on Android, pushing the toggle pill
            outside the card. */}
        <View style={styles.rowLabelGroup}>
          <Text style={styles.rowLabel}>
            {!!indexLabel && <Text style={styles.rowIndex}>{indexLabel} </Text>}
            {question}
          </Text>
          {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
        </View>

        <View style={styles.togglePill}>
          <TouchableOpacity
            style={[styles.toggleButton, styles.toggleButtonLeft, isB && styles.toggleButtonNotOkActive]}
            onPress={() => onSetValue(optionB)}
          >
            <X size={20} strokeWidth={2.5} color={isB ? '#FFFFFF' : '#BBBBBB'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, !hasNA && styles.toggleButtonRight, isA && styles.toggleButtonOkActive]}
            onPress={() => onSetValue(optionA)}
          >
            <Check size={20} strokeWidth={2.5} color={isA ? '#FFFFFF' : '#BBBBBB'} />
          </TouchableOpacity>
          {hasNA && (
            <TouchableOpacity
              style={[styles.toggleButton, styles.toggleButtonRight, isNA && styles.toggleButtonNaActive]}
              onPress={() => onSetValue(naValue)}
            >
              <Text style={[styles.toggleButtonNaText, isNA && styles.toggleButtonNaTextActive]}>{naValue}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showComment && (
        <TextInput
          style={styles.issueInput}
          placeholder={commentPlaceholder}
          placeholderTextColor="#D1A3A3"
          value={comment}
          onChangeText={onSetComment}
          multiline
        />
      )}
    </View>
  );
}

// Commissioning's own checklist row — fixed OK/Not OK(/N/A) vocabulary,
// numbered as a zero-padded 2-digit index ("01", "02", ...).
export const CheckToggleRow: React.FC<CheckToggleRowProps> = React.memo(({
  index, question, value, comment, hasNA = false, onSetValue, onSetComment,
}) => (
  <ToggleRowCore
    indexLabel={index === null ? '' : String(index).padStart(2, '0')}
    alt={index !== null && index % 2 === 0}
    question={question}
    optionA="OK"
    optionB="Not OK"
    value={value}
    onSetValue={onSetValue}
    hasNA={hasNA}
    commentTriggerValue="Not OK"
    comment={comment}
    onSetComment={onSetComment}
    commentPlaceholder="Describe the issue..."
  />
));

// Revalidation's checklist row — a caller-supplied pair of option labels
// (e.g. "Ok"/"Replaced") instead of the fixed OK/Not OK pair, since its
// rows don't share one vocabulary. Numbered as "{index}. " (with a
// trailing period, unlike CheckToggleRow's zero-padded bare number).
export const TwoOptionToggleRow: React.FC<TwoOptionToggleRowProps> = ({
  index, question, subtext, optionA, optionB, value, onSetValue,
  commentTriggerValue, comment, onSetComment,
}) => {
  const numericIndex = Number(index);
  return (
    <ToggleRowCore
      indexLabel={`${index}.`}
      alt={!Number.isNaN(numericIndex) && numericIndex % 2 === 0}
      question={question}
      subtext={subtext}
      optionA={optionA}
      optionB={optionB}
      value={value}
      onSetValue={onSetValue}
      commentTriggerValue={commentTriggerValue}
      comment={comment}
      onSetComment={onSetComment}
    />
  );
};

// A checklist row offering more than two mutually-exclusive option chips.
export const MultiOptionToggleRow: React.FC<MultiOptionToggleRowProps> = ({
  index, question, options, value, onSetValue,
}) => (
  <View style={styles.checkItemBlock}>
    <Text style={styles.checkItemQuestion}>{index}. {question}</Text>
    <View style={[styles.okNotOkRow, styles.wrapRow]}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.okButton, active && styles.okButtonActive, styles.wrapItem]}
            onPress={() => onSetValue(opt)}
          >
            <Text style={[styles.okButtonText, active && styles.okButtonTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

const styles = StyleSheet.create({
  // ToggleRowCore's own layout — a flat, zebra-striped list row (no
  // per-item card), distinct from checkItemBlock below which is still used
  // by MultiOptionToggleRow's unchanged text-pill look.
  row: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  rowAlt: {
    backgroundColor: '#F8F9FA',
  },
  rowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rowLabelGroup: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F0F0F',
    lineHeight: 21,
  },
  rowIndex: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
  // The joined X/check pill — outer corners rounded, inner corners sharp,
  // matching the pasted "Check Blaock" component exactly.
  togglePill: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBDBDB',
    padding: 4,
    gap: 4,
  },
  toggleButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBDBDB',
  },
  toggleButtonLeft: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  toggleButtonRight: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  toggleButtonNotOkActive: {
    backgroundColor: '#FA6868',
    borderColor: '#E75A5A',
  },
  toggleButtonOkActive: {
    backgroundColor: '#4AC686',
    borderColor: '#33A86B',
  },
  toggleButtonNaActive: {
    backgroundColor: '#E5E7EB',
    borderColor: '#9CA3AF',
  },
  toggleButtonNaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#BBBBBB',
  },
  toggleButtonNaTextActive: {
    color: '#374151',
  },
  checkItemBlock: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  checkItemQuestion: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 10,
  },
  subtext: {
    color: '#3B82F6',
    fontStyle: 'italic',
    fontSize: 13,
    marginBottom: 8,
  },
  okNotOkRow: {
    flexDirection: 'row',
  },
  wrapRow: {
    flexWrap: 'wrap',
  },
  wrapItem: {
    marginBottom: 8,
    marginRight: 8,
  },
  okButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  okButtonActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  okButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  okButtonTextActive: {
    color: '#15803D',
  },
  notOkButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  notOkButtonActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  notOkButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  notOkButtonTextActive: {
    color: '#DC2626',
  },
  issueInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#1F2937',
    minHeight: 44,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
});
