import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAnalytics } from '../utils/analytics';
import {
  requestReview,
  openAppStoreForRating,
  markRatePromptDismissed,
  markHasRated,
} from '../utils/rateShareTracking';
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
  const [daysUsed, setDaysUsed] = useState(0);

  // Load dynamic stats for personalized messaging
  useEffect(() => {
    if (visible) {
      qaLog("rate", `Rate modal shown - trigger: ${trigger}`);
      trackRateModalShown(trigger);

      // Calculate days since first use
      (async () => {
        const firstUseStr = await AsyncStorage.getItem('first_use_date');
        if (firstUseStr) {
          const firstUse = new Date(firstUseStr);
          const daysSince = Math.floor(
            (Date.now() - firstUse.getTime()) / (1000 * 60 * 60 * 24)
          );
          setDaysUsed(Math.max(1, daysSince));
        }
      })();
    }
  }, [visible, trigger, trackRateModalShown]);

  const handleRateApp = async () => {
    qaLog("rate", `User tapped Rate App in modal - trigger: ${trigger}`);
    trackRateModalOpenedStore(trigger);

    if (trigger === 'settings_button') {
      // Settings button: always open App Store directly (native dialog may be rate-limited)
      await openAppStoreForRating();
    } else {
      // Automatic triggers: use native in-app review dialog for higher conversion
      const shown = await requestReview();
      if (!shown) {
        // Fallback to App Store if native dialog unavailable
        await openAppStoreForRating();
      }
    }
    onClose();
  };

  const handleNotNow = async () => {
    qaLog("rate", `User dismissed rate modal - trigger: ${trigger}`);
    trackRateModalDismissed(trigger);
    await markRatePromptDismissed();
    onClose();
  };

  const handleAlreadyRated = async () => {
    qaLog("rate", `User said already rated - trigger: ${trigger}`);
    await markHasRated();
    onClose();
  };

  // Dynamic message based on usage
  const getMessage = () => {
    if (daysUsed >= 30) {
      return `You've been reading Daily Paths for ${daysUsed} days!\n\nIf it's been helpful in your Al-Anon journey, would you rate it?\n\nYour rating helps others discover Daily Paths.`;
    }
    if (daysUsed >= 7) {
      return `You've read Daily Paths for ${daysUsed} days!\n\nIf it's been helpful in your recovery journey, would you rate it?\n\nYour rating helps others discover Daily Paths.`;
    }
    return "If Daily Paths has been helpful in your journey, would you rate it?\n\nYour rating helps others discover this app.";
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
          style={[styles.toast, { backgroundColor: colors.modalBackground }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            Enjoying Daily Paths?
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {getMessage()}
          </Text>

          <View style={styles.buttonColumn}>
            <TouchableOpacity
              style={[styles.rateButton, { backgroundColor: colors.buttonPrimary }]}
              onPress={handleRateApp}
            >
              <Text style={[styles.rateButtonText, { color: colors.textOnAccent }]}>
                Yes, I'll rate it
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleNotNow}>
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
                Maybe later
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleAlreadyRated}>
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
                Already rated
              </Text>
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
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonColumn: {
    gap: 10,
  },
  rateButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
  },
  rateButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
  },
});
