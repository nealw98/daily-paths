import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { PrayersScreen } from "../../components/prayers/PrayersScreen";
import { PremiumGate } from "../../components/PremiumGate";

export default function PrayersTab() {
  return (
    <PremiumGate>
      <PrayersTabContent />
    </PremiumGate>
  );
}

function PrayersTabContent() {
  const { user } = useAuth();
  return <PrayersScreen userId={user?.id || null} />;
}
