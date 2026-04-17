import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { fonts } from "../../constants/theme";
import type { GuidedPrompt } from "../../constants/journalCategories";

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
  const questionFontSize = Math.round(typography.bodyLargeFontSize * (22 / 19));
  const questionLineHeight = Math.round(questionFontSize * (28 / 22));
  const inputFontSize = Math.round(typography.bodyLargeFontSize * (16 / 19));
  const inputLineHeight = Math.round(inputFontSize * (21 / 16));

  return (
    <View style={styles.container}>
      {prompts.map((prompt) => (
        <View key={prompt.id} style={styles.block}>
          <Text
            style={[
              styles.questionText,
              {
                fontSize: questionFontSize,
                lineHeight: questionLineHeight,
                color: colors.primary,
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
                color: colors.text,
                backgroundColor: colors.surfaceContainerLow,
              },
            ]}
            value={responses[prompt.id] ?? ""}
            onChangeText={(text) => onResponseChange(prompt.id, text)}
            placeholder={
              prompt.hint
                ? `${prompt.placeholder} ${prompt.hint}`
                : prompt.placeholder
            }
            placeholderTextColor={colors.textSecondary + "50"}
            multiline
            textAlignVertical="top"
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  block: {
    paddingVertical: 20,
  },
  questionText: {
    // fontSize/lineHeight applied inline (questionFontSize / questionLineHeight).
    fontFamily: fonts.cormorantGaramondSemiBold,
    marginBottom: 10,
  },
  textInput: {
    // fontSize/lineHeight applied inline (inputFontSize / inputLineHeight).
    minHeight: 120,
    fontFamily: fonts.bodyFamily,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderRadius: 10,
  },
});
