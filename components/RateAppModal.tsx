import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { colors, fonts } from '../constants/theme';
import { openAppStoreForRating, markRatePromptDismissed } from '../utils/rateShareTracking';
import { qaLog } from '../utils/qaLog';

interface RateAppModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RateAppModal: React.FC<RateAppModalProps> = ({
  visible,
  onClose,
}) => {

  const handleRateApp = async () => {
    qaLog("rate", "User tapped Rate App in modal - opening App Store");
    await openAppStoreForRating();
    onClose();
  };

  const handleNotNow = async () => {
    qaLog("rate", "User dismissed rate modal with Not Now");
    await markRatePromptDismissed();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleNotNow}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleNotNow}
      >
        <View 
          style={styles.toast}
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.title}>Enjoying Daily Paths?</Text>
          <Text style={styles.message}>
            Your rating helps others discover this app.
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.dismissButton} onPress={handleNotNow}>
              <Text style={styles.dismissText}>Not Now</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.rateButton} onPress={handleRateApp}>
              <Text style={styles.rateButtonText}>Rate App</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  toast: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 26,
    color: colors.deepTeal,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    color: colors.ink,
    lineHeight: 26,
    marginBottom: 28,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  dismissButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.mist,
  },
  dismissText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    color: colors.ocean,
  },
  rateButton: {
    backgroundColor: colors.deepTeal,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  rateButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    color: '#fff',
    fontWeight: '600',
  },
});
