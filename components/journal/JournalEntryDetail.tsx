import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { fonts, typography as staticTypography } from "../../constants/theme";
import type { JournalEntry } from "../../hooks/useJournalStorage";
import {
  getCategoryById,
  getCategoryLabel,
  getCategoryColor,
  type EntryType,
} from "../../constants/journalCategories";
import { Seedling } from "../../components/icons";
import { SanctuaryCard } from "../ui/Sanctuary";
import { TealHeader } from "../shared/TealHeader";
import { buildJournalEntryShareMessage, parseGratitudeItems } from "../../utils/journalShare";

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

type Draft =
  | { kind: "none" }
  | { kind: "text"; value: string }
  | { kind: "items"; items: string[] }
  | { kind: "guided"; promptId: string; value: string };

export const JournalEntryDetail: React.FC<JournalEntryDetailProps> = ({
  entry,
  onBack,
  onSave,
  onDelete,
}) => {
  const { colors } = useTheme();
  const { typography } = useTypography();
  const [draft, setDraft] = useState<Draft>({ kind: "none" });

  // Dynamic sizes for every text element in this screen — scale from
  // bodyLargeFontSize so the "medium" tier matches the prior static
  // values (20 question, 17 fallback content, 16 body/input, 15 aux).
  const questionFontSize = Math.round(typography.bodyLargeFontSize * (20 / 19));
  const questionLineHeight = Math.round(questionFontSize * (26 / 20));
  const bodyFontSize = Math.round(typography.bodyLargeFontSize * (16 / 19));
  const bodyLineHeight = Math.round(bodyFontSize * (22 / 16));
  const auxFontSize = Math.round(typography.bodyLargeFontSize * (15 / 19));
  const auxLineHeight = Math.round(auxFontSize * (20 / 15));
  const [saving, setSaving] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  const entryType = (entry.entry_type || "journal") as EntryType;
  const catConfig = getCategoryById(entryType);
  const catLabel = getCategoryLabel(entryType);
  const catColor = getCategoryColor(entryType);
  const editorType = catConfig?.editorType ?? "text";

  const entryDate = new Date(entry.created_at);
  const dayOfWeek = entryDate.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = entryDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const timeStr = entryDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  // Reset draft when entry changes (prev/next navigation).
  React.useEffect(() => {
    setDraft({ kind: "none" });
  }, [entry.id]);

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
    try {
      await Share.share({ message: buildJournalEntryShareMessage(entry) });
    } catch (err) {
      console.error("Error sharing entry:", err);
    }
  };

  const startEditText = () => {
    setDraft({ kind: "text", value: entry.content ?? "" });
  };

  const startEditItems = () => {
    const items = entry.structured_content?.items
      ? (entry.structured_content.items as string[])
      : parseGratitudeItems(entry.content);
    setDraft({ kind: "items", items: items.length > 0 ? [...items] : [""] });
  };

  const startEditGuidedPrompt = (promptId: string) => {
    const existing = entry.structured_content?.[promptId];
    const value = typeof existing === "string" ? existing : "";
    setDraft({ kind: "guided", promptId, value });
  };

  const handleCancel = () => {
    setDraft({ kind: "none" });
  };

  const handleSave = async () => {
    if (draft.kind === "none" || saving) return;
    setSaving(true);
    try {
      if (draft.kind === "text") {
        const trimmed = draft.value.trim();
        if (!trimmed) {
          Alert.alert("Nothing to save", "Write something before saving.");
          setSaving(false);
          return;
        }
        await onSave(entry.id, trimmed, null);
      } else if (draft.kind === "items") {
        const filled = draft.items.map((i) => i.trim()).filter(Boolean);
        if (filled.length === 0) {
          Alert.alert("Nothing to save", "Add at least one item before saving.");
          setSaving(false);
          return;
        }
        const searchable = filled.join(" • ");
        await onSave(entry.id, searchable, { items: filled });
      } else if (draft.kind === "guided") {
        const existing = (entry.structured_content ?? {}) as Record<string, any>;
        const merged: Record<string, string> = {};
        for (const [key, value] of Object.entries(existing)) {
          if (typeof value === "string" && value.trim()) merged[key] = value;
        }
        const trimmed = draft.value.trim();
        if (trimmed) {
          merged[draft.promptId] = trimmed;
        } else {
          delete merged[draft.promptId];
        }
        const searchable = Object.values(merged).join("\n\n");
        await onSave(entry.id, searchable || null, Object.keys(merged).length > 0 ? merged : null);
      }
      setDraft({ kind: "none" });
    } catch {
      Alert.alert("Error", "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // Gratitude list edit helpers
  const updateItem = (index: number, text: string) => {
    setDraft((prev) => {
      if (prev.kind !== "items") return prev;
      const next = [...prev.items];
      next[index] = text;
      return { ...prev, items: next };
    });
  };

  const addItem = () => {
    setDraft((prev) => {
      if (prev.kind !== "items") return prev;
      return { ...prev, items: [...prev.items, ""] };
    });
  };

  const removeItem = (index: number) => {
    setDraft((prev) => {
      if (prev.kind !== "items") return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  };

  // ─── Inline Card Footer (Save / Cancel) ───────────────

  const renderCardFooter = () => (
    <View style={[styles.cardFooter, { borderTopColor: colors.ghostBorder }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleCancel}
        style={styles.footerCancel}
      >
        <Text
          style={[styles.footerCancelText, { color: colors.onSurfaceVariant }]}
        >
          Cancel
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleSave}
        disabled={saving}
        style={[
          styles.footerSave,
          { backgroundColor: colors.primaryContainer },
          saving && styles.footerSaveDisabled,
        ]}
      >
        <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
        <Text style={[styles.footerSaveText, { color: colors.onPrimary }]}>
          {saving ? "Saving..." : "Save"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Card Renderers ───────────────────────────────────

  const renderTextCard = () => {
    const isEditing = draft.kind === "text";
    return (
      <SanctuaryCard
        tone="lowest"
        style={styles.entryCard}
        contentStyle={styles.entryCardContent}
        elevated
      >
        {isEditing ? (
          <>
            <TextInput
              ref={textInputRef}
              style={[
                styles.textEditInput,
                {
                  fontSize: bodyFontSize,
                  lineHeight: bodyLineHeight,
                  color: colors.text,
                  backgroundColor: colors.surfaceContainerLow,
                },
              ]}
              value={draft.value}
              onChangeText={(value) =>
                setDraft((prev) => (prev.kind === "text" ? { ...prev, value } : prev))
              }
              multiline
              textAlignVertical="top"
              autoFocus
              autoCorrect
              autoCapitalize="sentences"
              placeholder="What's on your mind..."
              placeholderTextColor={colors.textSecondary + "70"}
              selectionColor={colors.secondary}
            />
            {renderCardFooter()}
          </>
        ) : (
          <TouchableOpacity activeOpacity={0.8} onPress={startEditText}>
            <Text style={[styles.contentText, typography.body, { color: colors.text }]}>
              {entry.content}
            </Text>
          </TouchableOpacity>
        )}
      </SanctuaryCard>
    );
  };

  const renderItemsCard = () => {
    const isEditing = draft.kind === "items";
    return (
      <SanctuaryCard
        tone="lowest"
        style={styles.entryCard}
        contentStyle={styles.entryCardContent}
        elevated
      >
        {isEditing ? (
          <>
            {draft.items.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.itemsEditRow,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <View style={styles.gratitudeIcon}>
                  <Seedling size={16} color={catColor} />
                </View>
                <TextInput
                  style={[
                    styles.itemsEditInput,
                    {
                      fontSize: bodyFontSize,
                      lineHeight: bodyLineHeight,
                      color: colors.text,
                    },
                  ]}
                  placeholder="I'm grateful for..."
                  placeholderTextColor={colors.textSecondary + "70"}
                  value={item}
                  onChangeText={(text) => updateItem(index, text)}
                  multiline
                  autoCorrect
                  autoCapitalize="sentences"
                />
                {draft.items.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeItem(index)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.itemsRemove}
                  >
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={colors.textSecondary + "80"}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={styles.addItemLink}
              onPress={addItem}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add" size={18} color={colors.secondary} />
              <Text
                style={[
                  styles.addItemLinkText,
                  { fontSize: auxFontSize, color: colors.secondary },
                ]}
              >
                Add another
              </Text>
            </TouchableOpacity>
            {renderCardFooter()}
          </>
        ) : (
          <TouchableOpacity activeOpacity={0.8} onPress={startEditItems}>
            {(entry.structured_content?.items
              ? (entry.structured_content.items as string[])
              : parseGratitudeItems(entry.content)
            ).map((item, index) => (
              <View
                key={index}
                style={[styles.gratitudeReadItem, { borderBottomColor: colors.border }]}
              >
                <View style={styles.gratitudeIcon}>
                  <Seedling size={16} color={catColor} />
                </View>
                <Text
                  style={[
                    styles.gratitudeReadText,
                    { fontSize: bodyFontSize, lineHeight: bodyLineHeight, color: colors.text },
                  ]}
                >
                  {item}
                </Text>
              </View>
            ))}
          </TouchableOpacity>
        )}
      </SanctuaryCard>
    );
  };

  const renderGuidedCards = () => {
    const prompts = catConfig?.guidedPrompts ?? [];
    const responses = entry.structured_content ?? {};

    return (
      <>
        {prompts.map((prompt) => {
          const value = responses[prompt.id];
          const hasAnswer = value && typeof value === "string" && value.trim();
          const isEditing = draft.kind === "guided" && draft.promptId === prompt.id;
          return (
            <View
              key={prompt.id}
              style={[
                styles.guidedCard,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.ghostBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.guidedQuestion,
                  {
                    fontSize: questionFontSize,
                    lineHeight: questionLineHeight,
                    color: colors.primary,
                  },
                ]}
              >
                {prompt.question}
              </Text>
              {isEditing ? (
                <>
                  <TextInput
                    style={[
                      styles.guidedEditInput,
                      {
                        fontSize: bodyFontSize,
                        lineHeight: bodyLineHeight,
                        color: colors.text,
                        backgroundColor: colors.surface,
                        borderColor: colors.ghostBorder,
                      },
                    ]}
                    value={draft.value}
                    onChangeText={(value) =>
                      setDraft((prev) =>
                        prev.kind === "guided" ? { ...prev, value } : prev
                      )
                    }
                    multiline
                    textAlignVertical="top"
                    autoFocus
                    autoCorrect
                    autoCapitalize="sentences"
                    placeholder={prompt.placeholder ?? ""}
                    placeholderTextColor={colors.textSecondary + "70"}
                    selectionColor={colors.secondary}
                  />
                  {renderCardFooter()}
                </>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => startEditGuidedPrompt(prompt.id)}
                >
                  {hasAnswer ? (
                    <Text
                      style={[
                        styles.guidedResponse,
                        {
                          fontSize: bodyFontSize,
                          lineHeight: bodyLineHeight,
                          color: colors.text,
                        },
                      ]}
                    >
                      {value}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        styles.guidedEmpty,
                        {
                          fontSize: auxFontSize,
                          lineHeight: auxLineHeight,
                          color: colors.textSecondary + "80",
                        },
                      ]}
                    >
                      Tap to add
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Fallback: show plain content if no structured_content */}
        {!entry.structured_content && entry.content && (
          <Text
            style={[
              styles.contentText,
              {
                color: colors.text,
                fontSize: typography.bodyFontSize,
                lineHeight: typography.bodyLineHeight,
              },
            ]}
          >
            {entry.content}
          </Text>
        )}
      </>
    );
  };

  // ─── Main Render ──────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surface }]}
      edges={["top"]}
    >
      <TealHeader
        title={catLabel}
        onBack={onBack}
        rightAction={
          <View style={styles.actionIcons}>
            <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {Platform.OS === "ios" ? (
                <MaterialIcons name="ios-share" size={22} color={colors.onPrimary} />
              ) : (
                <MaterialIcons name="share" size={22} color={colors.onPrimary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={22} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Date & Time */}
      <View style={[styles.dateBar, { backgroundColor: colors.surface }]}>
        <Text style={[styles.dateText, { color: colors.onSurfaceVariant }]}>
          {dayOfWeek}, {monthDay} · {timeStr}
        </Text>
      </View>

      {/* Content */}
      <KeyboardAwareScrollView
        style={styles.contentScroll}
        bottomOffset={96}
        extraKeyboardSpace={24}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.tapHint, typography.caption, { color: colors.textSecondary }]}>
          Tap to edit
        </Text>
        {editorType === "guided" && renderGuidedCards()}
        {editorType === "text" && renderTextCard()}
        {editorType === "items" && renderItemsCard()}
        <View style={{ height: 100 }} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dateBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dateText: {
    ...staticTypography.caption,
    fontFamily: fonts.labelFamily,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  tapHint: {
    fontStyle: "italic",
    textAlign: "left",
    marginBottom: 14,
  },

  // ─── Text / Items wrapper card ────────────────────────
  entryCard: {
    borderRadius: 16,
  },
  entryCardContent: {
    padding: 20,
  },
  contentText: {},

  // ─── Text edit input ──────────────────────────────────
  textEditInput: {
    // fontSize/lineHeight applied inline (bodyFontSize / bodyLineHeight).
    minHeight: 160,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    fontFamily: fonts.bodyFamily,
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
    // fontSize/lineHeight applied inline (bodyFontSize / bodyLineHeight).
    flex: 1,
    fontFamily: fonts.bodyFamily,
  },

  // ─── Gratitude Edit ───────────────────────────────────
  itemsEditRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  itemsEditInput: {
    // fontSize/lineHeight applied inline (bodyFontSize / bodyLineHeight).
    flex: 1,
    minHeight: 22,
    fontFamily: fonts.bodyFamily,
  },
  itemsRemove: {
    marginTop: 2,
  },
  addItemLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  addItemLinkText: {
    // fontSize applied inline (auxFontSize).
    fontFamily: fonts.bodyFamilySemiBold,
  },

  // ─── Guided cards ─────────────────────────────────────
  guidedCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    marginBottom: 20,
  },
  guidedQuestion: {
    // fontSize/lineHeight applied inline (questionFontSize / questionLineHeight).
    fontFamily: fonts.cormorantGaramondSemiBold,
    marginBottom: 8,
  },
  guidedResponse: {
    // fontSize/lineHeight applied inline (bodyFontSize / bodyLineHeight).
    fontFamily: fonts.bodyFamily,
  },
  guidedEmpty: {
    // fontSize/lineHeight applied inline (auxFontSize / auxLineHeight).
    fontFamily: fonts.bodyFamily,
    fontStyle: "italic",
  },
  guidedEditInput: {
    // fontSize/lineHeight applied inline (bodyFontSize / bodyLineHeight).
    minHeight: 100,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    fontFamily: fonts.bodyFamily,
  },

  // ─── Card-level save/cancel footer ────────────────────
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerCancel: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  footerCancelText: {
    ...staticTypography.label,
  },
  footerSave: {
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerSaveDisabled: {
    opacity: 0.55,
  },
  footerSaveText: {
    ...staticTypography.label,
  },

  actionIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
});
