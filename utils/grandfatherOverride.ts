import AsyncStorage from "@react-native-async-storage/async-storage";

import { isInternalBuild } from "./buildProfile";
import { qaLog } from "./qaLog";

const KEY = "@daily_paths_ignore_grandfather_for_testing";

/** Preview-only override. Production builds always run the real grandfather check. */
export async function getGrandfatherOverride(): Promise<boolean> {
  if (!isInternalBuild()) return false;
  return (await AsyncStorage.getItem(KEY)) === "true";
}

export async function setGrandfatherOverride(ignore: boolean): Promise<void> {
  if (!isInternalBuild()) return;
  if (ignore) await AsyncStorage.setItem(KEY, "true");
  else await AsyncStorage.removeItem(KEY);
  qaLog("grandfather-override", ignore ? "Grandfathering ignored for testing" : "Grandfathering restored");
}
