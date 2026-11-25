// Onboarding and the paywall on wide screens (docs/widescreen-2.9/SPEC.md §5):
// a phone-sized window centered on a dark backdrop instead of a stretched
// full-width screen. On phones (and the Duo's cover display) it is a no-op.
//
// Both screens are fixed-palette (fallbackColors), so the backdrop is too.
import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fallbackColors } from "../../constants/theme";
import { isOpenCanvas } from "../../hooks/useLayoutMode";

const MAX_WIDTH = 520;
const MAX_HEIGHT = 840;
const MARGIN = 24;

/**
 * The size the onboarding/paywall content gets: the centered window on an
 * open canvas, otherwise the whole window. Use it instead of
 * useWindowDimensions() for anything sized to the screen (carousels,
 * full-screen overlays).
 */
export function useCenteredWindow(): { wide: boolean; width: number; height: number } {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (!isOpenCanvas(width, height)) return { wide: false, width, height };
  return {
    wide: true,
    width: Math.min(MAX_WIDTH, width - insets.left - insets.right - MARGIN * 2),
    height: Math.min(MAX_HEIGHT, height - insets.top - insets.bottom - MARGIN * 2),
  };
}

export function CenteredWindow({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { wide, width, height } = useCenteredWindow();
  if (!wide) return <>{children}</>;
  return (
    <View
      style={[
        styles.backdrop,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={[styles.window, { width, height }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: fallbackColors.primaryFixed,
  },
  window: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: fallbackColors.surface,
  },
});
