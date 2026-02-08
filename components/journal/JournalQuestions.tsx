import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { JOURNAL_QUESTION_CATEGORIES, type QuestionCategory } from "../../constants/journalQuestions";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";

interface JournalQuestionsProps {
  onSelectQuestion?: (question: string) => void;
  /** Optional override categories. If provided, these are shown instead of the defaults. */
  categories?: QuestionCategory[];
}

export const JournalQuestions: React.FC<JournalQuestionsProps> = ({
  onSelectQuestion,
  categories,
}) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const sourceCategories = categories || JOURNAL_QUESTION_CATEGORIES;
  const categoriesWithQuestions = sourceCategories.filter(
    (cat) => cat.questions.length > 0
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.toggleButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="help-circle-outline"
          size={20}
          color={colors.accent}
        />
        <Text style={[styles.toggleText, { color: colors.accent }]}>
          Questions to ask myself
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.categoriesContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          {categoriesWithQuestions.map((category) => (
            <View key={category.id}>
              <TouchableOpacity
                style={[styles.categoryHeader, { borderBottomColor: colors.border }]}
                onPress={() =>
                  setExpandedCategory(
                    expandedCategory === category.id ? null : category.id
                  )
                }
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  {category.title}
                </Text>
                <Ionicons
                  name={
                    expandedCategory === category.id
                      ? "chevron-up"
                      : "chevron-down"
                  }
                  size={16}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {expandedCategory === category.id && (
                <View style={styles.questionsContainer}>
                  {category.questions.map((question, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.questionRow, { borderBottomColor: colors.border }]}
                      onPress={() => onSelectQuestion?.(question)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.questionText, { color: colors.textSecondary }]}
                      >
                        {question}
                      </Text>
                      <Ionicons
                        name="add-circle-outline"
                        size={18}
                        color={colors.accent}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    flex: 1,
  },
  categoriesContainer: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  categoryTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "600",
  },
  questionsContainer: {
    paddingLeft: 8,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  questionText: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});
