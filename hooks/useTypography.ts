import { useMemo } from "react";
import { useSettings, getTextSizeMetrics } from "./useSettings";
import { typography as staticTypography, fonts } from "../constants/theme";

/**
 * Hook to access the unified typography system.
 * Combines static styles (H1/H2/H3) with dynamic, user-scaled body styles.
 */
export function useTypography() {
  const { settings } = useSettings();
  
  const dynamicMetrics = useMemo(
    () => getTextSizeMetrics(settings.textSize),
    [settings.textSize]
  );

  const typography = useMemo(() => {
    return {
      // Static Styles (System Scaling only)
      h1: staticTypography.h1,
      h2: staticTypography.h2,
      h3: staticTypography.h3,

      // Dynamic Styles (In-App + System Scaling)
      bodyLarge: {
        ...staticTypography.bodyLarge,
        fontSize: dynamicMetrics.bodyLargeFontSize,
        lineHeight: dynamicMetrics.bodyLargeLineHeight,
      },
      quoteBox: {
        ...staticTypography.quoteBox,
        fontSize: dynamicMetrics.bodyLargeFontSize,
        lineHeight: Math.round(dynamicMetrics.bodyLargeFontSize * 1.35),
      },
      body: {
        ...staticTypography.body,
        fontSize: dynamicMetrics.bodyFontSize,
        lineHeight: dynamicMetrics.bodyLineHeight,
      },
      bodySmall: {
        ...staticTypography.bodySmall,
        fontSize: dynamicMetrics.bodySmallFontSize,
        lineHeight: dynamicMetrics.bodySmallLineHeight,
      },
      label: {
        ...staticTypography.label,
        fontSize: dynamicMetrics.labelFontSize,
        lineHeight: dynamicMetrics.labelLineHeight,
      },
      caption: {
        ...staticTypography.caption,
        fontSize: dynamicMetrics.captionFontSize,
        lineHeight: dynamicMetrics.captionLineHeight,
      },
      // Legacy metrics kept for staged migration.
      h3FontSize: staticTypography.h3.fontSize,
      h3LineHeight: staticTypography.h3.lineHeight,
      bodyLargeFontSize: dynamicMetrics.bodyLargeFontSize,
      bodyLargeLineHeight: dynamicMetrics.bodyLargeLineHeight,
      bodyFontSize: dynamicMetrics.bodyFontSize,
      bodyLineHeight: dynamicMetrics.bodyLineHeight,
      bodySmallFontSize: dynamicMetrics.bodySmallFontSize,
      bodySmallLineHeight: dynamicMetrics.bodySmallLineHeight,
      labelFontSize: dynamicMetrics.labelFontSize,
      labelLineHeight: dynamicMetrics.labelLineHeight,
      captionFontSize: dynamicMetrics.captionFontSize,
      captionLineHeight: dynamicMetrics.captionLineHeight,
    };
  }, [dynamicMetrics]);

  return {
    typography,
    fonts,
    textSize: settings.textSize,
  };
}
