import React, { useState, useMemo, useRef } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTheme } from "../../hooks/useTheme";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { useAnalytics } from "../../utils/analytics";
import { usePersonalPrayers, type PersonalPrayer } from "../../hooks/usePersonalPrayers";
import { fonts } from "../../constants/theme";
import { PRAYERS, type Prayer } from "../../constants/prayers";
import { TealHeader } from "../shared/TealHeader";
import { LeafOnWater } from "../icons";
import { FieldShell, SanctuaryButton, SanctuaryCard } from "../ui/Sanctuary";

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
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const scrollRef = useRef<any>(null);

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

  const renderPrayer = (prayer: Prayer) => {
    const isExpanded = expandedPrayer === prayer.id;

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
          <Text style={[styles.prayerTitle, { color: colors.ocean, fontSize: typography.bodyFontSize + 2 }]}>
            {prayer.title.toUpperCase()}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {isExpanded && (
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
      </SanctuaryCard>
    );
  };

  const handleStartEdit = (prayer: PersonalPrayer) => {
    setEditingId(prayer.id);
    setEditTitle(prayer.title);
    setEditText(prayer.text);
    setExpandedPrayer(prayer.id);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim() || !editText.trim()) return;
    await updatePrayer(editingId, editTitle, editText);
    setEditingId(null);
    setEditTitle("");
    setEditText("");
  };

  const handleCancelEdit = () => {
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

  const handleSaveNew = async () => {
    if (!newTitle.trim() || !newText.trim()) return;
    await addPrayer(newTitle, newText);
    setNewTitle("");
    setNewText("");
    setShowAddForm(false);
  };

  const renderPersonalPrayer = (prayer: PersonalPrayer) => {
    const isExpanded = expandedPrayer === prayer.id;
    const isEditing = editingId === prayer.id;

    return (
      <SanctuaryCard key={prayer.id} tone="lowest" style={styles.prayerSection} contentStyle={styles.prayerSectionContent}>
        <TouchableOpacity
          style={styles.prayerHeader}
          onPress={() => {
            if (isEditing) handleCancelEdit();
            setExpandedPrayer(isExpanded ? null : prayer.id);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.prayerTitle, { color: colors.ocean, fontSize: typography.bodyFontSize + 2 }]}>
            {prayer.title.toUpperCase()}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {isExpanded && !isEditing && (
          <View style={styles.prayerBody}>
            <Text style={[styles.prayerText, { color: colors.ink, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.625 }]}>
              {prayer.text}
            </Text>
            <View style={styles.personalActions}>
              <TouchableOpacity
                onPress={() => handleStartEdit(prayer)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.editLink, { color: colors.seafoam }]}>Edit</Text>
              </TouchableOpacity>
            </View>
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
        leftIcon={<LeafOnWater size={28} color={colors.textOnAccent} />}
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
        {/* Built-in Prayers */}
        {PRAYERS.map(renderPrayer)}

        {/* Personal Prayers */}
        {personalPrayers.map(renderPersonalPrayer)}

        {/* Add New Prayer */}
        <SanctuaryCard tone="low" style={styles.prayerSection} contentStyle={styles.prayerSectionContent}>
          <TouchableOpacity
            style={styles.prayerHeader}
            onPress={() => {
              const opening = !showAddForm;
              setShowAddForm(opening);
              if (!opening) {
                setNewTitle("");
                setNewText("");
              } else {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.addPrayerLeft}>
              <Ionicons name="add" size={20} color={colors.ocean} style={{ marginRight: 6 }} />
              <Text style={[styles.prayerTitle, { color: colors.ocean, fontSize: typography.bodyFontSize + 2 }]}>
                ADD PRAYER
              </Text>
            </View>
            <Ionicons
              name={showAddForm ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.textSecondary}
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
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
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
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
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
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  prayerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  prayerTitle: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  prayerBody: {
    paddingBottom: 16,
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
    marginTop: 14,
  },
  editLink: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "600",
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
