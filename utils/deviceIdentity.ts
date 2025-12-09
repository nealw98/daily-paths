import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { qaLog } from './qaLog';

const DEVICE_ID_KEY = '@daily_paths_device_id';

/**
 * Gets or creates a unique device identifier for anonymous tracking.
 * This ID is stored locally and used to track feedback across sessions
 * without requiring user login.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    // Check if we already have a device ID
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (deviceId) {
      qaLog('device', 'Device ID retrieved from storage', { deviceId });
      return deviceId;
    }
    
    // Generate new UUID
    deviceId = generateUUID();
    
    // Save locally
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    qaLog('device', 'New device ID generated and stored', { deviceId });
    
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


