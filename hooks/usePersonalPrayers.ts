import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@daily_paths_personal_prayers_v1";

export interface PersonalPrayer {
  id: string;
  title: string;
  text: string;
  createdAt: string;
}

function localId(): string {
  return `prayer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readAll(): Promise<PersonalPrayer[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeAll(prayers: PersonalPrayer[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prayers));
}

export function usePersonalPrayers() {
  const [prayers, setPrayers] = useState<PersonalPrayer[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    readAll().then((data) => {
      if (mounted.current) {
        setPrayers(data);
        setLoading(false);
      }
    });
    return () => { mounted.current = false; };
  }, []);

  const addPrayer = useCallback(async (title: string, text: string) => {
    const prayer: PersonalPrayer = {
      id: localId(),
      title: title.trim(),
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...(await readAll()), prayer];
    await writeAll(updated);
    if (mounted.current) setPrayers(updated);
    return prayer;
  }, []);

  const updatePrayer = useCallback(async (id: string, title: string, text: string) => {
    const all = await readAll();
    const updated = all.map((p) =>
      p.id === id ? { ...p, title: title.trim(), text: text.trim() } : p
    );
    await writeAll(updated);
    if (mounted.current) setPrayers(updated);
  }, []);

  const deletePrayer = useCallback(async (id: string) => {
    const all = await readAll();
    const updated = all.filter((p) => p.id !== id);
    await writeAll(updated);
    if (mounted.current) setPrayers(updated);
  }, []);

  return { prayers, loading, addPrayer, updatePrayer, deletePrayer };
}
