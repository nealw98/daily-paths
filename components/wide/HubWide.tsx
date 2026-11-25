import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { fonts, layout, wideType } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { useAppDate } from "../../contexts/AppDateContext";
import { useJournalStorage, type JournalEntry } from "../../hooks/useJournalStorage";
import { useDailyGratitudeQuote } from "../../hooks/useDailyGratitudeQuote";
import { useDailyJournalQuote } from "../../hooks/useDailyJournalQuote";
import { getCategoryById, type EntryType } from "../../constants/journalCategories";
import { buildJournalEntryShareMessage } from "../../utils/journalShare";
import {
  draftFromEntry,
  draftHasContent,
  draftPayload,
  emptyDraft,
  entryPreview,
  type JournalDraft,
} from "../../utils/journalEntryPayload";
import { BackLink } from "./BackLink";

/**
 * A journaling hub in the wide layout (docs/widescreen-2.9/08–12):
 * Gratitude, Journal, Spot Check and Nightly Review. Left: hero image,
 * title, the latest past entries and "See all in Notebook". Right: today's
 * entry, dated; a past entry when one is tapped (with Share, Edit and
 * "Write today's entry"); or that entry's edit form. Entries save in the
 * phone editor's format (utils/journalEntryPayload).
 */
const HERO: Record<EntryType, any> = {
  journal: require("../../assets/journal.jpg"),
  gratitude: require("../../assets/gratitude.jpg"),
  spot_check: require("../../assets/spot_check.jpg"),
  nightly_review: require("../../assets/nightly_review.jpg"),
};

const PAST_ENTRIES_SHOWN = 4;

type Pane = { type: "today" } | { type: "view"; entry: JournalEntry } | { type: "edit"; entry: JournalEntry };

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const longDate = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export function HubWide({ entryType }: { entryType: EntryType }) {
  const { colors } = useTheme();
  const { typography } = useTypography();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { today } = useAppDate();
  const category = getCategoryById(entryType);
  const editor = category?.editorType ?? "text";
  const { entries, createEntry, updateEntry } = useJournalStorage();
  const { quote: gratitudeQuote } = useDailyGratitudeQuote({ enabled: entryType === "gratitude" });
  const { quote: journalQuote } = useDailyJournalQuote({ enabled: entryType === "journal" });

  const [pane, setPane] = useState<Pane>({ type: "today" });
  const [draft, setDraft] = useState<JournalDraft>(() => emptyDraft(entryType));
  const [saving, setSaving] = useState(false);

  const past = useMemo(
    () =>
      entries
        .filter((e) => e.entry_type === entryType)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [entries, entryType],
  );

  const label = category?.label ?? "Journal";
  const writing = pane.type !== "view";
  const hasContent = draftHasContent(entryType, draft);

  // The daily quote over Gratitude and Journal (as on the phone editor).
  const introQuote = useMemo(() => {
    const live = entryType === "gratitude" ? gratitudeQuote : entryType === "journal" ? journalQuote : null;
    if (live?.quote) return { text: live.quote, author: live.author ?? "" };
    if (entryType !== "journal") return null;
    const raw = category?.introText ?? "";
    const m = raw.match(/^(.*?)(?:\s+[—-]\s*)([^—-][\s\S]*)$/);
    return m ? { text: m[1].trim(), author: m[2].trim() } : raw ? { text: raw, author: "" } : null;
  }, [entryType, gratitudeQuote, journalQuote, category?.introText]);

  // Asks before throwing away a draft.
  const confirmDiscard = (proceed: () => void) => {
    if (!writing || !hasContent) return proceed();
    Alert.alert("Unsaved entry", "Discard what you've written?", [
      { text: "Keep writing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: proceed },
    ]);
  };
  const leave = () => confirmDiscard(() => (router.canGoBack() ? router.back() : router.navigate("/home")));

  const openEntry = (entry: JournalEntry) =>
    confirmDiscard(() => {
      setDraft(emptyDraft(entryType));
      setPane({ type: "view", entry });
    });
  const writeToday = () => {
    setDraft(emptyDraft(entryType));
    setPane({ type: "today" });
  };
  const startEdit = (entry: JournalEntry) => {
    setDraft(draftFromEntry(entry));
    setPane({ type: "edit", entry });
  };

  const save = async () => {
    if (!hasContent || saving) return;
    setSaving(true);
    try {
      const { content, structured } = draftPayload(entryType, draft);
      if (pane.type === "edit") {
        await updateEntry(pane.entry.id, content, structured);
        setPane({
          type: "view",
          entry: { ...pane.entry, content, structured_content: structured, updated_at: new Date().toISOString() },
        });
      } else {
        const created = await createEntry(entryType, content, structured);
        setPane(created ? { type: "view", entry: created } : { type: "today" });
      }
      setDraft(emptyDraft(entryType));
    } catch {
      Alert.alert("Error", "Failed to save your entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const shareEntry = (entry: JournalEntry) =>
    Share.share({ message: buildJournalEntryShareMessage(entry) }).catch(() => {});
  const shareDraft = () => {
    const { content, structured } = draftPayload(entryType, draft);
    const now = new Date().toISOString();
    shareEntry({
      id: "draft",
      user_id: "local",
      entry_type: entryType,
      content,
      structured_content: structured,
      created_at: now,
      updated_at: now,
    });
  };

  // Entry text follows the Text Size setting.
  const entryText = {
    fontFamily: fonts.loraRegular,
    fontSize: typography.body.fontSize,
    lineHeight: Math.round(typography.body.fontSize * 1.45),
    color: colors.onSurface,
  };
  const field = [styles.field, { backgroundColor: colors.surfaceContainerHigh }];
  const card = [
    styles.card,
    { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceContainerHighest },
  ];
  const iconButton = [
    styles.iconButton,
    { borderColor: colors.surfaceContainerHighest, backgroundColor: colors.surfaceContainerLowest },
  ];

  const cardHeader = (dateText: string, title: string, buttons: React.ReactNode) => (
    <View style={styles.cardHeader}>
      <View style={styles.flex}>
        <Text style={[wideType.smallCaps, styles.caps, { color: colors.secondary }]}>{dateText}</Text>
        <Text style={[wideType.paneTitle, styles.cardTitle, { color: colors.onSurface }]}>{title}</Text>
      </View>
      <View style={styles.buttonRow}>{buttons}</View>
    </View>
  );

  const shareButton = (onPress: () => void, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Share"
      style={[iconButton, disabled && styles.dim]}
    >
      <MaterialIcons name={Platform.OS === "ios" ? "ios-share" : "share"} size={17} color={colors.primary} />
    </Pressable>
  );

  // --- The form: today's entry, or editing a past one ---
  const renderForm = () => {
    const editing = pane.type === "edit";
    const dateText = longDate(editing ? new Date(pane.entry.created_at) : today);
    const title = entryType === "gratitude" ? "Today I'm grateful for…" : label;
    return (
      <>
        {!editing && introQuote ? (
          <View style={[card, styles.quoteCard]}>
            <View style={[styles.quoteAccent, { backgroundColor: colors.primary }]} />
            <Text style={[wideType.quote, styles.center, { color: colors.onSurface }]}>{introQuote.text}</Text>
            {introQuote.author ? (
              <Text style={[wideType.secondary, styles.center, { color: colors.onSurfaceVariant }]}>
                {introQuote.author}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={[card, styles.formCard]}>
          {cardHeader(dateText, editing && entryType === "gratitude" ? "I was grateful for…" : title, shareButton(shareDraft, !hasContent))}
          {editor === "guided" && category?.introText ? (
            <Text style={[wideType.preview, { color: colors.secondary }]}>{category.introText}</Text>
          ) : null}

          {editor === "text" ? (
            <TextInput
              value={draft.text}
              onChangeText={(text) => setDraft((d) => ({ ...d, text }))}
              placeholder="What's on your mind…"
              placeholderTextColor={colors.onSurfaceVariant}
              accessibilityLabel="Journal entry"
              multiline
              textAlignVertical="top"
              style={[field, entryText, styles.journalField]}
            />
          ) : null}

          {editor === "items" ? (
            <View style={styles.items}>
              {draft.items.map((item, i) => (
                <View key={i} style={styles.itemRow}>
                  <TextInput
                    value={item}
                    onChangeText={(t) =>
                      setDraft((d) => ({ ...d, items: d.items.map((x, j) => (j === i ? t : x)) }))
                    }
                    placeholder={i === 0 ? "Something small is fine" : ""}
                    placeholderTextColor={colors.onSurfaceVariant}
                    accessibilityLabel={`Gratitude ${i + 1}`}
                    multiline
                    style={[field, entryText, styles.flex]}
                  />
                  {draft.items.length > 1 ? (
                    <Pressable
                      onPress={() => setDraft((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove gratitude ${i + 1}`}
                      hitSlop={10}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.outlineVariant} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
              <Pressable
                onPress={() => setDraft((d) => ({ ...d, items: [...d.items, ""] }))}
                accessibilityRole="button"
                style={styles.addRow}
                hitSlop={8}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={[wideType.row, { color: colors.primary }]}>Add another</Text>
              </Pressable>
            </View>
          ) : null}

          {editor === "guided" ? (
            <View style={styles.questions}>
              {(category?.guidedPrompts ?? []).map((p) => (
                <View key={p.id} style={styles.question}>
                  <Text style={[wideType.row, { color: colors.onSurface }]}>{p.question}</Text>
                  <TextInput
                    value={draft.responses[p.id] ?? ""}
                    onChangeText={(t) => setDraft((d) => ({ ...d, responses: { ...d.responses, [p.id]: t } }))}
                    placeholder={p.placeholder}
                    placeholderTextColor={colors.onSurfaceVariant}
                    accessibilityLabel={p.question}
                    multiline
                    style={[field, entryText]}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.formButtons}>
          <Pressable
            onPress={() => (editing ? setPane({ type: "view", entry: pane.entry }) : leave())}
            accessibilityRole="button"
            style={[styles.cancelButton, { borderColor: colors.primary }]}
          >
            <Text style={[wideType.row, { color: colors.primary }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={!hasContent || saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasContent || saving }}
            style={[
              styles.saveButton,
              { backgroundColor: hasContent ? colors.primaryContainer : colors.outlineVariant },
            ]}
          >
            <Text style={[wideType.row, { color: colors.onPrimary }]}>
              {saving ? "Saving…" : editing ? "Save changes" : "Save to Notebook"}
            </Text>
          </Pressable>
        </View>
      </>
    );
  };

  // --- A past entry, read-only ---
  const renderEntry = (entry: JournalEntry) => {
    const d = draftFromEntry(entry);
    const title = entryType === "gratitude" ? "I was grateful for…" : label;
    return (
      <>
        <View style={[card, styles.formCard]}>
          {cardHeader(
            longDate(new Date(entry.created_at)),
            title,
            <>
              {shareButton(() => shareEntry(entry))}
              <Pressable onPress={() => startEdit(entry)} accessibilityRole="button" accessibilityLabel="Edit" style={iconButton}>
                <MaterialIcons name="edit" size={16} color={colors.primary} />
              </Pressable>
            </>,
          )}
          {editor === "items" ? (
            <View style={styles.items}>
              {d.items.filter(Boolean).map((item, i) => (
                <View key={i} style={[styles.readItem, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Text style={[wideType.secondary, styles.itemNumber, { color: colors.secondary }]}>{i + 1}</Text>
                  <Text style={[entryText, styles.flex]}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {editor === "text" ? <Text style={entryText}>{d.text}</Text> : null}
          {editor === "guided" ? (
            <View style={styles.questions}>
              {(category?.guidedPrompts ?? [])
                .filter((p) => d.responses[p.id]?.trim())
                .map((p) => (
                  <View key={p.id} style={styles.question}>
                    <Text style={[wideType.row, { color: colors.onSurface }]}>{p.question}</Text>
                    <Text style={entryText}>{d.responses[p.id]}</Text>
                  </View>
                ))}
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={writeToday}
          accessibilityRole="button"
          style={[styles.writeToday, { backgroundColor: colors.secondary }]}
        >
          <Ionicons name="add" size={20} color={colors.onSecondary} />
          <Text style={[wideType.row, { color: colors.onSecondary }]}>Write today's entry</Text>
        </Pressable>
      </>
    );
  };

  const selectedId = pane.type === "today" ? null : pane.entry.id;

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
              <Pressable onPress={() => router.navigate("/journal")} accessibilityRole="link" hitSlop={8} style={styles.seeAll}>
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
        <KeyboardAwareScrollView
          style={styles.flex}
          contentContainerStyle={[styles.rightContent, { paddingBottom: Math.max(insets.bottom, 20) }]}
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {pane.type === "view" ? renderEntry(pane.entry) : renderForm()}
        </KeyboardAwareScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, paddingLeft: 18, paddingRight: 20 },
  caps: { textTransform: "uppercase" },
  center: { textAlign: "center" },
  dim: { opacity: 0.5 },
  columns: { flex: 1, flexDirection: "row", gap: 24, marginTop: 4 },

  // Fixed proportions (flexBasis 0) so content never shifts the split.
  left: { flexGrow: 0.86, flexBasis: 0, minWidth: 0 },
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

  right: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
  rightContent: { gap: 14 },
  card: {
    borderWidth: 1,
    borderRadius: layout.borderRadiusLarge,
    shadowColor: "#214743",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  quoteCard: { paddingVertical: 16, paddingHorizontal: 24, gap: 6, overflow: "hidden" },
  quoteAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 6 },
  formCard: { paddingVertical: 22, paddingHorizontal: 22, gap: 14 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardTitle: { marginTop: 4 },
  buttonRow: { flexDirection: "row", gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: layout.borderRadius },
  journalField: { minHeight: 260 },
  items: { gap: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 4 },
  questions: { gap: 14 },
  question: { gap: 6 },
  readItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: layout.borderRadius,
  },
  itemNumber: { fontFamily: fonts.loraRegular, minWidth: 12 },
  formButtons: { flexDirection: "row", gap: 12 },
  cancelButton: {
    height: 48,
    paddingHorizontal: 26,
    borderWidth: 2,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: { flex: 1, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  writeToday: {
    flexDirection: "row",
    gap: 6,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
