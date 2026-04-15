import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { useTheme } from "../../hooks/useTheme";
import { useReading } from "../../hooks/useReading";
import { useAppDate } from "../../contexts/AppDateContext";
import { useSpeakers } from "../../hooks/useSpeakers";
import { usePersonalPrayers } from "../../hooks/usePersonalPrayers";
import { useSubscriptionContext } from "../../contexts/SubscriptionContext";
import { fonts, layout, shadows } from "../../constants/theme";
import { JOURNAL_CATEGORIES, type EntryType } from "../../constants/journalCategories";
import { JournalEntryEditor } from "../../components/journal/JournalEntryEditor";
import { useJournalStorage } from "../../hooks/useJournalStorage";
import { TealHeader } from "../../components/shared/TealHeader";
import { useFeaturedSpeaker } from "../../hooks/useFeaturedSpeaker";
import { qaLog } from "../../utils/qaLog";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeTab() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { today } = useAppDate();
  const { reading, loading: readingLoading } = useReading(today);
  const { speakers } = useSpeakers();
  const { prayers } = usePersonalPrayers();
  const { speaker: featuredSpeaker, isStarted: speakerIsStarted, isListenAgain } = useFeaturedSpeaker(speakers);
  const { createEntry } = useJournalStorage();
  const [journalEntryType, setJournalEntryType] = useState<EntryType | null>(null);

  const { gate, refresh: refreshSub } = useSubscriptionContext();
  const isFree = gate === "paywall";
  const presentingPaywall = useRef(false);

  const presentPaywall = useCallback(async () => {
    if (presentingPaywall.current) return;
    presentingPaywall.current = true;
    qaLog("paywall", "Home free-state presenting paywall");
    try {
      const result = await RevenueCatUI.presentPaywall();
      qaLog("paywall", "Home free-state paywall result", { result });
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await refreshSub();
        await new Promise((resolve) => setTimeout(resolve, 350));
        await refreshSub();
      }
    } catch (err) {
      qaLog("paywall", "Home free-state paywall error", { error: String(err) });
    } finally {
      presentingPaywall.current = false;
    }
  }, [refreshSub]);

  // The home tab's container is rendered inside the tab content area, so
  // bottom: 0 is already flush with the top edge of the tab bar.

  // If user picked a journal type, show the editor full-screen
  if (journalEntryType) {
    return (
      <JournalEntryEditor
        key={journalEntryType}
        entryType={journalEntryType}
        onSave={async (entryType, content, structuredContent) => {
          await createEntry(entryType, content, structuredContent);
          setJournalEntryType(null);
        }}
        onCancel={() => setJournalEntryType(null)}
        onSwitchEntryType={setJournalEntryType}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}>
      <TealHeader
        title={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        eyebrow="Daily Paths"
        hideIcon
      />
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.surface }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Welcome Greeting ── */}
        <Text style={[styles.greeting, { color: colors.onSurface }]}>
          {getGreeting()}
        </Text>

        {/* ── Hero Card — Daily Reflection (split view) ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/(tabs)/reading")}
          style={styles.heroWrapper}
        >
          <View style={styles.heroClip}>
          {/* Top half: hero image with label + title */}
          <ImageBackground
            source={require("../../assets/home-page.jpg")}
            resizeMode="cover"
            style={styles.heroTop}
            imageStyle={styles.heroTopImage}
          >
            {/* Clear top area — lets the image breathe */}
            <View style={styles.heroSpacer} />
            {/* Text pinned to the lower half with a gradient scrim */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.55)"]}
              style={styles.heroOverlay}
            >
              <View style={styles.heroIconRow}>
                <MaterialIcons name="menu-book" size={18} color="#FFFFFFCC" />
                <Text style={[styles.heroLabel, { color: "#FFFFFFBB" }]}>
                  Today's Reflection
                </Text>
              </View>
              {readingLoading && !reading ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                  style={{ marginVertical: 16 }}
                />
              ) : reading ? (
                <Text style={[styles.heroTitle, { color: "#FFFFFF" }]}>
                  {reading.title}
                </Text>
              ) : null}
            </LinearGradient>
          </ImageBackground>

          {/* Bottom half: white with thought + read more */}
          <View style={[styles.heroBottom, { backgroundColor: colors.surfaceContainerLowest }]}>
            {reading ? (
              <>
                <Text
                  style={[styles.notebookTag, styles.heroThoughtForDay, { color: colors.onSurface }]}
                  numberOfLines={3}
                >
                  {`"${reading.thoughtForDay}"`}
                </Text>
                <View style={styles.ctaRow}>
                  <Text style={[styles.readMore, { color: colors.accent }]}>
                    Read more
                  </Text>
                  <MaterialIcons name="chevron-right" size={20} color={colors.accent} />
                </View>
              </>
            ) : (
              <Text style={[styles.notebookTag, styles.heroThoughtForDay, { color: colors.onSurfaceVariant }]}>
                No reading available today.
              </Text>
            )}
          </View>
          </View>
        </TouchableOpacity>

        {/* ── Daily Tools List ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.onSurface, marginTop: 56 },
            isFree && styles.sectionTitleToolsFree,
          ]}
        >
          Daily Tools
        </Text>
        <View style={styles.toolsList}>
          {JOURNAL_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              activeOpacity={0.8}
              onPress={() => {
                if (isFree) {
                  void presentPaywall();
                } else {
                  setJournalEntryType(cat.id);
                }
              }}
              style={[styles.toolRow, isFree && styles.toolRowFree]}
            >
              <View style={styles.toolRowInner}>
                <View style={[styles.toolIconPip, isFree && styles.toolIconPipFree]}>
                  <Ionicons
                    name={cat.icon as any}
                    size={38}
                    color={isFree ? "#aaa" : "#FFFFFF"}
                    style={{ fontWeight: "900" }}
                  />
                </View>
                <View style={styles.toolText}>
                  <Text style={[styles.notebookLabel, { color: colors.onSurface }]}>
                    {cat.label}
                  </Text>
                  <Text
                    style={[styles.notebookTag, { color: colors.onSurfaceVariant }]}
                    numberOfLines={2}
                  >
                    {cat.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#B0B0B0" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Speaker Feature Card ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.onSurface, marginTop: 56 },
            isFree && styles.sectionTitleSpeakersFree,
          ]}
        >
          Speakers
        </Text>
        {featuredSpeaker ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (isFree) {
                void presentPaywall();
              } else {
                router.push({ pathname: "/(tabs)/speakers", params: { speakerId: featuredSpeaker.id } });
              }
            }}
            style={[styles.speakerCard, isFree && styles.speakerSectionFree]}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.speakerCardInner}
            >
              <Ionicons
                name="headset"
                size={220}
                color="rgba(255,255,255,0.05)"
                style={[styles.speakerWatermark, { transform: [{ rotate: "30deg" }] }]}
              />
              <View style={styles.heroIconRow}>
                <MaterialIcons name="record-voice-over" size={18} color="#FFFFFFCC" />
                <Text style={[styles.heroLabel, { color: "#FFFFFFBB" }]}>
                  Featured Speaker
                </Text>
              </View>
              <Text style={[styles.speakerName, { color: colors.onPrimary, marginTop: 12 }]}>
                {featuredSpeaker.speaker}
              </Text>
              <Text
                style={[styles.speakerTitle, { color: colors.onPrimary + "CC" }]}
                numberOfLines={2}
              >
                {featuredSpeaker.title}
              </Text>
              <View style={styles.ctaRow}>
                <Text style={[styles.readMore, { color: colors.secondaryContainer }]}>
                  {isListenAgain ? "Listen again" : speakerIsStarted ? "Continue" : "Listen"}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.secondaryContainer} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (isFree) {
              void presentPaywall();
            } else {
              router.push("/(tabs)/speakers");
            }
          }}
          style={[styles.exploreRow, isFree && styles.speakerSectionFree]}
        >
          <Text style={[styles.exploreText, { color: colors.secondary }]}>
            Explore all speakers
          </Text>
          <MaterialIcons name="arrow-forward" size={18} color={colors.secondary} />
        </TouchableOpacity>

        {/* ── Prayers Card ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.onSurface, marginTop: 56 },
            isFree && styles.sectionTitleToolsFree,
          ]}
        >
          Prayers
        </Text>
        <View style={styles.toolsList}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (isFree) {
                void presentPaywall();
              } else {
                router.push("/(tabs)/prayers");
              }
            }}
            style={[styles.toolRow, isFree && styles.toolRowFree]}
          >
            <View style={[styles.toolRowInner, styles.prayersTile]}>
              <View style={[styles.toolIconPip, isFree && styles.toolIconPipFree]}>
                <MaterialCommunityIcons
                  name="hands-pray"
                  size={38}
                  color={isFree ? "#aaa" : "#FFFFFF"}
                  style={{ fontWeight: "900" }}
                />
              </View>
              <View style={styles.toolText}>
                <Text style={[styles.notebookLabel, { color: colors.onSurface }]}>
                  Your Prayers
                </Text>
                <Text style={[styles.notebookTag, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
                  A collection of prayers — and a place to add your own.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B0B0B0" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom spacing — extra room so the persistent pill doesn't cover content */}
        <View style={{ height: isFree ? 96 : 32 }} />
      </ScrollView>

      {/* ── Persistent unlock pill (free users only) ── */}
      {isFree ? (
        <View
          pointerEvents="box-none"
          style={styles.unlockPillWrapper}
        >
          <View style={[styles.unlockPill, { backgroundColor: colors.subscriptionBar }]}>
            <Text style={[styles.unlockPillText, { color: colors.subscriptionOnBar }]}>
              Unlock the full experience
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => void presentPaywall()}
              style={[styles.unlockPillButton, { backgroundColor: colors.subscriptionOnBar }]}
            >
              <Text style={[styles.unlockPillButtonText, { color: colors.subscriptionAccent }]}>
                Subscribe
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },

  // Welcome greeting
  greeting: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    marginHorizontal: layout.spacing.lgPlus,
    marginTop: layout.spacing.lg,
    marginBottom: layout.spacing.lgPlus,
  },

  // Hero card
  heroWrapper: {
    marginHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadiusLarge,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroClip: {
    borderRadius: layout.borderRadiusLarge,
    overflow: "hidden",
  },
  heroTop: {
    borderTopLeftRadius: layout.borderRadiusLarge,
    borderTopRightRadius: layout.borderRadiusLarge,
    minHeight: 160,
    justifyContent: "flex-end",
  },
  heroTopImage: {
    borderTopLeftRadius: layout.borderRadiusLarge,
    borderTopRightRadius: layout.borderRadiusLarge,
  },
  heroSpacer: {
    flex: 1,
  },
  heroOverlay: {
    padding: layout.spacing.lgPlus,
    paddingTop: layout.spacing.xxl,
    paddingBottom: layout.spacing.md,
  },
  heroBottom: {
    padding: layout.spacing.lgPlus,
    borderBottomLeftRadius: layout.borderRadiusLarge,
    borderBottomRightRadius: layout.borderRadiusLarge,
  },
  heroIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  heroLabel: {
    fontFamily: fonts.labelFamily,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  /** Centered quote; horizontal inset comes only from `heroBottom` padding (matches tool text width). */
  heroThoughtForDay: {
    textAlign: "center",
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: 16,
  },
  readMore: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    letterSpacing: 0.1,
  },

  // Section titles
  sectionTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.1,
    marginTop: layout.spacing.lg,
    marginBottom: layout.spacing.lg,
    marginHorizontal: layout.spacing.lgPlus,
  },

  // Daily Tools list
  toolsList: {
    paddingHorizontal: layout.spacing.md,
    gap: 24,
  },
  toolRow: {
    borderRadius: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  toolRowInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#c5dedd",
    borderWidth: 0.5,
    borderRadius: 10,
    paddingRight: 16,
    paddingLeft: 0,
    paddingVertical: 0,
    minHeight: 100,
    overflow: "hidden",
  },
  toolIconPip: {
    width: 90,
    alignSelf: "stretch",
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "#2C5F5D",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  toolText: {
    flex: 1,
    gap: 3,
    paddingVertical: 16,
  },
  notebookLabel: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0,
  },
  notebookTag: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: 0,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  },

  // Prayers
  prayersTile: {
    padding: 16,
    paddingHorizontal: 16,
  },
  prayersCard: {
    marginHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius,
    padding: 16,
    gap: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  prayersIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  prayersText: {
    flex: 1,
  },
  prayersTitle: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 17,
    lineHeight: 22,
    marginTop: 6,
  },
  prayersSubtitle: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },
  prayersCount: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    alignSelf: "flex-start",
    marginTop: 2,
  },

  // Speaker
  speakerCard: {
    marginHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  speakerWatermark: {
    position: "absolute",
    bottom: 12,
    right: -28,
    zIndex: 0,
  },
  speakerCardInner: {
    paddingHorizontal: layout.spacing.lgPlus,
    paddingBottom: layout.spacing.lgPlus,
    paddingTop: 24,
    borderRadius: layout.borderRadius,
    overflow: "hidden",
  },
  speakerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  speakerName: {
    fontFamily: fonts.headerFamily,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  speakerTitle: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 16,
    lineHeight: 22,
  },
  speakerThemes: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    lineHeight: 16,
    fontStyle: "italic",
    marginTop: 4,
  },
  exploreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: layout.spacing.lgPlus,
    marginTop: 10,
  },
  exploreText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 15,
    letterSpacing: 0.1,
  },

  // Free-user faded states
  toolRowFree: {
    opacity: 0.5,
  },
  toolIconPipFree: {
    backgroundColor: "#ebe8e4",
  },
  speakerSectionFree: {
    opacity: 0.45,
  },
  sectionTitleToolsFree: {
    opacity: 0.5,
  },
  sectionTitleSpeakersFree: {
    opacity: 0.45,
  },

  // Persistent unlock pill (free users)
  unlockPillWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "stretch",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  unlockPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 50,
    padding: 8,
    ...shadows.ambient,
  },
  unlockPillText: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 14,
    marginLeft: 12,
  },
  unlockPillButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  unlockPillButtonText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 14,
    fontWeight: "600",
  },
});
