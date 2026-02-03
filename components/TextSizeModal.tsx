import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, lightColors } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useSettings, TextSize } from "../hooks/useSettings";
import { useAnalytics } from "../utils/analytics";

/** All theme options shown in a single list */
const THEME_OPTIONS: { id: string; displayName: string; icon?: string }[] = [
  { id: "ocean-light", displayName: "Light", icon: "sunny" },
  { id: "ocean-dark", displayName: "Dark", icon: "moon" },
  { id: "system", displayName: "System", icon: "phone-portrait-outline" },
  { id: "deep-sea", displayName: "Deep\nSea" },
  { id: "burgundy-rose", displayName: "Rose\nGarden" },
  { id: "twilight-fire", displayName: "Desert\nTwilight" },
];

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
  const { settings, setTextSize, setThemeId, setColorScheme } = useSettings();
  const { updateThemeMode } = useAnalytics();
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  const handleThemeChange = (optionId: string) => {
    if (optionId === "system") {
      setColorScheme("system");
      updateThemeMode("system");
    } else {
      setThemeId(optionId);
      const isDark = optionId.includes("-dark") || optionId === "deep-sea";
      updateThemeMode(isDark ? "dark" : "light");
    }
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
        style={[styles.backdrop, { backgroundColor: colors.backdrop }]}
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
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.deepTeal }]}>Appearance</Text>
            <TouchableOpacity onPress={onClose} style={styles.doneButton}>
              <Text style={[styles.doneButtonText, { color: colors.deepTeal }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Theme section */}
            <Text style={[styles.sectionLabel, { color: colors.deepTeal }]}>Theme</Text>
            <View style={styles.themeOptions}>
              {THEME_OPTIONS.map((option) => {
                const isSelected =
                  option.id === "system"
                    ? settings.colorScheme === "system"
                    : settings.themeId === option.id && settings.colorScheme !== "system";
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.themeOption,
                      { borderColor: colors.border },
                      isSelected && [styles.themeOptionSelected, { backgroundColor: colors.deepTeal, borderColor: colors.deepTeal }],
                    ]}
                    onPress={() => handleThemeChange(option.id)}
                    activeOpacity={0.8}
                  >
                    {option.icon && (
                      <Ionicons
                        name={option.icon as any}
                        size={20}
                        color={isSelected ? colors.textOnAccent : colors.deepTeal}
                      />
                    )}
                    <Text
                      style={[
                        styles.themeOptionText,
                        { color: colors.deepTeal },
                        isSelected && [styles.themeOptionTextSelected, { color: colors.textOnAccent }],
                      ]}
                      numberOfLines={2}
                    >
                      {option.displayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
                          { borderColor: colors.border, backgroundColor: colors.pearl },
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
          </ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: lightColors.backdrop,
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: lightColors.pearl,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
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
    color: lightColors.textSecondary,
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
    fontSize: 15,
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
    borderColor: lightColors.border,
    backgroundColor: lightColors.modalBackground,
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
  sectionLabel: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 24,
    color: lightColors.deepTeal,
    marginBottom: 12,
  },
  sectionLabelSpacing: {
    marginTop: 40,
  },
  themeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 48,
  },
  themeOption: {
    minWidth: 90,
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: lightColors.mist,
    gap: 4,
    minHeight: 70,
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
    textAlign: "center",
  },
  themeOptionTextSelected: {
    // color from colors.textOnAccent applied inline
  },
});

