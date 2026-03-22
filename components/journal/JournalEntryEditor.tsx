import React, { useState, useMemo } from "react";
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
import { fonts } from "../../constants/theme";
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
import { FieldShell, SanctuaryButton, SanctuaryCard } from "../ui/Sanctuary";

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

  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const categoryConfig = getCategoryById(entryType);
  const categoryLabel = getCategoryLabel(entryType);
  const categoryColor = getCategoryColor(entryType);
  const editorType = categoryConfig?.editorType ?? "text";

  const [saving, setSaving] = useState(false);

  // ─── Text editor state (journal type) ──────────────────
  const [content, setContent] = useState(initialContent ?? "");

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
        <View style={[styles.gradientHeader, { backgroundColor: colors.surface }]}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.headerIconShell, { backgroundColor: colors.primaryContainer }]}>
              {categoryConfig && (
                <EntryTypeIcon svgIcon={categoryConfig.svgIcon} size={24} color={colors.onPrimary} />
              )}
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={[styles.headerEyebrow, { color: colors.onSurfaceVariant }]}>
                {isEditing ? "Edit entry" : "New entry"}
              </Text>
              <Text style={[styles.headerTitleText, { color: colors.onSurface }]}>
                {categoryLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.dateBar, { backgroundColor: colors.surface }]}>
          <Text style={[styles.dateText, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 6 }]}>
            {isEditing ? "Editing Entry" : dateStr}
          </Text>
        </View>

        {/* Editor Content */}
        <KeyboardAwareScrollView
          style={[styles.editorScroll, { backgroundColor: colors.background }]}
          bottomOffset={96}
          extraKeyboardSpace={24}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {editorType === "text" && (
            <View style={styles.textEditorContainer}>
              {categoryConfig?.introText && (
                <SanctuaryCard tone="low" style={styles.textIntroWrapper} contentStyle={styles.textIntroContent}>
                  <Text
                    style={[
                      styles.introText,
                      { color: colors.primaryContainer, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.5 },
                    ]}
                  >
                    {categoryConfig.introText}
                  </Text>
                </SanctuaryCard>
              )}
              <FieldShell style={styles.textInputShell}>
                <TextInput
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
                  selectionColor={colors.secondary}
                />
              </FieldShell>
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
                <SanctuaryCard
                  key={index}
                  tone="lowest"
                  style={styles.gratitudeCard}
                  contentStyle={styles.gratitudeCardContent}
                >
                  <View style={styles.gratitudeIconWrapper}>
                    <Seedling size={18} color={categoryColor} />
                  </View>
                  <FieldShell style={styles.gratitudeInputShell}>
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
                  </FieldShell>
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
                </SanctuaryCard>
              ))}

              <SanctuaryButton
                label="Add another"
                variant="secondary"
                onPress={handleAddGratitudeSlot}
                style={styles.addItemButton}
                icon={<Ionicons name="add" size={18} color={colors.onSecondaryContainer} />}
              />

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
        </KeyboardAwareScrollView>

        {/* Bottom Bar */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.ghostBorder,
            },
          ]}
        >
          <SanctuaryButton
            label="Cancel"
            variant="secondary"
            onPress={handleCancel}
            style={styles.bottomButton}
          />
          <SanctuaryButton
            label={saving ? "Saving..." : "Save"}
            onPress={handleSave}
            disabled={saving || !hasContent}
            style={styles.bottomButton}
            icon={<Ionicons name="checkmark" size={18} color={colors.onSecondary} />}
          />
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
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconShell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextBlock: {
    flex: 1,
  },
  headerEyebrow: {
    fontFamily: fonts.labelFamily,
    fontSize: 12,
    lineHeight: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  headerTitleText: {
    fontFamily: fonts.headerFamily,
    fontSize: 24,
    lineHeight: 30,
  },
  dateBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
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
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  textIntroContent: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  textInputShell: {
    marginHorizontal: 20,
  },
  textInput: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    lineHeight: 28,
    minHeight: 200,
  },

  // ─── Gratitude ────────────────────────────────────────
  gratitudeContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  introText: {
    fontFamily: fonts.headerFamily,
    fontSize: 18,
    lineHeight: 18 * 1.5,
    marginBottom: 20,
    textAlign: "center",
  },
  gratitudeCard: {
    marginBottom: 12,
  },
  gratitudeCardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
  },
  gratitudeIconWrapper: {
    marginTop: 2,
  },
  gratitudeInputShell: {
    flex: 1,
    paddingVertical: 10,
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
    marginBottom: 12,
    gap: 12,
  },
  bottomButton: {
    flex: 1,
  },
});
