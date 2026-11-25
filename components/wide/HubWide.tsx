import React, { useCallback, useMemo, useRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { layout, wideType } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { useJournalStorage, type JournalEntry } from "../../hooks/useJournalStorage";
import { getCategoryById, type EntryType } from "../../constants/journalCategories";
import { entryPreview } from "../../utils/journalEntryPayload";
import { useRememberedState, type PaneMemory } from "../../utils/paneMemory";
import { BackLink } from "./BackLink";
import { EntryPane, confirmDiscard, forgetKeptDraft, type PaneMode } from "./EntryPane";

/**
 * A journaling hub in the wide layout (docs/widescreen-2.9/08–12):
 * Gratitude, Journal, Spot Check and Nightly Review. Left: hero image,
 * title, the latest past entries and "See all in Notebook". Right: the
 * shared EntryPane — today's entry, a past entry with "Write today's
 * entry", or its edit form.
 */
const HERO: Record<EntryType, any> = {
  journal: require("../../assets/journal.jpg"),
  gratitude: require("../../assets/gratitude.jpg"),
  spot_check: require("../../assets/spot_check.jpg"),
  nightly_review: require("../../assets/nightly_review.jpg"),
};

const PAST_ENTRIES_SHOWN = 4;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function HubWide({ entryType, memory }: { entryType: EntryType; memory?: PaneMemory }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { entries, createEntry, updateEntry, deleteEntry } = useJournalStorage();
  const label = getCategoryById(entryType)?.label ?? "Journal";

  const [mode, setModeState] = useRememberedState<PaneMode>(memory, `hub.${entryType}.mode`, { type: "new", entryType });
  const setMode = (next: PaneMode) => {
    forgetKeptDraft(memory);
    setModeState(next);
  };
  const dirty = useRef(false);
  const onDirtyChange = useCallback((d: boolean) => {
    dirty.current = d;
  }, []);

  const past = useMemo(
    () =>
      entries
        .filter((e) => e.entry_type === entryType)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [entries, entryType],
  );

  const leave = () =>
    confirmDiscard(dirty.current, () => (router.canGoBack() ? router.back() : router.navigate("/home")));
  const openEntry = (entry: JournalEntry) =>
    confirmDiscard(dirty.current, () => setMode({ type: "view", entry }));
  const selectedId = mode.type === "new" ? null : mode.entry.id;

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + 6 }]}>
      <BackLink onPress={leave} />
      <View style={styles.columns}>
        {/* Left: image, title, past entries */}
        <View style={styles.left}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.leftContent} showsVerticalScrollIndicator={false}>
            <Image source={HERO[entryType]} style={styles.hero} resizeMode="cover" accessibilityIgnoresInvertColors />
            <Text style={[wideType.screenTitle, { color: colors.onSurface }]}>{label}</Text>
            {past.length > 0 ? (
              <>
                <Text style={[wideType.smallCaps, styles.caps, { color: colors.secondary }]}>Past entries</Text>
                {past.slice(0, PAST_ENTRIES_SHOWN).map((entry) => {
                  const selected = entry.id === selectedId;
                  return (
                    <Pressable
                      key={entry.id}
                      onPress={() => openEntry(entry)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.pastRow,
                        {
                          backgroundColor: colors.surfaceContainerLowest,
                          borderColor: selected ? colors.secondary : colors.surfaceContainerHighest,
                          borderWidth: selected ? 1.5 : 1,
                        },
                        pressed && styles.dim,
                      ]}
                    >
                      <View style={styles.flex}>
                        <Text style={[wideType.smallCaps, { color: colors.secondary, letterSpacing: 0 }]}>
                          {shortDate(entry.created_at)}
                        </Text>
                        <Text style={[wideType.secondary, { color: colors.onSurface }]} numberOfLines={1}>
                          {entryPreview(entry)}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => confirmDiscard(dirty.current, () => router.navigate("/journal"))}
                  accessibilityRole="link"
                  hitSlop={8}
                  style={styles.seeAll}
                >
                  <Text style={[wideType.link, { color: colors.secondary }]}>See all in Notebook →</Text>
                </Pressable>
              </>
            ) : (
              <Text style={[wideType.secondary, { color: colors.onSurfaceVariant }]}>
                Your entries will appear here.
              </Text>
            )}
          </ScrollView>
        </View>

        {/* Right: today's entry, a past entry, or the edit form */}
        <View style={styles.right}>
          <EntryPane
            mode={mode}
            onModeChange={setMode}
            onCreate={createEntry}
            onUpdate={updateEntry}
            onCancelNew={leave}
            onWriteToday={() => setMode({ type: "new", entryType })}
            onDelete={async (entry) => {
              await deleteEntry(entry.id);
              setMode({ type: "new", entryType });
            }}
            onDirtyChange={onDirtyChange}
            memory={memory}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, paddingLeft: 18, paddingRight: 20 },
  caps: { textTransform: "uppercase" },
  dim: { opacity: 0.5 },
  columns: { flex: 1, flexDirection: "row", gap: 24, marginTop: 4 },
  // Fixed proportions (flexBasis 0) so content never shifts the split.
  left: { flexGrow: 0.86, flexBasis: 0, minWidth: 0 },
  right: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
  leftContent: { gap: 10, paddingBottom: 24 },
  hero: { width: "100%", height: 130, borderRadius: layout.borderRadius, marginBottom: 6 },
  pastRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: layout.borderRadius,
  },
  seeAll: { marginTop: 4, alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },
});
