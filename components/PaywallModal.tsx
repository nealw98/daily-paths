import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useSubscription } from "../hooks/useSubscription";
import { useAuth } from "../contexts/AuthContext";
import type { PurchasesPackage } from "react-native-purchases";

interface PaywallModalProps {
  visible: boolean;
  /** When false, close button is hidden (used as mandatory gate). */
  dismissable?: boolean;
  onClose: () => void;
}

const FEATURES = [
  { icon: "create-outline" as const, title: "Journal", desc: "Write and reflect on your recovery journey" },
  { icon: "book-outline" as const, title: "Prayers", desc: "Al-Anon prayers with personal notes" },
  { icon: "mic-outline" as const, title: "Speakers", desc: "Browse and listen to recovery audio" },
  { icon: "cloud-outline" as const, title: "Cloud Sync", desc: "Access your data across all devices" },
  { icon: "search-outline" as const, title: "Search", desc: "Search through all your journal entries" },
];

export const PaywallModal: React.FC<PaywallModalProps> = ({
  visible,
  dismissable = true,
  onClose,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { packages, purchase, restore, purchasing } = useSubscription(user?.id);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [restoring, setRestoring] = useState(false);

  const handlePurchase = async () => {
    const pkg = selectedPackage || packages[0];
    if (!pkg) return;

    try {
      const success = await purchase(pkg);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      Alert.alert("Purchase Error", err.message || "Something went wrong. Please try again.");
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const success = await restore();
      if (success) {
        Alert.alert("Restored!", "Your subscription has been restored.");
        onClose();
      } else {
        Alert.alert("No Purchases Found", "We couldn't find any previous purchases to restore.");
      }
    } catch (err: any) {
      Alert.alert("Restore Error", err.message || "Something went wrong.");
    } finally {
      setRestoring(false);
    }
  };

  const monthlyPkg = packages.find(
    (p) => p.packageType === "MONTHLY" || p.identifier === "$rc_monthly"
  );
  const annualPkg = packages.find(
    (p) => p.packageType === "ANNUAL" || p.identifier === "$rc_annual"
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismissable ? onClose : undefined}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.backdrop }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            {dismissable ? (
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.closeButton} />
            )}
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>
              Daily Paths Unlimited
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Deepen your recovery journey
            </Text>

            {/* Features */}
            <View style={styles.featuresList}>
              {FEATURES.map((feature) => (
                <View key={feature.title} style={styles.featureRow}>
                  <View
                    style={[
                      styles.featureIcon,
                      { backgroundColor: colors.cardBackground },
                    ]}
                  >
                    <Ionicons name={feature.icon} size={20} color={colors.accent} />
                  </View>
                  <View style={styles.featureText}>
                    <Text style={[styles.featureTitle, { color: colors.text }]}>
                      {feature.title}
                    </Text>
                    <Text
                      style={[styles.featureDesc, { color: colors.textSecondary }]}
                    >
                      {feature.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Package Selection */}
            <View style={styles.packages}>
              {annualPkg && (
                <TouchableOpacity
                  style={[
                    styles.packageCard,
                    {
                      borderColor:
                        (selectedPackage || annualPkg) === annualPkg
                          ? colors.accent
                          : colors.border,
                      backgroundColor:
                        (selectedPackage || annualPkg) === annualPkg
                          ? colors.cardBackground
                          : colors.background,
                    },
                  ]}
                  onPress={() => setSelectedPackage(annualPkg)}
                >
                  <View style={[styles.bestValueBadge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.bestValueText, { color: colors.textOnAccent }]}>
                      Best Value
                    </Text>
                  </View>
                  <Text style={[styles.packageTitle, { color: colors.text }]}>
                    Annual
                  </Text>
                  <Text style={[styles.packagePrice, { color: colors.accent }]}>
                    {annualPkg.product.priceString}/year
                  </Text>
                </TouchableOpacity>
              )}

              {monthlyPkg && (
                <TouchableOpacity
                  style={[
                    styles.packageCard,
                    {
                      borderColor:
                        selectedPackage === monthlyPkg
                          ? colors.accent
                          : colors.border,
                      backgroundColor:
                        selectedPackage === monthlyPkg
                          ? colors.cardBackground
                          : colors.background,
                    },
                  ]}
                  onPress={() => setSelectedPackage(monthlyPkg)}
                >
                  <Text style={[styles.packageTitle, { color: colors.text }]}>
                    Monthly
                  </Text>
                  <Text style={[styles.packagePrice, { color: colors.accent }]}>
                    {monthlyPkg.product.priceString}/month
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={[styles.ctaButton, { backgroundColor: colors.buttonPrimary }]}
              onPress={handlePurchase}
              disabled={purchasing || packages.length === 0}
            >
              {purchasing ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <Text style={[styles.ctaText, { color: colors.textOnAccent }]}>
                  Subscribe Now
                </Text>
              )}
            </TouchableOpacity>

            {/* Restore */}
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={restoring}
            >
              <Text style={[styles.restoreText, { color: colors.textSecondary }]}>
                {restoring ? "Restoring..." : "Restore Purchases"}
              </Text>
            </TouchableOpacity>

            {/* Legal */}
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              Payment will be charged to your App Store account at confirmation
              of purchase. Subscription automatically renews unless cancelled at
              least 24 hours before the end of the current period.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: fonts.headerFamily,
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  subtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  featuresList: {
    gap: 16,
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
  featureDesc: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    marginTop: 2,
  },
  packages: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  packageCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  bestValueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  bestValueText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  packageTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  packagePrice: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    fontWeight: "700",
  },
  packageSavings: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    marginTop: 4,
  },
  ctaButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  ctaText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    fontWeight: "700",
  },
  restoreButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  restoreText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  legalText: {
    fontFamily: fonts.bodyFamily,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 8,
    paddingBottom: 16,
  },
});
