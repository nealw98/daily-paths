import * as Updates from "expo-updates";

/**
 * True only for an EAS preview build. Preview-only controls must not rely on
 * __DEV__ or a stored developer-device flag because either can be present in
 * builds that are not intended to expose purchase bypasses.
 */
export function isPreviewBuild(): boolean {
  return (
    process.env.EXPO_PUBLIC_BUILD_PROFILE === "preview" ||
    Updates.channel === "preview"
  );
}

/**
 * Builds allowed to expose purchase-testing controls.
 *
 * The explicit environment flag is intended for a runtime-scoped OTA sent to
 * an internal-test production binary. Never set it for a public release OTA.
 */
export function isInternalBuild(): boolean {
  return (
    __DEV__ ||
    isPreviewBuild() ||
    process.env.EXPO_PUBLIC_ENABLE_INTERNAL_CONTROLS === "true"
  );
}
