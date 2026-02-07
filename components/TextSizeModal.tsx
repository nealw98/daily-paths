import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useSettings, TextSize } from "../hooks/useSettings";
import { useAnalytics } from "../utils/analytics";

/** Default theme options (visible to all users) */
const DEFAULT_THEME_OPTIONS: { id: string; displayName: string; icon?: string }[] = [
  { id: "ocean-light", displayName: "Light", icon: "sunny" },
  { id: "ocean-dark", displayName: "Dark", icon: "moon" },
  { id: "system", displayName: "System", icon: "phone-portrait-outline" },
];

/** Extended color themes (hidden behind long-press) */
const EXTENDED_THEME_OPTIONS: { id: string; displayName: string }[] = [
  { id: "deep-sea", displayName: "Deep\nSea" },
  { id: "burgundy-rose", displayName: "Rose\nGarden" },
  { id: "twilight-fire", displayName: "Desert\nTwilight" },
  { id: "soft-mauve", displayName: "Plum" },
  { id: "champagne", displayName: "Coffee\nBreak" },
  { id: "peach-blossom", displayName: "Peach\nBlossom" },
  { id: "morning-light", displayName: "Morning\nLight" },
];

/** IDs of dark themes for analytics */
const DARK_THEME_IDS = new Set(["ocean-dark", "deep-sea", "champagne"]);

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
  const [showExtended, setShowExtended] = React.useState(false);

  const handleThemeChange = (optionId: string) => {
    if (optionId === "system") {
      setColorScheme("system");
      updateThemeMode("system");
    } else {
      setThemeId(optionId);
      updateThemeMode(DARK_THEME_IDS.has(optionId) ? "dark" : "light");
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

  // Reset extended menu when modal closes
  React.useEffect(() => {
    if (!visible) {
      setShowExtended(false);
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

  const shouldShowExtended = showExtended;

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
            {/* Theme section — long-press label to reveal extended themes */}
            <TouchableOpacity
              activeOpacity={0.7}
              onLongPress={() => setShowExtended(true)}
              delayLongPress={600}
            >
              <Text style={[styles.sectionLabel, { color: colors.deepTeal }]}>Theme</Text>
            </TouchableOpacity>

            {/* Default theme options (always visible) */}
            <View style={styles.themeOptions}>
              {DEFAULT_THEME_OPTIONS.map((option) => {
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

            {/* Extended color themes (hidden until long-press on "Theme") */}
            {shouldShowExtended && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.deepTeal, marginTop: -36 }]}>Colors</Text>
                <View style={styles.themeOptions}>
                  {EXTENDED_THEME_OPTIONS.map((option) => {
                    const isSelected =
                      settings.themeId === option.id && settings.colorScheme !== "system";
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
              </>
            )}

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
    justifyContent: "flex-end",
  },
  modalContainer: {
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
  },
  title: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 28,
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
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  subtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
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
  },
  sliderStopActive: {
  },
  sliderStopSelected: {
    transform: [{ scale: 1.1 }],
  },
  sectionLabel: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 24,
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
    gap: 4,
    minHeight: 70,
  },
  themeOptionSelected: {
  },
  themeOptionText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  themeOptionTextSelected: {
    // color from colors.textOnAccent applied inline
  },
});
