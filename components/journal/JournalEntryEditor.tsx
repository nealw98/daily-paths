import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../hooks/useTheme";
import { fonts, getHeaderGradientPoints } from "../../constants/theme";
import {
  getCategoryById,
  getCategoryLabel,
  getCategoryColor,
  type EntryType,
} from "../../constants/journalCategories";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { GuidedPromptEditor } from "./GuidedPromptEditor";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { Seedling } from "../../components/icons";

interface JournalEntryEditorProps {
  entryType: EntryType;
  onSave: (
    entryType: EntryType,
    content: string | null,
    structuredContent?: Record<string, any> | null
  ) => Promise<void>;
  onCancel: () => void;
  initialContent?: string | null;
  initialStructuredContent?: Record<string, any> | null;
  isEditing?: boolean;
}

export const JournalEntryEditor: React.FC<JournalEntryEditorProps> = ({
  entryType,
  onSave,
  onCancel,
  initialContent = "",
  initialStructuredContent = null,
  isEditing = false,
}) => {
  const { colors, themeId } = useTheme();
  const { start: headerGradientStart, end: headerGradientEnd } =
    getHeaderGradientPoints(themeId);

  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const categoryConfig = getCategoryById(entryType);
  const categoryLabel = getCategoryLabel(entryType);
  const categoryColor = getCategoryColor(entryType);
  const editorType = categoryConfig?.editorType ?? "text";

  const [saving, setSaving] = useState(false);

  // ─── Text editor state (journal type) ──────────────────
  const [content, setContent] = useState(initialContent ?? "");
  const inputRef = useRef<TextInput>(null);

  // ─── Gratitude items state ─────────────────────────────
  const [gratitudeItems, setGratitudeItems] = useState<string[]>(() => {
    if (entryType === "gratitude") {
      if (
        initialStructuredContent?.items &&
        Array.isArray(initialStructuredContent.items)
      ) {
        return initialStructuredContent.items as string[];
      }
      // Legacy: parse from content
      if (initialContent) {
        return initialContent
          .split("\n")
          .map((line) => line.replace(/^-\s*/, "").trim())
          .filter(Boolean);
      }
      // Start with 3 empty slots for new entries
      if (!isEditing) return ["", "", ""];
    }
    return [];
  });

  // ─── Guided prompt state (spot_check, nightly_review) ──
  const [guidedResponses, setGuidedResponses] = useState<
    Record<string, string>
  >(() => {
    if (editorType === "guided" && initialStructuredContent) {
      const responses: Record<string, string> = {};
      for (const [key, value] of Object.entries(initialStructuredContent)) {
        if (typeof value === "string") responses[key] = value;
      }
      return responses;
    }
    return {};
  });

  useEffect(() => {
    if (editorType === "text") {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [editorType]);

  // ─── Computed State ────────────────────────────────────

  const hasContent = (() => {
    switch (editorType) {
      case "text":
        return content.trim().length > 0;
      case "items":
        return gratitudeItems.some((item) => item.trim().length > 0);
      case "guided":
        return Object.values(guidedResponses).some(
          (v) => v.trim().length > 0
        );
      default:
        return false;
    }
  })();

  // ─── Save Handler ──────────────────────────────────────

  const handleSave = async () => {
    if (!hasContent) {
      Alert.alert(
        "Nothing to save",
        editorType === "items"
          ? "Add at least one item before saving."
          : "Write something before saving."
      );
      return;
    }

    setSaving(true);
    try {
      switch (editorType) {
        case "text": {
          await onSave(entryType, content.trim(), null);
          break;
        }
        case "items": {
          const filledItems = gratitudeItems
            .map((i) => i.trim())
            .filter(Boolean);
          const searchableContent = filledItems.join(" • ");
          await onSave(entryType, searchableContent, { items: filledItems });
          break;
        }
        case "guided": {
          const filledResponses: Record<string, string> = {};
          for (const [key, value] of Object.entries(guidedResponses)) {
            if (value.trim()) filledResponses[key] = value.trim();
          }
          // Build searchable content from non-empty responses
          const searchableContent = Object.values(filledResponses).join("\n\n");
          await onSave(entryType, searchableContent, filledResponses);
          break;
        }
      }
    } catch (err) {
      const message = String(err).toLowerCase().includes("timed out")
        ? "Saving is taking too long. Please try again."
        : "Failed to save your entry. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasContent) {
      Alert.alert("Discard this entry?", "Your writing will not be saved.", [
        { text: "Keep Writing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: onCancel,
        },
      ]);
    } else {
      onCancel();
    }
  };

  // ─── Gratitude Handlers ────────────────────────────────

  const handleGratitudeItemChange = (index: number, text: string) => {
    setGratitudeItems((prev) => {
      const updated = [...prev];
      updated[index] = text;
      return updated;
    });
  };

  const handleAddGratitudeSlot = () => {
    setGratitudeItems((prev) => [...prev, ""]);
  };

  const handleRemoveGratitudeItem = (index: number) => {
    setGratitudeItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Guided Prompt Handler ─────────────────────────────

  const handleGuidedResponseChange = (promptId: string, text: string) => {
    setGuidedResponses((prev) => ({ ...prev, [promptId]: text }));
  };

  // ─── Date String ───────────────────────────────────────

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // ─── Render ────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Gradient Header — 2-line: title row + actions row */}
        <LinearGradient
          colors={[colors.headerGradientStart, colors.headerGradientEnd]}
          start={headerGradientStart}
          end={headerGradientEnd}
          style={styles.gradientHeader}
        >
          {/* Icon + Title (centered) */}
          <View style={styles.headerTitleRow}>
            {categoryConfig && (
              <EntryTypeIcon svgIcon={categoryConfig.svgIcon} size={28} color={colors.textOnAccent} />
            )}
            <Text style={[styles.headerTitleText, { color: colors.textOnAccent }]}>
              {isEditing ? "Edit " : ""}{categoryLabel}
            </Text>
          </View>
        </LinearGradient>

        {/* Date bar */}
        <View style={[styles.dateBar, { backgroundColor: colors.background }]}>
          <Text style={[styles.dateText, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 6 }]}>
            {isEditing ? "Editing Entry" : dateStr}
          </Text>
        </View>

        {/* Editor Content */}
        <ScrollView
          style={[styles.editorScroll, { backgroundColor: colors.background }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {editorType === "text" && (
            <View style={styles.textEditorContainer}>
              {/* Intro quote */}
              {categoryConfig?.introText && (
                <View style={[styles.textIntroWrapper, { borderBottomColor: colors.border }]}>
                  <Text
                    style={[
                      styles.introText,
                      { color: colors.accent, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.5 },
                    ]}
                  >
                    {categoryConfig.introText}
                  </Text>
                </View>
              )}
              <TextInput
                ref={inputRef}
                style={[
                  styles.textInput,
                  { color: colors.text, fontSize: typography.bodyFontSize, lineHeight: typography.bodyLineHeight },
                ]}
                placeholder="What's on your mind..."
                placeholderTextColor={colors.textSecondary + "60"}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
                autoCorrect
                autoCapitalize="sentences"
                scrollEnabled={false}
                selectionColor={colors.accent}
              />
            </View>
          )}

          {editorType === "items" && (
            <View style={styles.gratitudeContainer}>
              {/* Intro text */}
              {categoryConfig?.introText && (
                <Text
                  style={[
                    styles.introText,
                    { color: colors.accent, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.5 },
                  ]}
                >
                  {categoryConfig.introText}
                </Text>
              )}

              {/* Gratitude item cards */}
              {gratitudeItems.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.gratitudeCard,
                    {
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.gratitudeIconWrapper}>
                    <Seedling size={18} color={categoryColor} />
                  </View>
                  <TextInput
                    style={[
                      styles.gratitudeInput,
                      { color: colors.text, fontSize: typography.bodyFontSize - 2, lineHeight: typography.bodyLineHeight - 6 },
                    ]}
                    placeholder="I'm grateful for..."
                    placeholderTextColor={colors.textSecondary + "60"}
                    value={item}
                    onChangeText={(text) =>
                      handleGratitudeItemChange(index, text)
                    }
                    multiline
                    autoCorrect
                    autoCapitalize="sentences"
                  />
                  {gratitudeItems.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveGratitudeItem(index)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.removeItemButton}
                    >
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={colors.textSecondary + "60"}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {/* Add another button */}
              <TouchableOpacity
                style={[
                  styles.addItemButton,
                  { borderColor: colors.border },
                ]}
                onPress={handleAddGratitudeSlot}
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={categoryColor}
                />
                <Text
                  style={[
                    styles.addItemText,
                    { color: categoryColor, fontSize: typography.bodyFontSize - 6 },
                  ]}
                >
                  add another
                </Text>
              </TouchableOpacity>

              <Text
                style={[
                  styles.gratitudeHint,
                  { color: colors.textSecondary, fontSize: typography.bodyFontSize - 8 },
                ]}
              >
                Write as many or as few as you'd like
              </Text>
            </View>
          )}

          {editorType === "guided" &&
            categoryConfig?.guidedPrompts && (
              <View style={styles.guidedContainer}>
                <GuidedPromptEditor
                  prompts={categoryConfig.guidedPrompts}
                  responses={guidedResponses}
                  onResponseChange={handleGuidedResponseChange}
                  color={categoryColor}
                  introText={categoryConfig.introText ?? ""}
                />
              </View>
            )}

          {/* Spacer for keyboard */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom Bar */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.cancelButton,
              { backgroundColor: colors.cardBackground },
            ]}
            onPress={handleCancel}
          >
            <Text
              style={[styles.cancelText, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 4 }]}
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveButtonWrapper}
            onPress={handleSave}
            disabled={saving || !hasContent}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={
                hasContent
                  ? [colors.heroGradientStart, colors.heroGradientEnd]
                  : [colors.border, colors.border]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButton}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color={hasContent ? colors.textOnAccent : colors.textSecondary}
              />
              <Text
                style={[
                  styles.saveText,
                  {
                    color: hasContent ? colors.textOnAccent : colors.textSecondary,
                    fontSize: typography.bodyFontSize - 4,
                  },
                ]}
              >
                {saving ? "Saving..." : "Save"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  gradientHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  headerTitleText: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 38,
    lineHeight: 46,
  },
  dateBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  dateText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  editorScroll: {
    flex: 1,
  },

  // ─── Text Editor ──────────────────────────────────────
  textEditorContainer: {
    minHeight: 200,
  },
  textIntroWrapper: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  textInput: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    lineHeight: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    minHeight: 200,
  },

  // ─── Gratitude ────────────────────────────────────────
  gratitudeContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  introText: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 18,
    lineHeight: 18 * 1.5,
    marginBottom: 20,
    textAlign: "center",
  },
  gratitudeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  gratitudeIconWrapper: {
    marginTop: 2,
  },
  gratitudeInput: {
    flex: 1,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 22,
  },
  removeItemButton: {
    marginTop: 2,
    padding: 2,
  },
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginBottom: 12,
  },
  addItemText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    fontWeight: "500",
  },
  gratitudeHint: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4,
  },

  // ─── Guided Prompts ───────────────────────────────────
  guidedContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // ─── Bottom Bar ───────────────────────────────────────
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  cancelText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "500",
  },
  saveButtonWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "rgba(44, 95, 93, 1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  saveText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
});
