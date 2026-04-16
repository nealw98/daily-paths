import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { fonts, layout } from "../../constants/theme";

interface CollectionLinkRowProps {
  /** Gray metadata on the left. If null, the left side renders nothing. */
  metadata: string | null;
  /** Tappable teal link text on the right. */
  linkLabel: string;
  /** Fires when the link text is pressed. */
  onPress: () => void;
  /** Optional extra style for the outer row (e.g., to apply a faded opacity). */
  style?: StyleProp<ViewStyle>;
}

/**
 * A quiet one-line row used below sections on the home screen to point
 * users into a collection view (e.g. Notebook, Speakers). Left side is
 * gray metadata; right side is the tappable accent link. Only the link
 * is tappable — not the whole row, not the metadata.
 */
export const CollectionLinkRow: React.FC<CollectionLinkRowProps> = ({
  metadata,
  linkLabel,
  onPress,
  style,
}) => {
  const { colors } = useTheme();
  const { typography } = useTypography();

  const metadataStyle = {
    fontFamily: fonts.bodyFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: 0,
  };

  // Matches the link sizing that was previously on "Explore all speakers →":
  // bodySmall size/lineHeight + semibold family + subtle letter-spacing.
  const linkStyle = {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    letterSpacing: 0.1,
  };

  return (
    <View style={[styles.row, style]}>
      <Text
        style={[styles.metadata, metadataStyle, { color: colors.onSurfaceVariant }]}
        numberOfLines={1}
      >
        {metadata ?? ""}
      </Text>
      <Pressable
        onPress={onPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {({ pressed }) => (
          <Text
            style={[linkStyle, { color: colors.secondary, opacity: pressed ? 0.6 : 1 }]}
          >
            {linkLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginHorizontal: layout.spacing.lgPlus,
    paddingVertical: 5,
  },
  metadata: {
    flexShrink: 1,
  },
});
