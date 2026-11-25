import type { JournalEntry } from "../hooks/useJournalStorage";
import { getCategoryById, type EntryType } from "../constants/journalCategories";
import { parseGratitudeItems } from "./journalShare";

/**
 * A journaling draft in the shape each editor type works with. Saved with
 * the same content/structured_content the phone editor
 * (components/journal/JournalEntryEditor.tsx, saveEntry) writes, so the
 * Notebook, search, share and backup treat both alike.
 */
export type JournalDraft = {
  text: string;
  items: string[];
  responses: Record<string, string>;
};

export function emptyDraft(type: EntryType): JournalDraft {
  return { text: "", items: type === "gratitude" ? ["", "", ""] : [], responses: {} };
}

export function draftFromEntry(entry: JournalEntry): JournalDraft {
  const type = entry.entry_type;
  const editor = getCategoryById(type)?.editorType ?? "text";
  if (editor === "items") {
    const items = Array.isArray(entry.structured_content?.items)
      ? (entry.structured_content!.items as string[])
      : parseGratitudeItems(entry.content);
    return { text: "", items: items.length ? items : [""], responses: {} };
  }
  if (editor === "guided") {
    const responses: Record<string, string> = {};
    for (const [k, v] of Object.entries(entry.structured_content ?? {})) {
      if (typeof v === "string") responses[k] = v;
    }
    return { text: "", items: [], responses };
  }
  return { text: entry.content ?? "", items: [], responses: {} };
}

export function draftHasContent(type: EntryType, d: JournalDraft): boolean {
  const editor = getCategoryById(type)?.editorType ?? "text";
  if (editor === "items") return d.items.some((i) => i.trim());
  if (editor === "guided") return Object.values(d.responses).some((v) => v.trim());
  return !!d.text.trim();
}

/** content + structured_content, as the phone editor saves them. */
export function draftPayload(
  type: EntryType,
  d: JournalDraft,
): { content: string; structured: Record<string, any> | null } {
  const editor = getCategoryById(type)?.editorType ?? "text";
  if (editor === "items") {
    const items = d.items.map((i) => i.trim()).filter(Boolean);
    return { content: items.join(" • "), structured: { items } };
  }
  if (editor === "guided") {
    const filled: Record<string, string> = {};
    for (const [k, v] of Object.entries(d.responses)) if (v.trim()) filled[k] = v.trim();
    return { content: Object.values(filled).join("\n\n"), structured: filled };
  }
  return { content: d.text.trim(), structured: null };
}

/** One-line preview for a past-entry row. */
export function entryPreview(entry: JournalEntry): string {
  const d = draftFromEntry(entry);
  const editor = getCategoryById(entry.entry_type)?.editorType ?? "text";
  if (editor === "items") return d.items.filter(Boolean).join(" · ");
  if (editor === "guided") {
    const order = getCategoryById(entry.entry_type)?.guidedPrompts?.map((p) => p.id) ?? [];
    return order.map((id) => d.responses[id]).filter(Boolean).join(" · ");
  }
  return d.text.replace(/\s+/g, " ").trim();
}
