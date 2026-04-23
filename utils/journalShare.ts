import type { JournalEntry } from "../hooks/useJournalStorage";
import {
  getCategoryById,
  type EntryType,
} from "../constants/journalCategories";

/** Parse markdown list content back into an array of items. */
export function parseGratitudeItems(content: string | null): string[] {
  if (!content) return [];
  return content
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

/** Plain-text body for Share / copy (matches notebook entry detail share). */
export function buildJournalEntryShareMessage(entry: JournalEntry): string {
  const entryType = (entry.entry_type || "journal") as EntryType;
  const catConfig = getCategoryById(entryType);
  const editorType = catConfig?.editorType ?? "text";

  const lines: string[] = [];

  if (editorType === "text") {
    const content = entry.content?.trim();
    if (content) {
      lines.push("My thoughts:");
      lines.push(content);
    }
  } else if (editorType === "items") {
    const items = entry.structured_content?.items
      ? (entry.structured_content.items as string[])
      : parseGratitudeItems(entry.content);
    const cleanItems = items.filter(Boolean);
    if (cleanItems.length > 0) {
      lines.push("Today I'm grateful for:");
      cleanItems.forEach((item) => lines.push(`• ${item}`));
    }
  } else if (editorType === "guided") {
    const prompts = catConfig?.guidedPrompts ?? [];
    const responses = entry.structured_content ?? {};
    prompts.forEach((prompt) => {
      const value = responses[prompt.id];
      if (value && typeof value === "string" && value.trim()) {
        lines.push(prompt.question);
        lines.push(value.trim());
        lines.push("");
      }
    });
  }

  lines.push("");
  lines.push("-----");
  lines.push("Shared from Daily Paths");
  return lines.join("\n");
}
