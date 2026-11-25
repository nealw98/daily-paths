import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { fonts, layout, wideType } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { useAppDate } from "../../contexts/AppDateContext";
import type { JournalEntry } from "../../hooks/useJournalStorage";
import { useDailyGratitudeQuote } from "../../hooks/useDailyGratitudeQuote";
import { useDailyJournalQuote } from "../../hooks/useDailyJournalQuote";
import { getCategoryById, getCategoryColor, type EntryType } from "../../constants/journalCategories";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { buildJournalEntryShareMessage } from "../../utils/journalShare";
import {
  draftFromEntry,
  draftHasContent,
  draftPayload,
  emptyDraft,
  type JournalDraft,
} from "../../utils/journalEntryPayload";
import type { PaneMemory } from "../../utils/paneMemory";

/**
 * The right-hand entry pane shared by the journaling hubs (08–12) and the
 * Notebook (06–07) in the wide layout: today's entry form for one type, a
 * past entry read-only (Share, Edit), or that entry's edit form. The parent
 * owns the entries (so its list updates on save) and decides what Cancel
 * and "Write today's entry" do. Entries save in the phone editor's format.
 */
export type PaneMode =
  | { type: "new"; entryType: EntryType }
  | { type: "view"; entry: JournalEntry }
  | { type: "edit"; entry: JournalEntry };

type Props = {
  mode: PaneMode;
  onModeChange: (mode: PaneMode) => void;
  onCreate: (type: EntryType, content: string, structured: Record<string, any> | null) => Promise<JournalEntry | null>;
  onUpdate: (id: string, content: string, structured: Record<string, any> | null) => Promise<unknown>;
  /** Cancel on a new entry. */
  onCancelNew: () => void;
  /** Shows "Write today's entry" under a past entry (the hubs). */
  onWriteToday?: () => void;
  /** Shows the type's icon beside the title (the Notebook, which mixes types). */
  showTypeIcon?: boolean;
  /** Deletes a past entry (asks first). */
  onDelete?: (entry: JournalEntry) => Promise<unknown>;
  /** Tells the parent whether there is unsaved writing. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Keeps a half-written draft across the wide ↔ phone layout switch. */
  memory?: PaneMemory;
};

// The one draft slot kept in PaneMemory: the form it belongs to, and its text.
const DRAFT_SLOT = "entryPane.draft";
type DraftSlot = { key: string; draft: JournalDraft };

/**
 * Drops the kept draft. Parents call it whenever they change the pane's
 * mode (open, save, cancel, discard): only a layout switch, which changes
 * no mode, should bring a draft back.
 */
export function forgetKeptDraft(memory: PaneMemory | undefined) {
  memory?.delete(DRAFT_SLOT);
}

/** Ask before throwing away unsaved writing. */
export function confirmDiscard(dirty: boolean, proceed: () => void) {
  if (!dirty) return proceed();
  Alert.alert("Unsaved entry", "Discard what you've written?", [
    { text: "Keep writing", style: "cancel" },
    { text: "Discard", style: "destructive", onPress: proceed },
  ]);
}

const modeKey = (m: PaneMode) => (m.type === "new" ? `new:${m.entryType}` : `${m.type}:${m.entry.id}`);
const longDate = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

// A fresh draft whenever the pane switches to another entry or form.
export function EntryPane(props: Props) {
  return <EntryPaneInner key={modeKey(props.mode)} {...props} />;
}

function EntryPaneInner({
  mode,
  onModeChange,
  onCreate,
  onUpdate,
  onCancelNew,
  onWriteToday,
  showTypeIcon = false,
  onDelete,
  onDirtyChange,
  memory,
}: Props) {
  const { colors } = useTheme();
  const { typography } = useTypography();
  const insets = useSafeAreaInsets();
  const { today } = useAppDate();
  const entryType: EntryType = mode.type === "new" ? mode.entryType : mode.entry.entry_type;
  const category = getCategoryById(entryType);
  const editor = category?.editorType ?? "text";
  const label = category?.label ?? "Journal";
  const { quote: gratitudeQuote } = useDailyGratitudeQuote({ enabled: entryType === "gratitude" });
  const { quote: journalQuote } = useDailyJournalQuote({ enabled: entryType === "journal" });

  const slotKey = modeKey(mode);
  const [draft, setDraftState] = useState<JournalDraft>(() => {
    const kept = memory?.get(DRAFT_SLOT) as DraftSlot | undefined;
    if (kept?.key === slotKey) return kept.draft;
    return mode.type === "edit" ? draftFromEntry(mode.entry) : emptyDraft(entryType);
  });
  const setDraft = (next: React.SetStateAction<JournalDraft>) =>
    setDraftState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      memory?.set(DRAFT_SLOT, { key: slotKey, draft: value } satisfies DraftSlot);
      return value;
    });
  const [saving, setSaving] = useState(false);
  const writing = mode.type !== "view";
  const hasContent = draftHasContent(entryType, draft);

  useEffect(() => {
    onDirtyChange?.(writing && hasContent);
  }, [writing, hasContent, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // The daily quote over a new Gratitude or Journal entry (as on the phone).
  const introQuote = useMemo(() => {
    const live = entryType === "gratitude" ? gratitudeQuote : entryType === "journal" ? journalQuote : null;
    if (live?.quote) return { text: live.quote, author: live.author ?? "" };
    if (entryType !== "journal") return null;
    const raw = category?.introText ?? "";
    const m = raw.match(/^(.*?)(?:\s+[—-]\s*)([^—-][\s\S]*)$/);
    return m ? { text: m[1].trim(), author: m[2].trim() } : raw ? { text: raw, author: "" } : null;
  }, [entryType, gratitudeQuote, journalQuote, category?.introText]);

  const save = async () => {
    if (!hasContent || saving) return;
    setSaving(true);
    try {
      const { content, structured } = draftPayload(entryType, draft);
      if (mode.type === "edit") {
        await onUpdate(mode.entry.id, content, structured);
        onDirtyChange?.(false);
        onModeChange({
          type: "view",
          entry: { ...mode.entry, content, structured_content: structured, updated_at: new Date().toISOString() },
        });
      } else {
        const created = await onCreate(entryType, content, structured);
        onDirtyChange?.(false);
        if (created) onModeChange({ type: "view", entry: created });
      }
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
        <View style={styles.titleRow}>
          {showTypeIcon && category ? (
            <EntryTypeIcon svgIcon={category.svgIcon} size={20} color={getCategoryColor(entryType)} />
          ) : null}
          <Text style={[wideType.paneTitle, styles.flex, { color: colors.onSurface }]}>{title}</Text>
        </View>
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

  // --- The form: a new entry, or editing a past one ---
  const renderForm = () => {
    const editing = mode.type === "edit";
    const dateText = longDate(editing ? new Date(mode.entry.created_at) : today);
    const title =
      entryType === "gratitude" ? (editing ? "I was grateful for…" : "Today I'm grateful for…") : label;
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
          {cardHeader(dateText, title, shareButton(shareDraft, !hasContent))}
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
            onPress={() =>
              editing
                ? confirmDiscard(hasContent, () => onModeChange({ type: "view", entry: mode.entry }))
                : onCancelNew()
            }
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
              <Pressable
                onPress={() => onModeChange({ type: "edit", entry })}
                accessibilityRole="button"
                accessibilityLabel="Edit"
                style={iconButton}
              >
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
          {editor === "text" ? (
            <View style={styles.paragraphs}>
              {d.text
                .split(/\n{2,}/)
                .map((p) => p.trim())
                .filter(Boolean)
                .map((p, i) => (
                  <Text key={i} style={entryText}>
                    {p}
                  </Text>
                ))}
            </View>
          ) : null}
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
          {onDelete ? (
            <Pressable
              onPress={() =>
                Alert.alert("Delete Entry?", "This cannot be undone.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => void onDelete(entry) },
                ])
              }
              accessibilityRole="button"
              hitSlop={8}
              style={styles.deleteLink}
            >
              <Text style={[wideType.link, { color: colors.danger }]}>Delete entry</Text>
            </Pressable>
          ) : null}
        </View>
        {onWriteToday ? (
          <Pressable
            onPress={onWriteToday}
            accessibilityRole="button"
            style={[styles.writeToday, { backgroundColor: colors.secondary }]}
          >
            <Ionicons name="add" size={20} color={colors.onSecondary} />
            <Text style={[wideType.row, { color: colors.onSecondary }]}>Write today's entry</Text>
          </Pressable>
        ) : null}
      </>
    );
  };

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {mode.type === "view" ? renderEntry(mode.entry) : renderForm()}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  caps: { textTransform: "uppercase" },
  center: { textAlign: "center" },
  dim: { opacity: 0.5 },
  content: { gap: 14 },
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
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
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
  paragraphs: { gap: 12 },
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
  deleteLink: { alignSelf: "flex-start", marginTop: 4 },
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
