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
  Image,
  BackHandler,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useNavigation } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import { useDailyGratitudeQuote } from "../../hooks/useDailyGratitudeQuote";
import {
  getCategoryById,
  getCategoryLabel,
  getCategoryColor,
  type EntryType,
} from "../../constants/journalCategories";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { GuidedPromptEditor } from "./GuidedPromptEditor";
import { JournalCategoryPicker } from "./JournalCategoryPicker";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { Seedling } from "../../components/icons";
import { FieldShell, SanctuaryButton, SanctuaryCard } from "../ui/Sanctuary";
import { useAppDate } from "../../contexts/AppDateContext";

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
  onSwitchEntryType?: (entryType: EntryType) => void;
}

export const JournalEntryEditor: React.FC<JournalEntryEditorProps> = ({
  entryType,
  onSave,
  onCancel,
  initialContent = "",
  initialStructuredContent = null,
  isEditing = false,
  onSwitchEntryType,
}) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();

  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const categoryConfig = getCategoryById(entryType);
  const categoryLabel = getCategoryLabel(entryType);
  const categoryColor = getCategoryColor(entryType);
  const editorType = categoryConfig?.editorType ?? "text";
  const { journalIntroQuote, journalIntroReference } = useMemo(() => {
    const raw = categoryConfig?.introText?.trim() ?? "";
    if (!raw) {
      return { journalIntroQuote: "", journalIntroReference: "" };
    }

    const dashMatch = raw.match(/^(.*?)(?:\s+[—-]\s*)([^—-][\s\S]*)$/);
    if (dashMatch) {
      return {
        journalIntroQuote: dashMatch[1].trim(),
        journalIntroReference: dashMatch[2].trim(),
      };
    }

    return { journalIntroQuote: raw, journalIntroReference: "" };
  }, [categoryConfig?.introText]);

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
  const [focusedPromptId, setFocusedPromptId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const { today } = useAppDate();
  const { quote: dailyGratitudeQuoteData } = useDailyGratitudeQuote({
    enabled: entryType === "gratitude",
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

  const handleSwitchEntryType = useCallback(
    (nextEntryType: EntryType) => {
      setShowCategoryPicker(false);
      if (nextEntryType === entryType) return;
      confirmExit(() => {
        if (onSwitchEntryType) {
          onSwitchEntryType(nextEntryType);
          return;
        }
        onCancel();
      });
    },
    [confirmExit, entryType, onCancel, onSwitchEntryType]
  );

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

  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const journalQuoteFontSize = Math.max(16, typography.bodyFontSize - 1);
  const journalQuoteLineHeight = Math.round(journalQuoteFontSize * 1.35);
  const journalHeroWidth = screenWidth;
  const journalHeroHeight = journalHeroWidth / 3;
  const gratitudeQuoteText =
    dailyGratitudeQuoteData?.quote || (entryType === "gratitude" ? journalIntroQuote : "");
  const gratitudeReferenceText = dailyGratitudeQuoteData?.quote
    ? dailyGratitudeQuoteData.author
    : entryType === "gratitude"
      ? journalIntroReference
      : "";

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
      style={[styles.container, { backgroundColor: colors.surface }]}
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
            <TouchableOpacity
              onPress={() => setShowCategoryPicker(true)}
              activeOpacity={0.7}
              style={styles.headerAdd}
            >
              <Ionicons name="add" size={24} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {entryType !== "journal" &&
        entryType !== "gratitude" &&
        entryType !== "spot_check" &&
        entryType !== "nightly_review" ? (
          <View style={[styles.dateBar, { backgroundColor: colors.surface }]}>
            <Text style={[styles.dateText, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 6 }]}>
              {isEditing ? "Editing Entry" : dateStr}
            </Text>
          </View>
        ) : null}

        {/* Editor Content */}
        <KeyboardAwareScrollView
          style={[styles.editorScroll, { backgroundColor: colors.surface }]}
          bottomOffset={96}
          extraKeyboardSpace={24}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {editorType === "text" && (
            <View style={styles.textEditorContainer}>
              {entryType === "journal" ? (
                <View style={styles.journalContainer}>
                  <Image
                    source={require("../../assets/journal.jpg")}
                    style={[
                      styles.journalHeroImage,
                      { width: journalHeroWidth, height: journalHeroHeight },
                    ]}
                    resizeMode="contain"
                  />
                  <View
                    style={[
                      styles.journalDatePill,
                      { backgroundColor: "rgba(255, 255, 255, 0.90)" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.journalDatePillText,
                        {
                          color: colors.onSurface,
                        },
                      ]}
                    >
                      {isEditing ? "Editing Entry" : dateStr}
                    </Text>
                  </View>
                  <SanctuaryCard
                    tone="lowest"
                    style={styles.journalQuoteCard}
                    contentStyle={[
                      styles.journalQuoteCardInner,
                      { backgroundColor: colors.primary },
                    ]}
                    elevated
                  >
                    {categoryConfig?.introText && (
                      <View style={styles.quoteCardContent}>
                        <View pointerEvents="none" style={styles.quotePatternLayer}>
                          <Text numberOfLines={1} style={styles.quotePatternSmall}>
                            quote   quote   quote
                          </Text>
                          <Text style={styles.quotePatternLargeA}>quote</Text>
                          <Text style={styles.quotePatternLargeB}>quote</Text>
                          <Text style={styles.quotePatternMedium}>quote</Text>
                        </View>
                        <View style={styles.journalQuoteWrap}>
                          <Text
                            style={[
                              styles.journalQuoteText,
                              {
                                color: colors.onPrimary,
                                fontSize: journalQuoteFontSize,
                                lineHeight: journalQuoteLineHeight,
                              },
                            ]}
                          >
                            {journalIntroQuote}
                          </Text>
                          {!!journalIntroReference && (
                            <Text
                              style={[
                                styles.journalQuoteReference,
                                {
                                  fontSize: 14,
                                  color: colors.secondaryContainer,
                                },
                              ]}
                            >
                              {journalIntroReference}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                  </SanctuaryCard>
                  <SanctuaryCard
                    tone="lowest"
                    style={styles.journalEntryFieldCard}
                    contentStyle={[
                      styles.journalEntryFieldCardInner,
                      { backgroundColor: colors.surfaceContainerLowest },
                    ]}
                    elevated
                  >
                    <TextInput
                      style={[
                        styles.textInput,
                        styles.journalTextInput,
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
                    <View
                      style={[
                        styles.journalEntryFooter,
                        { borderTopColor: colors.ghostBorder },
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleCancel}
                        style={styles.journalFooterCancel}
                      >
                        <Text
                          style={[
                            styles.journalFooterCancelText,
                            { color: colors.onSurfaceVariant },
                          ]}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSave}
                        disabled={saving || !hasContent}
                        style={[
                          styles.journalFooterSave,
                          { backgroundColor: colors.primaryContainer },
                          (saving || !hasContent) && styles.journalFooterSaveDisabled,
                        ]}
                      >
                        <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                        <Text style={[styles.journalFooterSaveText, { color: colors.onPrimary }]}>
                          {saving ? "Saving..." : "Save"}
                        </Text>
                      </TouchableOpacity>
                    </View>
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
              <Image
                source={require("../../assets/gratitude.jpg")}
                style={[
                  styles.gratitudeHeroImage,
                  { width: journalHeroWidth, height: journalHeroHeight },
                ]}
                resizeMode="contain"
              />
              <View
                style={[
                  styles.gratitudeDatePill,
                  { backgroundColor: "rgba(255, 255, 255, 0.90)" },
                ]}
              >
                <Text
                  style={[
                    styles.gratitudeDatePillText,
                    { color: colors.onSurface },
                  ]}
                >
                  {isEditing ? "Editing Entry" : dateStr}
                </Text>
              </View>

              <SanctuaryCard
                tone="lowest"
                style={styles.gratitudeQuoteCard}
                contentStyle={[
                  styles.gratitudeQuoteCardInner,
                  { backgroundColor: colors.primary },
                ]}
                elevated
              >
                {!!gratitudeQuoteText && (
                  <View style={styles.quoteCardContent}>
                    <View pointerEvents="none" style={styles.quotePatternLayer}>
                      <Text numberOfLines={1} style={styles.quotePatternSmall}>
                        quote   quote   quote
                      </Text>
                      <Text style={styles.quotePatternLargeA}>quote</Text>
                      <Text style={styles.quotePatternLargeB}>quote</Text>
                      <Text style={styles.quotePatternMedium}>quote</Text>
                    </View>
                    <View style={styles.gratitudeQuoteWrap}>
                      <Text
                        style={[
                          styles.gratitudeDailyQuote,
                          {
                            color: colors.onPrimary,
                            fontSize: journalQuoteFontSize,
                            lineHeight: journalQuoteLineHeight,
                          },
                        ]}
                      >
                        {gratitudeQuoteText}
                      </Text>
                      {!!gratitudeReferenceText && (
                        <Text
                          style={[
                            styles.gratitudeDailyReference,
                            { color: colors.secondaryContainer },
                          ]}
                        >
                          {gratitudeReferenceText}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </SanctuaryCard>

              <SanctuaryCard
                tone="lowest"
                style={styles.gratitudeEntryCard}
                contentStyle={[
                  styles.gratitudeEntryCardInner,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
                elevated
              >
                {gratitudeItems.map((item, index) => (
                  <View
                    key={index}
                    style={[
                      styles.gratitudeItemRow,
                      index === gratitudeItems.length - 1 ? styles.gratitudeItemRowLast : null,
                      { borderBottomColor: colors.ghostBorder },
                    ]}
                  >
                    <View style={styles.gratitudeIconWrapper}>
                      <Seedling size={18} color={categoryColor} />
                    </View>
                    <View style={styles.gratitudeInputShell}>
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
                    </View>
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

              <View style={styles.gratitudeActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleCancel}
                  style={styles.journalFooterCancel}
                >
                  <Text
                    style={[
                      styles.journalFooterCancelText,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSave}
                  disabled={saving || !hasContent}
                  style={[
                    styles.journalFooterSave,
                    { backgroundColor: colors.primaryContainer },
                    (saving || !hasContent) && styles.journalFooterSaveDisabled,
                  ]}
                >
                  <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                  <Text style={[styles.journalFooterSaveText, { color: colors.onPrimary }]}>
                    {saving ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {editorType === "guided" &&
            categoryConfig?.guidedPrompts &&
            (entryType === "spot_check" || entryType === "nightly_review" ? (
              <View style={styles.spotCheckContainer}>
                <Image
                  source={
                    entryType === "spot_check"
                      ? require("../../assets/spot_check.jpg")
                      : require("../../assets/nightly_review.jpg")
                  }
                  style={[
                    styles.spotCheckHeroImage,
                    { width: journalHeroWidth, height: journalHeroHeight },
                  ]}
                  resizeMode="contain"
                />
                <View
                  style={[
                    styles.spotCheckDatePill,
                    { backgroundColor: "rgba(255, 255, 255, 0.90)" },
                  ]}
                >
                  <Text
                    style={[
                      styles.spotCheckDatePillText,
                      { color: colors.onSurface },
                    ]}
                  >
                    {isEditing ? "Editing Entry" : dateStr}
                  </Text>
                </View>

                <SanctuaryCard
                  tone="lowest"
                  style={styles.spotCheckQuoteCard}
                  contentStyle={[
                    styles.spotCheckQuoteCardInner,
                    { backgroundColor: colors.primary },
                  ]}
                  elevated
                >
                  {categoryConfig?.introText && (
                    <View style={styles.quoteCardContent}>
                      <View pointerEvents="none" style={styles.quotePatternLayer}>
                        <Text numberOfLines={1} style={styles.quotePatternSmall}>
                          quote   quote   quote
                        </Text>
                        <Text style={styles.quotePatternLargeA}>quote</Text>
                        <Text style={styles.quotePatternLargeB}>quote</Text>
                        <Text style={styles.quotePatternMedium}>quote</Text>
                      </View>
                      <View style={styles.journalQuoteWrap}>
                        <Text
                          style={[
                            styles.journalQuoteText,
                            {
                              color: colors.onPrimary,
                              fontSize: journalQuoteFontSize,
                              lineHeight: journalQuoteLineHeight,
                            },
                          ]}
                        >
                          {journalIntroQuote}
                        </Text>
                        {!!journalIntroReference && (
                          <Text
                            style={[
                              styles.journalQuoteReference,
                              {
                                fontSize: 14,
                                color: colors.secondaryContainer,
                              },
                            ]}
                          >
                            {journalIntroReference}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                </SanctuaryCard>

                <SanctuaryCard
                  tone="lowest"
                  style={styles.spotCheckEntryCard}
                  contentStyle={[
                    styles.spotCheckEntryCardInner,
                    { backgroundColor: colors.surfaceContainerLowest },
                  ]}
                  elevated
                >
                  {categoryConfig.guidedPrompts.map((prompt, index) => {
                    const isFocused = focusedPromptId === prompt.id;

                    return (
                      <View
                        key={prompt.id}
                        style={[
                          styles.spotCheckPromptBlock,
                          index === categoryConfig.guidedPrompts!.length - 1
                            ? styles.spotCheckPromptBlockLast
                            : null,
                          { borderBottomColor: colors.ghostBorder },
                        ]}
                      >
                        <Text
                          style={[
                            styles.spotCheckPromptQuestion,
                            {
                              color: colors.text,
                              fontSize: typography.bodyFontSize - 2,
                              lineHeight: (typography.bodyFontSize - 2) * 1.35,
                            },
                          ]}
                        >
                          {prompt.question}
                        </Text>

                        <FieldShell focused={isFocused} style={styles.spotCheckFieldShell}>
                          <TextInput
                            style={[
                              styles.spotCheckPromptInput,
                              {
                                color: colors.text,
                                fontSize: typography.bodyFontSize,
                                lineHeight: typography.bodyLineHeight,
                              },
                            ]}
                            value={guidedResponses[prompt.id] ?? ""}
                            onChangeText={(text) =>
                              handleGuidedResponseChange(prompt.id, text)
                            }
                            placeholder={prompt.placeholder}
                            placeholderTextColor={colors.textSecondary + "60"}
                            multiline
                            textAlignVertical="top"
                            autoCorrect
                            autoCapitalize="sentences"
                            scrollEnabled={false}
                            selectionColor={colors.secondary}
                            onFocus={() => setFocusedPromptId(prompt.id)}
                            onBlur={() => setFocusedPromptId(null)}
                          />
                        </FieldShell>

                        {prompt.hint ? (
                          <Text
                            style={[
                              styles.spotCheckPromptHint,
                              {
                                color: colors.textSecondary,
                                fontSize: typography.bodyFontSize - 8,
                              },
                            ]}
                          >
                            {prompt.hint}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </SanctuaryCard>

                <View style={styles.gratitudeActionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleCancel}
                    style={styles.journalFooterCancel}
                  >
                    <Text
                      style={[
                        styles.journalFooterCancelText,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleSave}
                    disabled={saving || !hasContent}
                    style={[
                      styles.journalFooterSave,
                      { backgroundColor: colors.primaryContainer },
                      (saving || !hasContent) && styles.journalFooterSaveDisabled,
                    ]}
                  >
                    <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                    <Text style={[styles.journalFooterSaveText, { color: colors.onPrimary }]}>
                      {saving ? "Saving..." : "Save"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.guidedContainer}>
                <GuidedPromptEditor
                  prompts={categoryConfig.guidedPrompts}
                  responses={guidedResponses}
                  onResponseChange={handleGuidedResponseChange}
                  color={categoryColor}
                  introText={categoryConfig.introText ?? ""}
                />
              </View>
            ))}

          {/* Spacer for keyboard */}
          <View style={{ height: 100 }} />
        </KeyboardAwareScrollView>

        {/* Bottom Bar */}
        {entryType !== "journal" &&
        entryType !== "gratitude" &&
        entryType !== "spot_check" &&
        entryType !== "nightly_review" ? (
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
        ) : null}
      </KeyboardAvoidingView>
      <JournalCategoryPicker
        visible={showCategoryPicker}
        onSelect={handleSwitchEntryType}
        onClose={() => setShowCategoryPicker(false)}
      />
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
  headerAdd: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
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
    width: "100%",
    aspectRatio: 3,
  },
  journalDatePill: {
    alignSelf: "flex-start",
    marginLeft: 20,
    marginTop: -22,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    shadowColor: "#191C1C",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  journalDatePillText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  journalQuoteCard: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 0,
    borderRadius: 12,
  },
  journalQuoteCardInner: {
    borderRadius: 12,
    overflow: "hidden",
  },
  quoteCardContent: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
  },
  journalQuoteWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    position: "relative",
  },
  journalQuoteText: {
    fontFamily: fonts.bodyFamilyMedium,
    textAlign: "left",
    fontWeight: "500",
    paddingHorizontal: 14,
    position: "relative",
    zIndex: 2,
  },
  journalQuoteReference: {
    fontFamily: fonts.bodyFamilyRegular,
    textAlign: "left",
    letterSpacing: 0.2,
    alignSelf: "stretch",
    marginLeft: 14,
    marginRight: 0,
    marginTop: 10,
    position: "relative",
    zIndex: 2,
  },
  quotePatternLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 0,
  },
  quotePatternSmall: {
    position: "absolute",
    left: -36,
    right: -36,
    top: 10,
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 1.4,
    color: "rgba(255, 255, 255, 0.10)",
    zIndex: 0,
  },
  quotePatternLargeA: {
    position: "absolute",
    right: -34,
    top: -10,
    fontFamily: fonts.bodyFamilyBold,
    fontSize: 148,
    lineHeight: 148,
    color: "rgba(255, 255, 255, 0.07)",
    transform: [{ rotate: "-8deg" }],
    zIndex: 0,
  },
  quotePatternLargeB: {
    position: "absolute",
    left: -12,
    bottom: -40,
    fontFamily: fonts.bodyFamilyBold,
    fontSize: 164,
    lineHeight: 164,
    color: "rgba(255, 255, 255, 0.05)",
    transform: [{ rotate: "10deg" }],
    zIndex: 0,
  },
  quotePatternMedium: {
    position: "absolute",
    left: 110,
    bottom: 8,
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 72,
    lineHeight: 72,
    color: "rgba(255, 255, 255, 0.06)",
    transform: [{ rotate: "-90deg" }],
    zIndex: 0,
  },
  journalEntryFieldCard: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 12,
  },
  journalEntryFieldCardInner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderRadius: 12,
  },
  journalEntryFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  journalFooterCancel: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  journalFooterCancelText: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  journalFooterSave: {
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  journalFooterSaveDisabled: {
    opacity: 0.55,
  },
  journalFooterSaveText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 14,
    lineHeight: 18,
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
  journalTextInput: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },

  // ─── Gratitude ────────────────────────────────────────
  gratitudeContainer: {
    paddingTop: 0,
  },
  gratitudeHeroImage: {
    width: "100%",
    aspectRatio: 3,
  },
  gratitudeDatePill: {
    alignSelf: "flex-start",
    marginLeft: 20,
    marginTop: -22,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    shadowColor: "#191C1C",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  gratitudeDatePillText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  gratitudeQuoteCard: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 0,
    borderRadius: 12,
  },
  gratitudeQuoteCardInner: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    borderRadius: 12,
    overflow: "hidden",
  },
  gratitudeDailyQuote: {
    fontFamily: fonts.bodyFamilyMedium,
    textAlign: "left",
    fontWeight: "500",
    paddingHorizontal: 14,
    position: "relative",
    zIndex: 1,
  },
  gratitudeQuoteWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    position: "relative",
  },
  gratitudeDailyReference: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.2,
    textAlign: "left",
    marginTop: 10,
    marginLeft: 14,
    position: "relative",
    zIndex: 1,
  },
  gratitudeEntryCard: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 12,
  },
  gratitudeEntryCardInner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderRadius: 12,
  },
  introText: {
    fontFamily: fonts.headerFamily,
    fontSize: 18,
    lineHeight: 18 * 1.5,
    marginBottom: 20,
    textAlign: "center",
  },
  gratitudeItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  gratitudeItemRowLast: {
    borderBottomWidth: 0,
  },
  gratitudeIconWrapper: {
    marginTop: 2,
  },
  gratitudeInputShell: {
    flex: 1,
  },
  gratitudeInput: {
    flex: 1,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 28,
  },
  removeItemButton: {
    marginTop: 2,
    padding: 2,
  },
  addItemButton: {
    marginTop: 4,
    marginBottom: 12,
    alignSelf: "flex-start",
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
  gratitudeActionsRow: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  spotCheckContainer: {
    paddingTop: 0,
  },
  spotCheckHeroImage: {
    width: "100%",
    aspectRatio: 3,
  },
  spotCheckDatePill: {
    alignSelf: "flex-start",
    marginLeft: 20,
    marginTop: -22,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    shadowColor: "#191C1C",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  spotCheckDatePillText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  spotCheckQuoteCard: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 0,
    borderRadius: 12,
  },
  spotCheckQuoteCardInner: {
    borderRadius: 12,
    overflow: "hidden",
  },
  spotCheckEntryCard: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 12,
  },
  spotCheckEntryCardInner: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 12,
  },
  spotCheckPromptBlock: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  spotCheckPromptBlockLast: {
    borderBottomWidth: 0,
  },
  spotCheckPromptQuestion: {
    fontFamily: fonts.bodyFamilySemiBold,
    marginBottom: 10,
  },
  spotCheckFieldShell: {
    marginTop: 0,
  },
  spotCheckPromptInput: {
    minHeight: 80,
    fontFamily: fonts.bodyFamilyRegular,
    paddingVertical: 0,
  },
  spotCheckPromptHint: {
    fontFamily: fonts.bodyFamilyRegular,
    fontStyle: "italic",
    marginTop: 8,
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
