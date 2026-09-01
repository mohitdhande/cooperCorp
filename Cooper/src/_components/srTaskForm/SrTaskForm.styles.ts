import { StyleSheet } from 'react-native';

// Styles specific to the SR task form's Step 6 (category & work-approval) UI.
// Shared step/section/field styles live in taskForm/TaskForm.styles.ts.
export const catStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  letterCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  letterText: {
    fontWeight: '700',
    fontSize: 14,
    color: '#374151',
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#241D67',
  },
  chevron: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  subList: {
    marginTop: 8,
    gap: 8,
    paddingLeft: 8,
  },
  subRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
  },
  subText: {
    fontSize: 14,
    color: '#475467',
    fontWeight: '500',
  },
  sendButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  sendButtonActive: {
    backgroundColor: '#241D67',
  },

  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lockedText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  statusIcon: {
    fontSize: 26,
    textAlign: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  statusSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});

export const statusCardColors: Record<string, { bg: string; border: string }> = {
  amber: { bg: '#FEF9C3', border: '#FDE68A' },
  blue: { bg: '#DBEAFE', border: '#BFDBFE' },
  green: { bg: '#DCFCE7', border: '#BBF7D0' },
};
