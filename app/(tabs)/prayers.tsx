import React, { useState, useEffect } from "react";
import { useNavigation } from "expo-router";
import { PrayersScreen } from "../../components/prayers/PrayersScreen";
import { useFeatureTimeTracker } from "../../hooks/useFeatureTimeTracker";

export default function PrayersTab() {
  const navigation = useNavigation();

  const [tabFocused, setTabFocused] = useState(false);
  useEffect(() => {
    const unFocus = navigation.addListener("focus" as any, () => {
      setTabFocused(true);
    });
    const unBlur = navigation.addListener("blur" as any, () => {
      setTabFocused(false);
    });
    return () => { unFocus(); unBlur(); };
  }, [navigation]);

  // Track cumulative time in the prayers tab for rate prompt
  useFeatureTimeTracker("prayer", tabFocused);

  return <PrayersScreen />;
}
