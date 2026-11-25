// Keeps app content out of the LEFT/RIGHT safe-area insets while the
// background still paints edge-to-edge behind them, and draws the tab rail
// wherever the wide rule puts the tabs.
//
// iOS only pads the sides on hardware that reserves them: the iPhone Duo
// reports an 84pt side inset (camera strip + floating status cluster) on
// both displays. Classic portrait phones and iPad report 0 on both sides, so
// the padding is a no-op there.
//
// Mounted ONCE at the app root (app/_layout.tsx). Screens inside must NOT
// add left/right safe-area padding of their own: a native SafeAreaView
// measures its own position and reads 0 inside the guard, but
// useSafeAreaInsets() does not, so padding with insets.left/right would
// double up. React Native <Modal>s render in their own native window,
// OUTSIDE this guard, so full-screen modals handle the side edges themselves.
//
// Duo edge margins: on the Duo the status bar lives in the side strip, so
// the window reports a top inset of 0, and the side away from the strip
// reports 0 too. While the main app is showing and a strip is present, the
// guard pads an edge that reports 0: 14pt at the top, 10pt on the side away
// from the strip.
//
// Tab navigation. The main app turns it on with <MainNav /> (onboarding never
// does), and it stays put over every pushed screen:
//   · strip rail — on the Duo (cover and inner display) the rail lives in
//     the safe strip, following the strip's side when the cover turns;
//   · edge rail — on open canvases with no strip (iPad, the Duo's inner
//     display held portrait, where its strip runs along the top) a 76pt
//     column on the right edge, beside the content;
//   · phones keep the bottom tab bar, which app/(tabs)/_layout.tsx draws.
// Ported from Sober Dailies and Hands Off (components/layout/SideInsetGuard).
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../../hooks/useTheme";
import { isOpenCanvas, isWideLayout } from "../../hooks/useLayoutMode";
import { reassertDisplayOrientationRule } from "../../lib/orientation";
import NavigationRail, { RAIL_WIDTH } from "../navigation/NavigationRail";

// Extra edge margin where the Duo reports no inset.
const DUO_EDGE_TOP = 14;
const DUO_EDGE_SIDE = 10;

// Which side's safe strip can hold the tab rail (the Duo), or null when
// neither strip is wide enough.
export function stripSide(insets: { left: number; right: number }): "left" | "right" | null {
  if (insets.right >= RAIL_WIDTH) return "right";
  if (insets.left >= RAIL_WIDTH) return "left";
  return null;
}

// True when the rail, not the phone's bottom bar, carries the tabs: the Duo
// (either display) or an open canvas such as an iPad. Phones are always false.
export function useTabsInRail(): boolean {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  return stripSide(insets) != null || isOpenCanvas(width, height);
}

// The Duo edge margin the guard has applied around the content.
export type EdgeMargin = { top: number; left: number; right: number };
const EdgeMarginContext = createContext<EdgeMargin>({ top: 0, left: 0, right: 0 });
export const useEdgeMargin = () => useContext(EdgeMarginContext);

const MainNavContext = createContext<{ setOn: (on: boolean) => void }>({ setOn: () => {} });

// Mounted while the main app (not onboarding) is showing, to turn on the
// tab rail and the Duo edge margins.
export function MainNav() {
  const { setOn } = useContext(MainNavContext);
  useEffect(() => {
    setOn(true);
    return () => setOn(false);
  }, [setOn]);
  return null;
}

export default function SideInsetGuard({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const [navOn, setNavOn] = useState(false);
  const navCtx = useMemo(() => ({ setOn: setNavOn }), []);
  const side = stripSide(insets);
  const roomy = navOn && side != null;
  const padTop = roomy && insets.top === 0 ? DUO_EDGE_TOP : 0;
  const extraLeft = roomy && side === "right" && insets.left === 0 ? DUO_EDGE_SIDE : 0;
  const extraRight = roomy && side === "left" && insets.right === 0 ? DUO_EDGE_SIDE : 0;
  const edge = useMemo(
    () => ({ top: padTop, left: extraLeft, right: extraRight }),
    [padTop, extraLeft, extraRight],
  );
  const showStripRail = navOn && side != null;
  const showEdgeRail = navOn && side == null && isOpenCanvas(width, height);

  return (
    <EdgeMarginContext.Provider value={edge}>
      <MainNavContext.Provider value={navCtx}>
        <View
          // The app root re-lays-out whenever the app changes displays
          // (fold/unfold) or rotates — a UI-tree-side trigger for the
          // orientation rule, for handoffs where the Dimensions/AppState
          // events are missed. Idempotent, so repeat fires converge.
          onLayout={() => reassertDisplayOrientationRule()}
          style={[styles.flex, { backgroundColor: colors.surface }]}
        >
          <View
            style={[
              styles.row,
              {
                paddingTop: padTop,
                paddingLeft: insets.left + extraLeft,
                paddingRight: insets.right + extraRight,
              },
            ]}
          >
            <View style={styles.flex}>{children}</View>
            {/* The edge rail takes real layout width beside the content. */}
            {showEdgeRail && <NavigationRail placement="edge" />}
          </View>
          {/* Wide screens have no teal header under the status bar, so its
              text follows the theme (light text on Dark). Phones are unchanged. */}
          {navOn && isWideLayout(width, height) ? <StatusBar style={isDark ? "light" : "dark"} /> : null}
          {/* The strip rail sits inside the strip, which content never uses. */}
          {showStripRail && side && (
            <View
              style={[
                styles.stripRail,
                side === "left"
                  ? { left: 0, width: insets.left }
                  : { right: 0, width: insets.right },
              ]}
            >
              <NavigationRail placement="strip" side={side} />
            </View>
          )}
        </View>
      </MainNavContext.Provider>
    </EdgeMarginContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: "row" },
  stripRail: { position: "absolute", top: 0, bottom: 0, alignItems: "center" },
});
