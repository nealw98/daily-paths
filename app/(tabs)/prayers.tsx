import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { PrayersScreen } from "../../components/prayers/PrayersScreen";

export default function PrayersTab() {
  const { user } = useAuth();
  return <PrayersScreen userId={user?.id || null} />;
}
