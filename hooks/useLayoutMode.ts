// Layout modes for the wide layout (iPad and the open iPhone Duo).
// One source of truth: classes derived from the LIVE window size — never
// device names, Platform.isPad, or orientation. Thresholds and helpers are
// the ones Hands Off and Sober Dailies shipped (Duo Adaptation Playbook);
// keep them in step with those apps.
//
// Measured canvases (pt):
//   iPhone 17 402 · Duo cover 466 · Duo inner portrait 669 ·
//   iPad 11" portrait 820 · Duo inner landscape ~951 · iPad 11" landscape 1180.
// compact keeps the phone UI untouched; medium has room for a second pane;
// expanded fits rail | list | detail.
import { useWindowDimensions } from "react-native";

export type LayoutMode = "compact" | "medium" | "expanded";

export const MEDIUM_MIN_WIDTH = 600;
export const EXPANDED_MIN_WIDTH = 900;

// Pure helper so nested layouts can classify a CONTAINER width — a pane can
// be compact inside an expanded window.
export function layoutModeForWidth(width: number): LayoutMode {
  if (width >= EXPANDED_MIN_WIDTH) return "expanded";
  if (width >= MEDIUM_MIN_WIDTH) return "medium";
  return "compact";
}

export function useLayoutMode(): LayoutMode {
  const { width } = useWindowDimensions();
  return layoutModeForWidth(width);
}

// Open canvas: big in BOTH directions — the Duo's inner display in either
// orientation, or an iPad (full screen or a roomy Split View window). The
// phone, the Duo cover and narrow iPad windows never qualify.
export function isOpenCanvas(width: number, height: number): boolean {
  return width >= MEDIUM_MIN_WIDTH && height >= MEDIUM_MIN_WIDTH;
}

export function useOpenLayout(): boolean {
  const { width, height } = useWindowDimensions();
  return isOpenCanvas(width, height);
}

// The two-pane wide layout (docs/widescreen-2.9/SPEC.md): an open canvas
// that is also expanded-width — the open Duo held sideways, or an iPad in
// landscape. The open Duo upright (669pt) and an upright 11" iPad (820pt)
// keep the phone screens beside the rail, as Hands Off does: half of those
// widths is too narrow for either pane.
export function isWideLayout(width: number, height: number): boolean {
  return isOpenCanvas(width, height) && width >= EXPANDED_MIN_WIDTH;
}

export function useWideLayout(): boolean {
  const { width, height } = useWindowDimensions();
  return isWideLayout(width, height);
}
