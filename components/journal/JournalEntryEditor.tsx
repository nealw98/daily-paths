import React, { useState, useRef, useEffect } from "react";
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
import { fonts } from "../../constants/theme";
import {
  getCategoryById,
  getCategoryLabel,
  getCategoryColor,
  getCategoryBgColor,
  type EntryType,
} from "../../constants/journalCategories";
import { GuidedPromptEditor } from "./GuidedPromptEditor";

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
  const { colors } = useTheme();
  const categoryConfig = getCategoryById(entryType);
  const categoryLabel = getCategoryLabel(entryType);
  const categoryColor = getCategoryColor(entryType);
  const categoryBgColor = getCategoryBgColor(entryType);
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
      Alert.alert("Error", "Failed to save your entry. Please try again.");
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
        {/* Header */}
        <View
          style={[styles.header, { borderBottomColor: colors.border }]}
        >
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {isEditing ? "Editing Entry" : dateStr}
          </Text>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: categoryBgColor },
            ]}
          >
            {categoryConfig && (
              <Text style={styles.categoryBadgeEmoji}>
                {categoryConfig.emoji}
              </Text>
            )}
            <Text
              style={[styles.categoryBadgeText, { color: categoryColor }]}
            >
              {categoryLabel}
            </Text>
          </View>
        </View>

        {/* Editor Content */}
        <ScrollView
          style={styles.editorScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {editorType === "text" && (
            <View style={styles.textEditorContainer}>
              <TextInput
                ref={inputRef}
                style={[
                  styles.textInput,
                  { color: colors.text },
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
                    { color: colors.accent },
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
                      backgroundColor: colors.cardBackground,
                      borderColor: "rgba(139, 110, 78, 0.08)",
                    },
                  ]}
                >
                  <Text style={styles.gratitudeLeaf}>🌿</Text>
                  <TextInput
                    style={[
                      styles.gratitudeInput,
                      { color: colors.text },
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
                  { borderColor: "rgba(139, 110, 78, 0.25)" },
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
                    { color: categoryColor },
                  ]}
                >
                  add another
                </Text>
              </TouchableOpacity>

              <Text
                style={[
                  styles.gratitudeHint,
                  { color: colors.textSecondary },
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
              style={[styles.cancelText, { color: colors.textSecondary }]}
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
                  ? ["#2C5F5D", "#3A7573"]
                  : [colors.border, colors.border]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButton}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color={hasContent ? "#FFFFFF" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.saveText,
                  {
                    color: hasContent ? "#FFFFFF" : colors.textSecondary,
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dateText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  categoryBadgeEmoji: {
    fontSize: 12,
  },
  categoryBadgeText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    fontWeight: "600",
  },
  editorScroll: {
    flex: 1,
  },

  // ─── Text Editor ──────────────────────────────────────
  textEditorContainer: {
    minHeight: 200,
  },
  textInput: {
    fontFamily: fonts.loraRegular,
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
    fontStyle: "italic",
    marginBottom: 20,
  },
  gratitudeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  gratitudeLeaf: {
    fontSize: 16,
    marginTop: 2,
  },
  gratitudeInput: {
    flex: 1,
    fontFamily: fonts.loraRegular,
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
