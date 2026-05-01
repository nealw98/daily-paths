import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  hasSeenNotificationCoachmark,
  markNotificationCoachmarkSeen,
} from "../utils/coachmarkStorage";
import { useAnalytics } from "../utils/analytics";
import type { CoachmarkAnchor } from "../components/NotificationCoachmark";

const BOTTOM_THRESHOLD_PX = 50;

interface UseNotificationCoachmarkArgs {
  /** Current value of settings.dailyReminderEnabled. */
  enabled: boolean;
}

interface ScrollProps {
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange: (w: number, h: number) => void;
  onLayout: (e: LayoutChangeEvent) => void;
  onToggleLayout: (e: LayoutChangeEvent) => void;
}

interface UseNotificationCoachmarkResult {
  visible: boolean;
  anchor: CoachmarkAnchor | null;
  onDismiss: (reason: "got_it") => void;
  registerToggleRef: (ref: View | null) => void;
  scrollProps: ScrollProps;
}

export function useNotificationCoachmark(
  args: UseNotificationCoachmarkArgs
): UseNotificationCoachmarkResult {
  const { enabled } = args;
  const {
    trackNotificationCoachmarkShown,
    trackNotificationCoachmarkDismissed,
    trackNotificationToggleChanged,
  } = useAnalytics();

  const [seen, setSeen] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<CoachmarkAnchor | null>(null);

  const toggleViewRef = useRef<View | null>(null);
  const atBottomRef = useRef(false);
  const contentSizeRef = useRef({ height: 0 });
  const layoutSizeRef = useRef({ height: 0 });
  const visibleRef = useRef(false);
  const wasVisibleAtToggleRef = useRef(false);
  const prevEnabledRef = useRef(enabled);
  const seenRef = useRef<boolean | null>(null);
  const enabledRef = useRef(enabled);

  // Keep refs in sync.
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);
  useEffect(() => {
    seenRef.current = seen;
  }, [seen]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Load (and re-load) the seen flag whenever the screen gains focus. This
  // covers the QA "Reset Notification Coachmark" path: after the flag is
  // cleared in QA Logs, navigating back to the reading screen re-reads it,
  // flipping `seen` back to false so the show condition can fire again.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const value = await hasSeenNotificationCoachmark();
        if (!cancelled) setSeen(value);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const measureToggle = useCallback(() => {
    const node = toggleViewRef.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      if (
        typeof x === "number" &&
        typeof y === "number" &&
        width > 0 &&
        height > 0
      ) {
        setAnchor({ x, y, width, height });
      }
    });
  }, []);

  const tryShow = useCallback(() => {
    if (visibleRef.current) return;
    if (seenRef.current !== false) return;
    if (enabledRef.current) return;
    measureToggle();
    setVisible(true);
    visibleRef.current = true;
    wasVisibleAtToggleRef.current = true;
    void markNotificationCoachmarkSeen();
    setSeen(true);
    trackNotificationCoachmarkShown();
  }, [measureToggle, trackNotificationCoachmarkShown]);

  // If content fits without scrolling, treat as "at bottom" and show.
  const evaluateAtBottomFromSizes = useCallback(() => {
    const contentH = contentSizeRef.current.height;
    const layoutH = layoutSizeRef.current.height;
    if (contentH === 0 || layoutH === 0) return;
    if (contentH <= layoutH) {
      if (!atBottomRef.current) {
        atBottomRef.current = true;
        tryShow();
      }
    }
  }, [tryShow]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (visibleRef.current) return; // scroll does NOT dismiss once visible
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceToBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      atBottomRef.current = distanceToBottom <= BOTTOM_THRESHOLD_PX;
      // Don't show during the in-flight scroll: the row's window y is
      // still moving as the user drags / inertia plays out, so measuring
      // here would lock the ring at a stale position. Wait for the scroll
      // to settle (onScrollEndDrag / onMomentumScrollEnd) before showing.
    },
    []
  );

  const showIfSettledAtBottom = useCallback(() => {
    if (visibleRef.current) return;
    if (seenRef.current !== false) return;
    if (enabledRef.current) return;
    if (!atBottomRef.current) return;
    tryShow();
  }, [tryShow]);

  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (visibleRef.current) return;
      const { contentOffset, contentSize, layoutMeasurement, velocity } =
        e.nativeEvent;
      const distanceToBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      atBottomRef.current = distanceToBottom <= BOTTOM_THRESHOLD_PX;
      // If there's no momentum, this is the final stop. If there IS
      // momentum, onMomentumScrollEnd will follow and handle it.
      const hasMomentum = velocity ? Math.abs(velocity.y ?? 0) > 0.05 : false;
      if (!hasMomentum) showIfSettledAtBottom();
    },
    [showIfSettledAtBottom]
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (visibleRef.current) return;
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceToBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      atBottomRef.current = distanceToBottom <= BOTTOM_THRESHOLD_PX;
      showIfSettledAtBottom();
    },
    [showIfSettledAtBottom]
  );

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      contentSizeRef.current.height = h;
      evaluateAtBottomFromSizes();
    },
    [evaluateAtBottomFromSizes]
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      layoutSizeRef.current.height = e.nativeEvent.layout.height;
      evaluateAtBottomFromSizes();
    },
    [evaluateAtBottomFromSizes]
  );

  const onToggleLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      // Re-measure absolute window position after layout settles.
      measureToggle();
    },
    [measureToggle]
  );

  const registerToggleRef = useCallback((ref: View | null) => {
    toggleViewRef.current = ref;
  }, []);

  const onDismiss = useCallback(
    (reason: "got_it") => {
      trackNotificationCoachmarkDismissed(reason);
      wasVisibleAtToggleRef.current = false;
      setVisible(false);
      visibleRef.current = false;
    },
    [trackNotificationCoachmarkDismissed]
  );

  // Toggle attribution: when settings.dailyReminderEnabled changes, fire the
  // notification_toggle_changed event. If the coachmark was visible at the
  // moment the value flipped, attribute as "coachmark" and dismiss with
  // toggle_tap. Otherwise attribute as "settings".
  useEffect(() => {
    if (prevEnabledRef.current === enabled) return;
    prevEnabledRef.current = enabled;
    const source = wasVisibleAtToggleRef.current ? "coachmark" : "settings";
    trackNotificationToggleChanged(enabled, source);
    if (wasVisibleAtToggleRef.current) {
      trackNotificationCoachmarkDismissed("toggle_tap");
      wasVisibleAtToggleRef.current = false;
      setVisible(false);
      visibleRef.current = false;
    }
  }, [
    enabled,
    trackNotificationToggleChanged,
    trackNotificationCoachmarkDismissed,
  ]);

  // Re-show when prerequisites become true again. This handles the QA reset
  // case: the user is already at the bottom (atBottomRef stays true), but
  // `seen` flips false on focus and no scroll event fires to trigger tryShow.
  // Without this effect, the coachmark never reappears until the user scrolls
  // away and back.
  useEffect(() => {
    if (
      seen === false &&
      !enabled &&
      atBottomRef.current &&
      !visibleRef.current
    ) {
      tryShow();
    }
  }, [seen, enabled, tryShow]);

  return {
    visible,
    anchor,
    onDismiss,
    registerToggleRef,
    scrollProps: {
      onScroll,
      onScrollEndDrag,
      onMomentumScrollEnd,
      onContentSizeChange,
      onLayout,
      onToggleLayout,
    },
  };
}
