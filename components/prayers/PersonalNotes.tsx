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
import { fonts } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import { qaLog } from "../../utils/qaLog";
import { useAuth } from "../../contexts/AuthContext";
import { SignInModal } from "../SignInModal";
import { requiresSignInForCloudWrite } from "../../utils/accessControl";

const SAVE_REQUEST_TIMEOUT_MS = 6000;
const FETCH_REQUEST_TIMEOUT_MS = 8000;

const isLikelySessionError = (message: string) =>
  /jwt|token|session|auth/i.test(message);

interface PersonalNotesProps {
  userId: string | null;
  onInputFocus?: () => void;
}

/**
 * Personal prayer notes component backed by Supabase.
 * Read/write requires account auth; signed-out users can still access the
 * premium screen but must sign in to load/save cloud notes.
 */
export const PersonalNotes: React.FC<PersonalNotesProps> = ({ userId, onInputFocus }) => {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const { isAuthenticated } = useAuth();

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
      const fetchOnce = async (signal: AbortSignal) => {
        const { data, error: fetchError } = await supabase
          .from("prayer_notes")
          .select("content")
          .eq("user_id", userId)
          .single()
          .abortSignal(signal)
          .then((res) => res);

        if (fetchError) {
          // PGRST116 = no rows found — not an error, just empty notes
          if (fetchError.code === "PGRST116") return null;
          throw new Error(fetchError.message);
        }
        return data;
      };

      const loadFromSupabase = async () => {
        const startedAt = Date.now();
        const controller = new AbortController();
        const timeoutError = new Error("Fetch timed out");
        const timer = setTimeout(() => {
          controller.abort();
        }, FETCH_REQUEST_TIMEOUT_MS);

        try {
          let data: { content: string } | null = null;

          try {
            data = await Promise.race([
              fetchOnce(controller.signal),
              new Promise<never>((_, reject) => {
                setTimeout(() => reject(timeoutError), FETCH_REQUEST_TIMEOUT_MS);
              }),
            ]);
          } catch (firstErr) {
            const message = String(firstErr);
            qaLog("prayers", "First load attempt failed", {
              userId,
              elapsedMs: Date.now() - startedAt,
              error: message,
            });

            if (firstErr === timeoutError || message.toLowerCase().includes("abort")) {
              throw new Error("Loading your prayer notes is taking too long. Please try again.");
            }

            if (!isLikelySessionError(message)) {
              throw firstErr;
            }

            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              qaLog("prayers", "Session refresh before load retry failed", {
                error: refreshError.message,
              });
              throw firstErr;
            }

            qaLog("prayers", "Retrying load after session refresh", { userId });
            const retryController = new AbortController();
            const retryTimer = setTimeout(() => retryController.abort(), FETCH_REQUEST_TIMEOUT_MS);
            try {
              data = await fetchOnce(retryController.signal);
            } finally {
              clearTimeout(retryTimer);
            }
          }

          if (data) {
            setContent(data.content);
            setSavedContent(data.content);
          }
          qaLog("prayers", "Prayer notes loaded", {
            userId,
            hasContent: !!data,
            elapsedMs: Date.now() - startedAt,
          });
        } catch (err) {
          const errorText = String(err);
          qaLog("prayers", "Error loading prayer notes", { error: errorText });
          Alert.alert("Error", errorText.includes("taking too long")
            ? errorText
            : "Failed to load your prayer notes. Please try again.");
        } finally {
          clearTimeout(timer);
          setLoading(false);
        }
      };
      loadFromSupabase();
    } else {
      // Signed out: cloud notes are unavailable.
      setContent("");
      setSavedContent("");
      setLoading(false);
    }
  }, [userId]);

  // ── Save to appropriate storage ────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (requiresSignInForCloudWrite(isAuthenticated, userId)) {
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
      if (!userId) return;

      const saveOnce = async (signal: AbortSignal) => {
        const { error: upsertError } = await supabase
          .from("prayer_notes")
          .upsert(
            {
              user_id: userId,
              content: content.trim(),
            },
            { onConflict: "user_id" }
          )
          .abortSignal(signal)
          .then((res) => res);

        if (upsertError) {
          throw new Error(upsertError.message);
        }
      };

      const startedAt = Date.now();
      const controller = new AbortController();
      const timeoutError = new Error("Save timed out");
      const timer = setTimeout(() => {
        controller.abort();
      }, SAVE_REQUEST_TIMEOUT_MS);

      try {
        try {
          await Promise.race([
            saveOnce(controller.signal),
            new Promise<never>((_, reject) => {
              setTimeout(() => reject(timeoutError), SAVE_REQUEST_TIMEOUT_MS);
            }),
          ]);
        } catch (firstErr) {
          const message = String(firstErr);

          if (firstErr === timeoutError || message.toLowerCase().includes("abort")) {
            Alert.alert("Save Timed Out", "Saving is taking too long. Please try again.");
            return;
          }

          if (!isLikelySessionError(message)) {
            throw firstErr;
          }

          qaLog("prayers", "First save attempt failed (session)", {
            userId,
            elapsedMs: Date.now() - startedAt,
            error: message,
          });

          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            qaLog("prayers", "Session refresh before save retry failed", {
              error: refreshError.message,
            });
            throw firstErr;
          }

          qaLog("prayers", "Retrying save after session refresh", { userId });
          const retryController = new AbortController();
          const retryTimer = setTimeout(() => retryController.abort(), SAVE_REQUEST_TIMEOUT_MS);
          try {
            await saveOnce(retryController.signal);
          } finally {
            clearTimeout(retryTimer);
          }
        }

        setSavedContent(content);
        setIsEditing(false);
        qaLog("prayers", "Prayer notes saved", {
          storage: "supabase",
          elapsedMs: Date.now() - startedAt,
        });
      } catch (saveErr) {
        const errorText = String(saveErr);
        Alert.alert("Error", "Failed to save your notes. Please try again.");
        qaLog("prayers", "Error saving prayer notes", { error: errorText });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to save your notes. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [userId, content, isAuthenticated]);

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
