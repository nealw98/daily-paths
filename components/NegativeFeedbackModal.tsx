import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Keyboard,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useTypography } from '../hooks/useTypography';

interface NegativeFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reasons: {
    unclear?: boolean;
    tooLong?: boolean;
    notApplicable?: boolean;
    language?: boolean;
    otherText?: string;
  }) => void;
}

type ReasonKey = 'unclear' | 'tooLong' | 'notApplicable' | 'language' | 'other';

const REASON_OPTIONS: { key: ReasonKey; label: string }[] = [
  { key: 'unclear', label: 'Content is unclear' },
  { key: 'tooLong', label: 'Too long or wordy' },
  { key: 'notApplicable', label: 'Not relevant' },
  { key: 'language', label: 'Language/tone issues' },
  { key: 'other', label: 'Other' },
];

export const NegativeFeedbackModal: React.FC<NegativeFeedbackModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { colors } = useTheme();
  const { typography } = useTypography();
  const [selectedReason, setSelectedReason] = useState<ReasonKey | null>(null);
  const [detailText, setDetailText] = useState('');

  const detailTrimmed = detailText.trim();
  const canSubmit = selectedReason !== null && detailTrimmed.length > 0;

  const resetState = () => {
    setSelectedReason(null);
    setDetailText('');
  };

  const handleSubmit = () => {
    if (!canSubmit || !selectedReason) return;
    Keyboard.dismiss();
    onSubmit({
      unclear: selectedReason === 'unclear',
      tooLong: selectedReason === 'tooLong',
      notApplicable: selectedReason === 'notApplicable',
      language: selectedReason === 'language',
      otherText: detailTrimmed,
    });
    resetState();
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
    // Reset on close
    setTimeout(resetState, 300);
  };

  // Dynamic sizes — scale from bodyLargeFontSize so the baseline at
  // "medium" matches the previous fixed values (20/16/14).
  const titleFontSize = Math.round(typography.bodyLargeFontSize * (20 / 19));
  const bodyFontSize = Math.round(typography.bodyLargeFontSize * (16 / 19));
  const labelFontSize = Math.round(typography.bodyLargeFontSize * (14 / 19));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[styles.modalContainer, { backgroundColor: '#fff' }]}
          onPress={() => Keyboard.dismiss()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { fontSize: titleFontSize }]}>
              What could be improved?
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeIcon}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {REASON_OPTIONS.map(({ key, label }) => (
              <CheckboxOption
                key={key}
                label={label}
                checked={selectedReason === key}
                onToggle={() =>
                  setSelectedReason((prev) => (prev === key ? null : key))
                }
                colors={colors}
                labelFontSize={bodyFontSize}
              />
            ))}

            {selectedReason !== null && (
              <View style={styles.otherContainer}>
                <Text style={[styles.otherLabel, { fontSize: labelFontSize, color: colors.ink }]}>
                  Please tell us more about your rating (required)
                </Text>
                <TextInput
                  style={[
                    styles.otherInput,
                    {
                      fontSize: bodyFontSize,
                      color: colors.ink,
                      backgroundColor: '#dfe8e4',
                      borderColor: 'transparent',
                    },
                  ]}
                  placeholder="Share more details about your rating..."
                  value={detailText}
                  onChangeText={setDetailText}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  placeholderTextColor={colors.textSecondary + "50"}
                />
              </View>
            )}
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={[styles.cancelText, { fontSize: bodyFontSize }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <Text style={[styles.submitText, { fontSize: bodyFontSize }]}>Submit</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// Checkbox option component
interface CheckboxOptionProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  colors: ColorPalette;
  /** Dynamic label font size passed in from the parent so it stays aligned with the global text-size setting. */
  labelFontSize: number;
}

const CheckboxOption: React.FC<CheckboxOptionProps> = ({
  label,
  checked,
  onToggle,
  colors,
  labelFontSize,
}) => {
  return (
    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? colors.accent : '#fff',
            borderColor: checked ? colors.accent : colors.textSecondary,
          },
        ]}
      >
        {checked && (
          <Ionicons name="checkmark" size={16} color={colors.textOnAccent} />
        )}
      </View>
      <Text style={[styles.checkboxLabel, { fontSize: labelFontSize, color: colors.ink }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    // backgroundColor set inline via colors.cardBackground
    borderRadius: 16,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    // fontSize applied inline (titleFontSize).
    fontFamily: fonts.headerFamilyItalic,
    flex: 1,
  },
  closeIcon: {
    padding: 4,
  },
  content: {
    flexGrow: 0,
    flexShrink: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    // backgroundColor set inline via colors.background
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
  },
  checkboxLabel: {
    // fontSize applied inline (labelFontSize prop).
    fontFamily: fonts.bodyFamilyRegular,
    flex: 1,
  },
  otherContainer: {
    marginTop: 12,
  },
  otherLabel: {
    // fontSize applied inline (labelFontSize).
    fontFamily: fonts.bodyFamilyRegular,
    marginBottom: 8,
  },
  otherInput: {
    // fontSize applied inline (bodyFontSize).
    fontFamily: fonts.bodyFamilyRegular,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    borderWidth: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelText: {
    // fontSize applied inline (bodyFontSize).
    fontFamily: fonts.bodyFamilyRegular,
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitText: {
    // fontSize applied inline (bodyFontSize).
    fontFamily: fonts.bodyFamilyRegular,
    color: '#fff', // intentional: white text on accent-colored submit button
    fontWeight: '600',
  },
});

