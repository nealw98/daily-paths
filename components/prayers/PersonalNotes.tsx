import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import { qaLog } from "../../utils/qaLog";

interface PersonalNotesProps {
  userId: string | null;
}

export const PersonalNotes: React.FC<PersonalNotesProps> = ({ userId }) => {
  const { colors } = useTheme();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<TextInput>(null);

  // Load existing notes
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadNotes = async () => {
      try {
        const { data } = await supabase
          .from("prayer_notes")
          .select("content")
          .eq("user_id", userId)
          .single();

        if (data) {
          setContent(data.content);
          setSavedContent(data.content);
        }
      } catch (err) {
        qaLog("prayers", "Error loading prayer notes", { error: String(err) });
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [userId]);

  const handleSave = useCallback(async () => {
    if (!userId) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("prayer_notes").upsert(
        {
          user_id: userId,
          content: content.trim(),
        },
        { onConflict: "user_id" }
      );

      if (error) {
        Alert.alert("Error", "Failed to save your notes.");
        qaLog("prayers", "Error saving prayer notes", { error: error.message });
      } else {
        setSavedContent(content);
        setIsEditing(false);
        qaLog("prayers", "Prayer notes saved");
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }, [userId, content]);

  const handleEdit = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const handleCancel = () => {
    setContent(savedContent);
    setIsEditing(false);
  };

  const hasChanges = content !== savedContent;

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Personal Prayer Notes
        </Text>
        {!isEditing && (
          <TouchableOpacity onPress={handleEdit}>
            <Ionicons name="create-outline" size={20} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      {isEditing ? (
        <>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={content}
            onChangeText={setContent}
            placeholder="Write your personal prayers, intentions, or reflections..."
            placeholderTextColor={colors.textSecondary + "60"}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.buttonRow}>
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
                { backgroundColor: hasChanges ? colors.buttonPrimary : colors.border },
              ]}
              onPress={handleSave}
              disabled={saving || !hasChanges}
            >
              <Text
                style={[
                  styles.saveText,
                  { color: hasChanges ? colors.textOnAccent : colors.textSecondary },
                ]}
              >
                {saving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity onPress={handleEdit} activeOpacity={0.7}>
          {content.trim() ? (
            <Text style={[styles.noteContent, { color: colors.text }]}>
              {content}
            </Text>
          ) : (
            <Text style={[styles.placeholder, { color: colors.textSecondary + "60" }]}>
              Tap to add your personal prayers, intentions, or reflections...
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.headerFamily,
    fontSize: 20,
    fontWeight: "600",
  },
  input: {
    fontFamily: fonts.loraRegular,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  noteContent: {
    fontFamily: fonts.loraRegular,
    fontSize: 16,
    lineHeight: 24,
  },
  placeholder: {
    fontFamily: fonts.loraItalic,
    fontSize: 15,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  saveText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    fontWeight: "600",
  },
});
