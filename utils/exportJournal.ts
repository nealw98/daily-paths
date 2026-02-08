import RNHTMLtoPDF from "react-native-html-to-pdf";
import * as Sharing from "expo-sharing";
import { qaLog } from "./qaLog";
import type { JournalEntry } from "../hooks/useJournalEntries";

/**
 * Journal PDF export utility.
 * Generates a styled PDF from journal entries and shares it.
 */

export interface ExportOptions {
  includeTimestamps: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Filter entries by date range if specified.
 */
function filterEntries(
  entries: JournalEntry[],
  options: ExportOptions
): JournalEntry[] {
  if (!options.dateRange) return entries;

  const { start, end } = options.dateRange;
  return entries.filter((entry) => {
    const entryDate = new Date(entry.created_at);
    return entryDate >= start && entryDate <= end;
  });
}

/**
 * Generate HTML content from journal entries.
 */
function generateHTML(
  entries: JournalEntry[],
  options: ExportOptions
): string {
  const entryHTML = entries
    .map((entry) => {
      const date = new Date(entry.created_at);
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = options.includeTimestamps
        ? date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        : "";

      const contentParagraphs = (entry.content ?? "")
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join("");

      return `
        <div class="entry">
          <div class="entry-date">${escapeHtml(dateStr)}${timeStr ? ` &middot; ${escapeHtml(timeStr)}` : ""}</div>
          <div class="entry-content">${contentParagraphs}</div>
        </div>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital@0;1&family=Inter:wght@300;400&display=swap');

        body {
          font-family: 'Lora', Georgia, serif;
          color: #2D3E3F;
          padding: 40px;
          line-height: 1.6;
          max-width: 700px;
          margin: 0 auto;
        }

        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #2C5F5D;
        }

        .header h1 {
          font-size: 28px;
          color: #2C5F5D;
          margin-bottom: 8px;
        }

        .header .subtitle {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: #4A8B8D;
        }

        .entry {
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 1px solid #B8D8D8;
        }

        .entry:last-child {
          border-bottom: none;
        }

        .entry-date {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #2C5F5D;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .entry-content p {
          font-size: 15px;
          line-height: 1.8;
          margin: 0 0 12px 0;
        }

        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #B8D8D8;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: #4A8B8D;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>My Journal</h1>
        <div class="subtitle">Daily Paths &middot; ${entries.length} ${entries.length === 1 ? "entry" : "entries"}</div>
      </div>
      ${entryHTML}
      <div class="footer">
        Exported from Daily Paths
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Export journal entries as a PDF file and open the share sheet.
 */
export async function exportJournalToPDF(
  entries: JournalEntry[],
  options: ExportOptions = { includeTimestamps: true }
): Promise<boolean> {
  try {
    const filtered = filterEntries(entries, options);

    if (filtered.length === 0) {
      qaLog("export", "No entries to export");
      return false;
    }

    qaLog("export", "Generating PDF", { entryCount: filtered.length });

    const html = generateHTML(filtered, options);

    const result = await RNHTMLtoPDF.convert({
      html,
      fileName: `DailyPaths_Journal_${new Date().toISOString().split("T")[0]}`,
      directory: "Documents",
    });

    if (!result.filePath) {
      qaLog("export", "PDF generation failed - no file path");
      return false;
    }

    qaLog("export", "PDF generated", { filePath: result.filePath });

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      qaLog("export", "Sharing not available on this device");
      return false;
    }

    await Sharing.shareAsync(result.filePath, {
      mimeType: "application/pdf",
      dialogTitle: "Share Journal Export",
    });

    qaLog("export", "PDF shared successfully");
    return true;
  } catch (err) {
    qaLog("export", "Export error", { error: String(err) });
    return false;
  }
}
