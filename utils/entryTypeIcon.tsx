import React from "react";
import { Ionicons } from "@expo/vector-icons";
import type { SvgIconName } from "../constants/journalCategories";

const ICON_MAP: Record<SvgIconName, keyof typeof Ionicons.glyphMap> = {
  feather: "document-text-outline",
  seedling: "leaf-outline",
  softExhale: "pulse-outline",
  moonOnWater: "moon-outline",
};

/**
 * Returns the Ionicon for a given entry-type icon name.
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
  const iconName = ICON_MAP[svgIcon] || "document-text-outline";
  return <Ionicons name={iconName} size={size} color={color} />;
}
