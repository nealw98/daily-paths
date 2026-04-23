import { requireOptionalNativeModule } from "expo-modules-core";

export interface AppTransactionInfo {
  originalAppVersion: string | null;
  originalPurchaseDate: string | null;
  available: boolean;
  verified: boolean;
  reason: string | null;
  error?: boolean;
}

const PaidAppDetector = requireOptionalNativeModule("PaidAppDetector");

export async function getAppTransactionInfo(): Promise<AppTransactionInfo> {
  if (!PaidAppDetector) {
    return {
      originalAppVersion: null,
      originalPurchaseDate: null,
      available: false,
      verified: false,
      reason: "Native module not available",
    };
  }
  return PaidAppDetector.getAppTransactionInfo();
}
