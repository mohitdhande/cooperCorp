import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    otpSubCard: {
  backgroundColor: '#F9FAFB',
  borderRadius: 16,
  padding: 18,
  marginTop: 16,
},
otpSubCardTitle: {
  fontSize: 12,
  fontWeight: '700',
  color: '#9CA3AF',
  letterSpacing: 0.5,
  textAlign: 'center',
  marginBottom: 14,
},
assetLoadingRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 10,
  paddingHorizontal: 4,
},
readingsSavedBox: {
  backgroundColor: '#F0FDF4',
  borderRadius: 12,
  padding: 14,
  marginTop: 16,
  borderWidth: 1,
  borderColor: '#BBF7D0',
},
readingsSavedTitle: {
  fontSize: 15,
  fontWeight: '700',
  color: '#15803D',
},
readingsSavedMeta: {
  fontSize: 13,
  color: '#16A34A',
  marginTop: 3,
},
toastContainer: {
  position: 'absolute',
  top: 60,
  left: 20,
  right: 20,
  zIndex: 999,
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 20,
  flexDirection: 'row',
  alignItems: 'center',
  elevation: 10,
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
},
toastSuccess: {
  backgroundColor: '#16A34A',
},
toastError: {
  backgroundColor: '#DC2626',
},
toastText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 14,
  flex: 1,
},
assetLoadingText: {
  marginLeft: 8,
  color: '#F26722',
  fontSize: 13,
  fontWeight: '500',
},
sectionSaveButtonSuccess: {
  backgroundColor: '#16A34A',
},
sectionSaveButtonDisabled: {
  opacity: 0.6,
},
sectionErrorText: {
  color: '#DC2626',
  fontSize: 13,
  marginBottom: 8,
  textAlign: 'center',
},
generateOtpButton: {
  backgroundColor: '#F26722',
  borderRadius: 12,
  paddingVertical: 16,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},
generateOtpButtonText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 15,
},
otpShareText: {
  textAlign: 'center',
  color: '#6B7280',
  fontSize: 13,
  marginBottom: 16,
},
otpDigitsRow: {
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 12,
},
otpDigitBox: {
  width: 52,
  height: 52,
  borderRadius: 12,
  borderWidth: 1.5,
  borderColor: '#F26722',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#fff',
},
otpDigitText: {
  fontSize: 20,
  fontWeight: '700',
  color: '#1F2937',
},
regenerateLink: {
  color: '#6B7280',
  fontSize: 14,
  textDecorationLine: 'underline',
},
otpInputRow: {
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 12,
  marginBottom: 20,
},
otpInputBox: {
  width: 52,
  height: 52,
  borderRadius: 12,
  borderWidth: 1.5,
  borderColor: '#E5E7EB',
  backgroundColor: '#fff',
  fontSize: 20,
  fontWeight: '700',
  color: '#1F2937',
},
verifyCompleteButton: {
  backgroundColor: '#86EFAC',
  borderRadius: 14,
  paddingVertical: 16,
  alignItems: 'center',
},
verifyCompleteButtonText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 16,
},
    feedbackTextArea: {
  minHeight: 140,
  maxHeight: 140,
  textAlignVertical: 'top',
  paddingTop: 12,
},
    // Modal styles for photo options
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  optionRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  optionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },

    
    photoGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  marginTop: 14,
  marginBottom: 4,
},
photoThumbWrapper: {
  width: 100,
  marginRight: 12,
  marginBottom: 12,
},
photoThumb: {
  width: 100,
  height: 100,
  borderRadius: 12,
  backgroundColor: '#E5E7EB',
},
photoRemoveBadge: {
  position: 'absolute',
  top: -6,
  right: -6,
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: '#1F2937',
  justifyContent: 'center',
  alignItems: 'center',
},
photoRemoveBadgeText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: '700',
},
photoNameTag: {
  position: 'absolute',
  bottom: 4,
  left: 4,
  right: 4,
  backgroundColor: 'rgba(0,0,0,0.55)',
  borderRadius: 6,
  paddingHorizontal: 6,
  paddingVertical: 2,
},
photoNameText: {
  color: '#fff',
  fontSize: 10,
},

addPhotoBox: {
  borderWidth: 1.5,
  borderColor: '#D1D5DB',
  borderStyle: 'dashed',
  borderRadius: 16,
  paddingVertical: 32,
  alignItems: 'center',
  marginTop: 14,
},
addPhotoIconCircle: {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: '#F3F4F6',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 12,
},
addPhotoIcon: {
  fontSize: 20,
},
addPhotoTitle: {
  fontSize: 16,
  fontWeight: '700',
  color: '#1F2937',
  marginBottom: 4,
},
addPhotoSubtitle: {
  fontSize: 13,
  color: '#9CA3AF',
},
photoCountText: {
  textAlign: 'center',
  color: '#6B7280',
  fontSize: 13,
  marginTop: 12,
},
    // Add Part button
addPartButton: {
  borderWidth: 1.5,
  borderColor: '#F26722',
  borderStyle: 'dashed',
  borderRadius: 12,
  paddingVertical: 14,
  alignItems: 'center',
  marginTop: 8,
},
addPartButtonText: {
  color: '#F26722',
  fontWeight: '700',
  fontSize: 15,
},

// Selected part card
partCard: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#F9FAFB',
  borderRadius: 14,
  padding: 14,
  marginBottom: 12,
},
partCardInfo: {
  flex: 1,
},
partCardCodeRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 4,
},
partCardCode: {
  fontSize: 13,
  fontWeight: '700',
  color: '#1F2937',
  marginRight: 8,
},
partCardUnit: {
  fontSize: 11,
  color: '#9CA3AF',
  fontWeight: '600',
},
partCardName: {
  fontSize: 14,
  color: '#374151',
},
partCardControls: {
  flexDirection: 'row',
  alignItems: 'center',
},
qtyButton: {
  width: 28,
  height: 28,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: '#D1D5DB',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#fff',
},
qtyButtonText: {
  fontSize: 16,
  fontWeight: '700',
  color: '#374151',
},
qtyValue: {
  width: 32,
  textAlign: 'center',
  fontSize: 15,
  fontWeight: '700',
  color: '#1F2937',
},
removePartButton: {
  width: 28,
  height: 28,
  borderRadius: 14,
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: 10,
},
removePartButtonText: {
  fontSize: 16,
  color: '#DC2626',
  fontWeight: '700',
},

// Part picker modal
partModalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.4)',
  justifyContent: 'flex-end',
},
partModalSheet: {
  backgroundColor: '#fff',
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  paddingHorizontal: 20,
  paddingTop: 20,
  height: '80%',
},
partModalHeaderRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
},
partModalTitle: {
  fontSize: 19,
  fontWeight: '700',
  color: '#1F2937',
},
partModalCloseIcon: {
  fontSize: 20,
  color: '#6B7280',
},
partSearchBox: {
  flexDirection: 'row',
  alignItems: 'center',
  borderWidth: 1.5,
  borderColor: '#F26722',
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 12,
  marginBottom: 16,
},
partSearchIcon: {
  fontSize: 14,
  marginRight: 8,
  color: '#9CA3AF',
},
partSearchInput: {
  flex: 1,
  fontSize: 15,
  color: '#1F2937',
},
partCategoryLabel: {
  fontSize: 11,
  fontWeight: '700',
  color: '#9CA3AF',
  letterSpacing: 0.5,
  backgroundColor: '#F3F4F6',
  paddingVertical: 8,
  paddingHorizontal: 4,
},
partRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 14,
  paddingHorizontal: 4,
  borderBottomWidth: 1,
  borderBottomColor: '#F3F4F6',
},
partCodeBox: {
  backgroundColor: '#F3F4F6',
  borderRadius: 8,
  paddingHorizontal: 8,
  paddingVertical: 4,
  marginRight: 10,
},
partCodeText: {
  fontSize: 12,
  fontWeight: '700',
  color: '#374151',
},
unitBadge: {
  borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 4,
  marginRight: 10,
},
unitBadgeRed: {
  backgroundColor: '#FEE2E2',
},
unitBadgeTextRed: {
  color: '#DC2626',
},
unitBadgeOrange: {
  backgroundColor: '#FFEDD5',
},
unitBadgeTextOrange: {
  color: '#C2410C',
},
unitBadgeText: {
  fontSize: 11,
  fontWeight: '700',
},
partNameText: {
  fontSize: 15,
  color: '#1F2937',
  flexShrink: 1,
},
    fieldThird: {
    width: '31%',
  },

  stepperInputWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  stepperInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  stepperArrows: {
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    width: 26,
  },
  stepperArrowButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperArrowText: {
    fontSize: 8,
    color: '#9CA3AF',
  },
  stepperArrowDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dropdownSheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: 350,
    overflow: 'hidden',
  },
  dropdownOptionRow: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownOptionRowSelected: {
    backgroundColor: '#DBEAFE',
  },
  dropdownOptionText: {
    fontSize: 15,
    color: '#1E3A8A',
  },

  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
  },

appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#241D67',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoEmoji: {
    fontSize: 16,
  },
  logoImage: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  fixedBottomActions: {
  flexDirection: 'row',
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 16,
  backgroundColor: '#F5F7FA',
  borderTopWidth: 1,
  borderTopColor: '#E5E7EB',
  gap: 12,
},
drawerIconButton: {
  padding: 6, gap: 5, justifyContent: 'center',
},

hamburgerLine: {
  width: 22, height: 2.5,
  backgroundColor: '#fff', borderRadius: 2,
  marginVertical: 2,
},
appBarAvatar: {
  width: 34, height: 34, borderRadius: 17,
  borderWidth: 2, borderColor: '#fff',
  marginRight: 10,
},
appBarAvatarFallback: {
  width: 34, height: 34, borderRadius: 17,
  backgroundColor: '#F26722',
  justifyContent: 'center', alignItems: 'center',
  marginRight: 10,
},
appBarAvatarText: {
  color: '#fff', fontWeight: '700', fontSize: 14,
},
brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 12,
  },
  signOutIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },

  myTasksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  myTasksArrow: {
    fontSize: 22,
    color: '#6B7280',
    marginRight: 4,
  },
  myTasksText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },

  stepperCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  stepperHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  taskLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 10,
  },
  typeBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
  },
  typeBadgeText: {
    color: '#7E22CE',
    fontWeight: '600',
    fontSize: 13,
  },
  stepperScroll: {
    flexDirection: 'row',
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#F26722',
  },
  stepCircleDone: {
    backgroundColor: '#16A34A',
  },
  stepCircleText: {
    color: '#9CA3AF',
    fontWeight: '700',
  },
  stepCircleTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
  },

  stepHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.5,
  },
  missingPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  missingPillText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },

  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  fieldHalf: {
    width: '48%',
  },
  fieldFull: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F26722',
    marginBottom: 6,
  },
  fieldLabelStatic: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#fff',
  },
  fieldStaticValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  dropdownInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  dropdownText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  dropdownArrow: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  toggleRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  toggleOptionActive: {
    backgroundColor: '#FFEDD5',
  },
  toggleText: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#C2410C',
  },

  sectionSaveButton: {
    backgroundColor: '#F26722',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  sectionSaveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  placeholderStep: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  placeholderStepText: {
    color: '#9CA3AF',
    fontSize: 15,
  },

  bottomActionRow: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    paddingVertical: 12,
    marginTop: 8,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '700',
  },
  nextButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F26722',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: '700',
  },

  bottomBar: {
    height: 70,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bottomTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBottomTab: {
    color: '#F26722',
    fontWeight: '700',
  },
  inactiveBottomTab: {
    color: '#98A2B3',
    fontWeight: '600',
  },

  bigFormCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  bigFormTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  bigFormSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  groupDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 14,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupStatusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F26722',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  groupStatusCircleSaved: {
    backgroundColor: '#16A34A',
  },
  groupStatusCircleD: {
    backgroundColor: '#F26722',
  },
  groupStatusCircleText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  groupStatusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  groupStatusPillSaved: {
    backgroundColor: '#DCFCE7',
  },
  groupStatusPillUnsaved: {
    backgroundColor: '#FFEDD5',
  },
  groupStatusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  groupStatusPillTextSaved: {
    color: '#15803D',
  },
  groupStatusPillTextUnsaved: {
    color: '#C2410C',
  },

  checkItemBlock: {
    marginBottom: 20,
  },
  checkItemQuestion: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  okNotOkRow: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  okButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  okButtonActive: {
    backgroundColor: '#16A34A',
  },
  okButtonText: {
    color: '#9CA3AF',
    fontWeight: '700',
  },
  okButtonTextActive: {
    color: '#fff',
  },
  notOkButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  notOkButtonActive: {
    backgroundColor: '#DC2626',
  },
  notOkButtonText: {
    color: '#9CA3AF',
    fontWeight: '700',
  },
  notOkButtonTextActive: {
    color: '#fff',
  },
  naButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  naButtonActive: {
    backgroundColor: '#9CA3AF',
  },
  naButtonText: {
    color: '#9CA3AF',
    fontWeight: '700',
  },
  naButtonTextActive: {
    color: '#fff',
  },

  issueInput: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    marginTop: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  itemSaveButton: {
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  itemSaveButtonOrange: {
    backgroundColor: '#F26722',
  },
  itemSaveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  savedCommentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  savedCommentText: {
    flex: 1,
    color: '#7F1D1D',
    fontSize: 14,
  },
  savedCommentPlaceholder: {
    color: '#D1A3A3',
    fontStyle: 'italic',
  },
  editLink: {
    color: '#DC2626',
    fontWeight: '700',
    marginLeft: 10,
  },

  groupSaveButton: {
    backgroundColor: '#F26722',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  groupSaveButtonSaved: {
    backgroundColor: '#16A34A',
  },
  groupSaveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  numericSubLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  numericFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  numericFieldThird: {
    width: '31%',
  },
  numericFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  numericFieldInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#fff',
  },

  loadStageCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  loadStageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadStageLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 10,
  },
  durationPill: {
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 'auto',
  },
  durationPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  progressPill: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressPillText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },

  uploadPhotoBox: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  uploadPhotoIcon: {
    fontSize: 22,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  uploadPhotoText: {
    color: '#9CA3AF',
    fontSize: 14,
  },

  // ── Step 3: Complaint Codes ──

  addCodeButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  addCodeButtonText: {
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 15,
  },

  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Selected complaint code card
  complaintCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  complaintCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  complaintCardRemoveButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  complaintCardRemoveIcon: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
  },
  complaintCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 10,
  },
  complaintCardBreadcrumb: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  complaintCardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  complaintFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  complaintTextArea: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 56,
    textAlignVertical: 'top',
    backgroundColor: '#F9FAFB',
  },

  // Picker modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '75%',
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pickerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pickerBackButton: {
    marginRight: 8,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  pickerBackArrow: {
    fontSize: 26,
    color: '#374151',
  },
  pickerBreadcrumb: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  pickerHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  pickerCloseIcon: {
    fontSize: 18,
    color: '#6B7280',
    paddingTop: 2,
  },

  pickerSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  pickerSearchIcon: {
    fontSize: 14,
    marginRight: 8,
    opacity: 0.6,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    padding: 0,
  },

  pickerList: {
    flexGrow: 0,
  },
  pickerEmptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    paddingVertical: 24,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  pickerRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerRowCount: {
    fontSize: 13,
    color: '#9CA3AF',
    marginRight: 6,
  },
  pickerRowChevron: {
    fontSize: 18,
    color: '#D1D5DB',
  },

  pickerCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerCodeTag: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  pickerCodeTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
 pickerCodeTitle: {
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 10,
    flex: 1,
  },// ... paste the ENTIRE styles object exactly as-is, unchanged
});