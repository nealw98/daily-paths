import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getOrCreateDeviceId } from '../utils/deviceIdentity';
import { qaLog } from '../utils/qaLog';

type Rating = 'positive' | 'neutral' | 'negative' | null;

interface NegativeReasons {
  unclear?: boolean;
  tooLong?: boolean;
  notApplicable?: boolean;
  language?: boolean;
  otherText?: string;
}

/**
 * Hook to manage reading feedback for a specific reading.
 * Handles loading, submitting, and updating ratings.
 */
export function useReadingFeedback(readingId: string) {
  const [currentRating, setCurrentRating] = useState<Rating>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing rating on mount
  useEffect(() => {
    loadExistingRating();
  }, [readingId]);

  async function loadExistingRating() {
    try {
      const deviceId = await getOrCreateDeviceId();
      
      const { data, error } = await supabase
        .from('app_reading_feedback')
        .select('rating')
        .eq('reading_id', readingId)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (error) {
        qaLog('feedback', 'Error loading existing rating', {
          readingId,
          error: error.message,
        });
      } else if (data) {
        setCurrentRating(data.rating as Rating);
        setHasSubmitted(true);
        qaLog('feedback', 'Loaded existing rating', {
          readingId,
          rating: data.rating,
        });
      }
    } catch (err) {
      qaLog('feedback', 'Exception loading rating', {
        readingId,
        error: String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  async function submitRating(
    rating: 'positive' | 'neutral' | 'negative',
    dayOfYear: number,
    readingTitle: string,
    reasons?: NegativeReasons
  ): Promise<boolean> {
    try {
      const deviceId = await getOrCreateDeviceId();

      const feedbackData: any = {
        device_id: deviceId,
        reading_id: readingId,
        day_of_year: dayOfYear,
        reading_title: readingTitle,
        rating,
        updated_at: new Date().toISOString(),
      };

      // Add negative feedback reasons if provided
      if (rating === 'negative' && reasons) {
        feedbackData.reason_unclear = reasons.unclear || false;
        feedbackData.reason_too_long = reasons.tooLong || false;
        feedbackData.reason_not_applicable = reasons.notApplicable || false;
        feedbackData.reason_language = reasons.language || false;
        feedbackData.reason_other_text = reasons.otherText || null;
      }

      // Upsert (insert or update if exists)
      const { error } = await supabase
        .from('app_reading_feedback')
        .upsert(feedbackData, {
          onConflict: 'reading_id,device_id',
        });

      if (error) {
        qaLog('feedback', 'Error submitting rating', {
          readingId,
          rating,
          error: error.message,
        });
        return false;
      }

      setCurrentRating(rating);
      setHasSubmitted(true);
      
      qaLog('feedback', 'Rating submitted successfully', {
        readingId,
        rating,
        hasReasons: !!reasons,
      });

      return true;
    } catch (err) {
      qaLog('feedback', 'Exception submitting rating', {
        readingId,
        rating,
        error: String(err),
      });
      return false;
    }
  }

  return {
    currentRating,
    hasSubmitted,
    loading,
    submitRating,
  };
}


