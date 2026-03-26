import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { fonts } from "../../constants/theme";
import type { JournalEntry } from "../../hooks/useJournalStorage";
import {
  getCategoryById,
  getCategoryLabel,
  getCategoryColor,
  type EntryType,
} from "../../constants/journalCategories";
import { useSettings } from "../../hooks/useSettings";
import { GuidedPromptEditor } from "./GuidedPromptEditor";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { Seedling } from "../../components/icons";
import { FieldShell, SanctuaryButton, SanctuaryCard } from "../ui/Sanctuary";

interface JournalEntryDetailProps {
  entry: JournalEntry;
  onBack: () => void;
  onSave: (
    entryId: string,
    content: string | null,
    structuredContent?: Record<string, any> | null
  ) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
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
}) => {
  const { colors } = useTheme();

  const { settings } = useSettings();
  const { typography } = useTypography();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const entryType = (entry.entry_type || "journal") as EntryType;
  const catConfig = getCategoryById(entryType);
  const catLabel = getCategoryLabel(entryType);
  const catColor = getCategoryColor(entryType);
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
  const dayOfWeek = entryDate.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = entryDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });
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
    lines.push(`${dayOfWeek}, ${monthDay}`);
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
            <Text style={[styles.gratitudeReadText, typography.bodySmall, { color: colors.text }]}>
              {item}
            </Text>
          </View>
        ))}
      </TouchableOpacity>
    );
  };

  const renderGuidedReadOnly = () => {
    const prompts = catConfig?.guidedPrompts ?? [];
    const responses = entry.structured_content ?? {};

    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => setIsEditing(true)}>
        {prompts.map((prompt) => {
          const value = responses[prompt.id];
          const hasAnswer = value && typeof value === "string" && value.trim();
          return (
            <SanctuaryCard key={prompt.id} tone="lowest" style={styles.guidedCard} contentStyle={styles.guidedCardContent} elevated>
              <Text style={[styles.guidedReadQuestion, typography.bodySmall, { color: colors.primary, fontFamily: fonts.headerFamily }]}>
                {prompt.question}
              </Text>
              {hasAnswer ? (
                <Text style={[styles.guidedReadResponse, typography.bodyLarge, { color: colors.text }]}>
                  {value}
                </Text>
              ) : (
                <Text style={[styles.guidedReadResponse, typography.bodyLarge, { color: colors.textSecondary + "60" }]}>
                  No entry
                </Text>
              )}
            </SanctuaryCard>
          );
        })}

        {/* Fallback: show plain content if no structured_content */}
        {!entry.structured_content && entry.content && (
          <Text style={[styles.contentText, typography.body, { color: colors.text }]}>
            {entry.content}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderTextReadOnly = () => {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => setIsEditing(true)}>
        <Text style={[styles.contentText, typography.body, { color: colors.text }]}>
          {entry.content}
        </Text>
      </TouchableOpacity>
    );
  };

  // ─── Edit Mode Render Helpers ─────────────────────────

  const renderTextEdit = () => (
    <View style={styles.editContainer}>
      <FieldShell style={styles.editInputShell}>
        <TextInput
          style={[styles.editInput, typography.body, { color: colors.text }]}
          value={editContent}
          onChangeText={setEditContent}
          multiline
          textAlignVertical="top"
          autoFocus
          autoCorrect
          autoCapitalize="sentences"
          scrollEnabled={false}
          selectionColor={colors.secondary}
        />
      </FieldShell>
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
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.gratitudeIcon}>
                <Seedling size={16} color={catColor} />
              </View>
          <TextInput
            style={[styles.gratitudeEditInput, typography.bodySmall, { color: colors.text }]}
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
        <Text style={[styles.addSlotText, typography.caption, { color: catColor }]}>add another</Text>
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
      style={[styles.container, { backgroundColor: colors.surface }]}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.gradientHeader, { backgroundColor: colors.primary }]}>
          <View style={styles.headerTitleRow}>
            {catConfig ? (
              <View style={[styles.headerIconShell, { backgroundColor: colors.onPrimary + "1A" }]}>
                <EntryTypeIcon svgIcon={catConfig.svgIcon} size={24} color={colors.onPrimary} />
              </View>
            ) : null}
            <View style={styles.headerTextBlock}>
              <Text style={[styles.headerEyebrow, typography.label, { color: colors.secondaryContainer }]}>Notebook entry</Text>
              <Text style={[styles.headerTitleText, typography.h2, { color: colors.onPrimary }]}>{catLabel}</Text>
            </View>
          </View>
        </View>

        {/* Back + Actions */}
        <View style={[styles.backActionRow, { paddingHorizontal: 20 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primaryContainer} />
            <Text style={[styles.backLabel, { color: colors.primaryContainer }]}>Back</Text>
          </TouchableOpacity>
          <View style={styles.actionIcons}>
            <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="arrow-redo-outline" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Date & Time */}
        <View style={[styles.dateBar, { backgroundColor: colors.surface }]}>
          <Text style={[styles.dateText, typography.h1, { color: colors.text }]}>{dayOfWeek}, {monthDay}</Text>
          <Text style={[styles.timeText, typography.bodySmall, { color: colors.textSecondary }]}>
            {timeStr}
          </Text>
        </View>

        {/* Content */}
        <KeyboardAwareScrollView
          style={styles.contentScroll}
          bottomOffset={96}
          extraKeyboardSpace={24}
          keyboardShouldPersistTaps="handled"
        >
          {isEditing ? (
            <SanctuaryCard tone="lowest" style={styles.entryCard} contentStyle={styles.entryCardContent} elevated>
              {editorType === "text" && renderTextEdit()}
              {editorType === "items" && renderGratitudeEdit()}
              {editorType === "guided" && renderGuidedEdit()}
            </SanctuaryCard>
          ) : (
            <>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setIsEditing(true)}>
                <Text style={[styles.tapHint, typography.caption, { color: colors.textSecondary, marginTop: 0, marginBottom: 16 }]}>
                  Tap to edit
                </Text>
              </TouchableOpacity>
              {editorType === "guided" ? (
                renderGuidedReadOnly()
              ) : (
                <SanctuaryCard tone="lowest" style={styles.entryCard} contentStyle={styles.entryCardContent} elevated>
                  {editorType === "text" && renderTextReadOnly()}
                  {editorType === "items" && renderGratitudeReadOnly()}
                </SanctuaryCard>
              )}
            </>
          )}
          <View style={{ height: 100 }} />
        </KeyboardAwareScrollView>

        {/* Bottom Bar (editing only) */}
        {isEditing && (
          <View
            style={[
              styles.bottomBar,
              { backgroundColor: colors.surface, borderTopColor: colors.ghostBorder },
            ]}
          >
            <SanctuaryButton
              label="Discard"
              variant="secondary"
              onPress={handleDiscard}
              style={styles.bottomButton}
            />
            <SanctuaryButton
              label={saving ? "Saving..." : "Save"}
              onPress={handleSave}
              disabled={saving || !hasChanges}
              style={styles.bottomButton}
            />
          </View>
        )}
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
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  headerTitleText: {
  },
  bottomReadOnly: {
    flex: 1,
    gap: 10,
  },
  bottomNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  dateBar: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  dateBarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateText: {
    fontFamily: fonts.bodyFamilySemiBold,
  },
  // typeBadge styles removed — type info now shown in gradient header
  timeText: {
    marginTop: 2,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  entryCard: {
    borderRadius: 16,
  },
  entryCardContent: {
    padding: 20,
  },

  // ─── Read-Only ────────────────────────────────────────
  contentText: {
  },
  tapHint: {
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
    flex: 1,
  },

  // ─── Guided Read-Only ─────────────────────────────────
  guidedCard: {
    borderRadius: 14,
    marginBottom: 12,
  },
  guidedCardContent: {
    padding: 18,
  },
  guidedReadSection: {
    marginBottom: 20,
  },
  guidedReadQuestion: {
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  guidedReadResponse: {
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
    fontWeight: "500",
  },

  // ─── Text Edit ────────────────────────────────────────
  editContainer: {
    minHeight: 200,
  },
  editInputShell: {
    minHeight: 200,
  },
  editInput: {
    minHeight: 200,
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
  bottomButton: {
    flex: 1,
  },
  backActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  backLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
});
