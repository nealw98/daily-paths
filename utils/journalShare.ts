import type { JournalEntry } from "../hooks/useJournalStorage";
import {
  getCategoryById,
  getCategoryLabel,
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
  const catLabel = getCategoryLabel(entryType);
  const editorType = catConfig?.editorType ?? "text";

  const entryDate = new Date(entry.created_at);
  const dayOfWeek = entryDate.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = entryDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const lines: string[] = [];
  lines.push(`${dayOfWeek}, ${monthDay}`);
  lines.push("");
  lines.push(catLabel.toUpperCase());
  lines.push("");

  if (editorType === "text") {
    if (entry.content) lines.push(entry.content.trim());
  } else if (editorType === "items") {
    const items = entry.structured_content?.items
      ? (entry.structured_content.items as string[])
      : parseGratitudeItems(entry.content);
    items.filter(Boolean).forEach((item) => lines.push(`• ${item}`));
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
