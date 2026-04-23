import ExpoModulesCore
import StoreKit

public class PaidAppDetectorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PaidAppDetector")

    AsyncFunction("getAppTransactionInfo") { () -> [String: Any?] in
      guard #available(iOS 16.0, *) else {
        return [
          "originalAppVersion": nil,
          "originalPurchaseDate": nil,
          "available": false,
          "verified": false,
          "reason": "iOS < 16",
        ]
      }

      do {
        let result = try await AppTransaction.shared
        switch result {
        case .verified(let transaction):
          let formatter = ISO8601DateFormatter()
          return [
            "originalAppVersion": transaction.originalAppVersion,
            "originalPurchaseDate": formatter.string(from: transaction.originalPurchaseDate),
            "available": true,
            "verified": true,
            "reason": nil,
          ]
        case .unverified(_, let error):
          return [
            "originalAppVersion": nil,
            "originalPurchaseDate": nil,
            "available": true,
            "verified": false,
            "reason": "unverified: \(error.localizedDescription)",
          ]
        }
      } catch {
        // AppTransaction.shared threw — likely a transient OS issue.
        // Treat as lifetime access (paid) since legitimate users shouldn't
        // lose access due to a system error.
        return [
          "originalAppVersion": nil,
          "originalPurchaseDate": nil,
          "available": true,
          "verified": false,
          "reason": "error: \(error.localizedDescription)",
          "error": true,
        ]
      }
    }
  }
}
