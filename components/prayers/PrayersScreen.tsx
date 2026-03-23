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
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { useAnalytics } from "../../utils/analytics";
import { usePersonalPrayers, type PersonalPrayer } from "../../hooks/usePersonalPrayers";
import { fonts } from "../../constants/theme";
import { PRAYERS, type Prayer } from "../../constants/prayers";
import { TealHeader } from "../shared/TealHeader";
import { FieldShell, SanctuaryButton, SanctuaryCard } from "../ui/Sanctuary";

const BUILTIN_PRAYER_OVERRIDES_KEY = "@daily_paths_builtin_prayer_overrides_v1";
const HIDDEN_BUILTIN_PRAYERS_KEY = "@daily_paths_hidden_builtin_prayers_v1";

type BuiltInPrayerOverride = {
  title: string;
  text: string;
};

export const PrayersScreen: React.FC = () => {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const { trackPrayerViewed } = useAnalytics();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const { prayers: personalPrayers, addPrayer, updatePrayer, deletePrayer } = usePersonalPrayers();
  const [expandedPrayer, setExpandedPrayer] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<"personal" | "builtin" | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [builtinOverrides, setBuiltinOverrides] = useState<Record<string, BuiltInPrayerOverride>>({});
  const [hiddenBuiltinPrayerIds, setHiddenBuiltinPrayerIds] = useState<string[]>([]);
  const scrollRef = useRef<any>(null);

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

    // Determine which phrases to bold in this prayer
    const boldPhrases: string[] = [];
    if (prayer.id === "just-for-today") boldPhrases.push("Just for today");
    if (prayer.id === "just-for-tonight") boldPhrases.push("Just for tonight");

    return (
      <SanctuaryCard key={prayer.id} tone="lowest" style={styles.prayerSection} contentStyle={styles.prayerSectionContent}>
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
          <Text style={[styles.prayerTitle, { color: colors.primaryContainer, fontSize: typography.bodyFontSize + 4 }]}>
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
              {
                color: colors.onSurfaceVariant,
                fontSize: typography.bodyFontSize + 1,
                lineHeight: Math.round((typography.bodyFontSize + 1) * 1.45),
              },
            ]}
            numberOfLines={3}
          >
            {getPrayerPreview(prayer.text)}
          </Text>
        )}

        {isExpanded && !isEditing && (
          <View style={styles.prayerBody}>
            <Text style={[styles.prayerText, { color: colors.ink, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.625 }]}>
              {renderPrayerText(prayer.text, boldPhrases)}
            </Text>
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
                style={[styles.titleInput, { color: colors.ink, fontSize: typography.bodyFontSize }]}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Prayer title"
                placeholderTextColor={colors.textSecondary}
              />
            </FieldShell>
            <FieldShell style={styles.inputShell}>
              <TextInput
                style={[styles.bodyInput, { color: colors.ink, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.625 }]}
                value={editText}
                onChangeText={setEditText}
                placeholder="Prayer text"
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
              />
            </FieldShell>
            <View style={styles.formActions}>
              <SanctuaryButton
                label="Delete"
                variant="secondary"
                onPress={() => handleDeleteBuiltin(prayer)}
                style={styles.formButton}
              />
              <SanctuaryButton
                label="Save"
                onPress={handleSaveEdit}
                disabled={!editTitle.trim() || !editText.trim()}
                style={styles.formButton}
              />
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
              <Text style={[styles.personalActionText, { color: colors.primaryContainer }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteBuiltin(prayer)}
              activeOpacity={0.8}
              style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.personalActionText, { color: colors.danger }]}>Delete</Text>
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
        style={[styles.prayerSection, { backgroundColor: colors.surfaceContainerLow }]}
        contentStyle={styles.prayerSectionContent}
      >
        <TouchableOpacity
          style={styles.prayerHeader}
          onPress={() => {
            if (isEditing) handleCancelEdit();
            setExpandedPrayer(isExpanded ? null : prayer.id);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.prayerTitle, { color: colors.primaryContainer, fontSize: typography.bodyFontSize + 4 }]}>
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
              {
                color: colors.onSurfaceVariant,
                fontSize: typography.bodyFontSize + 1,
                lineHeight: Math.round((typography.bodyFontSize + 1) * 1.45),
              },
            ]}
            numberOfLines={3}
          >
            {getPrayerPreview(prayer.text)}
          </Text>
        )}

        {isExpanded && !isEditing && (
          <View style={styles.prayerBody}>
            <Text style={[styles.prayerText, { color: colors.ink, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.625 }]}>
              {prayer.text}
            </Text>
          </View>
        )}

        {isEditing && (
          <View style={styles.formContainer}>
            <FieldShell style={styles.inputShell}>
              <TextInput
                style={[styles.titleInput, { color: colors.ink, fontSize: typography.bodyFontSize }]}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Prayer title"
                placeholderTextColor={colors.textSecondary}
              />
            </FieldShell>
            <FieldShell style={styles.inputShell}>
              <TextInput
                style={[styles.bodyInput, { color: colors.ink, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.625 }]}
                value={editText}
                onChangeText={setEditText}
                placeholder="Prayer text"
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
              />
            </FieldShell>
            <View style={styles.formActions}>
              <SanctuaryButton
                label="Delete"
                variant="secondary"
                onPress={() => handleDelete(prayer)}
                style={styles.formButton}
              />
              <SanctuaryButton
                label="Save"
                onPress={handleSaveEdit}
                disabled={!editTitle.trim() || !editText.trim()}
                style={styles.formButton}
              />
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
              <Text style={[styles.personalActionText, { color: colors.primaryContainer }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(prayer)}
              activeOpacity={0.8}
              style={[styles.personalActionButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.personalActionText, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </SanctuaryCard>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pearl }]}
      edges={["top"]}
    >
      {/* Teal Gradient Header */}
      <TealHeader
        title="Prayers"
        leftIcon={<MaterialCommunityIcons name="hands-pray" size={24} color={colors.textOnAccent} />}
      />

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
          tone="low"
          style={[styles.prayerSection, { backgroundColor: colors.primaryContainer }]}
          contentStyle={styles.prayerSectionContent}
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
              <Ionicons name="add" size={20} color={colors.onPrimary} style={{ marginRight: 6 }} />
              <Text style={[styles.prayerTitle, { color: colors.onPrimary, fontSize: typography.bodyFontSize + 2 }]}>
                Create a New Prayer
              </Text>
            </View>
            <Ionicons
              name={showAddForm ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.onPrimary}
            />
          </TouchableOpacity>

          {showAddForm && (
            <View style={styles.formContainer}>
              <FieldShell style={styles.inputShell}>
                <TextInput
                  style={[styles.titleInput, { color: colors.ink, fontSize: typography.bodyFontSize }]}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Prayer title"
                  placeholderTextColor={colors.textSecondary}
                />
              </FieldShell>
              <FieldShell style={styles.inputShell}>
                <TextInput
                  style={[styles.bodyInput, { color: colors.ink, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.625 }]}
                  value={newText}
                  onChangeText={setNewText}
                  placeholder="Prayer text"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  textAlignVertical="top"
                />
              </FieldShell>
              <View style={styles.formActions}>
                <SanctuaryButton
                  label="Save"
                  onPress={handleSaveNew}
                  disabled={!newTitle.trim() || !newText.trim()}
                  style={styles.formButton}
                />
              </View>
            </View>
          )}
        </SanctuaryCard>

        {/* Built-in Prayers */}
        {personalPrayers.map(renderPersonalPrayer)}
        {builtInPrayers.map(renderPrayer)}
        <View style={{ height: 100 }} />
      </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  prayerSection: {
    marginBottom: 12,
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
    paddingBottom: 8,
  },
  prayerTitle: {
    fontFamily: fonts.bodyFamilyBold,
    fontSize: 18,
    lineHeight: 30,
    fontWeight: "700",
    flex: 1,
    paddingRight: 12,
    includeFontPadding: false,
  },
  prayerPreview: {
    fontFamily: fonts.bodyFamilyRegular,
    marginTop: 4,
  },
  prayerBody: {
    paddingTop: 6,
    paddingBottom: 8,
  },
  prayerText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    lineHeight: 26,
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
    fontSize: 14,
    lineHeight: 18,
  },
  addPrayerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  formContainer: {
    paddingBottom: 16,
    gap: 12,
  },
  inputShell: {
    paddingVertical: 8,
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
  formButton: {
    minWidth: 120,
  },
});
