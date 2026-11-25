import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { JOURNAL_CATEGORIES, type EntryType } from "../../constants/journalCategories";
import { useWideLayout } from "../../hooks/useLayoutMode";
import { useJournalStorage } from "../../hooks/useJournalStorage";
import { HubWide } from "../../components/wide/HubWide";
import { usePaneMemory } from "../../utils/paneMemory";
import { JournalEntryEditor } from "../../components/journal/JournalEntryEditor";

/**
 * A journaling hub: /hub/gratitude, /hub/journal, /hub/spot_check,
 * /hub/nightly_review. Opened from Today and the Reading on wide windows
 * (docs/widescreen-2.9/SPEC.md §4–5), with `?from=notebook` when opened
 * from the Notebook so the rail keeps Notebook selected. If the window
 * narrows while a hub is open (the Duo turned upright), the phone editor
 * takes over, as Today would have opened it.
 */
export default function HubRoute() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const router = useRouter();
  const wide = useWideLayout();
  // Keeps the wide pane (and a half-written entry) across a rotate or fold.
  const paneMemory = usePaneMemory();
  const { createEntry } = useJournalStorage();
  const entryType = (JOURNAL_CATEGORIES.find((c) => c.id === type)?.id ?? "journal") as EntryType;
  const goBack = () => (router.canGoBack() ? router.back() : router.navigate("/home"));

  if (wide) return <HubWide key={entryType} entryType={entryType} memory={paneMemory} />;
  return (
    <JournalEntryEditor
      key={entryType}
      entryType={entryType}
      navigateToNotebookAfterSave
      onSave={async (t, content, structured) => {
        await createEntry(t, content, structured);
      }}
      onCancel={goBack}
    />
  );
}
