import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useNavigation } from "expo-router";
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
import { supabase } from "../../lib/supabase";

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
  const navigation = useNavigation();

  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const categoryConfig = getCategoryById(entryType);
  const categoryLabel = getCategoryLabel(entryType);
  const categoryColor = getCategoryColor(entryType);
  const editorType = categoryConfig?.editorType ?? "text";

  const [saving, setSaving] = useState(false);
  const [dailyGratitudeQuote, setDailyGratitudeQuote] = useState<string>("");
  const [dailyGratitudeReference, setDailyGratitudeReference] = useState<string>("");

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

  const saveEntry = useCallback(async (): Promise<boolean> => {
    if (!hasContent) {
      Alert.alert(
        "Nothing to save",
        editorType === "items"
          ? "Add at least one item before saving."
          : "Write something before saving."
      );
      return false;
    }

    setSaving(true);
    try {
      switch (editorType) {
        case "text": {
          await onSave(entryType, content.trim(), null);
          return true;
        }
        case "items": {
          const filledItems = gratitudeItems
            .map((i) => i.trim())
            .filter(Boolean);
          const searchableContent = filledItems.join(" • ");
          await onSave(entryType, searchableContent, { items: filledItems });
          return true;
        }
        case "guided": {
          const filledResponses: Record<string, string> = {};
          for (const [key, value] of Object.entries(guidedResponses)) {
            if (value.trim()) filledResponses[key] = value.trim();
          }
          // Build searchable content from non-empty responses
          const searchableContent = Object.values(filledResponses).join("\n\n");
          await onSave(entryType, searchableContent, filledResponses);
          return true;
        }
        default:
          return false;
      }
    } catch (err) {
      const message = String(err).toLowerCase().includes("timed out")
        ? "Saving is taking too long. Please try again."
        : "Failed to save your entry. Please try again.";
      Alert.alert("Error", message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    content,
    editorType,
    entryType,
    gratitudeItems,
    guidedResponses,
    hasContent,
    onSave,
  ]);

  const handleSave = async () => {
    await saveEntry();
  };

  const confirmExit = useCallback(
    (onProceed: () => void) => {
      if (!hasContent) {
        onProceed();
        return;
      }

      Alert.alert("Unsaved entry", "Do you want to save this entry before leaving?", [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: onProceed,
        },
        {
          text: "Save",
          onPress: async () => {
            const saved = await saveEntry();
            if (saved) onProceed();
          },
        },
      ]);
    },
    [hasContent, saveEntry]
  );

  const handleCancel = () => {
    confirmExit(onCancel);
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

  const gratitudeQuoteFontSize = Math.round(typography.bodyFontSize * 1.11) + 2;
  const gratitudeQuoteLineHeight = Math.round(gratitudeQuoteFontSize * 1.18);

  // Load daily gratitude quote for the gratitude editor from `gratitude_quotes`.
  React.useEffect(() => {
    if (entryType !== "gratitude") return;
    let cancelled = false;

    const fetchDailyQuote = async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const diff = now.getTime() - start.getTime();
      const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

      const { data } = await supabase
        .from("gratitude_quotes")
        .select("quote, author")
        .eq("day_of_year", dayOfYear)
        .single();

      if (!cancelled && data?.quote) {
        let quoteText = String(data.quote).trim();
        let referenceText = data.author ? String(data.author).trim() : "";

        // Match Today page behavior: if quote has trailing parenthetical, move it to reference.
        const match = quoteText.match(/^(.*?)(\s*\(([^()]*)\))\s*$/);
        if (match) {
          quoteText = match[1].trim();
          referenceText = match[3].trim();
        }

        setDailyGratitudeQuote(quoteText);
        setDailyGratitudeReference(referenceText);
      }
    };

    fetchDailyQuote();
    return () => {
      cancelled = true;
    };
  }, [entryType]);

  // In any journal editor, tab presses should close this sheet.
  // If there's unsaved content, ask whether to save or discard first.
  React.useEffect(() => {
    const resolveTabNavigation = () => {
      let current: any = navigation;
      let tabNav: any = null;

      while (current) {
        const state = current.getState?.();
        if (state?.type === "tab") {
          tabNav = current;
        }
        current = current.getParent?.();
      }

      return tabNav ?? ((navigation as any).getParent?.() ?? navigation);
    };

    const tabNavigation = resolveTabNavigation();
    const unsubscribe = (tabNavigation as any).addListener("tabPress", (e: any) => {
      const targetKey: string | undefined = e?.target;
      const state = (tabNavigation as any).getState?.();
      const targetRoute = state?.routes?.find((r: any) => r.key === targetKey);
      const targetRouteName = targetRoute?.name as string | undefined;

      e.preventDefault();
      confirmExit(() => {
        onCancel();
        if (targetRouteName) {
          setTimeout(() => {
            (tabNavigation as any).navigate(targetRouteName);
          }, 0);
        }
      });
    });

    return unsubscribe;
  }, [confirmExit, navigation, onCancel]);

  // Android hardware back should follow the same save/discard flow.
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        confirmExit(onCancel);
        return true;
      }
    );

    return () => subscription.remove();
  }, [confirmExit, onCancel]);

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
              {entryType === "journal" ? (
                <View style={styles.journalContainer}>
                  <ImageBackground
                    source={require("../../assets/journal.jpg")}
                    style={styles.journalHeroImage}
                    imageStyle={styles.journalHeroImageInner}
                    resizeMode="cover"
                  />
                  <SanctuaryCard
                    tone="lowest"
                    style={styles.journalOverlayCard}
                    contentStyle={styles.journalOverlayContent}
                  >
                    {categoryConfig?.introText && (
                      <View style={styles.journalQuoteWrap}>
                        <Text
                          style={[
                            styles.journalQuoteText,
                            {
                              color: colors.primary,
                              fontSize: gratitudeQuoteFontSize,
                              lineHeight: gratitudeQuoteLineHeight,
                            },
                          ]}
                        >
                          {categoryConfig.introText}
                        </Text>
                      </View>
                    )}
                    <FieldShell style={styles.textInputShell}>
                      <TextInput
                        style={[
                          styles.textInput,
                          {
                            color: colors.text,
                            fontSize: typography.bodyFontSize,
                            lineHeight: typography.bodyLineHeight,
                          },
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
                  </SanctuaryCard>
                </View>
              ) : (
                <>
                  {categoryConfig?.introText && (
                    <SanctuaryCard
                      tone="low"
                      style={styles.textIntroWrapper}
                      contentStyle={styles.textIntroContent}
                    >
                      <Text
                        style={[
                          styles.introText,
                          {
                            color: colors.primaryContainer,
                            fontSize: typography.bodyFontSize,
                            lineHeight: typography.bodyFontSize * 1.5,
                          },
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
                        {
                          color: colors.text,
                          fontSize: typography.bodyFontSize,
                          lineHeight: typography.bodyLineHeight,
                        },
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
                </>
              )}
            </View>
          )}

          {editorType === "items" && (
            <View style={styles.gratitudeContainer}>
              <ImageBackground
                source={require("../../assets/gratitude.jpg")}
                style={styles.gratitudeHeroImage}
                imageStyle={styles.gratitudeHeroImageInner}
                resizeMode="cover"
              />

              <SanctuaryCard
                tone="lowest"
                style={styles.gratitudeOverlayCard}
                contentStyle={styles.gratitudeOverlayContent}
              >
                {!!dailyGratitudeQuote && (
                  <View style={styles.gratitudeQuoteWrap}>
                    <Text
                      style={[
                        styles.gratitudeDailyQuote,
                        {
                          color: colors.primary,
                          fontSize: gratitudeQuoteFontSize,
                          lineHeight: gratitudeQuoteLineHeight,
                        },
                      ]}
                    >
                      {dailyGratitudeQuote}
                    </Text>
                    {!!dailyGratitudeReference && (
                      <Text
                        style={[
                          styles.gratitudeDailyReference,
                          { color: colors.onSurfaceVariant },
                        ]}
                      >
                        {dailyGratitudeReference}
                      </Text>
                    )}
                  </View>
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
              </SanctuaryCard>
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
  journalContainer: {
    paddingTop: 0,
  },
  journalHeroImage: {
    height: 220,
    width: "100%",
  },
  journalHeroImageInner: {
    opacity: 0.95,
  },
  journalOverlayCard: {
    marginHorizontal: 20,
    marginTop: -72,
    marginBottom: 8,
    borderRadius: 12,
  },
  journalOverlayContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  journalQuoteWrap: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 24,
  },
  journalQuoteText: {
    fontFamily: fonts.bodyFamilyBold,
    textAlign: "left",
    fontWeight: "700",
    paddingHorizontal: 14,
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
    paddingTop: 0,
  },
  gratitudeHeroImage: {
    height: 220,
    width: "100%",
  },
  gratitudeHeroImageInner: {
    opacity: 0.95,
  },
  gratitudeOverlayCard: {
    marginHorizontal: 20,
    marginTop: -72,
    marginBottom: 8,
    borderRadius: 12,
  },
  gratitudeOverlayContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
  },
  gratitudeDailyQuote: {
    fontFamily: fonts.bodyFamilyBold,
    textAlign: "left",
    fontWeight: "700",
    paddingHorizontal: 14,
  },
  gratitudeQuoteWrap: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 24,
  },
  gratitudeDailyReference: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.2,
    textAlign: "left",
    marginTop: 10,
    paddingHorizontal: 14,
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
