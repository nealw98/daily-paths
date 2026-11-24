import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { fonts, layout, wideType } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import type { Prayer } from "../../constants/prayers";

/**
 * Prayers in the wide layout (docs/widescreen-2.9/13–17). Left: "Write your
 * own", then the prayers with 2-line previews. Right: the open prayer, top-
 * aligned with the list, with expand and share; or the write/edit form.
 * Expand hides the list so the prayer fills the screen: short prayers sit
 * centered at a larger size, long ones (Just for Today) run in two columns
 * and scroll only when the Text Size setting makes them too tall. The
 * expanded state is kept while switching prayers.
 * PrayersScreen owns the data and storage and passes them in.
 */
export type PrayerKind = "builtin" | "personal";
type Item = Prayer & { kind: PrayerKind };

type Props = {
  builtInPrayers: Prayer[];
  personalPrayers: Prayer[];
  /** Open this prayer first (from Today's prayer card). */
  initialPrayerId?: string;
  /** Built-in prayer shown on Today's card; labelled "Today's prayer". */
  prayerOfTheDayId?: string;
  onViewed: (prayer: Prayer) => void;
  onShare: (prayer: Prayer) => void;
  onAdd: (title: string, text: string) => Promise<{ id: string }>;
  onUpdate: (kind: PrayerKind, id: string, title: string, text: string) => Promise<void>;
  /** Asks first, then deletes. */
  onDelete: (kind: PrayerKind, prayer: Prayer) => void;
};

type Mode = { type: "view" } | { type: "write" } | { type: "edit"; item: Item };

const paragraphs = (text: string) =>
  text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

// Long prayers get two columns when expanded.
const isLong = (text: string) => paragraphs(text).length >= 4 || text.length > 700;

// Split paragraphs into two columns, choosing the break that makes the
// longer column as short as possible (each paragraph also costs a gap).
function twoColumns(paras: string[]): [string[], string[]] {
  const PARAGRAPH_COST = 40; // roughly the characters a paragraph gap takes up
  const cost = (ps: string[]) => ps.reduce((n, p) => n + p.length + PARAGRAPH_COST, 0);
  let best = paras.length;
  let bestMax = Infinity;
  for (let cut = 1; cut < paras.length; cut++) {
    const longer = Math.max(cost(paras.slice(0, cut)), cost(paras.slice(cut)));
    if (longer < bestMax) {
      bestMax = longer;
      best = cut;
    }
  }
  return [paras.slice(0, best), paras.slice(best)];
}

const clear = (hex: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}00` : "transparent");

export function PrayersWide({
  builtInPrayers,
  personalPrayers,
  initialPrayerId,
  prayerOfTheDayId,
  onViewed,
  onShare,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const { colors } = useTheme();
  const { typography } = useTypography();
  const insets = useSafeAreaInsets();

  const items: Item[] = useMemo(
    () => [
      ...personalPrayers.map((p) => ({ ...p, kind: "personal" as const })),
      ...builtInPrayers.map((p) => ({ ...p, kind: "builtin" as const })),
    ],
    [personalPrayers, builtInPrayers],
  );

  const [selectedId, setSelectedId] = useState<string | undefined>(initialPrayerId ?? prayerOfTheDayId);
  const [mode, setMode] = useState<Mode>({ type: "view" });
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (initialPrayerId) {
      setSelectedId(initialPrayerId);
      setMode({ type: "view" });
    }
  }, [initialPrayerId]);

  // A deleted or hidden prayer falls back to the first in the list.
  const selected = items.find((p) => p.id === selectedId) ?? items[0];

  const select = (item: Item) => {
    setSelectedId(item.id);
    setMode({ type: "view" });
    onViewed(item);
  };
  const startWrite = () => {
    setTitle("");
    setText("");
    setMode({ type: "write" });
    setExpanded(false);
  };
  const startEdit = (item: Item) => {
    setTitle(item.title);
    setText(item.text);
    setMode({ type: "edit", item });
  };
  const canSave = !!title.trim() && !!text.trim();
  const save = async () => {
    if (!canSave) return;
    if (mode.type === "write") {
      const added = await onAdd(title, text);
      setSelectedId(added.id);
    } else if (mode.type === "edit") {
      await onUpdate(mode.item.kind, mode.item.id, title, text);
    }
    setMode({ type: "view" });
  };

  const prayerSize = typography.body.fontSize;
  const label = (item: Item) =>
    item.kind === "personal" ? "Your prayer" : item.id === prayerOfTheDayId ? "Today's prayer" : null;

  const iconButton = [
    styles.iconButton,
    { borderColor: colors.surfaceContainerHighest, backgroundColor: colors.surfaceContainerLowest },
  ];
  const card = [
    styles.card,
    { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceContainerHighest },
  ];

  const header = (item: Item) => (
    <View style={styles.paneHeader}>
      <View style={styles.flex}>
        {label(item) ? (
          <Text style={[wideType.smallCaps, styles.caps, { color: colors.secondary }]}>{label(item)}</Text>
        ) : null}
        <Text style={[wideType.paneTitle, styles.paneTitle, { color: colors.onSurface }]}>{item.title}</Text>
      </View>
      <View style={styles.headerButtons}>
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Collapse prayer" : "Expand prayer"}
          style={iconButton}
        >
          <MaterialIcons name={expanded ? "close-fullscreen" : "open-in-full"} size={16} color={colors.primary} />
        </Pressable>
        <Pressable onPress={() => onShare(item)} accessibilityRole="button" accessibilityLabel="Share" style={iconButton}>
          <MaterialIcons name={Platform.OS === "ios" ? "ios-share" : "share"} size={17} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );

  const source = (item: Item) =>
    item.source ? (
      <Text style={[wideType.secondary, { color: colors.onSurfaceVariant }]}>{item.source}</Text>
    ) : null;

  // --- Expanded: the prayer fills the screen ---
  if (expanded && selected && mode.type === "view") {
    const long = isLong(selected.text);
    const paras = paragraphs(selected.text);
    const [left, right] = twoColumns(paras);
    const longText = {
      fontFamily: fonts.loraRegular,
      fontSize: Math.round(prayerSize * (17 / 18)),
      lineHeight: Math.round(prayerSize * (17 / 18) * 1.45),
      color: colors.onSurface,
      marginBottom: 10,
    };
    return (
      <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + 6 }]}>
        <View style={[card, styles.expandedCard]}>
          {header(selected)}
          {long ? (
            <ScrollView style={styles.flex} contentContainerStyle={styles.expandedScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.columns}>
                <View style={styles.flex}>
                  {left.map((p, i) => <Text key={i} style={longText}>{p}</Text>)}
                </View>
                <View style={styles.flex}>
                  {right.map((p, i) => <Text key={i} style={longText}>{p}</Text>)}
                </View>
              </View>
              {source(selected)}
            </ScrollView>
          ) : (
            <ScrollView style={styles.flex} contentContainerStyle={styles.centered} showsVerticalScrollIndicator={false}>
              {paras.map((p, i) => (
                <Text
                  key={i}
                  style={{
                    fontFamily: fonts.loraRegular,
                    fontSize: Math.round(prayerSize * (22 / 18)),
                    lineHeight: Math.round(prayerSize * (22 / 18) * 1.75),
                    color: colors.onSurface,
                    textAlign: "center",
                    marginBottom: 16,
                  }}
                >
                  {p}
                </Text>
              ))}
              {selected.source ? (
                <Text style={[wideType.secondary, styles.expandedSource, { color: colors.onSurfaceVariant }]}>
                  {selected.source}
                </Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    );
  }

  // --- Two panes ---
  const writing = mode.type !== "view";
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Padding lives on this inner view: the keyboard view sets its own bottom padding. */}
      <View style={[styles.root, styles.row, { paddingTop: insets.top + 6 }]}>
      {/* Left: write your own + the list */}
      <View style={styles.listColumn}>
        <View style={styles.titleRow}>
          <Text style={[wideType.screenTitle, { color: colors.onSurface }]}>Prayers</Text>
        </View>
        <Pressable
          onPress={startWrite}
          accessibilityRole="button"
          style={[
            styles.writeRow,
            mode.type === "write"
              ? { borderStyle: "solid", borderWidth: 1.5, backgroundColor: colors.surfaceContainerLowest }
              : { borderStyle: "dashed", borderWidth: 1 },
            { borderColor: colors.secondary },
          ]}
        >
          <Text style={[styles.plus, { color: colors.primary }]}>+</Text>
          <Text style={[wideType.row, { color: colors.primary }]}>Write your own</Text>
        </Pressable>
        <View style={styles.flex}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {items.map((item, i) => {
              const isSelected = !writing && item.id === selected?.id;
              const firstBuiltin = item.kind === "builtin" && (i === 0 || items[i - 1].kind === "personal");
              return (
                <React.Fragment key={item.id}>
                  {/* Headings only when there are prayers of your own to tell apart. */}
                  {personalPrayers.length > 0 && (i === 0 || firstBuiltin) ? (
                    <Text style={[wideType.smallCaps, styles.caps, styles.listHeading, { color: colors.onSurfaceVariant }]}>
                      {item.kind === "personal" ? "Your prayers" : "Daily prayers"}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => select(item)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={({ pressed }) => [
                      styles.listRow,
                      {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: isSelected ? colors.secondary : colors.surfaceContainerHighest,
                        borderWidth: isSelected ? 1.5 : 1,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[wideType.row, { color: colors.onSurface }]}>{item.title}</Text>
                    <Text style={[wideType.secondary, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
                      {item.text.replace(/\s+/g, " ").trim()}
                    </Text>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </ScrollView>
          <LinearGradient pointerEvents="none" colors={[clear(colors.surface), colors.surface]} locations={[0, 0.9]} style={styles.fade} />
        </View>
      </View>

      {/* Right: the open prayer, or the write/edit form */}
      <View style={styles.paneColumn}>
        {writing ? (
          <>
            <View style={[card, styles.formCard]}>
              <View>
                <Text style={[wideType.smallCaps, styles.caps, { color: colors.secondary }]}>Your prayers</Text>
                <Text style={[wideType.paneTitle, styles.paneTitle, { color: colors.onSurface }]}>
                  {mode.type === "edit" ? "Edit prayer" : "Write your own"}
                </Text>
              </View>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Prayer title"
                placeholderTextColor={colors.onSurfaceVariant}
                accessibilityLabel="Prayer title"
                style={[styles.titleInput, wideType.row, { backgroundColor: colors.surfaceContainerHigh, color: colors.onSurface }]}
              />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Prayer text"
                placeholderTextColor={colors.onSurfaceVariant}
                accessibilityLabel="Prayer text"
                multiline
                textAlignVertical="top"
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceContainerHigh,
                    color: colors.onSurface,
                    fontFamily: fonts.loraRegular,
                    fontSize: prayerSize,
                    lineHeight: Math.round(prayerSize * 1.6),
                  },
                ]}
              />
            </View>
            <View style={styles.formButtons}>
              <Pressable
                onPress={() => setMode({ type: "view" })}
                accessibilityRole="button"
                style={[styles.cancelButton, { borderColor: colors.primary }]}
              >
                <Text style={[wideType.row, { color: colors.primary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave }}
                style={[
                  styles.saveButton,
                  { backgroundColor: canSave ? colors.primaryContainer : colors.outlineVariant },
                ]}
              >
                <Text style={[wideType.row, { color: colors.onPrimary }]}>Save prayer</Text>
              </Pressable>
            </View>
          </>
        ) : selected ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.paneScroll}>
            <View style={[card, styles.prayerCard]}>
              {header(selected)}
              <View style={styles.stanzas}>
                {paragraphs(selected.text).map((p, i) => (
                  <Text
                    key={i}
                    style={{
                      fontFamily: fonts.loraRegular,
                      fontSize: prayerSize,
                      lineHeight: Math.round(prayerSize * 1.7),
                      color: colors.onSurface,
                    }}
                  >
                    {p}
                  </Text>
                ))}
              </View>
              {source(selected)}
              <View style={styles.manageRow}>
                <Pressable onPress={() => startEdit(selected)} accessibilityRole="button" hitSlop={8}>
                  <Text style={[wideType.link, { color: colors.secondary }]}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => onDelete(selected.kind, selected)} accessibilityRole="button" hitSlop={8}>
                  <Text style={[wideType.link, { color: colors.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        ) : null}
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row", gap: 24 },
  root: { flex: 1, paddingLeft: 18, paddingRight: 20, paddingBottom: 18 },
  caps: { textTransform: "uppercase" },
  pressed: { opacity: 0.8 },

  listColumn: { flex: 0.92, gap: 8 },
  titleRow: { height: 44, justifyContent: "center" },
  writeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: layout.borderRadius,
  },
  plus: { fontFamily: fonts.headerFamilyLight, fontSize: 22, lineHeight: 24 },
  list: { gap: 8, paddingBottom: 40 },
  listHeading: { marginTop: 6 },
  listRow: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: layout.borderRadius, gap: 1 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 50 },

  paneColumn: { flex: 1.08, paddingTop: 46, gap: 14 },
  paneScroll: { paddingBottom: 24 },
  card: {
    borderWidth: 1,
    borderRadius: layout.borderRadiusLarge,
    shadowColor: "#214743",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  prayerCard: { paddingTop: 26, paddingHorizontal: 30, paddingBottom: 26, gap: 18 },
  paneHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  paneTitle: { marginTop: 4 },
  headerButtons: { flexDirection: "row", gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stanzas: { gap: 14 },
  manageRow: { flexDirection: "row", gap: 24, marginTop: 4 },

  formCard: { flex: 1, paddingVertical: 22, paddingHorizontal: 24, gap: 14 },
  titleInput: { height: 46, paddingHorizontal: 16, borderRadius: layout.borderRadius },
  textInput: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: layout.borderRadius },
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

  expandedCard: { flex: 1, paddingTop: 26, paddingHorizontal: 36, gap: 20, overflow: "hidden" },
  expandedScroll: { paddingBottom: 26 },
  columns: { flexDirection: "row", gap: 44 },
  centered: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  expandedSource: { marginTop: 2, textAlign: "center" },
});
