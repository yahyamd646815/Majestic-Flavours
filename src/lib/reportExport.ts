import { EncodingType, File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";

import { getCategoryName, getUnitLabel } from "@/lib/inventoryLabels";
import { formatReportDate, formatSnapshotTime, getTodayIsoDate } from "@/lib/reports";
import type { SyncedUser } from "@/store/appUsersStore";
import type { Category, InventoryItem, Report, Unit } from "@/types/inventory";

/**
 * One exported line: a single item touched inside a single report. A report
 * that touched five items produces five rows — AGENTS.md → Report Rules
 * requires every item listed individually, never summarized.
 */
export type ReportExportRow = {
  date: string;
  reporterName: string;
  dayContent: string;
  itemName: string;
  categoryName: string;
  unitLabel: string;
  quantityHistory: string;
  itemNote: string;
};

/** Everything both export formats need. `filterSummary` is display-only. */
export type ReportExportInput = {
  reports: Report[];
  items: InventoryItem[];
  categories: Category[];
  units: Unit[];
  appUsers: SyncedUser[];
  /** Plain-text description of the active filters, e.g. "Today · All reporters · Meat". */
  filterSummary: string;
};

const PDF_FILE_NAME = "majestic-flavours-reports.pdf";
const XLSX_FILE_NAME = "majestic-flavours-reports.xlsx";

/**
 * Flattens reports into one row per item touched. Both PDF and XLSX are built
 * from this, so the two files can never drift apart.
 *
 * A report with no items at all still produces one row, so a written-report-only
 * day does not silently vanish from the exported record.
 */
export function buildReportExportRows(
  reports: Report[],
  items: InventoryItem[],
  categories: Category[],
  units: Unit[],
  appUsers: SyncedUser[],
): ReportExportRow[] {
  const rows: ReportExportRow[] = [];

  for (const report of reports) {
    const reporterName =
      appUsers.find((user) => user.clerkUserId === report.reporterId)?.name ??
      "Unknown reporter";
    const date = formatReportDate(report.date);

    if (report.itemEntries.length === 0) {
      rows.push({
        date,
        reporterName,
        dayContent: report.content,
        itemName: "",
        categoryName: "",
        unitLabel: "",
        quantityHistory: "",
        itemNote: "",
      });
      continue;
    }

    for (const entry of report.itemEntries) {
      const item = items.find((candidate) => candidate.id === entry.itemId);
      rows.push({
        date,
        reporterName,
        dayContent: report.content,
        itemName: item?.name ?? "Deleted item",
        categoryName: item ? getCategoryName(categories, item.categoryId) : "",
        unitLabel: item ? getUnitLabel(units, item.unitId) : "",
        quantityHistory: entry.snapshots
          .map((snapshot) => `${snapshot.quantity} (${formatSnapshotTime(snapshot.recordedAt)})`)
          .join(" → "),
        itemNote: entry.note,
      });
    }
  }

  return rows;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Item names and notes are free text, so everything entering the HTML is escaped. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * One block per report — reporter, date and the day-level note as a small
 * header, then one table row per item — mirroring how `ReportCard` groups the
 * same data on screen.
 */
function buildReportBlockHtml(report: Report, input: ReportExportInput): string {
  const rows = buildReportExportRows(
    [report],
    input.items,
    input.categories,
    input.units,
    input.appUsers,
  );

  const first = rows[0];
  if (first === undefined) return "";

  const dayContent = first.dayContent.trim();
  const itemRows = rows.filter((row) => row.itemName.length > 0);

  const body =
    itemRows.length === 0
      ? `<p class="empty">No items reported.</p>`
      : `<table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>Unit</th>
            <th>Quantity History</th>
            <th>Item Note</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows
            .map(
              (row) => `<tr>
            <td>${escapeHtml(row.itemName)}</td>
            <td>${escapeHtml(row.categoryName)}</td>
            <td>${escapeHtml(row.unitLabel)}</td>
            <td>${escapeHtml(row.quantityHistory)}</td>
            <td>${escapeHtml(row.itemNote)}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;

  return `<section class="report">
      <p class="report__reporter">${escapeHtml(first.reporterName)}</p>
      <p class="report__date">${escapeHtml(first.date)}</p>
      <p class="report__note">${
        dayContent.length > 0
          ? `<span class="report__note-label">Written report:</span> ${escapeHtml(dayContent)}`
          : `<span class="empty">No written report</span>`
      }</p>
      ${body}
    </section>`;
}

/** The full printable document: header, active filters, then one block per report. */
export function buildReportExportHtml(input: ReportExportInput): string {
  return `<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: -apple-system, Roboto, Helvetica, sans-serif; color: #1A1A1A; padding: 24px; }
      h1 { color: #7B1515; font-size: 20px; margin: 0 0 4px; }
      .meta { color: #6B6B6B; font-size: 11px; margin: 0 0 2px; }
      .report { border-top: 1px solid #E8E0D0; padding-top: 12px; margin-top: 20px; page-break-inside: avoid; }
      .report__reporter { font-size: 14px; font-weight: 600; margin: 0; }
      .report__date { color: #6B6B6B; font-size: 11px; margin: 2px 0 0; }
      .report__note { font-size: 11px; margin: 6px 0 0; }
      .report__note-label { color: #6B6B6B; }
      .empty { color: #6B6B6B; font-style: italic; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
      th { background: #F8EDD5; color: #7B1515; text-align: left; font-weight: 600; }
      th, td { border: 1px solid #E8E0D0; padding: 6px 8px; vertical-align: top; }
    </style>
  </head>
  <body>
    <h1>Majestic Flavours — Report Export</h1>
    <p class="meta">Exported ${escapeHtml(formatReportDate(getTodayIsoDate()))}</p>
    <p class="meta">Filters: ${escapeHtml(input.filterSummary)}</p>
    ${input.reports.map((report) => buildReportBlockHtml(report, input)).join("")}
  </body>
</html>`;
}

/**
 * `printToFileAsync` names its output with a random id, which reads badly in a
 * share sheet or email attachment, so it is moved to a stable file name first.
 */
export async function exportReportsAsPdf(input: ReportExportInput): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: buildReportExportHtml(input) });

  const target = new File(Paths.cache, PDF_FILE_NAME);
  if (target.exists) target.delete();
  // Sync, so the file is guaranteed to be in place before it is shared.
  new File(uri).moveSync(target);

  await shareFile(target.uri, "application/pdf", "Export Reports (PDF)");
}

export async function exportReportsAsXlsx(input: ReportExportInput): Promise<void> {
  const rows = buildReportExportRows(
    input.reports,
    input.items,
    input.categories,
    input.units,
    input.appUsers,
  );

  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Date: row.date,
      "Reporter Name": row.reporterName,
      "Item Name": row.itemName,
      Category: row.categoryName,
      Unit: row.unitLabel,
      "Quantity History": row.quantityHistory,
      "Item Note": row.itemNote,
      "Day Report": row.dayContent,
    })),
  );

  // Cell styling is a SheetJS Pro feature. Verified against the generated
  // file: the free build writes a styles.xml with a single non-bold font and
  // drops `cell.s` entirely, so this bold header does NOT actually render.
  // Kept because it costs nothing and would start working on a Pro build —
  // the header row is correctly labelled either way.
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: col })];
    if (cell) cell.s = { font: { bold: true } };
  }

  // Column widths, unlike fonts, do survive the free build — verified in the
  // written sheet1.xml — and the quantity history column is long.
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 20 },
    { wch: 22 },
    { wch: 16 },
    { wch: 10 },
    { wch: 40 },
    { wch: 32 },
    { wch: 32 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");
  const base64: string = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });

  const file = new File(Paths.cache, XLSX_FILE_NAME);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: EncodingType.Base64 });

  await shareFile(
    file.uri,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Export Reports (XLSX)",
  );
}

async function shareFile(uri: string, mimeType: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}
