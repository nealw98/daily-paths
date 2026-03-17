import { requireNativeModule } from "expo-modules-core";

export interface AppTransactionInfo {
  originalAppVersion: string | null;
  originalPurchaseDate: string | null;
  available: boolean;
  verified: boolean;
  reason: string | null;
  error?: boolean;
}

const PaidAppDetector = requireNativeModule("PaidAppDetector");

export async function getAppTransactionInfo(): Promise<AppTransactionInfo> {
  return PaidAppDetector.getAppTransactionInfo();
}
