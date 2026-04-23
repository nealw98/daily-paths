import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { useAnalytics } from "../../utils/analytics";
import { usePersonalPrayers, type PersonalPrayer } from "../../hooks/usePersonalPrayers";
import { useJournalStorage } from "../../hooks/useJournalStorage";
import type { EntryType } from "../../constants/journalCategories";
import { fonts, typography as staticTypography } from "../../constants/theme";
import { PRAYERS, type Prayer } from "../../constants/prayers";
import { TealHeader } from "../shared/TealHeader";
import { PageTitle } from "../ui/PageTitle";
import { JournalCategoryPicker } from "../journal/JournalCategoryPicker";
import { JournalEntryEditor } from "../journal/JournalEntryEditor";
import { FieldShell, SanctuaryButton, SanctuaryCard } from "../ui/Sanctuary";

const BUILTIN_PRAYER_OVERRIDES_KEY = "@daily_paths_builtin_prayer_overrides_v1";
const HIDDEN_BUILTIN_PRAYERS_KEY = "@daily_paths_hidden_builtin_prayers_v1";

type BuiltInPrayerOverride = {
  title: string;
  text: string;
};

export const PrayersScreen: React.FC = () => {
  const { colors } = useTheme();
  const { typography } = useTypography();
  const { trackPrayerViewed } = useAnalytics();
  const { prayers: personalPrayers, addPrayer, updatePrayer, deletePrayer } = usePersonalPrayers();
  const { createEntry } = useJournalStorage();
  const [expandedPrayer, setExpandedPrayer] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showJournalPicker, setShowJournalPicker] = useState(false);
  const [journalEntryType, setJournalEntryType] = useState<EntryType | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<"personal" | "builtin" | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [builtinOverrides, setBuiltinOverrides] = useState<Record<string, BuiltInPrayerOverride>>({});
  const [hiddenBuiltinPrayerIds, setHiddenBuiltinPrayerIds] = useState<string[]>([]);
  const scrollRef = useRef<any>(null);

  // Sizing for Edit/Delete/Cancel/Save labels — scales with the global
  // text-size setting instead of the old static 14/18.
  const actionTextStyle = useMemo(
    () => ({
      fontSize: typography.bodySmallFontSize,
      lineHeight: typography.bodySmallLineHeight,
    }),
    [typography.bodySmallFontSize, typography.bodySmallLineHeight]
  );

  useEffect(() => {
    (async () => {
      try {
        const [rawOverrides, rawHidden] = await Promise.all([
          AsyncStorage.getItem(BUILTIN_PRAYER_OVERRIDES_KEY),
          AsyncStorage.getItem(HIDDEN_BUILTIN_PRAYERS_KEY),
        ]);

        if (rawOverrides) {
          setBuiltinOverrides(JSON.parse(rawOverrides));
        }
        if (rawHidden) {
          setHiddenBuiltinPrayerIds(JSON.parse(rawHidden));
        }
      } catch (error) {
        console.warn("Failed to load built-in prayer preferences", error);
      }
    })();
  }, []);

  const builtInPrayers = useMemo(
    () =>
      PRAYERS.filter((prayer) => !hiddenBuiltinPrayerIds.includes(prayer.id)).map((prayer) => ({
        ...prayer,
        ...(builtinOverrides[prayer.id] ?? {}),
      })),
    [builtinOverrides, hiddenBuiltinPrayerIds]
  );

  /** Render prayer text with bold phrases (e.g. "Just for today", "Just for tonight") */
  const renderPrayerText = (text: string, boldPhrases: string[]) => {
    if (boldPhrases.length === 0) return text;

    const pattern = new RegExp(`(${boldPhrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = text.split(pattern);

    return parts.map((part, i) => {
      const isBold = boldPhrases.some(p => p.toLowerCase() === part.toLowerCase());
      if (isBold) {
        return (
          <Text key={i} style={{ fontFamily: fonts.bodyFamilyBold, fontWeight: "700" }}>
            {part}
          </Text>
        );
      }
      return part;
    });
  };

  const getPrayerPreview = (text: string) =>
    text
      .replace(/\s+/g, " ")
      .trim();

  const renderPrayer = (prayer: Prayer) => {
    const isExpanded = expandedPrayer === prayer.id;
    const isEditing = editingKind === "builtin" && editingId === prayer.id;

    const boldPhrases: string[] = [];

    return (
      <SanctuaryCard
        key={prayer.id}
        tone="lowest"
        style={styles.prayerSection}
        contentStyle={styles.prayerSectionContent}
        elevated
      >
        <TouchableOpacity
          style={styles.prayerHeader}
          onPress={() => {
            const expanding = !isExpanded;
            setExpandedPrayer(expanding ? prayer.id : null);
            if (expanding) {
              trackPrayerViewed(prayer.id, prayer.title);
            }
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.prayerTitle,
              typography.h3,
              {
                fontFamily: fonts.bodyFamilySemiBold,
                fontSize: typography.bodySmallFontSize + 2,
                lineHeight: Math.round((typography.bodySmallFontSize + 2) * (22 / 17)),
                color: colors.onSurface,
              },
            ]}
          >
            {prayer.title}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-down" : "chevron-forward"}
            size={20}
            color={colors.onSurfaceVariant}
          />
        </TouchableOpacity>

        {!isExpanded && (
          <Text
            style={[
              styles.prayerPreview,
              { color: colors.onSurfaceVariant, fontSize: typography.bodySmall.fontSize + 1, lineHeight: typography.bodySmall.lineHeight + 1 },
            ]}
            numberOfLines={2}
          >
            {renderPrayerText(getPrayerPreview(prayer.text), boldPhrases)}
          </Text>
        )}

        {isExpanded && !isEditing && (
          <View style={styles.prayerBody}>
            {prayer.text.split("\n\n").map((stanza, i) => (
              <Text
                key={i}
                style={[
                  styles.prayerText,
                  i > 0 && { marginTop: Math.round(typography.bodySmall.fontSize * 0.85) },
                  { color: colors.onSurfaceVariant, fontSize: typography.bodySmall.fontSize + 1, lineHeight: typography.bodySmall.lineHeight + 1 },
                ]}
              >
                {renderPrayerText(stanza, boldPhrases)}
              </Text>
            ))}
            {prayer.source && (
              <Text style={[styles.prayerSource, { color: colors.seafoam, fontSize: typography.bodyFontSize - 2 }]}>
                — {prayer.source.toUpperCase()}
              </Text>
            )}
          </View>
        )}

        {isEditing && (
          <View style={styles.formContainer}>
            <FieldShell style={styles.inputShell}>
              <TextInput
                style={[styles.titleInput, { color: colors.text, fontSize: typography.bodyLargeFontSize }]}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Prayer title"
                placeholderTextColor={colors.textSecondary + "99"}
              />
            </FieldShell>
            <FieldShell style={styles.inputShell}>
              <TextInput
                style={[styles.bodyInput, { color: colors.text, fontSize: typography.bodySmallFontSize, lineHeight: Math.round(typography.bodySmallFontSize * 1.625) }]}
                value={editText}
                onChangeText={setEditText}
                placeholder="Prayer text"
                placeholderTextColor={colors.textSecondary + "99"}
                multiline
                textAlignVertical="top"
              />
            </FieldShell>
            <View style={styles.formActions}>
              <TouchableOpacity
                onPress={() => handleDeleteBuiltin(prayer)}
                activeOpacity={0.8}
                style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.personalActionText, actionTextStyle, { color: colors.danger }]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCancelEdit}
                activeOpacity={0.8}
                style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.personalActionText, actionTextStyle, { color: colors.primaryContainer }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={!editTitle.trim() || !editText.trim()}
                activeOpacity={0.8}
                style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.personalActionText, actionTextStyle, { color: !editTitle.trim() || !editText.trim() ? colors.outlineVariant : colors.primaryContainer }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isExpanded && !isEditing && (
          <View style={styles.personalActions}>
            <TouchableOpacity
              onPress={() => handleStartEdit(prayer, "builtin")}
              activeOpacity={0.8}
              style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.personalActionText, actionTextStyle, { color: colors.primaryContainer }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteBuiltin(prayer)}
              activeOpacity={0.8}
              style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.personalActionText, actionTextStyle, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </SanctuaryCard>
    );
  };

  const handleStartEdit = (
    prayer: Pick<Prayer, "id" | "title" | "text">,
    kind: "personal" | "builtin"
  ) => {
    setEditingKind(kind);
    setEditingId(prayer.id);
    setEditTitle(prayer.title);
    setEditText(prayer.text);
    setExpandedPrayer(prayer.id);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim() || !editText.trim()) return;
    if (editingKind === "builtin") {
      const nextOverrides = {
        ...builtinOverrides,
        [editingId]: {
          title: editTitle.trim(),
          text: editText.trim(),
        },
      };
      setBuiltinOverrides(nextOverrides);
      await AsyncStorage.setItem(BUILTIN_PRAYER_OVERRIDES_KEY, JSON.stringify(nextOverrides));
    } else {
      await updatePrayer(editingId, editTitle, editText);
    }
    setEditingKind(null);
    setEditingId(null);
    setEditTitle("");
    setEditText("");
  };

  const handleCancelEdit = () => {
    setEditingKind(null);
    setEditingId(null);
    setEditTitle("");
    setEditText("");
  };

  const handleDelete = (prayer: PersonalPrayer) => {
    Alert.alert("Delete Prayer?", `Remove "${prayer.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deletePrayer(prayer.id);
          if (expandedPrayer === prayer.id) setExpandedPrayer(null);
          if (editingId === prayer.id) handleCancelEdit();
        },
      },
    ]);
  };

  const handleDeleteBuiltin = (prayer: Prayer) => {
    Alert.alert("Delete Prayer?", `Remove "${prayer.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const nextHidden = [...new Set([...hiddenBuiltinPrayerIds, prayer.id])];
          setHiddenBuiltinPrayerIds(nextHidden);
          await AsyncStorage.setItem(HIDDEN_BUILTIN_PRAYERS_KEY, JSON.stringify(nextHidden));
          if (expandedPrayer === prayer.id) setExpandedPrayer(null);
          if (editingId === prayer.id) handleCancelEdit();
        },
      },
    ]);
  };

  const handleSaveNew = async () => {
    if (!newTitle.trim() || !newText.trim()) return;
    await addPrayer(newTitle, newText);
    setNewTitle("");
    setNewText("");
    setShowAddForm(false);
  };

  const renderPersonalPrayer = (prayer: PersonalPrayer) => {
    const isExpanded = expandedPrayer === prayer.id;
    const isEditing = editingKind === "personal" && editingId === prayer.id;

    return (
      <SanctuaryCard
        key={prayer.id}
        tone="lowest"
        style={styles.prayerSection}
        contentStyle={styles.prayerSectionContent}
        elevated
      >
        <TouchableOpacity
          style={styles.prayerHeader}
          onPress={() => {
            if (isEditing) handleCancelEdit();
            setExpandedPrayer(isExpanded ? null : prayer.id);
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.prayerTitle,
              typography.h3,
              {
                fontFamily: fonts.bodyFamilySemiBold,
                fontSize: typography.bodySmallFontSize + 2,
                lineHeight: Math.round((typography.bodySmallFontSize + 2) * (22 / 17)),
                color: colors.onSurface,
              },
            ]}
          >
            {prayer.title}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-down" : "chevron-forward"}
            size={20}
            color={colors.onSurfaceVariant}
          />
        </TouchableOpacity>

        {!isExpanded && (
          <Text
            style={[
              styles.prayerPreview,
              { color: colors.onSurfaceVariant, fontSize: typography.bodySmall.fontSize + 1, lineHeight: typography.bodySmall.lineHeight + 1 },
            ]}
            numberOfLines={2}
          >
            {getPrayerPreview(prayer.text)}
          </Text>
        )}

        {isExpanded && !isEditing && (
          <View style={styles.prayerBody}>
            {prayer.text.split("\n\n").map((stanza, i) => (
              <Text
                key={i}
                style={[
                  styles.prayerText,
                  i > 0 && { marginTop: Math.round(typography.bodySmall.fontSize * 0.85) },
                  { color: colors.onSurfaceVariant, fontSize: typography.bodySmall.fontSize + 1, lineHeight: typography.bodySmall.lineHeight + 1 },
                ]}
              >
                {stanza}
              </Text>
            ))}
          </View>
        )}

        {isEditing && (
          <View style={styles.formContainer}>
            <FieldShell style={styles.inputShell}>
              <TextInput
                style={[styles.titleInput, { color: colors.text, fontSize: typography.bodyLargeFontSize }]}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Prayer title"
                placeholderTextColor={colors.textSecondary + "99"}
              />
            </FieldShell>
            <FieldShell style={styles.inputShell}>
              <TextInput
                style={[styles.bodyInput, { color: colors.text, fontSize: typography.bodySmallFontSize, lineHeight: Math.round(typography.bodySmallFontSize * 1.625) }]}
                value={editText}
                onChangeText={setEditText}
                placeholder="Prayer text"
                placeholderTextColor={colors.textSecondary + "99"}
                multiline
                textAlignVertical="top"
              />
            </FieldShell>
            <View style={styles.formActions}>
              <TouchableOpacity
                onPress={() => handleDelete(prayer)}
                activeOpacity={0.8}
                style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.personalActionText, actionTextStyle, { color: colors.danger }]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCancelEdit}
                activeOpacity={0.8}
                style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.personalActionText, actionTextStyle, { color: colors.primaryContainer }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={!editTitle.trim() || !editText.trim()}
                activeOpacity={0.8}
                style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.personalActionText, actionTextStyle, { color: !editTitle.trim() || !editText.trim() ? colors.outlineVariant : colors.primaryContainer }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isExpanded && !isEditing && (
          <View style={styles.personalActions}>
            <TouchableOpacity
              onPress={() => handleStartEdit(prayer, "personal")}
              activeOpacity={0.8}
              style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.personalActionText, actionTextStyle, { color: colors.primaryContainer }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(prayer)}
              activeOpacity={0.8}
              style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.personalActionText, actionTextStyle, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </SanctuaryCard>
    );
  };

  if (journalEntryType) {
    return (
      <JournalEntryEditor
        key={journalEntryType}
        entryType={journalEntryType}
        navigateToNotebookAfterSave
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surface }]}
      edges={[]}
    >
      {/* Teal Gradient Header */}
      <TealHeader />
      <PageTitle title="Prayers" subtitle="Essential prayers for your daily program" size="lg" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bottomOffset={24}
        extraKeyboardSpace={24}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {/* Add New Prayer */}
        <SanctuaryCard
          tone="lowest"
          style={[styles.prayerSection, showAddForm && styles.prayerSectionNoMargin]}
          contentStyle={styles.prayerSectionContent}
          elevated
        >
          <TouchableOpacity
            style={styles.prayerHeader}
            onPress={() => {
              const opening = !showAddForm;
              setShowAddForm(opening);
              if (!opening) {
                setNewTitle("");
                setNewText("");
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.addPrayerLeft}>
              <Ionicons name="add" size={16} color={colors.onSurfaceVariant} style={{ marginRight: 6 }} />
              <Text
                style={[
                  styles.prayerTitle,
                  {
                    color: colors.onSurfaceVariant,
                    fontSize: typography.bodySmallFontSize,
                    lineHeight: typography.bodySmallLineHeight,
                    fontFamily: fonts.bodyFamilyMedium,
                    fontWeight: undefined,
                    letterSpacing: 0.3,
                  },
                ]}
              >
                Create a new prayer
              </Text>
            </View>
            <Ionicons
              name={showAddForm ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.onSurfaceVariant}
            />
          </TouchableOpacity>

          {showAddForm && (
            <View style={styles.formContainer}>
              <FieldShell style={styles.inputShell}>
                <TextInput
                  style={[styles.titleInput, { color: colors.text, fontSize: typography.bodyLargeFontSize }]}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Prayer title"
                  placeholderTextColor={colors.textSecondary + "99"}
                />
              </FieldShell>
              <FieldShell style={styles.inputShell}>
                <TextInput
                  style={[styles.bodyInput, { color: colors.text, fontSize: typography.bodySmallFontSize, lineHeight: Math.round(typography.bodySmallFontSize * 1.625) }]}
                  value={newText}
                  onChangeText={setNewText}
                  placeholder="Prayer text"
                  placeholderTextColor={colors.textSecondary + "99"}
                  multiline
                  textAlignVertical="top"
                />
              </FieldShell>
            </View>
          )}
        </SanctuaryCard>
        {showAddForm && (
          <View style={styles.prayerActionsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { setNewTitle(""); setNewText(""); setShowAddForm(false); }}
              style={[styles.prayerFooterCancel, { borderColor: colors.onSurfaceVariant }]}
            >
              <Text style={[styles.prayerFooterCancelText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSaveNew}
              disabled={!newTitle.trim() || !newText.trim()}
              style={[
                styles.prayerFooterSave,
                { backgroundColor: colors.primaryContainer },
                (!newTitle.trim() || !newText.trim()) && styles.prayerFooterSaveDisabled,
              ]}
            >
              <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
              <Text style={[styles.prayerFooterSaveText, { color: colors.onPrimary }]}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {personalPrayers.length > 0 ? (
          <Text style={[styles.sectionEyebrow, { color: colors.onSurfaceVariant }]}>
            My Prayers
          </Text>
        ) : null}
        {personalPrayers.map(renderPersonalPrayer)}

        <Text style={[styles.sectionEyebrow, { color: colors.onSurfaceVariant }]}>
          Daily Prayers
        </Text>
        {builtInPrayers.map(renderPrayer)}
        <View style={{ height: 100 }} />
      </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
      <JournalCategoryPicker
        visible={showJournalPicker}
        onSelect={(entryType) => {
          setShowJournalPicker(false);
          setJournalEntryType(entryType);
        }}
        onClose={() => setShowJournalPicker(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerAdd: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  prayerSection: {
    marginBottom: 20,
  },
  prayerSectionNoMargin: {
    marginBottom: 0,
  },
  sectionEyebrow: {
    fontFamily: fonts.labelFamily,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 10,
    paddingLeft: 4,
  },
  prayerSectionContent: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 18,
  },
  prayerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 4,
  },
  prayerTitle: {
    flex: 1,
    paddingRight: 12,
    includeFontPadding: false,
  },
  prayerPreview: {
    ...staticTypography.bodyLarge,
    fontFamily: fonts.bodyFamilyMedium,
    marginTop: 6,
  },
  prayerBody: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  prayerText: {
    ...staticTypography.bodyLarge,
    fontFamily: fonts.bodyFamilyMedium,
  },
  prayerSource: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 14,
    textAlign: "right",
  },
  personalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  personalActionButton: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  personalActionText: {
    fontFamily: fonts.bodyFamilySemiBold,
  },
  addPrayerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  formContainer: {
    gap: 12,
  },
  inputShell: {
    paddingVertical: 8,
    backgroundColor: "#dfe8e4",
  },
  titleInput: {
    fontFamily: fonts.bodyFamilyRegular,
  },
  bodyInput: {
    fontFamily: fonts.bodyFamilyRegular,
    minHeight: 120,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  prayerActionsRow: {
    paddingHorizontal: 18,
    marginTop: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  prayerFooterCancel: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  prayerFooterCancelText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  prayerFooterSave: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  prayerFooterSaveDisabled: {
    opacity: 0.55,
  },
  prayerFooterSaveText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  formButton: {
    minWidth: 120,
  },
});
