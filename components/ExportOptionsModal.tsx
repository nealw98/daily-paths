import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../contexts/AuthContext";
import { useJournalEntries } from "../hooks/useJournalEntries";
import { exportJournalToPDF } from "../utils/exportJournal";

interface ExportOptionsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { entries } = useJournalEntries(user?.id);
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (entries.length === 0) {
      Alert.alert(
        "No Entries",
        "You don't have any journal entries to export yet."
      );
      return;
    }

    setExporting(true);
    try {
      const success = await exportJournalToPDF(entries, {
        includeTimestamps,
      });

      if (success) {
        onClose();
      } else {
        Alert.alert("Export Failed", "Something went wrong generating your PDF.");
      }
    } catch (err) {
      Alert.alert("Export Error", "Failed to export journal. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: colors.backdrop }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.content, { backgroundColor: colors.modalBackground }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Export Journal
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Export all {entries.length} journal{" "}
            {entries.length === 1 ? "entry" : "entries"} as a PDF file.
          </Text>

          {/* Options */}
          <View style={[styles.option, { borderColor: colors.border }]}>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>
                Include timestamps
              </Text>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                Show time of day for each entry
              </Text>
            </View>
            <Switch
              value={includeTimestamps}
              onValueChange={setIncludeTimestamps}
              trackColor={{
                false: colors.border,
                true: colors.accent + "80",
              }}
              thumbColor={includeTimestamps ? colors.accent : "#f4f3f4"}
            />
          </View>

          {/* Export Button */}
          <TouchableOpacity
            style={[styles.exportButton, { backgroundColor: colors.buttonPrimary }]}
            onPress={handleExport}
            disabled={exporting || entries.length === 0}
          >
            {exporting ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <>
                <Ionicons
                  name="download-outline"
                  size={20}
                  color={colors.textOnAccent}
                />
                <Text style={[styles.exportText, { color: colors.textOnAccent }]}>
                  Export PDF
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  content: {
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.headerFamily,
    fontSize: 24,
    fontWeight: "700",
  },
  description: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  optionText: {
    flex: 1,
    marginRight: 12,
  },
  optionTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "500",
  },
  optionDesc: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    marginTop: 2,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  exportText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    fontWeight: "600",
  },
});
