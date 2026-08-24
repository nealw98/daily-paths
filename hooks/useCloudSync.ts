import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { syncWithCloud } from "../lib/cloudSync";
import { subscribeToUserDataChanges } from "../lib/syncEvents";

// Speaker position is saved every few seconds during playback. Ten seconds
// means ordinary edits sync promptly while continuous playback coalesces into
// one sync after pausing; leaving the app still forces an immediate sync.
const CHANGE_DEBOUNCE_MS = 10_000;

async function reloadForRemoteChanges(): Promise<boolean> {
  try {
    const Updates = await import("expo-updates");
    await Updates.reloadAsync();
    return true;
  } catch {
    // Development clients reflect merged storage on their next cold start.
    return false;
  }
}

export function useCloudSync() {
  const started = useRef(false);
  const prevState = useRef<AppStateStatus>(AppState.currentState);
  const reloadStarted = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let changeTimer: ReturnType<typeof setTimeout> | null = null;

    const syncAndRefresh = async () => {
      const result = await syncWithCloud();
      if (result.localChanged && !reloadStarted.current) {
        reloadStarted.current = true;
        const reloaded = await reloadForRemoteChanges();
        if (!reloaded) reloadStarted.current = false;
      }
    };

    // Restore on reinstall and merge changes made by another device.
    void syncAndRefresh();

    const unsubscribeChanges = subscribeToUserDataChanges(() => {
      if (changeTimer) clearTimeout(changeTimer);
      changeTimer = setTimeout(() => {
        changeTimer = null;
        void syncAndRefresh();
      }, CHANGE_DEBOUNCE_MS);
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      const previous = prevState.current;
      prevState.current = state;

      // Only one sync when leaving active, rather than separate inactive and
      // background writes. The shared queue also prevents lifecycle races.
      if (previous === "active" && state !== "active") {
        if (changeTimer) {
          clearTimeout(changeTimer);
          changeTimer = null;
        }
        void syncWithCloud();
      } else if (state === "active" && previous !== "active") {
        void syncAndRefresh();
      }
    });

    return () => {
      if (changeTimer) clearTimeout(changeTimer);
      unsubscribeChanges();
      appStateSubscription.remove();
    };
  }, []);
}

export function CloudSyncGate() {
  useCloudSync();
  return null;
}
