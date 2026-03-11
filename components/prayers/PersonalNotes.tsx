import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { useLocalPrayerNotes } from "../../hooks/useLocalPrayerNotes";
import { fonts } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import { qaLog } from "../../utils/qaLog";
import { useSubscription } from "../../hooks/useSubscription";
import { useTrialStatus } from "../../hooks/useTrialStatus";
import { getSaveRequirement } from "../../utils/accessControl";
import { useAuth } from "../../contexts/AuthContext";
import { SignInModal } from "../SignInModal";

interface PersonalNotesProps {
  userId: string | null;
  onInputFocus?: () => void;
}

/**
 * Personal prayer notes component with dual storage support.
 *
 * When `userId` is null (during the free trial), notes are saved to
 * AsyncStorage via `useLocalPrayerNotes`.  When authenticated (`userId`
 * is present), notes are saved directly to Supabase.
 */
export const PersonalNotes: React.FC<PersonalNotesProps> = ({ userId, onInputFocus }) => {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const { status: subStatus } = useSubscription();
  const trialStatus = useTrialStatus();
  const { isAuthenticated } = useAuth();
  const saveReq = getSaveRequirement(subStatus, trialStatus, isAuthenticated);

  // Local storage hook — always called (Rules of Hooks)
  const localNotes = useLocalPrayerNotes();

  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSignIn, setShowSignIn] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // ── Load notes from appropriate source ─────────────────────────────
  useEffect(() => {
    if (userId) {
      // Authenticated: load from Supabase
      const loadFromSupabase = async () => {
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
      loadFromSupabase();
    } else if (saveReq === "local") {
      // Trial / anonymous: load from local storage
      if (!localNotes.loading) {
        setContent(localNotes.content);
        setSavedContent(localNotes.content);
        setLoading(false);
      }
    } else {
      // Entitled but signed out: no saved data is visible without an account.
      setContent("");
      setSavedContent("");
      setLoading(false);
    }
  }, [userId, localNotes.loading, localNotes.content, saveReq]);

  // ── Save to appropriate storage ────────────────────────────────────
  const handleSave = useCallback(async () => {
    const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error("Save timed out")), ms);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    setSaving(true);
    try {
      if (saveReq === "signin_required") {
        setPendingSave(true);
        Alert.alert(
          "Sign In Required to Save",
          "Saving requires an account. Sign in to save your prayer notes, or choose Not Now to keep editing.",
          [
            { text: "Not Now", style: "cancel" },
            { text: "Sign In", onPress: () => setShowSignIn(true) },
          ],
        );
        return;
      }
      if (saveReq === "blocked") return;

      if (saveReq === "cloud" && userId) {
        // Authenticated: save to Supabase
        const { error } = await withTimeout(
          supabase.from("prayer_notes").upsert(
            {
              user_id: userId,
              content: content.trim(),
            },
            { onConflict: "user_id" }
          ),
          15000,
        );

        if (error) {
          Alert.alert("Error", "Failed to save your notes.");
          qaLog("prayers", "Error saving prayer notes", { error: error.message });
          return;
        }
      } else if (saveReq === "local") {
        // Trial / anonymous: save to AsyncStorage
        const success = await withTimeout(localNotes.saveContent(content), 10000);
        if (!success) {
          Alert.alert("Error", "Failed to save your notes.");
          return;
        }
      }

      setSavedContent(content);
      setIsEditing(false);
      qaLog("prayers", "Prayer notes saved", { storage: userId ? "supabase" : "local" });
    } catch (err) {
      Alert.alert("Error", "Saving took too long or failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [userId, content, localNotes, saveReq]);

  const handleEdit = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const handleCancel = () => {
    setContent(savedContent);
    setIsEditing(false);
  };

  const hasChanges = content !== savedContent;

  useEffect(() => {
    if (showSignIn || !isAuthenticated || !pendingSave) return;
    setPendingSave(false);
    handleSave();
  }, [showSignIn, isAuthenticated, pendingSave, handleSave]);

  return (
    <View style={[styles.container, { backgroundColor: colors.cloud }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ocean }]}>
          PERSONAL PRAYER NOTES
        </Text>
        {!isEditing && (
          <TouchableOpacity onPress={handleEdit}>
            <Ionicons name="create-outline" size={20} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <Text style={[styles.placeholder, { color: colors.textSecondary }]}>Loading notes...</Text>
      )}

      {!loading && isEditing ? (
        <>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.ink, borderColor: colors.border, backgroundColor: colors.background, fontSize: typography.bodyFontSize, lineHeight: typography.bodyLineHeight }]}
            value={content}
            onChangeText={setContent}
            onContentSizeChange={onInputFocus}
            placeholder="Write your personal prayers, intentions, or reflections..."
            placeholderTextColor={colors.textSecondary + "60"}
            multiline
            textAlignVertical="top"
            onFocus={onInputFocus}
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
      ) : !loading ? (
        <TouchableOpacity onPress={handleEdit} activeOpacity={0.7}>
          {content.trim() ? (
            <Text style={[styles.noteContent, { color: colors.ink, fontSize: typography.bodyFontSize, lineHeight: typography.bodyLineHeight }]}>
              {content}
            </Text>
          ) : (
            <Text style={[styles.placeholder, { color: colors.textSecondary + "60", fontSize: typography.bodyFontSize - 2, lineHeight: typography.bodyLineHeight - 6 }]}>
              Tap to add your personal prayers, intentions, or reflections...
            </Text>
          )}
        </TouchableOpacity>
      ) : null}
      <SignInModal
        visible={showSignIn}
        dismissable
        initialMode="signin"
        onClose={() => {
          setShowSignIn(false);
          if (pendingSave && isAuthenticated) {
            setPendingSave(false);
            handleSave();
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
  },
  input: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  noteContent: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    lineHeight: 24,
  },
  placeholder: {
    fontFamily: fonts.bodyFamilyRegular,
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
