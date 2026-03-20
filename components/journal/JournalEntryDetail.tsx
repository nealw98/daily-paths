import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTheme } from "../../hooks/useTheme";
import { fonts, getHeaderGradientPoints } from "../../constants/theme";
import type { JournalEntry } from "../../hooks/useJournalStorage";
import {
  getCategoryById,
  getCategoryLabel,
  getCategoryColor,
  getCategoryBadgeBgColor,
  type EntryType,
} from "../../constants/journalCategories";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { GuidedPromptEditor } from "./GuidedPromptEditor";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { Seedling } from "../../components/icons";

interface JournalEntryDetailProps {
  entry: JournalEntry;
  onBack: () => void;
  onSave: (
    entryId: string,
    content: string | null,
    structuredContent?: Record<string, any> | null
  ) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

/** Parse markdown list content back into an array of items. */
function parseGratitudeItems(content: string | null): string[] {
  if (!content) return [];
  return content
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

export const JournalEntryDetail: React.FC<JournalEntryDetailProps> = ({
  entry,
  onBack,
  onSave,
  onDelete,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}) => {
  const { colors, themeId } = useTheme();
  const { start: headerGradientStart, end: headerGradientEnd } =
    getHeaderGradientPoints(themeId);

  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const entryType = (entry.entry_type || "journal") as EntryType;
  const catConfig = getCategoryById(entryType);
  const catLabel = getCategoryLabel(entryType);
  const catColor = getCategoryColor(entryType);
  const pageChromeBackgroundColor = isEditing
    ? getCategoryBadgeBgColor(entryType)
    : colors.background;
  // catBadgeBg removed — type info now in gradient header
  const editorType = catConfig?.editorType ?? "text";

  // ─── Edit state for text entries ──────────────────────
  const [editContent, setEditContent] = useState(entry.content ?? "");

  // ─── Edit state for gratitude items ───────────────────
  const [gratitudeItems, setGratitudeItems] = useState<string[]>(() => {
    if (entry.structured_content?.items && Array.isArray(entry.structured_content.items)) {
      return entry.structured_content.items as string[];
    }
    return parseGratitudeItems(entry.content);
  });

  // ─── Edit state for guided prompts ────────────────────
  const [guidedResponses, setGuidedResponses] = useState<Record<string, string>>(() => {
    if (entry.structured_content && editorType === "guided") {
      const responses: Record<string, string> = {};
      for (const [key, value] of Object.entries(entry.structured_content)) {
        if (typeof value === "string") responses[key] = value;
      }
      return responses;
    }
    return {};
  });

  const entryDate = new Date(entry.created_at);
  const dateStr = entryDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = entryDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  // ─── Handlers ─────────────────────────────────────────

  const handleDelete = () => {
    Alert.alert("Delete Entry?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await onDelete(entry.id);
          onBack();
        },
      },
    ]);
  };

  const handleShare = async () => {
    const lines: string[] = [];

    // Date
    lines.push(dateStr);
    lines.push("");

    // Type label
    lines.push(catLabel.toUpperCase());
    lines.push("");

    // Content by type
    if (editorType === "text") {
      if (entry.content) lines.push(entry.content.trim());
    } else if (editorType === "items") {
      const items = entry.structured_content?.items
        ? (entry.structured_content.items as string[])
        : parseGratitudeItems(entry.content);
      items.filter(Boolean).forEach((item) => lines.push(`• ${item}`));
    } else if (editorType === "guided") {
      const prompts = catConfig?.guidedPrompts ?? [];
      const responses = entry.structured_content ?? {};
      prompts.forEach((prompt) => {
        const value = responses[prompt.id];
        if (value && typeof value === "string" && value.trim()) {
          lines.push(prompt.question);
          lines.push(value.trim());
          lines.push("");
        }
      });
    }

    lines.push("");
    lines.push("-----");
    lines.push("Shared from Daily Paths");

    try {
      await Share.share({ message: lines.join("\n") });
    } catch (err) {
      console.error("Error sharing entry:", err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      switch (editorType) {
        case "text": {
          if (!editContent.trim()) {
            Alert.alert("Nothing to save", "Write something before saving.");
            setSaving(false);
            return;
          }
          await onSave(entry.id, editContent.trim(), null);
          break;
        }
        case "items": {
          const filledItems = gratitudeItems.map((i) => i.trim()).filter(Boolean);
          if (filledItems.length === 0) {
            Alert.alert("Nothing to save", "Add at least one item before saving.");
            setSaving(false);
            return;
          }
          const searchableContent = filledItems.join(" • ");
          await onSave(entry.id, searchableContent, { items: filledItems });
          break;
        }
        case "guided": {
          const filledResponses: Record<string, string> = {};
          for (const [key, value] of Object.entries(guidedResponses)) {
            if (value.trim()) filledResponses[key] = value.trim();
          }
          if (Object.keys(filledResponses).length === 0) {
            Alert.alert("Nothing to save", "Write something before saving.");
            setSaving(false);
            return;
          }
          const searchableContent = Object.values(filledResponses).join("\n\n");
          await onSave(entry.id, searchableContent, filledResponses);
          break;
        }
      }
      setIsEditing(false);
    } catch {
      Alert.alert("Error", "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // Track whether the edit state has diverged from the saved entry
  const hasChanges = useMemo(() => {
    if (editorType === "text") {
      return editContent !== (entry.content ?? "");
    } else if (editorType === "items") {
      const originalItems = entry.structured_content?.items
        ? (entry.structured_content.items as string[])
        : parseGratitudeItems(entry.content);
      return JSON.stringify(gratitudeItems) !== JSON.stringify(originalItems);
    } else if (editorType === "guided") {
      const original = entry.structured_content ?? {};
      return JSON.stringify(guidedResponses) !== JSON.stringify(original);
    }
    return false;
  }, [editorType, editContent, entry.content, entry.structured_content, gratitudeItems, guidedResponses]);

  const handleDiscard = () => {
    if (hasChanges) {
      Alert.alert("Discard changes?", "Your edits will not be saved.", [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            resetEditState();
            setIsEditing(false);
          },
        },
      ]);
    } else {
      setIsEditing(false);
    }
  };

  const resetEditState = () => {
    setEditContent(entry.content ?? "");
    if (entry.structured_content?.items && Array.isArray(entry.structured_content.items)) {
      setGratitudeItems(entry.structured_content.items as string[]);
    } else {
      setGratitudeItems(parseGratitudeItems(entry.content));
    }
    if (entry.structured_content && editorType === "guided") {
      const responses: Record<string, string> = {};
      for (const [key, value] of Object.entries(entry.structured_content)) {
        if (typeof value === "string") responses[key] = value;
      }
      setGuidedResponses(responses);
    } else {
      setGuidedResponses({});
    }
  };

  // Reset edit state when entry changes (prev/next navigation)
  React.useEffect(() => {
    resetEditState();
    setIsEditing(false);
  }, [entry.id]);

  // Gratitude edit handlers
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

  const handleGuidedResponseChange = (promptId: string, text: string) => {
    setGuidedResponses((prev) => ({ ...prev, [promptId]: text }));
  };

  // ─── Read-Only Render Helpers ─────────────────────────

  const renderGratitudeReadOnly = () => {
    const items = entry.structured_content?.items
      ? (entry.structured_content.items as string[])
      : parseGratitudeItems(entry.content);

    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => setIsEditing(true)}>
        {items.map((item, index) => (
          <View
            key={index}
            style={[styles.gratitudeReadItem, { borderBottomColor: colors.border }]}
          >
            <View style={styles.gratitudeIcon}>
                <Seedling size={16} color={catColor} />
              </View>
            <Text style={[styles.gratitudeReadText, { color: colors.text, fontSize: typography.bodyFontSize - 2, lineHeight: typography.bodyLineHeight - 6 }]}>
              {item}
            </Text>
          </View>
        ))}
        <Text style={[styles.tapHint, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 8 }]}>
          Tap to edit
        </Text>
      </TouchableOpacity>
    );
  };

  const renderGuidedReadOnly = () => {
    const prompts = catConfig?.guidedPrompts ?? [];
    const responses = entry.structured_content ?? {};

    // Only show prompts that have answers
    const answeredPrompts = prompts.filter((p) => {
      const v = responses[p.id];
      return v && typeof v === "string" && v.trim();
    });

    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => setIsEditing(true)}>
        {answeredPrompts.map((prompt) => (
          <View key={prompt.id} style={styles.guidedReadSection}>
            <Text style={[styles.guidedReadQuestion, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 2 }]}>
              {prompt.question}
            </Text>
            <Text style={[styles.guidedReadResponse, { color: colors.text, fontSize: typography.bodyFontSize, lineHeight: typography.bodyLineHeight }]}>
              {responses[prompt.id]}
            </Text>
          </View>
        ))}

        {/* Fallback: show plain content if no structured_content */}
        {!entry.structured_content && entry.content && (
          <Text style={[styles.contentText, { color: colors.text, fontSize: typography.bodyFontSize, lineHeight: typography.bodyLineHeight }]}>
            {entry.content}
          </Text>
        )}

        <Text style={[styles.tapHint, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 8 }]}>
          Tap to edit
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTextReadOnly = () => {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => setIsEditing(true)}>
        <Text style={[styles.contentText, { color: colors.text, fontSize: typography.bodyFontSize, lineHeight: typography.bodyLineHeight }]}>
          {entry.content}
        </Text>
        <Text style={[styles.tapHint, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 8 }]}>
          Tap to edit
        </Text>
      </TouchableOpacity>
    );
  };

  // ─── Edit Mode Render Helpers ─────────────────────────

  const renderTextEdit = () => (
    <View style={styles.editContainer}>
      {catConfig?.introText && (
        <View style={[styles.introWrapper, { borderBottomColor: colors.border }]}>
          <Text style={[styles.introText, { color: colors.accent, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.5 }]}>
            {catConfig.introText}
          </Text>
        </View>
      )}
      <TextInput
        style={[
          styles.editInput,
          {
            color: colors.text,
            fontSize: typography.bodyFontSize,
            lineHeight: typography.bodyLineHeight,
            backgroundColor: "#FFFFFF",
          },
        ]}
        value={editContent}
        onChangeText={setEditContent}
        multiline
        textAlignVertical="top"
        autoFocus
        autoCorrect
        autoCapitalize="sentences"
        scrollEnabled
        selectionColor={colors.accent}
      />
    </View>
  );

  const renderGratitudeEdit = () => (
    <View>
      {gratitudeItems.map((item, index) => (
        <View
          key={index}
          style={[
            styles.gratitudeEditCard,
            {
              backgroundColor: "#FFFFFF",
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.gratitudeIcon}>
                <Seedling size={16} color={catColor} />
              </View>
          <TextInput
            style={[styles.gratitudeEditInput, { color: colors.text, fontSize: typography.bodyFontSize - 2, lineHeight: typography.bodyLineHeight - 6 }]}
            placeholder="I'm grateful for..."
            placeholderTextColor={colors.textSecondary + "60"}
            value={item}
            onChangeText={(text) => handleGratitudeItemChange(index, text)}
            multiline
            autoCorrect
            autoCapitalize="sentences"
          />
          {gratitudeItems.length > 1 && (
            <TouchableOpacity
              onPress={() => handleRemoveGratitudeItem(index)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginTop: 2 }}
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
      <TouchableOpacity
        style={[styles.addSlotButton, { borderColor: colors.border }]}
        onPress={handleAddGratitudeSlot}
      >
        <Ionicons name="add" size={18} color={catColor} />
        <Text style={[styles.addSlotText, { color: catColor, fontSize: typography.bodyFontSize - 6 }]}>add another</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGuidedEdit = () => {
    if (!catConfig?.guidedPrompts) return null;
    return (
      <GuidedPromptEditor
        prompts={catConfig.guidedPrompts}
        responses={guidedResponses}
        onResponseChange={handleGuidedResponseChange}
        color={catColor}
        introText={catConfig.introText ?? ""}
      />
    );
  };

  // ─── Main Render ──────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: pageChromeBackgroundColor }]}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
            {catConfig && (
              <EntryTypeIcon svgIcon={catConfig.svgIcon} size={28} color={colors.textOnAccent} />
            )}
            <Text style={[styles.headerTitleText, { color: colors.textOnAccent }]}>
              {catLabel}
            </Text>
          </View>
        </LinearGradient>

        {/* Date & Time + Delete */}
        <View style={[styles.dateBar, { backgroundColor: pageChromeBackgroundColor }]}>
          <View style={styles.dateBarRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dateText, { color: colors.text, fontSize: typography.bodyFontSize - 5 }]}>{dateStr}</Text>
              <Text style={[styles.timeText, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 7 }]}>
                {timeStr}
              </Text>
            </View>
            <View style={styles.dateBarActions}>
              <TouchableOpacity onPress={handleShare} style={styles.dateBarActionButton}>
                <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.dateBarActionButton}>
                <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Content */}
        <KeyboardAwareScrollView
          style={[styles.contentScroll, { backgroundColor: pageChromeBackgroundColor }]}
          contentContainerStyle={
            isEditing && editorType === "text"
              ? styles.journalEditScrollContent
              : undefined
          }
          bottomOffset={96}
          extraKeyboardSpace={24}
          keyboardShouldPersistTaps="handled"
        >
          {isEditing ? (
            <>
              {editorType === "text" && renderTextEdit()}
              {editorType === "items" && renderGratitudeEdit()}
              {editorType === "guided" && renderGuidedEdit()}
            </>
          ) : (
            <>
              {editorType === "text" && renderTextReadOnly()}
              {editorType === "items" && renderGratitudeReadOnly()}
              {editorType === "guided" && renderGuidedReadOnly()}
            </>
          )}
          {!(isEditing && editorType === "text") && (
            <View style={{ height: 100 }} />
          )}
        </KeyboardAwareScrollView>

        {/* Bottom Bar */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: isEditing ? "#FFFFFF" : pageChromeBackgroundColor,
              borderTopColor: colors.border,
            },
          ]}
        >
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.discardButton, { backgroundColor: colors.cardBackground }]}
                onPress={handleDiscard}
              >
                <Text style={[styles.discardText, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 4 }]}>
                  Discard
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButtonWrapper}
                onPress={handleSave}
                disabled={saving || !hasChanges}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={
                    hasChanges
                      ? [colors.heroGradientStart, colors.heroGradientEnd]
                      : [colors.border, colors.border]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveEditButton}
                >
                  <Text style={[styles.saveEditText, { color: hasChanges ? colors.textOnAccent : colors.textSecondary, fontSize: typography.bodyFontSize - 4 }]}>
                    {saving ? "Saving..." : "Save"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  {
                    backgroundColor: hasPrev
                      ? colors.cardBackground
                      : colors.border + "40",
                  },
                ]}
                onPress={onPrev}
                disabled={!hasPrev}
              >
                <Ionicons
                  name="arrow-back"
                  size={18}
                  color={hasPrev ? colors.accent : colors.textSecondary + "40"}
                />
                <Text
                  style={[
                    styles.navText,
                    {
                      color: hasPrev
                        ? colors.accent
                        : colors.textSecondary + "40",
                      fontSize: typography.bodyFontSize - 5,
                    },
                  ]}
                >
                  Prev
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.doneButton}
                onPress={onBack}
              >
                <Text style={[styles.doneText, { color: colors.accent, fontSize: typography.bodyFontSize - 4 }]}>
                  Done
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.navButton,
                  {
                    backgroundColor: hasNext
                      ? colors.cardBackground
                      : colors.border + "40",
                  },
                ]}
                onPress={onNext}
                disabled={!hasNext}
              >
                <Text
                  style={[
                    styles.navText,
                    {
                      color: hasNext
                        ? colors.accent
                        : colors.textSecondary + "40",
                      fontSize: typography.bodyFontSize - 5,
                    },
                  ]}
                >
                  Next
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={hasNext ? colors.accent : colors.textSecondary + "40"}
                />
              </TouchableOpacity>
            </>
          )}
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
  dateBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dateBarActionButton: {
    padding: 8,
  },
  dateBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  dateBarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "600",
  },
  // typeBadge styles removed — type info now shown in gradient header
  timeText: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    marginTop: 2,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  journalEditScrollContent: {
    flexGrow: 1,
  },

  // ─── Read-Only ────────────────────────────────────────
  introWrapper: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 16,
  },
  introText: {
    fontFamily: fonts.headerFamilyItalic,
    textAlign: "center",
  },
  contentText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    lineHeight: 28,
  },
  tapHint: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 20,
    textAlign: "center",
  },

  // ─── Gratitude Read-Only ──────────────────────────────
  gratitudeReadItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  gratitudeIcon: {
    marginTop: 2,
  },
  gratitudeReadText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
  },

  // ─── Guided Read-Only ─────────────────────────────────
  guidedReadSection: {
    marginBottom: 20,
  },
  guidedReadQuestion: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  guidedReadResponse: {
    fontFamily: fonts.bodyFamily,
    fontSize: 16,
    lineHeight: 24,
  },

  // ─── Gratitude Edit ───────────────────────────────────
  gratitudeEditCard: {
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
  gratitudeEditInput: {
    flex: 1,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 22,
  },
  addSlotButton: {
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
  addSlotText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    fontWeight: "500",
  },

  // ─── Text Edit ────────────────────────────────────────
  editContainer: {
    flex: 1,
  },
  editInput: {
    flex: 1,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    lineHeight: 28,
    paddingTop: 8,
    paddingBottom: 20,
    minHeight: 120,
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
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  navText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "500",
  },
  doneButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  doneText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    fontWeight: "600",
  },
  discardButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  discardText: {
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
  saveEditButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  saveEditText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
    // color set inline via colors.textOnAccent
  },
});
