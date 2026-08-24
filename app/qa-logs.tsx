import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Ionicons } from "@expo/vector-icons";
import Clipboard from "@react-native-clipboard/clipboard";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { OnboardingFlow } from "../components/onboarding/OnboardingFlow";
import { fallbackColors, fonts, shadows } from "../constants/theme";
import { fetchAccessGrantRows, type AccessGrantRows } from "../lib/accessDiagnostics";
import { getRawEntitlements, type RawEntitlements } from "../lib/subscription";
import { isInternalBuild } from "../utils/buildProfile";
import { isDeveloperDevice, setDeveloperDevice } from "../utils/deviceIdentity";
import { getGrandfatherOverride, setGrandfatherOverride } from "../utils/grandfatherOverride";
import { getLegacyInstallEvidence } from "../utils/legacyInstallEvidence";
import { setLifetimeOverride } from "../utils/paidAppDetector";
import { clearQaLogs, qaLog, useQaLogs } from "../utils/qaLog";
import {
  clearSubscriptionOverride,
  enableSubscriptionOverride,
  getSubscriptionOverride,
} from "../utils/subscriptionOverride";

export default function DeveloperConsoleScreen() {
  const router = useRouter();
  const colors = fallbackColors;
  const logs = useQaLogs();
  const [developerDevice, setDeveloperDeviceState] = useState(false);
  const [savingDeveloperDevice, setSavingDeveloperDevice] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [rawEntitlements, setRawEntitlements] = useState<RawEntitlements | null>(null);
  const [grantRows, setGrantRows] = useState<AccessGrantRows | null>(null);
  const [hasLegacyInstallEvidence, setHasLegacyInstallEvidence] = useState(false);
  const [ignoreGrandfather, setIgnoreGrandfatherState] = useState(false);
  const [ignoreAccess, setIgnoreAccessState] = useState(false);

  const forcedDeveloperBuild = isInternalBuild();
  const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "dev";
  const buildNumber =
    Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber ?? Constants.nativeBuildVersion ?? "dev"
      : Constants.expoConfig?.android?.versionCode?.toString() ??
        Constants.nativeBuildVersion ??
        "dev";

  useEffect(() => {
    isDeveloperDevice()
      .then(setDeveloperDeviceState)
      .catch(() => setDeveloperDeviceState(forcedDeveloperBuild));
  }, [forcedDeveloperBuild]);

  const refreshAccessStatus = async () => {
    setAccessLoading(true);
    try {
      const [raw, grants, legacyInstall, grandfatherOverride, accessOverride] = await Promise.all([
        getRawEntitlements(),
        fetchAccessGrantRows(),
        getLegacyInstallEvidence(),
        getGrandfatherOverride(),
        getSubscriptionOverride(),
      ]);
      setRawEntitlements(raw);
      setGrantRows(grants);
      setHasLegacyInstallEvidence(legacyInstall.isValid);
      setIgnoreGrandfatherState(grandfatherOverride);
      setIgnoreAccessState(accessOverride);
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    void refreshAccessStatus();
  }, []);

  const developerDescription = useMemo(() => {
    if (forcedDeveloperBuild) {
      return "Development and preview builds are automatically marked as developer traffic.";
    }
    return "Marks activity from this device as developer traffic so it can be filtered from reporting.";
  }, [forcedDeveloperBuild]);

  const handleDeveloperToggle = async (value: boolean) => {
    setSavingDeveloperDevice(true);
    setDeveloperDeviceState(value);
    try {
      await setDeveloperDevice(value);
      qaLog("developer-console", "Developer device setting changed", { value });
    } catch (error) {
      setDeveloperDeviceState(!value);
      Alert.alert("Could not update developer mode", String(error));
    } finally {
      setSavingDeveloperDevice(false);
    }
  };

  const runOnboarding = () => {
    qaLog("developer-console", "Onboarding replay opened");
    setShowOnboarding(true);
  };

  const copyLogs = () => {
    const text = logs
      .map((entry) => {
        const heading = `[${entry.timestamp}] ${entry.scope}: ${entry.message}`;
        return entry.details ? `${heading}\n${entry.details}` : heading;
      })
      .join("\n\n");
    Clipboard.setString(text || "No troubleshooting logs recorded.");
    Alert.alert("Logs copied", `${logs.length} log ${logs.length === 1 ? "entry" : "entries"} copied.`);
  };

  const confirmClearLogs = () => {
    Alert.alert("Clear troubleshooting log?", "This removes the saved log from this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearQaLogs },
    ]);
  };

  const handleGrandfatherOverride = async (value: boolean) => {
    setIgnoreGrandfatherState(value);
    await setGrandfatherOverride(value);
  };

  const handleAccessOverride = (value: boolean) => {
    Alert.alert(
      value ? "Ignore purchase and entitlements?" : "Use real access again?",
      value
        ? "For 30 minutes, this preview build will behave as if there is no purchase or RevenueCat entitlement. Nothing is revoked or deleted. The app will restart."
        : "The test override will be removed and the app will restart using the real store and RevenueCat status.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: value ? "Ignore for testing" : "Use real access",
          onPress: async () => {
            if (value) {
              await enableSubscriptionOverride();
              await setLifetimeOverride(false);
            } else {
              await clearSubscriptionOverride();
              await setLifetimeOverride(null);
            }
            setIgnoreAccessState(value);
            await Updates.reloadAsync();
          },
        },
      ],
    );
  };

  const grandfatherStatus = grantRows?.grandfather?.status === "granted"
    ? "Granted"
    : hasLegacyInstallEvidence
      ? "Eligible install detected"
      : "Not grandfathered";
  const purchaseStatus = rawEntitlements?.purchasedProductIdentifiers.length
    ? rawEntitlements.purchasedProductIdentifiers.join(", ")
    : "No store purchase found";
  const entitlementStatus = rawEntitlements?.hasLifetime && rawEntitlements?.hasUnlimited
    ? "Lifetime + legacy subscription"
    : rawEntitlements?.hasLifetime
      ? "Lifetime"
      : rawEntitlements?.hasUnlimited
        ? "Legacy subscription"
        : "None";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>DEVELOPER</Text>
          <Text style={[styles.title, { color: colors.text }]}>Developer Console</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.closeButton, { backgroundColor: "#FFFFFF" }]}
          accessibilityRole="button"
          accessibilityLabel="Close developer console"
        >
          <Ionicons name="close" size={25} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.card,
          shadows.ambient,
          { backgroundColor: "#FFFFFF", borderColor: colors.border },
        ]}
      >
        <View style={styles.toggleRow}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Developer device</Text>
            <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
              {developerDescription}
            </Text>
          </View>
          <Switch
            value={developerDevice}
            disabled={forcedDeveloperBuild || savingDeveloperDevice}
            onValueChange={handleDeveloperToggle}
            trackColor={{ false: colors.mist, true: colors.deepTeal }}
            thumbColor={colors.pearl}
            accessibilityLabel="Developer device"
          />
        </View>
      </View>

      {developerDevice ? (
        <>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionHeaderLabel, { color: colors.textSecondary }]}>REAL ACCESS STATUS</Text>
        <TouchableOpacity onPress={refreshAccessStatus} disabled={accessLoading}>
          <Text style={[styles.refreshText, { color: colors.deepTeal }]}>
            {accessLoading ? "Checking…" : "Refresh"}
          </Text>
        </TouchableOpacity>
      </View>
      <View
        style={[
          styles.card,
          shadows.ambient,
          { backgroundColor: "#FFFFFF", borderColor: colors.border },
        ]}
      >
        <AccessStatusRow label="Grandfathered access" value={grandfatherStatus} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AccessStatusRow label="Purchase status" value={purchaseStatus} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <AccessStatusRow label="RevenueCat entitlement" value={entitlementStatus} colors={colors} />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ACCESS TESTING</Text>
      <View
        style={[
          styles.card,
          shadows.ambient,
          { backgroundColor: "#FFFFFF", borderColor: colors.border },
        ]}
      >
        <View style={styles.toggleRow}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Ignore grandfathering</Text>
            <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
              Prevents a grandfather grant while testing. It does not revoke one already granted.
            </Text>
          </View>
          <Switch
            value={ignoreGrandfather}
            onValueChange={handleGrandfatherOverride}
            trackColor={{ false: colors.mist, true: colors.deepTeal }}
            thumbColor={colors.pearl}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.toggleRow}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Ignore purchase and entitlements</Text>
            <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
              Temporarily makes this developer device behave as an unentitled user. Your real purchase remains untouched.
            </Text>
          </View>
          <Switch
            value={ignoreAccess}
            onValueChange={handleAccessOverride}
            trackColor={{ false: colors.mist, true: colors.deepTeal }}
            thumbColor={colors.pearl}
          />
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TEST THE CURRENT EXPERIENCE</Text>
      <TouchableOpacity
        activeOpacity={0.78}
        onPress={runOnboarding}
        style={[
          styles.actionCard,
          shadows.ambient,
          { backgroundColor: "#FFFFFF", borderColor: colors.border },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Run onboarding again"
      >
        <View style={[styles.iconTile, { backgroundColor: colors.secondaryContainer }]}>
          <Ionicons name="play-forward-outline" size={24} color={colors.deepTeal} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>Run onboarding again</Text>
          <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
            Opens the complete onboarding and paywall journey from page 1. Your purchase status is not changed.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={21} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionHeaderLabel, { color: colors.textSecondary }]}>TROUBLESHOOTING LOG</Text>
        <View style={styles.logActions}>
          <TouchableOpacity onPress={copyLogs} accessibilityRole="button" accessibilityLabel="Copy troubleshooting log">
            <Text style={[styles.refreshText, { color: colors.deepTeal }]}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmClearLogs} accessibilityRole="button" accessibilityLabel="Clear troubleshooting log">
            <Text style={[styles.refreshText, { color: colors.danger }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View
        style={[
          styles.logCard,
          shadows.ambient,
          { backgroundColor: "#FFFFFF", borderColor: colors.border },
        ]}
      >
        {logs.length === 0 ? (
          <Text style={[styles.emptyLog, { color: colors.textSecondary }]}>No troubleshooting entries yet.</Text>
        ) : (
          logs.slice(0, 50).map((entry, index) => (
            <View key={`${entry.id}-${entry.timestamp}`}>
              {index > 0 ? <View style={[styles.logDivider, { backgroundColor: colors.border }]} /> : null}
              <Text style={[styles.logMeta, { color: colors.textSecondary }]}>
                {new Date(entry.timestamp).toLocaleString()} · {entry.scope}
              </Text>
              <Text style={[styles.logMessage, { color: colors.text }]}>{entry.message}</Text>
              {entry.details ? (
                <Text style={[styles.logDetails, { color: colors.textSecondary }]} numberOfLines={6}>
                  {entry.details}
                </Text>
              ) : null}
            </View>
          ))
        )}
        {logs.length > 50 ? (
          <Text style={[styles.moreLogs, { color: colors.textSecondary }]}>Showing the 50 most recent entries. Copy includes all {logs.length}.</Text>
        ) : null}
      </View>
        </>
      ) : null}

      <Text style={[styles.buildInfo, { color: colors.textSecondary }]}>
        Version {appVersion} · Build {buildNumber}
      </Text>
      </ScrollView>

      <Modal
        visible={showOnboarding}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowOnboarding(false)}
      >
        <OnboardingFlow
          onExit={() => setShowOnboarding(false)}
          onAccessGranted={() => setShowOnboarding(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

function AccessStatusRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: typeof fallbackColors;
}) {
  return (
    <View style={styles.statusRow}>
      <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statusValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 18 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
    paddingBottom: 30,
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  title: {
    fontFamily: fonts.cormorantGaramondSemiBold,
    fontSize: 34,
    lineHeight: 39,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 18,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  rowCopy: { flex: 1 },
  rowTitle: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 17,
    lineHeight: 22,
    marginBottom: 5,
  },
  rowDescription: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.25,
    marginTop: 32,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionHeaderRow: {
    marginTop: 32,
    marginBottom: 10,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderLabel: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.25,
  },
  refreshText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  logActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  statusRow: { paddingVertical: 4 },
  statusLabel: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 3,
  },
  statusValue: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 16,
    lineHeight: 21,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  actionCard: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
  },
  logCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
  },
  emptyLog: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 12,
  },
  logDivider: { height: StyleSheet.hairlineWidth, marginVertical: 13 },
  logMeta: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 3,
  },
  logMessage: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 14,
    lineHeight: 19,
  },
  logDetails: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  moreLogs: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 16,
    textAlign: "center",
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buildInfo: {
    marginTop: 28,
    paddingBottom: 14,
    textAlign: "center",
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    lineHeight: 18,
  },
});
