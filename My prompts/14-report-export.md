Read AGENTS.md first and follow it strictly.

## Task

Implement PDF and XLSX export on the Reports screen, for Admins and Managers. This replaces the earlier draft of this prompt — that version predated the current report model (per-item timestamped snapshot history, per-item notes, self-reporting) and described a flat, single-note-per-report shape that no longer exists. Follow AGENTS.md's actual, current export requirement: every item touched in a report listed individually, with its full timestamped quantity history and note — never summarized.

**Approved dependencies** (confirmed, no need to re-ask): `expo-print` (HTML → PDF), `xlsx` (SheetJS, pure JS, no native linking) for XLSX, `expo-file-system` and `expo-sharing` for writing the file and triggering the native share sheet. Install with `npx expo install expo-print expo-file-system expo-sharing` and `npm install xlsx`.

### 1. Move the export buttons — and the "+ Make a Report" button — into `ManagerReportsView.tsx`

The filters (date/reporter/category) this needs already live inside `ManagerReportsView`, not in `reports.tsx`. Rather than thread that state back up to the parent, move the whole header row (title, "+ Make a Report", PDF, XLSX) into `ManagerReportsView` itself, rendered above `ReportFilters`. `reports.tsx` keeps its own, much simpler header for the two states it still owns: the "My Report" / "Back to Reports" self-reporting toggle, and passing `onSelfReport={() => setIsSelfReporting(true)}` down as a prop so `ManagerReportsView` can trigger it. `reports.tsx`'s title becomes just `"Reports"` when browsing (rendered inside `ManagerReportsView` now) and `"My Report"` when self-reporting (unchanged).

### 2. Shared row-flattening helper — `src/lib/reportExport.ts`

Both export formats need the exact same flattened data — one row per item touched, plus one row for any report with no items but real day-level content, so a written-report-only day doesn't silently vanish from the record:

```ts
import { getCategoryName, getUnitLabel } from "@/lib/inventoryLabels";
import { formatReportDate, formatSnapshotTime } from "@/lib/reports";
import type { Category, InventoryItem, Report, Unit } from "@/types/inventory";
import type { SyncedUser } from "@/store/appUsersStore";

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
      appUsers.find((user) => user.clerkUserId === report.reporterId)?.name ?? "Unknown reporter";
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
```

### 3. What gets exported

`ManagerReportsView`'s existing `historicalReports` memo already computes exactly the right set — it applies the date/reporter/category filters correctly *regardless* of which `dateFilter` is currently selected (its `"today"` branch already matches only today's reports), even though the UI chooses to render the roster-based `todayRows` instead when that filter is active. Feed `historicalReports` directly into `buildReportExportRows` for both export handlers — no new filtering logic needed.

### 4. PDF export

Build an HTML string grouped by report (reporter + date + day-level note as a small header, one row per item underneath, matching the same visual grouping `ReportCard.tsx` already uses on-screen — reuse that structure for consistency rather than inventing a new layout). Include a document header with "Majestic Flavours — Report Export", the export date, and a short plain-text summary of the currently active filters (e.g. "Today · Yahya Mohammed · All categories"). Keep styling light — a maroon heading is fine, but prioritize print-readable clarity over heavy design.

```ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

async function handleExportPdf() {
  const rows = buildReportExportRows(historicalReports, items, categories, units, appUsers);
  // group `rows` back by (date, reporterName) to render one block per report
  const html = buildExportHtml(historicalReports, items, categories, units, appUsers, filterSummary);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Export Reports (PDF)",
  });
}
```

### 5. XLSX export

One row per `ReportExportRow`, columns: Date, Reporter Name, Item Name, Category, Unit, Quantity History, Item Note, Day Report. Bold header row.

```ts
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";

async function handleExportXlsx() {
  const rows = buildReportExportRows(historicalReports, items, categories, units, appUsers);
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

  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: col })];
    if (cell) cell.s = { font: { bold: true } };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });

  const fileUri = `${FileSystem.cacheDirectory}majestic-flavours-reports.xlsx`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(fileUri, {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    dialogTitle: "Export Reports (XLSX)",
  });
}
```

**One honest caveat to verify, not assume:** the free `xlsx` package's cell-styling support has historically been inconsistent across output readers — the bold header *should* work, but if it doesn't render in whatever spreadsheet app is used to open the file, that's a known limitation of the free library, not a bug in this implementation. The header row will be correctly labeled either way even if the bold styling itself doesn't come through everywhere.

### 6. Handle empty results and failures

If `historicalReports` is empty for the current filters, show a brief `Alert.alert("Nothing to export", "No reports match the current filters.")` instead of generating an empty file. Wrap both handlers' async work in try/catch — on failure, `Alert.alert("Export failed", "Please try again.")`.

## Constraints

- Do not change anything about the report *data* — this is read-only, export never writes to `reportStore` or Supabase.
- Reuse `formatReportDate`/`formatSnapshotTime`/`getCategoryName`/`getUnitLabel` — don't reimplement formatting that already exists.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

Test with a mix of report shapes: one item with multiple snapshots, one item with a note but no quantity change, one report with day-content but zero items touched — confirm all three appear correctly and distinctly in both exports.