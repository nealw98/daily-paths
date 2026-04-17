import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { fonts, typography as staticTypography } from "../../constants/theme";
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

  return (
    <View style={styles.container}>
      {prompts.map((prompt) => (
        <View key={prompt.id} style={styles.block}>
          <Text
            style={[
              styles.questionText,
              { color: colors.primary },
            ]}
          >
            {prompt.question}
          </Text>

          <TextInput
            style={[
              styles.textInput,
              {
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
    fontFamily: fonts.cormorantGaramondSemiBold,
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 10,
  },
  textInput: {
    minHeight: 120,
    ...staticTypography.body,
    fontFamily: fonts.bodyFamily,
    fontSize: 16,
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderRadius: 10,
  },
});
