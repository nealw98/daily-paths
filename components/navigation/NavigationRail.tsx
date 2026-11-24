// The tab rail, for every display that is not a plain phone. Drawn by the
// root SideInsetGuard (never by a screen), in one of two forms:
//   · strip — on the iPhone Duo (cover and inner display) it sits inside the
//     84pt safe strip, under the status cluster, with no fill and no divider,
//     so it reads as system chrome. It follows the strip's side when the
//     cover turns.
//   · edge — on big canvases with no strip (iPad, the Duo's inner display
//     held portrait) it is a real 76pt column on the RIGHT edge, with its
//     divider facing the content.
// Phones keep the docked bottom tab bar (app/(tabs)/_layout.tsx).
// Measurements are the ones Hands Off and Sober Dailies shipped; the look
// (mint pill, Manrope 11/600 labels) is docs/widescreen-2.9/SPEC.md §2–3.
// It lives outside <Tabs>, so it navigates with the router and reads the
// selected tab from the pathname.
import React from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { fonts } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { MEDIUM_MIN_WIDTH } from "../../hooks/useLayoutMode";
import { TAB_ITEMS, isTabActive } from "./tabItems";

export const RAIL_WIDTH = 76;

// Where the strip rail starts, clear of the Duo's status cluster at the top
// of the strip. The cover's cluster is taller (the camera sits above the clock).
const STRIP_TOP = 150;
const STRIP_TOP_COVER = 185;
// The cover turned sideways: the strip is only ~466pt long and the camera
// sits at one end of it — the top when the strip is on the left, the bottom
// when it is on the right. The rail keeps clear of that end.
const COVER_CAMERA_END = 90;
const COVER_FAR_END = 12;

export default function NavigationRail({
  placement = "edge",
  side = "right",
}: {
  placement?: "edge" | "strip";
  side?: "left" | "right";
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const strip = placement === "strip";
  // The cover is the only Duo display whose short side is under 600pt.
  const cover = strip && Math.min(width, height) < MEDIUM_MIN_WIDTH;
  const coverSideways = cover && width > height;
  const cameraTop = side === "left";
  const paddingTop = coverSideways
    ? cameraTop
      ? COVER_CAMERA_END
      : COVER_FAR_END
    : strip
      ? cover
        ? STRIP_TOP_COVER
        : STRIP_TOP
      : insets.top + 16;
  const paddingBottom = coverSideways
    ? cameraTop
      ? COVER_FAR_END
      : COVER_CAMERA_END
    : Math.max(insets.bottom, 16);

  // `navigate` jumps to the existing tab instead of pushing a duplicate.
  const go = (path: string) => router.navigate(path as never);

  return (
    <View
      style={[
        styles.rail,
        { paddingTop, paddingBottom },
        strip
          ? styles.stripRail
          : {
              backgroundColor: colors.surface,
              borderLeftColor: colors.surfaceContainerHighest,
            },
      ]}
    >
      {TAB_ITEMS.map((item) => {
        const active = isTabActive(item, pathname);
        const ink = active ? colors.primaryContainer : colors.onSurfaceVariant;
        return (
          <Pressable
            key={item.path}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            onPress={() => go(item.path)}
            hitSlop={{ left: 4, right: 4 }}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
          >
            <View
              style={[
                styles.iconPill,
                active && { backgroundColor: colors.secondaryContainer },
              ]}
            >
              {item.renderIcon(ink, 22)}
            </View>
            <Text
              maxFontSizeMultiplier={1.3}
              style={[styles.label, { color: ink }]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: RAIL_WIDTH,
    gap: 10,
    alignItems: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  // In the strip it reads as part of the system chrome: no fill (the guard
  // paints the strip) and no divider.
  stripRail: {
    flex: 1,
    borderLeftWidth: 0,
    backgroundColor: "transparent",
  },
  item: {
    width: 64,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  // The selected-state pill wraps just the icon so the label never has to
  // fight the fill for contrast.
  iconPill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 11,
    lineHeight: 14,
  },
});
