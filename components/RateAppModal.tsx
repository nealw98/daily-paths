import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { fonts } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAnalytics } from '../utils/analytics';
import { openAppStoreForRating, markRatePromptDismissed } from '../utils/rateShareTracking';
import { qaLog } from '../utils/qaLog';

type RateTrigger = 'bookmark' | 'positive_feedback' | 'settings_button';

interface RateAppModalProps {
  visible: boolean;
  onClose: () => void;
  trigger?: RateTrigger;
}

export const RateAppModal: React.FC<RateAppModalProps> = ({
  visible,
  onClose,
  trigger = 'settings_button',
}) => {
  const { colors } = useTheme();
  const { trackRateModalShown, trackRateModalDismissed, trackRateModalOpenedStore } = useAnalytics();

  // Track when modal is shown
  useEffect(() => {
    if (visible) {
      qaLog("rate", `Rate modal shown - trigger: ${trigger}`);
      trackRateModalShown(trigger);
    }
  }, [visible, trigger, trackRateModalShown]);

  const handleRateApp = async () => {
    qaLog("rate", `User tapped Rate App in modal - trigger: ${trigger}`);
    trackRateModalOpenedStore(trigger);
    await openAppStoreForRating();
    onClose();
  };

  const handleNotNow = async () => {
    qaLog("rate", `User dismissed rate modal - trigger: ${trigger}`);
    trackRateModalDismissed(trigger);
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
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
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
  },
  dismissText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
  },
  rateButton: {
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
