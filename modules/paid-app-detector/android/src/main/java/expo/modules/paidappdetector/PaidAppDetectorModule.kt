package expo.modules.paidappdetector

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PaidAppDetectorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PaidAppDetector")

    // Android: no paid app download — always return unavailable.
    // All Android users go through trial/subscription.
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
