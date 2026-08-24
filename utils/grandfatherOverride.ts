import AsyncStorage from "@react-native-async-storage/async-storage";

import { isDeveloperDevice } from "./deviceIdentity";
import { qaLog } from "./qaLog";

const KEY = "@daily_paths_ignore_grandfather_for_testing";

/** Developer-device override. It can only suppress a grant, never create one. */
export async function getGrandfatherOverride(): Promise<boolean> {
  if (!(await isDeveloperDevice())) return false;
  return (await AsyncStorage.getItem(KEY)) === "true";
}

export async function setGrandfatherOverride(ignore: boolean): Promise<void> {
  if (!(await isDeveloperDevice())) return;
  if (ignore) await AsyncStorage.setItem(KEY, "true");
  else await AsyncStorage.removeItem(KEY);
  qaLog("grandfather-override", ignore ? "Grandfathering ignored for testing" : "Grandfathering restored");
}
