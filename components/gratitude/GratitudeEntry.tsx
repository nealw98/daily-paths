import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";

interface GratitudeEntryProps {
  initialItems?: string[];
  onSave: (items: string[]) => Promise<boolean>;
  onReset: () => void;
  saving?: boolean;
}

export const GratitudeEntry: React.FC<GratitudeEntryProps> = ({
  initialItems = [],
  onSave,
  onReset,
  saving = false,
}) => {
  const { colors } = useTheme();
  const [items, setItems] = useState<string[]>(initialItems);
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleAdd = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setItems((prev) => [...prev, trimmed]);
    setInputText("");
    // Re-focus the input for quick successive entries
    inputRef.current?.focus();
  };

  const handleRemove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const hasItems = items.length > 0;

  return (
    <View style={styles.container}>
      {/* Section label */}
      <Text style={[styles.sectionLabel, { color: colors.text }]}>
        Today I'm grateful for:
      </Text>

      {/* Single input + Add button */}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.cardBackground,
            },
          ]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="e.g., My sobriety"
          placeholderTextColor={colors.textSecondary + "80"}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.addButton,
            {
              backgroundColor: inputText.trim()
                ? colors.buttonPrimary
                : colors.border,
            },
          ]}
          onPress={handleAdd}
          disabled={!inputText.trim()}
        >
          <Text
            style={[
              styles.addButtonText,
              {
                color: inputText.trim()
                  ? colors.textOnAccent
                  : colors.textSecondary,
              },
            ]}
          >
            Add
          </Text>
        </TouchableOpacity>
      </View>

      {/* Items list */}
      {hasItems && (
        <View style={styles.itemsList}>
          {items.map((item, index) => (
            <View
              key={`${index}-${item}`}
              style={[styles.itemRow, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.itemText, { color: colors.text }]}>
                {item}
              </Text>
              <TouchableOpacity
                onPress={() => handleRemove(index)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Save button */}
      {hasItems && (
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.buttonPrimary },
          ]}
          onPress={() => onSave(items)}
          disabled={saving}
        >
          <Ionicons
            name="checkmark"
            size={18}
            color={colors.textOnAccent}
          />
          <Text style={[styles.saveButtonText, { color: colors.textOnAccent }]}>
            {saving ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Footer note */}
      <Text style={[styles.footerNote, { color: colors.textSecondary }]}>
        Your gratitude lists are saved to your account and synced across devices.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    fontWeight: "500",
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontFamily: fonts.loraRegular,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  addButton: {
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "600",
  },
  itemsList: {
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  itemText: {
    fontFamily: fonts.loraRegular,
    fontSize: 16,
    flex: 1,
    marginRight: 12,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  saveButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
  footerNote: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 18,
  },
});
