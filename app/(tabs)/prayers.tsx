import React, { useState, useEffect } from "react";
import { useNavigation } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { PrayersScreen } from "../../components/prayers/PrayersScreen";
import { PremiumGate } from "../../components/PremiumGate";
import { useFeatureTimeTracker } from "../../hooks/useFeatureTimeTracker";

export default function PrayersTab() {
  return (
    <PremiumGate>
      <PrayersTabContent />
    </PremiumGate>
  );
}

function PrayersTabContent() {
  const { user } = useAuth();
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

  return <PrayersScreen userId={user?.id || null} />;
}
