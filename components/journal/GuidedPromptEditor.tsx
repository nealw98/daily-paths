import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { fonts } from "../../constants/theme";
import type { GuidedPrompt } from "../../constants/journalCategories";
import { SanctuaryCard } from "../ui/Sanctuary";

interface GuidedPromptEditorProps {
  prompts: GuidedPrompt[];
  responses: Record<string, string>;
  onResponseChange: (promptId: string, text: string) => void;
  color: string;
  introText: string;
}

/**
 * Guided prompt editor used when editing an existing Spot Check / Nightly
 * Review entry. Mirrors the in-editor treatment in JournalEntryEditor.tsx:
 * Cormorant SemiBold question, mint-filled input, hint merged into the
 * placeholder.
 */
export function GuidedPromptEditor({
  prompts,
  responses,
  onResponseChange,
}: GuidedPromptEditorProps) {
  const { colors } = useTheme();
  const { typography } = useTypography();

  // Dynamic sizes — scale from bodyLargeFontSize so the medium tier matches
  // the old fixed values (22/28 question, 16/21 input).
  // Cormorant reads ~30% visually smaller than Manrope/Lora at the same
  // point size, so bump the computed size to match the same visual weight.
  const questionFontSize = Math.round((typography.bodySmall.fontSize + 4) * (23 / 19));
  const questionLineHeight = Math.round(questionFontSize * (22 / 17));
  const inputFontSize = typography.bodySmall.fontSize + 1;
  const inputLineHeight = typography.bodySmall.lineHeight + 1;

  return (
    <View style={styles.container}>
      {prompts.map((prompt) => (
        <SanctuaryCard
          key={prompt.id}
          tone="lowest"
          style={styles.card}
          contentStyle={[
            styles.cardInner,
            { backgroundColor: colors.surfaceContainerLowest },
          ]}
          elevated
        >
          <View style={styles.block}>
            <Text
              style={[
                styles.questionText,
                {
                  fontSize: questionFontSize,
                  lineHeight: questionLineHeight,
                  color: colors.onSurface,
                },
              ]}
            >
              {prompt.question}
            </Text>

            <TextInput
              style={[
                styles.textInput,
                {
                  fontSize: inputFontSize,
                  lineHeight: inputLineHeight,
                  color: colors.onSurfaceVariant,
                  backgroundColor: "#dfe8e4",
                },
              ]}
              value={responses[prompt.id] ?? ""}
              onChangeText={(text) => onResponseChange(prompt.id, text)}
              placeholder={
                prompt.hint
                  ? `${prompt.placeholder} ${prompt.hint}`
                  : prompt.placeholder
              }
              placeholderTextColor={colors.textSecondary + "99"}
              multiline
              textAlignVertical="top"
            />
          </View>
        </SanctuaryCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  card: {
    marginTop: 16,
    borderRadius: 12,
  },
  cardInner: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 12,
  },
  block: {
    paddingVertical: 16,
  },
  questionText: {
    // fontSize/lineHeight applied inline (questionFontSize / questionLineHeight).
    fontFamily: fonts.cormorantGaramondSemiBold,
    letterSpacing: -0.2,
    marginTop: 6,
    marginBottom: 24,
  },
  textInput: {
    // fontSize/lineHeight applied inline (inputFontSize / inputLineHeight).
    minHeight: 120,
    fontFamily: fonts.bodyFamilyMedium,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderRadius: 10,
  },
});
