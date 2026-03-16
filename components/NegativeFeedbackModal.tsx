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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, type ColorPalette } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

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

export const NegativeFeedbackModal: React.FC<NegativeFeedbackModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { colors } = useTheme();
  const [reasons, setReasons] = useState({
    unclear: false,
    tooLong: false,
    notApplicable: false,
    language: false,
    otherText: '',
  });

  const handleSubmit = () => {
    onSubmit(reasons);
    // Reset for next time
    setReasons({
      unclear: false,
      tooLong: false,
      notApplicable: false,
      language: false,
      otherText: '',
    });
  };

  const handleClose = () => {
    onClose();
    // Reset on close
    setTimeout(() => {
      setReasons({
        unclear: false,
        tooLong: false,
        notApplicable: false,
        language: false,
        otherText: '',
      });
    }, 300);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        <View
          style={[styles.modalContainer, { backgroundColor: colors.cardBackground }]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => Keyboard.dismiss()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>What could be improved?</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeIcon}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <CheckboxOption
              label="Content is unclear"
              checked={reasons.unclear}
              onToggle={() => setReasons((r) => ({ ...r, unclear: !r.unclear }))}
              colors={colors}
            />
            <CheckboxOption
              label="Too long or wordy"
              checked={reasons.tooLong}
              onToggle={() => setReasons((r) => ({ ...r, tooLong: !r.tooLong }))}
              colors={colors}
            />
            <CheckboxOption
              label="Not relevant"
              checked={reasons.notApplicable}
              onToggle={() =>
                setReasons((r) => ({ ...r, notApplicable: !r.notApplicable }))
              }
              colors={colors}
            />
            <CheckboxOption
              label="Language/tone issues"
              checked={reasons.language}
              onToggle={() => setReasons((r) => ({ ...r, language: !r.language }))}
              colors={colors}
            />

            <View style={styles.otherContainer}>
              <Text style={styles.otherLabel}>Other (optional)</Text>
              <TextInput
                style={styles.otherInput}
                placeholder="Tell us more..."
                value={reasons.otherText}
                onChangeText={(text) => setReasons((r) => ({ ...r, otherText: text }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor={colors.ocean}
              />
            </View>
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// Checkbox option component
interface CheckboxOptionProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  colors: ColorPalette;
}

const CheckboxOption: React.FC<CheckboxOptionProps> = ({
  label,
  checked,
  onToggle,
  colors,
}) => {
  return (
    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, { backgroundColor: colors.background }, checked && styles.checkboxChecked]}>
        {checked && (
          <Ionicons name="checkmark" size={16} color="#fff" />
        )}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
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
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 20,
    flex: 1,
  },
  closeIcon: {
    padding: 4,
  },
  content: {
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
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    flex: 1,
  },
  otherContainer: {
    marginTop: 12,
  },
  otherLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    marginBottom: 8,
  },
  otherInput: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
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
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  submitText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: '#fff', // intentional: white text on accent-colored submit button
    fontWeight: '600',
  },
});

