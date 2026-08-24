package expo.modules.paidappdetector

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PaidAppDetectorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PaidAppDetector")

    // Android: no paid app download — always return unavailable.
    // Android access is determined by RevenueCat.
    AsyncFunction("getAppTransactionInfo") {
      return@AsyncFunction mapOf(
        "originalAppVersion" to null,
        "originalPurchaseDate" to null,
        "available" to false,
        "verified" to false,
        "reason" to "Android: no paid app"
      )
    }
  }
}
