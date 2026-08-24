import AsyncStorage from "@react-native-async-storage/async-storage";

// Historical 2.6.x key. It is read only to recognize legitimate pre-paywall
// Android installs during the one-time grandfather migration.
const LEGACY_INSTALL_DATE_KEY = "@daily_paths_trial_start";

export interface LegacyInstallEvidence {
  installedAt: string | null;
  isValid: boolean;
}

export async function getLegacyInstallEvidence(): Promise<LegacyInstallEvidence> {
  try {
    const installedAt = await AsyncStorage.getItem(LEGACY_INSTALL_DATE_KEY);
    if (!installedAt) return { installedAt: null, isValid: false };

    return {
      installedAt,
      isValid: !Number.isNaN(Date.parse(installedAt)),
    };
  } catch (error) {
    console.warn("[legacyInstallEvidence] read failed:", error);
    return { installedAt: null, isValid: false };
  }
}
