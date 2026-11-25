import React, { useCallback, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout, wideType } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import type { JournalEntry } from "../../hooks/useJournalStorage";
import { JOURNAL_CATEGORIES, getCategoryColor, type EntryType } from "../../constants/journalCategories";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { JournalTimeline } from "../journal/JournalTimeline";
import { EntryPane, confirmDiscard, forgetKeptDraft, type PaneMode } from "./EntryPane";
import { useRememberedState, type PaneMemory } from "../../utils/paneMemory";

/**
 * The Notebook in the wide layout (docs/widescreen-2.9/05–07). Left: the
 * phone Notebook's timeline (day headers with dots, "+ New entry" under
 * Today). Right: "Would you like to add?" with the four types (05), the
 * open entry (06) or a new entry's form (07) — the same pane as that
 * type's hub, while the left stays the timeline. The Notebook tab owns the
 * entries and passes them in, so the timeline updates on save.
 */
type Props = {
  subtitle: string;
  entries: JournalEntry[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onViewed: (entry: JournalEntry) => void;
  createEntry: (type: EntryType, content: string, structured: Record<string, any> | null) => Promise<JournalEntry | null>;
  updateEntry: (id: string, content: string, structured: Record<string, any> | null) => Promise<unknown>;
  deleteEntry: (id: string) => Promise<unknown>;
  /** Keeps the open pane across the wide ↔ phone layout switch. */
  memory?: PaneMemory;
};

type Right = { type: "choose" } | PaneMode;

export function NotebookWide({
  subtitle,
  entries,
  loading,
  error,
  onRefresh,
  onViewed,
  createEntry,
  updateEntry,
  deleteEntry,
  memory,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [right, setRightState] = useRememberedState<Right>(memory, "notebook.right", { type: "choose" });
  const setRight = (next: Right) => {
    forgetKeptDraft(memory);
    setRightState(next);
  };
  const dirty = useRef(false);
  const onDirtyChange = useCallback((d: boolean) => {
    dirty.current = d;
  }, []);

  const go = (next: Right) => confirmDiscard(dirty.current, () => setRight(next));
  const selectEntry = (entry: JournalEntry) => {
    go({ type: "view", entry });
    onViewed(entry);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + 6 }]}>
      {/* Left: the timeline */}
      <View style={styles.left}>
        <View style={styles.titleBlock}>
          <Text style={[wideType.screenTitle, { color: colors.onSurface }]}>Notebook</Text>
          <Text style={[wideType.secondary, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
        </View>
        <JournalTimeline
          entries={entries}
          loading={loading}
          error={error}
          onCreateEntry={() => go({ type: "choose" })}
          onSelectEntry={selectEntry}
          onDeleteEntry={() => {}}
          onRefresh={onRefresh}
          selectedEntryId={right.type === "view" || right.type === "edit" ? right.entry.id : null}
          newEntrySelected={right.type === "new"}
        />
      </View>

      {/* Right: choose a type, an open entry, or a new entry */}
      <View style={styles.right}>
        {right.type === "choose" ? (
          <View style={styles.chooser}>
            <Text style={[wideType.paneTitle, { color: colors.onSurface }]}>Would you like to add?</Text>
            {JOURNAL_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => setRight({ type: "new", entryType: cat.id })}
                accessibilityRole="button"
                accessibilityLabel={`${cat.label}. ${cat.description}`}
                style={({ pressed }) => [
                  styles.typeRow,
                  { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceContainerHighest },
                  pressed && styles.pressed,
                ]}
              >
                <EntryTypeIcon svgIcon={cat.svgIcon} size={22} color={getCategoryColor(cat.id)} />
                <View style={styles.flex}>
                  <Text style={[wideType.row, { color: colors.onSurface }]}>{cat.label}</Text>
                  <Text style={[wideType.secondary, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                    {cat.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <EntryPane
            mode={right}
            onModeChange={setRight}
            onCreate={createEntry}
            onUpdate={updateEntry}
            onCancelNew={() => setRight({ type: "choose" })}
            onDelete={async (entry) => {
              await deleteEntry(entry.id);
              setRight({ type: "choose" });
            }}
            showTypeIcon
            onDirtyChange={onDirtyChange}
            memory={memory}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  root: { flex: 1, flexDirection: "row", gap: 24, paddingLeft: 10, paddingRight: 20 },
  // Fixed proportions (flexBasis 0) so content never shifts the split.
  left: { flexGrow: 0.86, flexBasis: 0, minWidth: 0 },
  right: { flexGrow: 1, flexBasis: 0, minWidth: 0, paddingTop: 50 },
  titleBlock: { paddingLeft: 8, paddingBottom: 6 },
  chooser: { gap: 12 },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: layout.borderRadiusLarge,
  },
});
