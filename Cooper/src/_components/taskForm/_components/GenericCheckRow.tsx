
import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { styles } from '../TaskForm.styles';
import { CheckItem, CheckItemStatus } from '@/models/taskForm.types';
type GenericCheckRowProps = {
  index: number;
  item: CheckItem;
  onSetStatus: (status: CheckItemStatus) => void;
  onChangeDescription: (text: string) => void;
  onSaveComment: () => void;
  onEditComment: () => void;
};

 export const GenericCheckRow: React.FC<GenericCheckRowProps> = ({
  index, item, onSetStatus, onChangeDescription, onSaveComment, onEditComment,
}) => {
  return (
    <View style={styles.checkItemBlock}>
      <Text style={styles.checkItemQuestion}>
        {index}. {item.question}
      </Text>

      <View style={styles.okNotOkRow}>
        <TouchableOpacity
          style={[styles.okButton, item.status === 'OK' && styles.okButtonActive]}
          onPress={() => onSetStatus('OK')}
        >
          <Text style={[styles.okButtonText, item.status === 'OK' && styles.okButtonTextActive]}>OK</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.notOkButton, item.status === 'NOT_OK' && styles.notOkButtonActive]}
          onPress={() => onSetStatus('NOT_OK')}
        >
          <Text style={[styles.notOkButtonText, item.status === 'NOT_OK' && styles.notOkButtonTextActive]}>
            Not OK
          </Text>
        </TouchableOpacity>

        {item.hasNA && (
          <TouchableOpacity
            style={[styles.naButton, item.status === 'NA' && styles.naButtonActive]}
            onPress={() => onSetStatus('NA')}
          >
            <Text style={[styles.naButtonText, item.status === 'NA' && styles.naButtonTextActive]}>N/A</Text>
          </TouchableOpacity>
        )}
      </View>

      {item.status === 'NOT_OK' && (
        <>
          {item.itemSaved && !item.editingComment ? (
            <View style={styles.savedCommentRow}>
              <Text style={[
                styles.savedCommentText,
                !item.issueDescription && styles.savedCommentPlaceholder,
              ]}>
                {item.issueDescription || 'No comment added'}
              </Text>
              <TouchableOpacity onPress={onEditComment}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.issueInput}
                placeholder="Describe the issue..."
                placeholderTextColor="#D1A3A3"
                value={item.issueDescription}
                onChangeText={onChangeDescription}
                multiline
              />
              <TouchableOpacity style={styles.itemSaveButton} onPress={onSaveComment}>
                <Text style={styles.itemSaveButtonText}>✓  Save</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </View>
  );
};
