import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';
import { useReadingFeedback } from '../hooks/useReadingFeedback';
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
  const { currentRating, submitRating, loading } = useReadingFeedback(readingId);
  const [showNegativeModal, setShowNegativeModal] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

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
    if (rating === 'negative') {
      setShowNegativeModal(true);
    } else {
      const success = await submitRating(rating, dayOfYear, readingTitle);
      if (success) {
        setShowThankYou(true);
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
    }
  };

  if (loading) {
    return null; // Or a subtle loading indicator
  }

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.question}>Was this reading helpful?</Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.ratingButton,
              currentRating === 'positive' && styles.ratingButtonSelected,
            ]}
            onPress={() => handleRating('positive')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="thumbs-up"
              size={24}
              color={currentRating === 'positive' ? colors.deepTeal : colors.ocean}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.ratingButton,
              currentRating === 'neutral' && styles.ratingButtonSelected,
            ]}
            onPress={() => handleRating('neutral')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="remove"
              size={24}
              color={currentRating === 'neutral' ? colors.deepTeal : colors.ocean}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.ratingButton,
              currentRating === 'negative' && styles.ratingButtonSelected,
            ]}
            onPress={() => handleRating('negative')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="thumbs-down"
              size={24}
              color={currentRating === 'negative' ? colors.deepTeal : colors.ocean}
            />
          </TouchableOpacity>
        </View>

        {showThankYou && (
          <Animated.View style={[styles.thankYouContainer, { opacity: fadeAnim }]}>
            <Text style={styles.thankYou}>
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
    backgroundColor: colors.seafoam + '15',
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

