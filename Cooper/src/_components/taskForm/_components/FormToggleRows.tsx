import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { styles } from '../TaskForm.styles';

type CheckToggleRowProps = {
  index: number;
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

export const TwoOptionToggleRow: React.FC<TwoOptionToggleRowProps> = ({
  index,
  question,
  subtext,
  optionA,
  optionB,
  value,
  onSetValue,
  commentTriggerValue,
  comment,
  onSetComment,
}) => {
  const isA = value === optionA;
  const isB = value === optionB;
  const showComment = !!commentTriggerValue && value === commentTriggerValue && !!onSetComment;

  return (
    <View style={styles.checkItemBlock}>
      <Text style={styles.checkItemQuestion}>{index}. {question}</Text>
      {subtext ? (
        <Text style={{ color: '#3B82F6', fontStyle: 'italic', fontSize: 13, marginBottom: 8 }}>
          {subtext}
        </Text>
      ) : null}
      <View style={styles.okNotOkRow}>
        <TouchableOpacity
          style={[styles.okButton, isA && styles.okButtonActive]}
          onPress={() => onSetValue(optionA)}
        >
          <Text style={[styles.okButtonText, isA && styles.okButtonTextActive]}>{optionA}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.notOkButton, isB && styles.notOkButtonActive]}
          onPress={() => onSetValue(optionB)}
        >
          <Text style={[styles.notOkButtonText, isB && styles.notOkButtonTextActive]}>{optionB}</Text>
        </TouchableOpacity>
      </View>

      {showComment && (
        <TextInput
          style={styles.issueInput}
          placeholder="Add a comment..."
          placeholderTextColor="#D1A3A3"
          value={comment}
          onChangeText={onSetComment}
          multiline
        />
      )}
    </View>
  );
};

export const MultiOptionToggleRow: React.FC<MultiOptionToggleRowProps> = ({
  index,
  question,
  options,
  value,
  onSetValue,
}) => (
  <View style={styles.checkItemBlock}>
    <Text style={styles.checkItemQuestion}>{index}. {question}</Text>
    <View style={[styles.okNotOkRow, { flexWrap: 'wrap' }]}> 
      {options.map(opt => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.okButton, active && styles.okButtonActive, { marginBottom: 8, marginRight: 8 }]}
            onPress={() => onSetValue(opt)}
          >
            <Text style={[styles.okButtonText, active && styles.okButtonTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

export const CheckToggleRow: React.FC<CheckToggleRowProps> = React.memo(({
  index,
  question,
  value,
  comment,
  hasNA = false,
  onSetValue,
  onSetComment,
}) => {
  const normalized = value?.toUpperCase();
  const isNotOk = normalized === 'NOT OK';
  const isOk = normalized === 'OK';
  const isNA = normalized === 'N/A';

  return (
    <View style={styles.checkItemBlock}>
      <Text style={styles.checkItemQuestion}>{index}. {question}</Text>

      <View style={styles.okNotOkRow}>
        <TouchableOpacity
          style={[styles.okButton, isOk && styles.okButtonActive]}
          onPress={() => onSetValue('OK')}
        >
          <Text style={[styles.okButtonText, isOk && styles.okButtonTextActive]}>OK</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.notOkButton, isNotOk && styles.notOkButtonActive]}
          onPress={() => onSetValue('Not OK')}
        >
          <Text style={[styles.notOkButtonText, isNotOk && styles.notOkButtonTextActive]}>Not OK</Text>
        </TouchableOpacity>

        {hasNA && (
          <TouchableOpacity
            style={[styles.naButton, isNA && styles.naButtonActive]}
            onPress={() => onSetValue('N/A')}
          >
            <Text style={[styles.naButtonText, isNA && styles.naButtonTextActive]}>N/A</Text>
          </TouchableOpacity>
        )}
      </View>

      {isNotOk && (
        <TextInput
          style={styles.issueInput}
          placeholder="Describe the issue..."
          placeholderTextColor="#D1A3A3"
          value={comment}
          onChangeText={onSetComment}
          multiline
        />
      )}
    </View>
  );
});
