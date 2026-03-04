import { useState } from 'react';
import { Platform, Dimensions, PixelRatio } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from '../lib/supabase';
import { getOrCreateDeviceId } from '../utils/deviceIdentity';
import { qaLog } from '../utils/qaLog';

/**
 * Hook to submit general app feedback directly to Supabase.
 * Used for the "Send Feedback" feature in Settings.
 */
export function useAppFeedback() {
  const [submitting, setSubmitting] = useState(false);

  async function submitFeedback(
    feedbackText: string,
    contactInfo?: string
  ): Promise<boolean> {
    if (!feedbackText.trim()) {
      qaLog('app-feedback', 'Cannot submit empty feedback');
      return false;
    }

    try {
      setSubmitting(true);
      const deviceId = await getOrCreateDeviceId();
      
      const expoConfig: any = Constants.expoConfig ?? {};
      const appVersion = expoConfig.version ?? Constants.nativeAppVersion ?? 'dev';
      const buildNumber = expoConfig.ios?.buildNumber ?? Constants.nativeBuildVersion ?? 'dev';

      const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

      const feedbackData = {
        device_id: deviceId,
        feedback_text: feedbackText.trim(),
        contact_info: contactInfo?.trim() || null,
        app_version: appVersion,
        build_number: buildNumber,
        platform: Platform.OS,
        device_model: Device.modelName ?? null,
        os_version: `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Platform.Version}`,
        screen_height: Math.round(screenHeight),
        screen_width: Math.round(screenWidth),
        font_scale: PixelRatio.getFontScale(),
        manufacturer: Platform.OS === 'android' ? (Device.manufacturer ?? null) : null,
      };

      qaLog('app-feedback', 'Submitting feedback', {
        feedbackLength: feedbackText.length,
        hasContact: !!contactInfo,
        platform: Platform.OS,
        version: appVersion,
      });

      const { error } = await supabase
        .from('app_feedback')
        .insert(feedbackData);

      if (error) {
        qaLog('app-feedback', 'Error submitting feedback', {
          error: error.message,
          code: error.code,
        });
        return false;
      }

      qaLog('app-feedback', 'Feedback submitted successfully');
      return true;
    } catch (err) {
      qaLog('app-feedback', 'Exception submitting feedback', {
        error: String(err),
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    submitting,
    submitFeedback,
  };
}




