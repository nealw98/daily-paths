import React, { useState, useMemo } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { fonts } from "../../constants/theme";
import type { GuidedPrompt } from "../../constants/journalCategories";

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
      {/* Intro text */}
      <View style={[styles.introWrapper, { borderBottomColor: colors.border }]}>
        <Text
          style={[
            styles.introText,
            {
              fontFamily: fonts.headerFamilyItalic,
              color: colors.accent,
              fontSize: typography.bodyFontSize,
              lineHeight: typography.bodyFontSize * 1.5,
            },
          ]}
        >
          {introText}
        </Text>
      </View>

      {/* Prompt cards */}
      {prompts.map((prompt, index) => {
        const isFocused = focusedId === prompt.id;

        return (
          <View
            key={prompt.id}
            style={styles.card}
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

            {/* TextInput */}
            <TextInput
              style={[
                styles.textInput,
                {
                  fontFamily: fonts.bodyFamilyRegular,
                  color: colors.text,
                  fontSize: typography.bodyFontSize - 2,
                  lineHeight: (typography.bodyFontSize - 2) * 1.65,
                  backgroundColor: isFocused
                    ? "#FFFFFF"
                    : colors.background,
                  borderColor: isFocused
                    ? colors.highlight
                    : "rgba(0,0,0,0.06)",
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
          </View>
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
    borderBottomWidth: 1,
    paddingBottom: 14,
    marginBottom: 20,
  },
  introText: {
    fontSize: 18,
    lineHeight: 18 * 1.5,
    textAlign: "center",
  },
  card: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 14 * 1.35,
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 70,
    fontSize: 14.5,
    lineHeight: 14.5 * 1.65,
  },
  hintText: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 6,
  },
});
