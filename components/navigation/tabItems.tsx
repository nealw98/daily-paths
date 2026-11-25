import React from "react";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";

// The five main tabs, in rail order, with the same icons as the phone tab bar
// (app/(tabs)/_layout.tsx). `path` is the tab's route; `also` lists routes
// opened on top of that tab, so the rail keeps the tab selected there
// (the Reading is opened from Today).
export type TabItem = {
  path: string;
  label: string;
  also?: string[];
  renderIcon: (color: string, size: number) => React.ReactNode;
};

export const TAB_ITEMS: TabItem[] = [
  {
    path: "/home",
    label: "Today",
    also: ["/reading"],
    renderIcon: (color, size) => <MaterialIcons name="home" size={size} color={color} />,
  },
  {
    path: "/journal",
    label: "Notebook",
    renderIcon: (color, size) => <MaterialIcons name="edit-note" size={size} color={color} />,
  },
  {
    path: "/speakers",
    label: "Speakers",
    renderIcon: (color, size) => (
      <MaterialIcons name="record-voice-over" size={size} color={color} />
    ),
  },
  {
    path: "/prayers",
    label: "Prayers",
    renderIcon: (color, size) => (
      <MaterialCommunityIcons name="hands-pray" size={size} color={color} />
    ),
  },
  {
    path: "/more",
    label: "Settings",
    renderIcon: (color, size) => <MaterialIcons name="settings" size={size} color={color} />,
  },
];

// A journaling hub (/hub/…) belongs to the tab it was opened from: Notebook
// when `from=notebook`, otherwise Today.
export function isTabActive(item: TabItem, pathname: string, from?: string): boolean {
  if (pathname.startsWith("/hub/")) return item.path === (from === "notebook" ? "/journal" : "/home");
  return pathname === item.path || (item.also ?? []).includes(pathname);
}
