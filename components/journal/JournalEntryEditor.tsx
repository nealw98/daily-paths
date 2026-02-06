import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import { JournalQuestions } from "./JournalQuestions";

interface JournalEntryEditorProps {
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
  initialContent?: string;
  isEditing?: boolean;
}

export const JournalEntryEditor: React.FC<JournalEntryEditorProps> = ({
  onSave,
  onCancel,
  initialContent = "",
  isEditing = false,
}) => {
  const { colors } = useTheme();
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Auto-focus the text input after a brief delay
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const hasContent = content.trim().length > 0;
  const hasChanges = content !== initialContent;

  const handleSave = async () => {
    if (!hasContent) {
      Alert.alert("Nothing to save", "Write something before saving.");
      return;
    }

    setSaving(true);
    try {
      await onSave(content);
    } catch (err) {
      Alert.alert("Error", "Failed to save your entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasContent && hasChanges) {
      Alert.alert("Discard this entry?", "Your writing will not be saved.", [
        { text: "Keep Writing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: onCancel,
        },
      ]);
    } else {
      onCancel();
    }
  };

  const handleSelectQuestion = (question: string) => {
    const prefix = content.length > 0 && !content.endsWith("\n") ? "\n\n" : "";
    setContent(content + prefix + question + "\n");
    // Dismiss keyboard briefly then refocus for better UX
    Keyboard.dismiss();
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

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
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.border },
          ]}
        >
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {isEditing ? "Editing Entry" : dateStr}
          </Text>
        </View>

        {/* Editor */}
        <ScrollView
          style={styles.editorScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.textInput,
              {
                color: colors.text,
              },
            ]}
            placeholder="Write freely..."
            placeholderTextColor={colors.textSecondary + "80"}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            autoCorrect
            autoCapitalize="sentences"
            scrollEnabled={false}
          />

          {/* Questions accordion - only in new entry mode */}
          {!isEditing && (
            <View style={styles.questionsWrapper}>
              <JournalQuestions onSelectQuestion={handleSelectQuestion} />
            </View>
          )}
        </ScrollView>

        {/* Bottom Bar */}
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={handleCancel}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: hasContent
                  ? colors.buttonPrimary
                  : colors.border,
              },
            ]}
            onPress={handleSave}
            disabled={saving || !hasContent}
          >
            <Ionicons
              name="checkmark"
              size={18}
              color={hasContent ? colors.textOnAccent : colors.textSecondary}
            />
            <Text
              style={[
                styles.saveText,
                {
                  color: hasContent ? colors.textOnAccent : colors.textSecondary,
                },
              ]}
            >
              {saving ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dateText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  editorScroll: {
    flex: 1,
  },
  textInput: {
    fontFamily: fonts.loraRegular,
    fontSize: 18,
    lineHeight: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    minHeight: 200,
  },
  questionsWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "500",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  saveText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
});
