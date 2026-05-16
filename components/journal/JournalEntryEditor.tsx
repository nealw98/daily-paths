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
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useNavigation, useRouter } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { fonts, typography as staticTypography } from "../../constants/theme";
import { useDailyGratitudeQuote } from "../../hooks/useDailyGratitudeQuote";
import { useDailyJournalQuote } from "../../hooks/useDailyJournalQuote";
import {
  getCategoryById,
  getCategoryLabel,
  getCategoryColor,
  type EntryType,
} from "../../constants/journalCategories";
import { useSettings } from "../../hooks/useSettings";
import { GuidedPromptEditor } from "./GuidedPromptEditor";
import { JournalCategoryPicker } from "./JournalCategoryPicker";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { Seedling } from "../../components/icons";
import { FieldShell, SanctuaryButton, SanctuaryCard } from "../ui/Sanctuary";
import { TealHeader } from "../shared/TealHeader";
import { PageTitle } from "../ui/PageTitle";
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
  /** When true, footer Save navigates to the Notebook tab after a successful save. */
  navigateToNotebookAfterSave?: boolean;
}

export const JournalEntryEditor: React.FC<JournalEntryEditorProps> = ({
  entryType,
  onSave,
  onCancel,
  initialContent = "",
  initialStructuredContent = null,
  isEditing = false,
  onSwitchEntryType,
  navigateToNotebookAfterSave = false,
}) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const { settings } = useSettings();
  const { typography } = useTypography();
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
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const { today } = useAppDate();
  const { quote: dailyGratitudeQuoteData } = useDailyGratitudeQuote({
    enabled: entryType === "gratitude",
  });
  const { quote: dailyJournalQuoteData } = useDailyJournalQuote({
    enabled: entryType === "journal",
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
    const ok = await saveEntry();
    if (ok && navigateToNotebookAfterSave) {
      router.push("/(tabs)/journal");
    }
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

  const journalQuoteFontSize = typography.quoteBox.fontSize;
  const journalQuoteLineHeight = typography.quoteBox.lineHeight;
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
      edges={[]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <TealHeader onBack={handleCancel} />

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
                  <PageTitle title="Journal" subtitle={isEditing ? "Editing entry" : dateStr} size="lg" />
                  <SanctuaryCard
                    tone="lowest"
                    style={styles.journalQuoteCard}
                    contentStyle={[
                      styles.journalQuoteCardInner,
                      { backgroundColor: colors.surfaceContainerLowest },
                    ]}
                    elevated
                  >
                    {categoryConfig?.introText && (
                      <View style={styles.quoteCardContent}>
                        <View style={[styles.quoteAccent, { backgroundColor: colors.deepTeal }]} />
                        <View style={styles.journalQuoteWrap}>
                          <Text
                            style={[
                              styles.journalQuoteText,
                              { color: colors.text },
                            ]}
                          >
                            {entryType === "journal" && dailyJournalQuoteData
                              ? dailyJournalQuoteData.quote
                              : journalIntroQuote}
                          </Text>
                          {!!(entryType === "journal"
                            ? dailyJournalQuoteData?.author
                            : journalIntroReference) && (
                            <Text
                              style={[
                                styles.journalQuoteReference,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {entryType === "journal"
                                ? dailyJournalQuoteData?.author
                                : journalIntroReference}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                  </SanctuaryCard>
                  <SanctuaryCard
                    tone="lowest"
                    style={styles.journalEntryFieldCard}
                    contentStyle={styles.journalEntryFieldCardInner}
                    elevated
                  >
                    <TextInput
                      style={[
                        styles.textInput,
                        styles.journalTextInput,
                        {
                          color: colors.text,
                          fontSize: 16,
                          lineHeight: 21,
                        },
                      ]}
                      placeholder="What's on your mind..."
                      placeholderTextColor={colors.textSecondary + "99"}
                      value={content}
                      onChangeText={setContent}
                      multiline
                      textAlignVertical="top"
                      autoCorrect
                      autoCapitalize="sentences"
                      scrollEnabled={false}
                      selectionColor={colors.secondary}
                    />
                  </SanctuaryCard>
                  <View style={styles.gratitudeActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleCancel}
                      style={[styles.journalFooterCancel, { borderColor: colors.onSurfaceVariant }]}
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
                      <Text
                        style={[styles.journalFooterSaveText, { color: colors.onPrimary }]}
                      >
                        {saving ? "Saving..." : "Save to Notebook"}
                      </Text>
                    </TouchableOpacity>
                  </View>
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
                      placeholderTextColor={colors.textSecondary + "99"}
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
              <PageTitle title="Gratitude" subtitle={isEditing ? "Editing entry" : dateStr} size="lg" />

              <SanctuaryCard
                tone="lowest"
                style={styles.gratitudeQuoteCard}
                contentStyle={[
                  styles.gratitudeQuoteCardInner,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
                elevated
              >
                {!!gratitudeQuoteText && (
                  <View style={styles.quoteCardContent}>
                    <View style={[styles.quoteAccent, { backgroundColor: colors.deepTeal }]} />
                    <View style={styles.gratitudeQuoteWrap}>
                      <Text
                        style={[
                          styles.gratitudeDailyQuote,
                          { color: colors.text },
                        ]}
                      >
                        {gratitudeQuoteText}
                      </Text>
                      {!!gratitudeReferenceText && (
                        <Text
                          style={[
                            styles.gratitudeDailyReference,
                            { color: colors.textSecondary },
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
                <Text
                  style={[
                    styles.gratitudePromptHeader,
                    {
                      color: colors.onSurface,
                      fontSize: Math.round((typography.bodySmall.fontSize + 4) * (23 / 19)),
                      lineHeight: Math.round((typography.bodySmall.fontSize + 4) * (23 / 19) * (22 / 17)),
                    },
                  ]}
                >
                  Today I'm grateful for...
                </Text>
                {gratitudeItems.map((item, index) => (
                  <View
                    key={index}
                    style={[
                      styles.gratitudeItemRow,
                      index === gratitudeItems.length - 1 ? styles.gratitudeItemRowLast : null,
                      { borderBottomColor: colors.ghostBorder },
                    ]}
                  >
                    <View style={styles.gratitudeInputShell}>
                      <TextInput
                        style={[
                          styles.gratitudeInput,
                          { color: colors.text, fontSize: 16, lineHeight: 21 },
                        ]}
                        placeholder={index === 0 ? "Something small is fine" : ""}
                        placeholderTextColor={colors.textSecondary + "99"}
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

                <TouchableOpacity
                  onPress={handleAddGratitudeSlot}
                  style={styles.addItemLink}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="add" size={18} color={colors.secondary} />
                  <Text style={[styles.addItemLinkText, { color: colors.secondary }]}>
                    Add another
                  </Text>
                </TouchableOpacity>
              </SanctuaryCard>

              <View style={styles.gratitudeActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleCancel}
                  style={[styles.journalFooterCancel, { borderColor: colors.onSurfaceVariant }]}
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
                  <Text
                    style={[styles.journalFooterSaveText, { color: colors.onPrimary }]}
                  >
                    {saving ? "Saving..." : "Save to Notebook"}
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
                <PageTitle
                  title={entryType === "spot_check" ? "Spot check" : "Nightly review"}
                  subtitle={isEditing ? "Editing entry" : dateStr}
                  size="lg"
                />

                {categoryConfig?.introText && (
                  <View style={styles.spotCheckQuoteSubtitle}>
                    <Text style={[styles.spotCheckQuoteText, { color: colors.accent }]}>
                      {journalIntroQuote}
                    </Text>
                    {!!journalIntroReference && (
                      <Text
                        style={[styles.spotCheckQuoteReference, { color: colors.accent }]}
                      >
                        {journalIntroReference}
                      </Text>
                    )}
                  </View>
                )}

                {categoryConfig.guidedPrompts.map((prompt) => (
                  <SanctuaryCard
                    key={prompt.id}
                    tone="lowest"
                    style={styles.spotCheckEntryCard}
                    contentStyle={[
                      styles.spotCheckEntryCardInner,
                      { backgroundColor: colors.surfaceContainerLowest },
                    ]}
                    elevated
                  >
                    <View style={styles.spotCheckPromptBlock}>
                      <Text
                        style={[
                          styles.spotCheckPromptQuestion,
                          {
                            color: colors.onSurface,
                            fontFamily:
                              entryType === "spot_check"
                                ? fonts.cormorantGaramondMedium
                                : fonts.cormorantGaramondSemiBold,
                            fontSize: Math.round((typography.bodySmall.fontSize + 4) * (23 / 19)),
                            lineHeight: Math.round((typography.bodySmall.fontSize + 4) * (23 / 19) * (22 / 17)),
                          },
                        ]}
                      >
                        {prompt.question}
                      </Text>

                      <TextInput
                        style={[
                          styles.spotCheckPromptInput,
                          {
                            color: colors.onSurfaceVariant,
                            fontSize: typography.bodySmall.fontSize + 1,
                            lineHeight: typography.bodySmall.lineHeight + 1,
                            backgroundColor: "#dfe8e4",
                          },
                        ]}
                        value={guidedResponses[prompt.id] ?? ""}
                        onChangeText={(text) =>
                          handleGuidedResponseChange(prompt.id, text)
                        }
                        placeholder={
                          prompt.hint
                            ? `${prompt.placeholder} ${prompt.hint}`
                            : prompt.placeholder
                        }
                        placeholderTextColor={colors.textSecondary + "99"}
                        multiline
                        textAlignVertical="top"
                        autoCorrect
                        autoCapitalize="sentences"
                        scrollEnabled={false}
                        selectionColor={colors.secondary}
                      />
                    </View>
                  </SanctuaryCard>
                ))}

                <View style={styles.gratitudeActionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleCancel}
                    style={[styles.journalFooterCancel, { borderColor: colors.onSurfaceVariant }]}
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
                    <Text
                      style={[styles.journalFooterSaveText, { color: colors.onPrimary }]}
                    >
                      {saving ? "Saving..." : "Save to Notebook"}
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
    fontSize: 10,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  headerTitleText: {
    ...staticTypography.h3,
    fontFamily: fonts.bodyFamilySemiBold,
  },
  dateBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  dateText: {
    ...staticTypography.caption,
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
  journalDateText: {
    ...staticTypography.caption,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginLeft: 20,
    marginTop: 14,
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
  quoteAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  journalQuoteWrap: {
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    position: "relative",
  },
  journalQuoteText: {
    fontFamily: fonts.cormorantGaramondMediumItalic,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
    textAlign: "center",
    position: "relative",
    zIndex: 2,
  },
  journalQuoteReference: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    letterSpacing: 0.2,
    alignSelf: "stretch",
    marginTop: 8,
    position: "relative",
    zIndex: 2,
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
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  journalFooterCancelText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 14,
    lineHeight: 18,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  },
  journalFooterSave: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: Platform.OS === "android" ? 12 : 16,
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
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
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
    ...staticTypography.body,
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
  gratitudeQuoteCard: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 0,
    borderRadius: 12,
  },
  gratitudeQuoteCardInner: {
    borderRadius: 12,
    overflow: "hidden",
  },
  gratitudeDailyQuote: {
    fontFamily: fonts.cormorantGaramondMediumItalic,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
    textAlign: "center",
    position: "relative",
    zIndex: 2,
  },
  gratitudeQuoteWrap: {
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    position: "relative",
  },
  gratitudeDailyReference: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    letterSpacing: 0.2,
    marginTop: 8,
    position: "relative",
    zIndex: 2,
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
    ...staticTypography.h3,
    marginBottom: 20,
    textAlign: "center",
  },
  gratitudeItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  gratitudeItemRowLast: {
    borderBottomWidth: 0,
  },
  gratitudeIconWrapper: {
    marginTop: 2,
  },
  gratitudeInputShell: {
    flex: 1,
    backgroundColor: "#dfe8e4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  gratitudeInput: {
    flex: 1,
    ...staticTypography.body,
    minHeight: 28,
  },
  removeItemButton: {
    marginTop: 2,
    padding: 2,
  },
  addItemLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  addItemLinkText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 15,
  },
  addItemText: {
    ...staticTypography.label,
    fontWeight: "500",
  },
  gratitudeHint: {
    ...staticTypography.caption,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4,
  },
  gratitudePromptHeader: {
    fontFamily: fonts.cormorantGaramondSemiBold,
    letterSpacing: -0.2,
    marginTop: 6,
    marginBottom: 16,
  },
  gratitudeActionsRow: {
    paddingHorizontal: 18,
    marginTop: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  spotCheckContainer: {
    paddingTop: 0,
  },
  spotCheckHeroImage: {
    width: "100%",
    aspectRatio: 3,
  },
  spotCheckQuoteSubtitle: {
    paddingHorizontal: 24,
    marginTop: 10,
    marginBottom: 16,
  },
  spotCheckQuoteText: {
    fontFamily: fonts.cormorantGaramondMediumItalic,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  spotCheckQuoteReference: {
    fontFamily: fonts.cormorantGaramondMediumItalic,
    fontSize: 20,
    lineHeight: 28,
    marginTop: 4,
    opacity: 0.85,
    textAlign: "center",
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
    paddingVertical: 20,
  },
  spotCheckPromptBlockLast: {
    paddingBottom: 16,
  },
  spotCheckPromptQuestion: {
    ...staticTypography.bodySmall,
    fontFamily: fonts.cormorantGaramondSemiBold,
    letterSpacing: -0.2,
    marginTop: 6,
    marginBottom: 24,
  },
  spotCheckPromptInput: {
    minHeight: 120,
    ...staticTypography.body,
    fontFamily: fonts.bodyFamilyMedium,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderRadius: 10,
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
