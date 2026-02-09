import React from "react";
import { Feather, Seedling, SoftExhale, MoonOnWater } from "../components/icons";
import type { SvgIconName } from "../constants/journalCategories";

/**
 * Returns the SVG icon component for a given entry-type icon name.
 * Use this anywhere you previously rendered an emoji for an entry type.
 */
export function EntryTypeIcon({
  svgIcon,
  size = 16,
  color = "#2C5F5D",
  strokeWidth,
}: {
  svgIcon: SvgIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  switch (svgIcon) {
    case "feather":
      return <Feather size={size} color={color} strokeWidth={strokeWidth} />;
    case "seedling":
      return <Seedling size={size} color={color} strokeWidth={strokeWidth} />;
    case "softExhale":
      return <SoftExhale size={size} color={color} strokeWidth={strokeWidth} />;
    case "moonOnWater":
      return <MoonOnWater size={size} color={color} strokeWidth={strokeWidth} />;
    default:
      return <Feather size={size} color={color} strokeWidth={strokeWidth} />;
  }
}
