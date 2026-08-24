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

/** Builds allowed to expose purchase-testing controls. */
export function isInternalBuild(): boolean {
  return __DEV__ || isPreviewBuild();
}
