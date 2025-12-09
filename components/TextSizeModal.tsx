import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { useSettings, TextSize, getTextSizeMetrics } from "../hooks/useSettings";

const textSizeStops: TextSize[] = [
  "extraSmall",
  "small",
  "medium",
  "large",
  "extraLarge",
];

interface TextSizeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const TextSizeModal: React.FC<TextSizeModalProps> = ({
  visible,
  onClose,
}) => {
  const { settings, setTextSize } = useSettings();

  const typography = useMemo(
    () => getTextSizeMetrics(settings.textSize),
    [settings.textSize]
  );

  const handleTextSizePress = async (size: TextSize) => {
    if (settings.textSize === size) return;
    await setTextSize(size);
  };

  const handleDecrementTextSize = async () => {
    const currentIndex = textSizeStops.indexOf(settings.textSize);
    if (currentIndex > 0) {
      await setTextSize(textSizeStops[currentIndex - 1]);
    }
  };

  const handleIncrementTextSize = async () => {
    const currentIndex = textSizeStops.indexOf(settings.textSize);
    if (currentIndex < textSizeStops.length - 1) {
      await setTextSize(textSizeStops[currentIndex + 1]);
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
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={styles.modalContainer}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Reading Text Size</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subtitle}>
              Adjust how large the daily reading appears.
            </Text>

            <View style={styles.sliderRow}>
              <TouchableOpacity
                onPress={handleDecrementTextSize}
                disabled={settings.textSize === textSizeStops[0]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sliderEdgeLabel,
                    settings.textSize === textSizeStops[0] && styles.sliderEdgeLabelDisabled,
                  ]}
                >
                  Smaller
                </Text>
              </TouchableOpacity>
              <View style={styles.sliderTrack}>
                {textSizeStops.map((size, index) => {
                  const selectedIndex = textSizeStops.indexOf(settings.textSize);
                  const isActive = index <= selectedIndex;
                  const isSelected = size === settings.textSize;
                  return (
                    <TouchableOpacity
                      key={size}
                      style={styles.sliderStopTouch}
                      activeOpacity={0.8}
                      onPress={() => handleTextSizePress(size)}
                    >
                      <View
                        style={[
                          styles.sliderStop,
                          isActive && styles.sliderStopActive,
                          isSelected && styles.sliderStopSelected,
                        ]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={handleIncrementTextSize}
                disabled={settings.textSize === textSizeStops[textSizeStops.length - 1]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sliderEdgeLabel,
                    settings.textSize === textSizeStops[textSizeStops.length - 1] &&
                      styles.sliderEdgeLabelDisabled,
                  ]}
                >
                  Larger
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.textPreviewContainer}>
              <Text
                style={[
                  styles.textPreview,
                  {
                    fontSize: typography.bodyFontSize,
                    lineHeight: typography.bodyLineHeight,
                  },
                ]}
              >
                Sample text size preview
              </Text>
            </View>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    paddingBottom: 82,
  },
  modalContainer: {
    backgroundColor: colors.pearl,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  title: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 28,
    color: colors.deepTeal,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  subtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 24,
    lineHeight: 22,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  sliderEdgeLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    color: colors.deepTeal,
    fontWeight: "600",
  },
  sliderEdgeLabelDisabled: {
    opacity: 0.3,
  },
  sliderTrack: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 4,
  },
  sliderStopTouch: {
    flex: 1,
    alignItems: "center",
  },
  sliderStop: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  sliderStopActive: {
    borderColor: colors.seafoam,
    backgroundColor: colors.seafoam,
  },
  sliderStopSelected: {
    borderColor: colors.deepTeal,
    backgroundColor: colors.deepTeal,
    transform: [{ scale: 1.1 }],
  },
  textPreviewContainer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  textPreview: {
    fontFamily: fonts.loraRegular,
    color: "#4b5563",
  },
});

