import React, { useMemo } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, lightColors } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useSettings, TextSize, ColorScheme, getTextSizeMetrics } from "../hooks/useSettings";
import { useAnalytics } from "../utils/analytics";

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
  const { colors } = useTheme();
  const { settings, setTextSize, setColorScheme } = useSettings();
  const { updateThemeMode } = useAnalytics();
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  // Handler for theme change - updates setting and tracks in PostHog
  const handleThemeChange = (mode: ColorScheme) => {
    setColorScheme(mode);
    updateThemeMode(mode);
  };

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

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
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY }], backgroundColor: colors.pearl },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.header, { borderBottomColor: colors.mist }]}>
            <Text style={[styles.title, { color: colors.deepTeal }]}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.doneButton}>
              <Text style={[styles.doneButtonText, { color: colors.deepTeal }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Theme Section */}
            <Text style={[styles.sectionLabel, { color: colors.deepTeal }]}>Theme</Text>
            <View style={styles.themeOptions}>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  { borderColor: colors.mist },
                  settings.colorScheme === "light" && [styles.themeOptionSelected, { backgroundColor: colors.deepTeal, borderColor: colors.deepTeal }],
                ]}
                onPress={() => handleThemeChange("light")}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="sunny" 
                  size={20} 
                  color={settings.colorScheme === "light" ? "#fff" : colors.deepTeal} 
                />
                <Text style={[
                  styles.themeOptionText,
                  { color: colors.deepTeal },
                  settings.colorScheme === "light" && styles.themeOptionTextSelected,
                ]}>
                  Light
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  { borderColor: colors.mist },
                  settings.colorScheme === "dark" && [styles.themeOptionSelected, { backgroundColor: colors.deepTeal, borderColor: colors.deepTeal }],
                ]}
                onPress={() => handleThemeChange("dark")}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="moon" 
                  size={20} 
                  color={settings.colorScheme === "dark" ? "#fff" : colors.deepTeal} 
                />
                <Text style={[
                  styles.themeOptionText,
                  { color: colors.deepTeal },
                  settings.colorScheme === "dark" && styles.themeOptionTextSelected,
                ]}>
                  Dark
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  { borderColor: colors.mist },
                  settings.colorScheme === "system" && [styles.themeOptionSelected, { backgroundColor: colors.deepTeal, borderColor: colors.deepTeal }],
                ]}
                onPress={() => handleThemeChange("system")}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="phone-portrait" 
                  size={20}
                  color={settings.colorScheme === "system" ? "#fff" : colors.deepTeal} 
                />
                <Text style={[
                  styles.themeOptionText,
                  { color: colors.deepTeal },
                  settings.colorScheme === "system" && styles.themeOptionTextSelected,
                ]}>
                  System
                </Text>
              </TouchableOpacity>
            </View>

            {/* Text Size Section */}
            <Text style={[styles.sectionLabel, styles.sectionLabelSpacing, { color: colors.deepTeal }]}>Text Size</Text>
            <Text style={[styles.subtitle, { color: colors.ocean }]}>
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
                    { color: colors.deepTeal },
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
                          { borderColor: colors.mist, backgroundColor: colors.pearl },
                          isActive && { borderColor: colors.seafoam, backgroundColor: colors.seafoam },
                          isSelected && { borderColor: colors.deepTeal, backgroundColor: colors.deepTeal },
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
                    { color: colors.deepTeal },
                    settings.textSize === textSizeStops[textSizeStops.length - 1] &&
                      styles.sliderEdgeLabelDisabled,
                  ]}
                >
                  Larger
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.textPreviewContainer, { borderTopColor: colors.mist }]}>
              <Text
                style={[
                  styles.textPreview,
                  {
                    fontSize: typography.bodyFontSize,
                    lineHeight: typography.bodyLineHeight,
                    color: colors.ink,
                  },
                ]}
              >
                Sample text size preview
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: lightColors.pearl,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 40,
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
    color: lightColors.deepTeal,
  },
  doneButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  doneButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: lightColors.deepTeal,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
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
    color: lightColors.deepTeal,
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
    borderColor: lightColors.seafoam,
    backgroundColor: lightColors.seafoam,
  },
  sliderStopSelected: {
    borderColor: lightColors.deepTeal,
    backgroundColor: lightColors.deepTeal,
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
  sectionLabel: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 20,
    color: lightColors.deepTeal,
    marginBottom: 12,
  },
  sectionLabelSpacing: {
    marginTop: 28,
  },
  themeOptions: {
    flexDirection: "row",
    gap: 12,
  },
  themeOption: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: lightColors.mist,
    gap: 6,
  },
  themeOptionSelected: {
    backgroundColor: lightColors.deepTeal,
    borderColor: lightColors.deepTeal,
  },
  themeOptionText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: lightColors.deepTeal,
    fontWeight: "600",
  },
  themeOptionTextSelected: {
    color: "#fff",
  },
});

