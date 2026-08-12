// Drives cloud backup at the app level: on launch AND on return-to-foreground,
// pull from the cloud (iCloud on iOS, Google Drive on Android) and restore +
// reload if the cloud copy is newer — that covers restore-on-reinstall, moving
// to a new device, and picking up a snapshot another device pushed. When the app
// goes to the background, push this device's state up.
//
// On Android everything silently no-ops until the user connects a Google
// account from the Backup screen. On iOS it works as soon as the user is signed
// in to iCloud, with no prompt.
//
// Mount <CloudSyncGate /> once at the app root.
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { pullFromCloud, pushToCloud } from "../lib/cloudSync";

export function useCloudSync() {
  const started = useRef(false);
  const prevState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Pull, and if the cloud copy was genuinely newer, reload so every hook
    // (they all read AsyncStorage on mount) picks up the restored data. The
    // newer-than-local check lives in pullFromCloud, so this is safe to call
    // often — it no-ops when there's nothing new.
    const pullAndReload = async () => {
      const restored = await pullFromCloud();
      if (restored) {
        try {
          const Updates = await import("expo-updates");
          await Updates.reloadAsync();
        } catch {
          /* dev client / no updates module — the next cold start reflects it */
        }
      }
    };

    // Cold-start pull: restore-on-reinstall / new device.
    pullAndReload();

    const sub = AppState.addEventListener("change", (state) => {
      const prev = prevState.current;
      prevState.current = state;
      if (state === "background" || state === "inactive") {
        pushToCloud();
      } else if (state === "active" && (prev === "background" || prev === "inactive")) {
        // Returning to the foreground: refresh if another device pushed a newer
        // snapshot while we were away. No-ops when nothing changed.
        pullAndReload();
      }
    });
    return () => sub.remove();
  }, []);
}

export function CloudSyncGate() {
  useCloudSync();
  return null;
}
