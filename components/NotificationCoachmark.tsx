import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
  BackHandler,
  Platform,
} from "react-native";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";

export interface CoachmarkAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NotificationCoachmarkProps {
  visible: boolean;
  anchor: CoachmarkAnchor | null;
  /**
   * The component itself only ever produces "got_it" (Got it button or Android
   * back). The "toggle_tap" reason is fired by the parent hook when it observes
   * the underlying setting flip — the parent passes through any reason it needs.
   */
  onDismiss: (reason: "got_it") => void;
}

const DIM_COLOR = "rgba(31, 42, 42, 0.65)";
const RING_COLOR = "#C9963A";
// Ring extends vertically and horizontally beyond the row for breathing room
// so the border doesn't crowd the title text on the left or the Switch on the
// right.
const RING_PADDING_H = 12;
const RING_PADDING_V = 8;
const RING_BORDER = 3;
const RING_RADIUS = 12;
const TOOLTIP_GAP = 14;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_TRIANGLE_SIZE = 12;
const FADE_DURATION = 200;
// The toggle row's measured height can be flaky on Android (intrinsic text-row
// metrics + scaled Switch). Clamp so the ring always covers the title +
// subtitle + Switch comfortably.
const MIN_CUTOUT_HEIGHT = 72;

export const NotificationCoachmark: React.FC<NotificationCoachmarkProps> = ({
  visible,
  anchor,
  onDismiss,
}) => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(false);
  const overlayRef = useRef<View>(null);
  const [overlayOffset, setOverlayOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, opacity, rendered]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onDismiss("got_it");
      return true;
    });
    return () => sub.remove();
  }, [visible, onDismiss]);

  // Measure the overlay's own window position so we can convert anchor coords
  // (returned in window space by measureInWindow) into local coords. Without
  // this, on Android the SafeAreaView/StatusBar inset of the parent shifts our
  // local 0,0 below window 0,0, and absolute children are placed too low/high.
  useEffect(() => {
    if (!rendered || !overlayRef.current) return;
    const measure = () => {
      overlayRef.current?.measureInWindow((x, y) => {
        if (typeof x === "number" && typeof y === "number") {
          setOverlayOffset({ x, y });
        }
      });
    };
    measure();
    // Re-measure on the next frame in case layout settles slightly later.
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [rendered, anchor]);

  if (!rendered || !anchor) return null;

  const { width: screenW, height: screenH } = Dimensions.get("window");

  // Convert window-relative anchor → overlay-local coords.
  const localX = anchor.x - overlayOffset.x;
  const localY = anchor.y - overlayOffset.y;

  // Spotlight rect (the cutout) — flush with the row horizontally, padded
  // vertically, with a minimum height so the ring covers title + subtitle +
  // Switch even when row metrics under-report.
  const paddedHeight = anchor.height + RING_PADDING_V * 2;
  const cutoutH = Math.max(MIN_CUTOUT_HEIGHT, paddedHeight);
  const extraTop = (cutoutH - paddedHeight) / 2;
  const cutoutX = Math.max(0, localX - RING_PADDING_H);
  const cutoutY = Math.max(0, localY - RING_PADDING_V - extraTop);
  const cutoutW = Math.min(
    screenW - cutoutX,
    anchor.width + RING_PADDING_H * 2
  );

  // Tooltip placement — below the anchor by default; flip above if not enough space.
  const ringBottom = cutoutY + cutoutH;
  const spaceBelow = screenH - overlayOffset.y - ringBottom;
  const tooltipBelow = spaceBelow > 200; // generous estimate
  const tooltipLeft = Math.max(
    12,
    Math.min(
      screenW - TOOLTIP_WIDTH - 12,
      localX + anchor.width / 2 - TOOLTIP_WIDTH / 2
    )
  );
  const tooltipTop = tooltipBelow
    ? ringBottom + TOOLTIP_GAP
    : cutoutY - TOOLTIP_GAP - 160; // approximate height; clamps below

  // Triangle X (relative to tooltip card) — point at the anchor's horizontal center.
  const anchorCenterX = localX + anchor.width / 2;
  const triangleLeft = Math.max(
    16,
    Math.min(TOOLTIP_WIDTH - 16 - TOOLTIP_TRIANGLE_SIZE, anchorCenterX - tooltipLeft - TOOLTIP_TRIANGLE_SIZE / 2)
  );

  return (
    <Animated.View
      ref={overlayRef}
      collapsable={false}
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFillObject, { opacity, zIndex: 999 }]}
    >
      {/* Inert dim segments — absorb taps, take no action. */}
      <View
        pointerEvents="auto"
        style={[
          styles.dim,
          { top: 0, left: 0, right: 0, height: cutoutY },
        ]}
      />
      <View
        pointerEvents="auto"
        style={[
          styles.dim,
          { top: cutoutY, left: 0, width: cutoutX, height: cutoutH },
        ]}
      />
      <View
        pointerEvents="auto"
        style={[
          styles.dim,
          {
            top: cutoutY,
            left: cutoutX + cutoutW,
            right: 0,
            height: cutoutH,
          },
        ]}
      />
      <View
        pointerEvents="auto"
        style={[
          styles.dim,
          { top: cutoutY + cutoutH, left: 0, right: 0, bottom: 0 },
        ]}
      />

      {/* Corner caps — fill the L-shaped notches between the rectangular
          cutout and the rounded ring so the dim follows the ring's curve.
          Each cap is two layers: a (RING_RADIUS × RING_RADIUS) dim square,
          plus an inner overlay matching the surface color clipped to a
          quarter-disk that covers the ring's interior portion of the cap.
          The L-shape difference stays dim. */}
      <View
        pointerEvents="auto"
        style={[
          styles.cornerCap,
          { top: cutoutY, left: cutoutX },
        ]}
      >
        <View
          style={[
            styles.cornerCapInner,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: RING_RADIUS,
            },
          ]}
        />
      </View>
      <View
        pointerEvents="auto"
        style={[
          styles.cornerCap,
          { top: cutoutY, left: cutoutX + cutoutW - RING_RADIUS },
        ]}
      >
        <View
          style={[
            styles.cornerCapInner,
            {
              backgroundColor: colors.surface,
              borderTopRightRadius: RING_RADIUS,
            },
          ]}
        />
      </View>
      <View
        pointerEvents="auto"
        style={[
          styles.cornerCap,
          { top: cutoutY + cutoutH - RING_RADIUS, left: cutoutX },
        ]}
      >
        <View
          style={[
            styles.cornerCapInner,
            {
              backgroundColor: colors.surface,
              borderBottomLeftRadius: RING_RADIUS,
            },
          ]}
        />
      </View>
      <View
        pointerEvents="auto"
        style={[
          styles.cornerCap,
          {
            top: cutoutY + cutoutH - RING_RADIUS,
            left: cutoutX + cutoutW - RING_RADIUS,
          },
        ]}
      >
        <View
          style={[
            styles.cornerCapInner,
            {
              backgroundColor: colors.surface,
              borderBottomRightRadius: RING_RADIUS,
            },
          ]}
        />
      </View>

      {/* Gold accent ring (non-interactive). */}
      <View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            top: cutoutY,
            left: cutoutX,
            width: cutoutW,
            height: cutoutH,
          },
        ]}
      />

      {/* Tooltip card — only the Got it button is interactive. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.tooltipWrap,
          { top: tooltipTop, left: tooltipLeft, width: TOOLTIP_WIDTH },
        ]}
      >
        {tooltipBelow ? (
          <View
            pointerEvents="none"
            style={[styles.triangleUp, { left: triangleLeft }]}
          />
        ) : null}
        <View pointerEvents="box-none" style={styles.tooltipCard}>
          <Text style={styles.tooltipTitle}>A gentle daily reminder</Text>
          <Text style={styles.tooltipBody}>
            Turn this on to receive the Thought for the Day each morning.
          </Text>
          <Pressable
            onPress={() => onDismiss("got_it")}
            style={({ pressed }) => [
              styles.gotItButton,
              pressed && { opacity: 0.85 },
            ]}
            hitSlop={8}
          >
            <Text style={styles.gotItText}>Got it</Text>
          </Pressable>
        </View>
        {!tooltipBelow ? (
          <View
            pointerEvents="none"
            style={[styles.triangleDown, { left: triangleLeft }]}
          />
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  dim: {
    position: "absolute",
    backgroundColor: DIM_COLOR,
  },
  ring: {
    position: "absolute",
    borderWidth: RING_BORDER,
    borderColor: RING_COLOR,
    borderRadius: RING_RADIUS,
    // No elevation/shadow on the ring itself: on Android, elevation casts a
    // system shadow on the parent surface that bleeds inside the ring's
    // transparent interior, showing as a darker bar at the top edge of the
    // highlighted area.
  },
  cornerCap: {
    position: "absolute",
    width: RING_RADIUS,
    height: RING_RADIUS,
    backgroundColor: DIM_COLOR,
  },
  cornerCapInner: {
    width: RING_RADIUS,
    height: RING_RADIUS,
  },
  tooltipWrap: {
    position: "absolute",
  },
  tooltipCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  triangleUp: {
    position: "absolute",
    top: -TOOLTIP_TRIANGLE_SIZE / 2,
    width: 0,
    height: 0,
    borderLeftWidth: TOOLTIP_TRIANGLE_SIZE / 2,
    borderRightWidth: TOOLTIP_TRIANGLE_SIZE / 2,
    borderBottomWidth: TOOLTIP_TRIANGLE_SIZE,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#FFFFFF",
    zIndex: 1,
  },
  triangleDown: {
    position: "absolute",
    bottom: -TOOLTIP_TRIANGLE_SIZE / 2,
    width: 0,
    height: 0,
    borderLeftWidth: TOOLTIP_TRIANGLE_SIZE / 2,
    borderRightWidth: TOOLTIP_TRIANGLE_SIZE / 2,
    borderTopWidth: TOOLTIP_TRIANGLE_SIZE,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFFFFF",
    zIndex: 1,
  },
  tooltipTitle: {
    fontFamily: fonts.cormorantGaramondMediumItalic,
    fontSize: 22,
    lineHeight: 26,
    color: "#2C5F5D",
    marginBottom: 6,
    textAlign: "center",
    alignSelf: "stretch",
  },
  tooltipBody: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 20,
    color: "#5A6968",
    marginBottom: 14,
    textAlign: "center",
    alignSelf: "stretch",
  },
  gotItButton: {
    backgroundColor: "#2C5F5D",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 999,
    alignSelf: "center",
  },
  gotItText: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 14,
    lineHeight: 18,
    color: "#F5F0EB",
  },
});
