import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';
import { useReadingFeedback } from '../hooks/useReadingFeedback';
import { useSettings, getTextSizeMetrics } from '../hooks/useSettings';
import { NegativeFeedbackModal } from './NegativeFeedbackModal';

interface ReadingFeedbackProps {
  readingId: string;
  dayOfYear: number;
  readingTitle: string;
}

export const ReadingFeedback: React.FC<ReadingFeedbackProps> = ({
  readingId,
  dayOfYear,
  readingTitle,
}) => {
  const { currentRating: hookRating, submitRating, loading } = useReadingFeedback(readingId);
  const { settings } = useSettings();
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
    
    if (rating === 'negative') {
      setShowNegativeModal(true);
    } else {
      const success = await submitRating(rating, dayOfYear, readingTitle);
      if (success) {
        setShowThankYou(true);
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
      <View style={styles.container}>
        <Text style={[styles.question, { fontSize: typography.bodyFontSize - 2 }]}>
          Was this reading helpful?
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.ratingButton,
              currentRating === 'positive' && styles.ratingButtonSelected,
              currentRating && currentRating !== 'positive' && styles.ratingButtonInactive,
            ]}
            onPress={() => handleRating('positive')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="thumbs-up"
              size={24}
              color={currentRating === 'positive' ? '#fff' : colors.ocean}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.ratingButton,
              currentRating === 'neutral' && styles.ratingButtonSelected,
              currentRating && currentRating !== 'neutral' && styles.ratingButtonInactive,
            ]}
            onPress={() => handleRating('neutral')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="hand-right"
              size={24}
              color={currentRating === 'neutral' ? '#fff' : colors.ocean}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.ratingButton,
              currentRating === 'negative' && styles.ratingButtonSelected,
              currentRating && currentRating !== 'negative' && styles.ratingButtonInactive,
            ]}
            onPress={() => handleRating('negative')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="thumbs-down"
              size={24}
              color={currentRating === 'negative' ? '#fff' : colors.ocean}
            />
          </TouchableOpacity>
        </View>

        {showThankYou && (
          <Animated.View style={[styles.thankYouContainer, { opacity: fadeAnim }]}>
            <Text style={[styles.thankYou, { fontSize: typography.bodyFontSize - 2 }]}>
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
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
    backgroundColor: colors.pearl,
    alignItems: 'center',
    marginBottom: 82, // Space for action bar
  },
  question: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: colors.ink,
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.mist,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ratingButtonSelected: {
    borderColor: colors.deepTeal,
    backgroundColor: colors.deepTeal,
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
    color: colors.deepTeal,
    textAlign: 'center',
  },
});

