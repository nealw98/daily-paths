import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useReadingFeedback } from '../hooks/useReadingFeedback';
import { useSettings, getTextSizeMetrics } from '../hooks/useSettings';
import { NegativeFeedbackModal } from './NegativeFeedbackModal';
import {
  shouldShowRatePrompt,
  incrementReadingsCompleted,
  markRatePromptShown,
  requestReview,
} from '../utils/rateShareTracking';
import { qaLog } from '../utils/qaLog';
import { useAnalytics } from '../utils/analytics';

interface ReadingFeedbackProps {
  readingId: string;
  dayOfYear: number;
  readingTitle: string;
  readingDate: Date;
}

export const ReadingFeedback: React.FC<ReadingFeedbackProps> = ({
  readingId,
  dayOfYear,
  readingTitle,
  readingDate,
}) => {
  const { colors } = useTheme();
  const { currentRating: hookRating, submitRating, loading } = useReadingFeedback(readingId);
  const { settings } = useSettings();
  const { trackReadingRated } = useAnalytics();
  const [localRating, setLocalRating] = useState<'positive' | 'neutral' | 'negative' | null>(null);
  const [showNegativeModal, setShowNegativeModal] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const typography = useMemo(
    () => getTextSizeMetrics(settings.textSize),
    [settings.textSize]
  );

  // Sync local rating with hook rating
  useEffect(() => {
    setLocalRating(hookRating);
  }, [hookRating]);

  const currentRating = localRating;

  useEffect(() => {
    if (showThankYou) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setShowThankYou(false));
    }
  }, [showThankYou]);

  const handleRating = async (rating: 'positive' | 'neutral' | 'negative') => {
    // Optimistically update local state immediately for visual feedback
    setLocalRating(rating);
    
    // Track in analytics
    if (rating === 'positive' || rating === 'negative') {
      trackReadingRated(
        readingId,
        readingDate,
        rating === 'positive' ? 'thumbs_up' : 'thumbs_down'
      );
    }
    
    if (rating === 'negative') {
      setShowNegativeModal(true);
    } else {
      const success = await submitRating(rating, dayOfYear, readingTitle);
      if (success) {
        setShowThankYou(true);
        
        // If positive feedback, increment readings and maybe request native review
        if (rating === 'positive') {
          await incrementReadingsCompleted();
          qaLog("rate", "Positive rating - checking if should request review");

          const shouldShow = await shouldShowRatePrompt();
          qaLog("rate", "shouldShowRatePrompt result", { shouldShow });
          if (shouldShow) {
            await markRatePromptShown();
            // Brief delay for thank you to appear, then show native review dialog
            setTimeout(async () => {
              qaLog("rate", "Requesting native review dialog");
              await requestReview();
            }, 800);
          }
        }
      } else {
        // Revert on failure
        setLocalRating(hookRating);
      }
    }
  };

  const handleNegativeFeedback = async (reasons: {
    unclear?: boolean;
    tooLong?: boolean;
    notApplicable?: boolean;
    language?: boolean;
    otherText?: string;
  }) => {
    const success = await submitRating('negative', dayOfYear, readingTitle, reasons);
    setShowNegativeModal(false);
    if (success) {
      setShowThankYou(true);
    } else {
      // Revert on failure
      setLocalRating(hookRating);
    }
  };

  if (loading) {
    return null; // Or a subtle loading indicator
  }

  return (
    <>
      <View style={[styles.container, { backgroundColor: colors.pearl }]}>
        <Text style={[styles.question, { fontSize: typography.bodyFontSize - 2, color: colors.ink }]}>
          Was this reading helpful?
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.ratingButton,
              { borderColor: colors.mist, backgroundColor: colors.pearl },
              currentRating === 'positive' && [styles.ratingButtonSelected, { backgroundColor: colors.deepTeal, borderColor: colors.deepTeal }],
              currentRating && currentRating !== 'positive' && styles.ratingButtonInactive,
            ]}
            onPress={() => handleRating('positive')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="thumbs-up"
              size={24}
              color={currentRating === 'positive' ? colors.textOnAccent : colors.ocean}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.ratingButton,
              { borderColor: colors.mist, backgroundColor: colors.pearl },
              currentRating === 'negative' && [styles.ratingButtonSelected, { backgroundColor: colors.deepTeal, borderColor: colors.deepTeal }],
              currentRating && currentRating !== 'negative' && styles.ratingButtonInactive,
            ]}
            onPress={() => handleRating('negative')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="thumbs-down"
              size={24}
              color={currentRating === 'negative' ? colors.textOnAccent : colors.ocean}
            />
          </TouchableOpacity>
        </View>

        {showThankYou && (
          <Animated.View style={[styles.thankYouContainer, { opacity: fadeAnim }]}>
            <Text style={[styles.thankYou, { fontSize: typography.bodyFontSize - 2, color: colors.deepTeal }]}>
              Thanks for helping improve Daily Paths 💚
            </Text>
          </Animated.View>
        )}
      </View>

      <NegativeFeedbackModal
        visible={showNegativeModal}
        onClose={() => setShowNegativeModal(false)}
        onSubmit={handleNegativeFeedback}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 82, // Space for action bar
  },
  question: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
  },
  ratingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    // backgroundColor set inline via styles (colors.pearl)
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ratingButtonSelected: {
    borderWidth: 3,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  ratingButtonInactive: {
    opacity: 0.3,
  },
  thankYouContainer: {
    marginTop: 16,
  },
  thankYou: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    textAlign: 'center',
  },
});

