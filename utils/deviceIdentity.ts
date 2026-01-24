import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { qaLog } from './qaLog';

const DEVICE_ID_KEY = '@daily_paths_device_id';
const LAST_ACTIVITY_DATE_KEY = '@daily_paths_last_activity_date';
const IS_DEVELOPER_KEY = '@daily_paths_is_developer';

// Cached device ID to avoid repeated async calls
let cachedDeviceId: string | null = null;

// TODO: Migrate to expo-secure-store for persistence across reinstalls
// Requires native rebuild: npx expo run:ios / npx expo run:android
// iOS: Keychain, Android: EncryptedSharedPreferences

/**
 * Gets or creates a unique device identifier for anonymous tracking.
 * This ID is stored locally and used to track feedback across sessions
 * without requiring user login.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  // Return cached ID if available
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    // Check if we already have a device ID
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (deviceId) {
      qaLog('device', 'Device ID retrieved from storage', { deviceId });
      cachedDeviceId = deviceId;
      return deviceId;
    }
    
    // Generate new UUID
    deviceId = generateUUID();
    
    // Save locally
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    qaLog('device', 'New device ID generated and stored', { deviceId });
    
    cachedDeviceId = deviceId;
    
    // Register in Supabase
    try {
      const { error } = await supabase.from('app_devices').insert({
        device_id: deviceId,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version || 'unknown',
      });
      
      if (error) {
        qaLog('device', 'Error registering device in Supabase', {
          deviceId,
          error: error.message,
        });
      } else {
        qaLog('device', 'Device registered in Supabase', { deviceId });
      }
    } catch (err) {
      qaLog('device', 'Exception registering device', {
        deviceId,
        error: String(err),
      });
    }
    
    return deviceId;
  } catch (err) {
    qaLog('device', 'Error in getOrCreateDeviceId', { error: String(err) });
    // Return a temporary ID if everything fails
    return 'temp-' + Date.now();
  }
}

/**
 * Generates a UUID v4 compliant string
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Updates the last active timestamp for analytics
 */
export async function updateLastActive(): Promise<void> {
  try {
    const deviceId = await getOrCreateDeviceId();
    await supabase
      .from('app_devices')
      .update({ last_active_at: new Date().toISOString() })
      .eq('device_id', deviceId);
  } catch (err) {
    // Silent fail - not critical
    qaLog('device', 'Error updating last active', { error: String(err) });
  }
}

/**
 * Check if this device is marked as a developer device (excluded from analytics)
 */
export async function isDeveloperDevice(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(IS_DEVELOPER_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Set whether this device is a developer device
 */
export async function setDeveloperDevice(isDeveloper: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(IS_DEVELOPER_KEY, isDeveloper ? 'true' : 'false');
    
    // Also update in Supabase
    const deviceId = await getOrCreateDeviceId();
    await supabase
      .from('app_devices')
      .update({ is_developer: isDeveloper })
      .eq('device_id', deviceId);
    
    qaLog('device', `Developer mode ${isDeveloper ? 'enabled' : 'disabled'}`, { deviceId });
  } catch (err) {
    qaLog('device', 'Error setting developer mode', { error: String(err) });
  }
}

/**
 * Records daily activity for analytics (called once per day max)
 * Skips if device is marked as developer
 */
export async function recordDailyActivity(): Promise<void> {
  try {
    // Skip if developer device
    const isDev = await isDeveloperDevice();
    if (isDev) {
      qaLog('device', 'Skipping daily activity - developer device');
      return;
    }

    // Check if we already recorded today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastDate = await AsyncStorage.getItem(LAST_ACTIVITY_DATE_KEY);
    
    if (lastDate === today) {
      qaLog('device', 'Daily activity already recorded for today');
      return;
    }

    const deviceId = await getOrCreateDeviceId();
    const appVersion = Constants.expoConfig?.version || 'unknown';
    const platform = Platform.OS;

    // Record in Supabase
    const { error } = await supabase.from('daily_active_users').upsert(
      {
        device_id: deviceId,
        date: today,
        app_version: appVersion,
        platform: platform,
      },
      { onConflict: 'device_id,date' }
    );

    if (error) {
      qaLog('device', 'Error recording daily activity', { 
        error: error.message,
        code: (error as any).code 
      });
    } else {
      // Mark as recorded locally
      await AsyncStorage.setItem(LAST_ACTIVITY_DATE_KEY, today);
      qaLog('device', 'Daily activity recorded', { deviceId, date: today });
    }
  } catch (err) {
    qaLog('device', 'Exception recording daily activity', { error: String(err) });
  }
}

/**
 * Records a reading view for analytics
 * Tracks unique viewers per reading (one record per device per reading, lifetime)
 * - On first view: creates row, DB sets first_viewed_at to now()
 * - On subsequent views: updates last_viewed_at only
 */
export async function recordReadingView(readingId: string): Promise<void> {
  try {
    // Skip if developer device
    const isDev = await isDeveloperDevice();
    if (isDev) {
      return; // Silent skip for reading views
    }

    if (!readingId) {
      return;
    }

    const deviceId = await getOrCreateDeviceId();
    const timestamp = new Date().toISOString(); // Full ISO 8601 timestamptz
    const appVersion = Constants.expoConfig?.version || 'unknown';
    const platform = Platform.OS;

    // Fire and forget - don't block the UI
    // Upserts on (device_id, reading_id)
    // - first_viewed_at: NOT sent, so DB uses default now() on insert, unchanged on update
    // - last_viewed_at: always updated to current timestamp
    supabase.from('reading_views').upsert(
      {
        device_id: deviceId,
        reading_id: readingId,
        last_viewed_at: timestamp,
        app_version: appVersion,
        platform: platform,
      },
      { 
        onConflict: 'device_id,reading_id',
      }
    ).then(({ error }) => {
      if (error) {
        qaLog('analytics', 'Error recording reading view', { 
          error: error.message,
          readingId 
        });
      }
    });
  } catch (err) {
    // Silent fail - not critical
  }
}





