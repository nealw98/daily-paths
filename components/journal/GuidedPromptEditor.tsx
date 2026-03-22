import React, { useState, useMemo } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { fonts } from "../../constants/theme";
import type { GuidedPrompt } from "../../constants/journalCategories";
import { FieldShell, SanctuaryCard } from "../ui/Sanctuary";

interface GuidedPromptEditorProps {
  prompts: GuidedPrompt[];
  responses: Record<string, string>;
  onResponseChange: (promptId: string, text: string) => void;
  color: string;
  introText: string;
}

export function GuidedPromptEditor({
  prompts,
  responses,
  onResponseChange,
  color,
  introText,
}: GuidedPromptEditorProps) {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <SanctuaryCard tone="low" style={styles.introWrapper} contentStyle={styles.introCardContent}>
        <Text
          style={[
            styles.introText,
            {
              fontFamily: fonts.headerFamily,
              color: colors.primaryContainer,
              fontSize: typography.bodyFontSize,
              lineHeight: typography.bodyFontSize * 1.5,
            },
          ]}
        >
          {introText}
        </Text>
      </SanctuaryCard>

      {/* Prompt cards */}
      {prompts.map((prompt, index) => {
        const isFocused = focusedId === prompt.id;

        return (
          <SanctuaryCard
            key={prompt.id}
            tone="lowest"
            style={styles.card}
            contentStyle={styles.cardContent}
          >
            {/* Question label */}
            <Text
              style={[
                styles.questionText,
                { color: colors.text, fontSize: typography.bodyFontSize - 2, lineHeight: (typography.bodyFontSize - 2) * 1.35 },
              ]}
            >
              {prompt.question}
            </Text>

            <FieldShell focused={isFocused}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    fontFamily: fonts.bodyFamilyRegular,
                    color: colors.text,
                    fontSize: typography.bodyFontSize,
                    lineHeight: typography.bodyLineHeight,
                  },
                ]}
                value={responses[prompt.id] ?? ""}
                onChangeText={(text) => onResponseChange(prompt.id, text)}
                placeholder={prompt.placeholder}
                placeholderTextColor={colors.textSecondary + "60"}
                multiline
                textAlignVertical="top"
                onFocus={() => setFocusedId(prompt.id)}
                onBlur={() => setFocusedId(null)}
              />
            </FieldShell>

            {/* Hint text */}
            {prompt.hint ? (
              <Text
                style={[
                  styles.hintText,
                  { color: colors.textSecondary, fontSize: typography.bodyFontSize - 8 },
                ]}
              >
                {prompt.hint}
              </Text>
            ) : null}
          </SanctuaryCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // No scroll — parent handles scrolling
  },
  introWrapper: {
    marginBottom: 20,
  },
  introCardContent: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  introText: {
    fontSize: 18,
    lineHeight: 18 * 1.5,
    textAlign: "center",
  },
  card: {
    marginBottom: 20,
  },
  cardContent: {
    padding: 18,
  },
  questionText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 14 * 1.35,
    marginBottom: 10,
  },
  textInput: {
    minHeight: 70,
    fontSize: 18,
    lineHeight: 28,
  },
  hintText: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 6,
  },
});
