import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import type { JournalEntry } from "../../hooks/useJournalEntries";

/**
 * Renders inline markdown: **bold**, *italic*, and _italic_ spans.
 * Bold is used for inserted journal questions; italic for user emphasis.
 */
const renderJournalMarkdown = (
  text: string,
  boldStyle: any,
  italicStyle: any
) => {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      elements.push("\n");
    }

    // Match **bold** first (greedy before single *), then *italic* or _italic_
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        elements.push(line.slice(lastIndex, match.index));
      }

      if (match[2] != null) {
        // **bold**
        elements.push(
          <Text key={`b-${lineIdx}-${key++}`} style={boldStyle}>
            {match[2]}
          </Text>
        );
      } else {
        // *italic* or _italic_
        const italicText = match[3] ?? match[4];
        elements.push(
          <Text key={`i-${lineIdx}-${key++}`} style={italicStyle}>
            {italicText}
          </Text>
        );
      }

      lastIndex = match.index + match[0]!.length;
    }

    if (lastIndex < line.length) {
      elements.push(line.slice(lastIndex));
    }
  });

  return elements;
};

interface JournalEntryDetailProps {
  entry: JournalEntry;
  onBack: () => void;
  onSave: (entryId: string, content: string) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export const JournalEntryDetail: React.FC<JournalEntryDetailProps> = ({
  entry,
  onBack,
  onSave,
  onDelete,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}) => {
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(entry.content);
  const [saving, setSaving] = useState(false);

  const entryDate = new Date(entry.created_at);
  const dateStr = entryDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = entryDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const handleDelete = () => {
    Alert.alert("Delete Entry?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await onDelete(entry.id);
          onBack();
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!editContent.trim()) {
      Alert.alert("Nothing to save", "Write something before saving.");
      return;
    }

    setSaving(true);
    try {
      await onSave(entry.id, editContent);
      setIsEditing(false);
    } catch {
      Alert.alert("Error", "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (editContent !== entry.content) {
      Alert.alert("Discard changes?", "Your edits will not be saved.", [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            setEditContent(entry.content);
            setIsEditing(false);
          },
        },
      ]);
    } else {
      setIsEditing(false);
    }
  };

  // Reset edit content when entry changes (prev/next navigation)
  React.useEffect(() => {
    setEditContent(entry.content);
    setIsEditing(false);
  }, [entry.id]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View
          style={[styles.header, { borderBottomColor: colors.border }]}
        >
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.accent} />
            <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={22} color="#E53E3E" />
          </TouchableOpacity>
        </View>

        {/* Date & Time */}
        <View style={[styles.dateBar, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.dateText, { color: colors.text }]}>{dateStr}</Text>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {timeStr}
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.contentScroll}
          keyboardShouldPersistTaps="handled"
        >
          {isEditing ? (
            <View style={styles.editContainer}>
              {/* Visible styled layer */}
              <Text
                style={[styles.contentText, { color: colors.text }]}
                pointerEvents="none"
              >
                {editContent
                  ? renderJournalMarkdown(
                      editContent,
                      { fontFamily: fonts.loraBold },
                      { fontFamily: fonts.loraItalic }
                    )
                  : null}
                {"\u200B"}
              </Text>
              {/* Invisible TextInput overlay */}
              <TextInput
                style={[styles.editInput, styles.editInputOverlay]}
                value={editContent}
                onChangeText={setEditContent}
                multiline
                textAlignVertical="top"
                autoFocus
                autoCorrect
                autoCapitalize="sentences"
                scrollEnabled={false}
                selectionColor={colors.accent}
              />
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsEditing(true)}
            >
              <Text style={[styles.contentText, { color: colors.text }]}>
                {renderJournalMarkdown(
                  entry.content,
                  { fontFamily: fonts.loraBold },
                  { fontFamily: fonts.loraItalic }
                )}
              </Text>
              <Text style={[styles.tapHint, { color: colors.textSecondary }]}>
                Tap to edit
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Bottom Bar */}
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.discardButton, { borderColor: colors.border }]}
                onPress={handleDiscard}
              >
                <Text style={[styles.discardText, { color: colors.textSecondary }]}>
                  Discard
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveEditButton, { backgroundColor: colors.buttonPrimary }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={[styles.saveEditText, { color: colors.textOnAccent }]}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.navButton,
                  { backgroundColor: hasPrev ? colors.cardBackground : colors.border + "40" },
                ]}
                onPress={onPrev}
                disabled={!hasPrev}
              >
                <Ionicons
                  name="arrow-back"
                  size={18}
                  color={hasPrev ? colors.accent : colors.textSecondary + "40"}
                />
                <Text
                  style={[
                    styles.navText,
                    { color: hasPrev ? colors.accent : colors.textSecondary + "40" },
                  ]}
                >
                  Prev
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.navButton,
                  { backgroundColor: hasNext ? colors.cardBackground : colors.border + "40" },
                ]}
                onPress={onNext}
                disabled={!hasNext}
              >
                <Text
                  style={[
                    styles.navText,
                    { color: hasNext ? colors.accent : colors.textSecondary + "40" },
                  ]}
                >
                  Next
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={hasNext ? colors.accent : colors.textSecondary + "40"}
                />
              </TouchableOpacity>
            </>
          )}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
  },
  deleteButton: {
    padding: 8,
  },
  dateBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  dateText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "600",
  },
  timeText: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    marginTop: 2,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  contentText: {
    fontFamily: fonts.loraRegular,
    fontSize: 18,
    lineHeight: 28,
  },
  tapHint: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 20,
    textAlign: "center",
  },
  editContainer: {
    position: "relative",
    minHeight: 200,
  },
  editInput: {
    fontFamily: fonts.loraRegular,
    fontSize: 18,
    lineHeight: 28,
    minHeight: 200,
  },
  editInputOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: "transparent",
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
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  navText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "500",
  },
  discardButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  discardText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "500",
  },
  saveEditButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  saveEditText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
});
