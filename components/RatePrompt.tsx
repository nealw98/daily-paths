import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import * as StoreReview from "expo-store-review";
import {
  markRatePromptShown,
  markRateDeclined,
  markHasRated,
  openAppStoreForRating,
} from "../utils/rateShareTracking";

interface RatePromptProps {
  visible: boolean;
  onClose: () => void;
}

export const RatePrompt: React.FC<RatePromptProps> = ({ visible, onClose }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const [showCustomModal, setShowCustomModal] = useState(false);

  useEffect(() => {
    if (visible) {
      // Check if native iOS rating is available first
      checkAndShowRating();
    } else {
      // Animate out and reset
      setShowCustomModal(false);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const checkAndShowRating = async () => {
    await markRatePromptShown();
    
    // Check if native iOS rating is available
    const nativeAvailable = await StoreReview.isAvailableAsync();
    
    if (nativeAvailable) {
      // Native is available - show iOS rating modal directly, then close
      await StoreReview.requestReview();
      await markHasRated();
      onClose();
    } else {
      // Native not available - show custom Rate/Not Now modal
      setShowCustomModal(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleRate = async () => {
    setShowCustomModal(false);
    onClose();
    // Small delay so the modal closes first, then open App Store directly
    setTimeout(async () => {
      await openAppStoreForRating();
    }, 300);
  };

  const handleNotNow = async () => {
    await markRateDeclined();
    setShowCustomModal(false);
    onClose();
  };

  // Only render the custom modal if native wasn't available
  if (!showCustomModal) return null;

  return (
    <Modal transparent visible={showCustomModal} animationType="none">
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={handleNotNow}
        />
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="heart" size={32} color={colors.deepTeal} />
            </View>
          </View>

          <Text style={styles.title}>Enjoying Daily Paths?</Text>
          <Text style={styles.message}>
            Your support helps others discover this companion for their recovery journey.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRate}
              activeOpacity={0.8}
            >
              <Ionicons name="star" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Rate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleNotNow}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: colors.pearl,
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 32,
    maxWidth: 400,
    width: "85%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E8F3F3",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 24,
    color: colors.deepTeal,
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: colors.ink,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.deepTeal,
  },
  primaryButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: colors.deepTeal,
  },
  secondaryButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: colors.deepTeal,
    fontWeight: "600",
  },
});
