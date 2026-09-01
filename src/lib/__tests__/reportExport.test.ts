// TypeScript 6 does not pull in `@types/*` packages automatically, so the Jest
// globals (`describe`, `it`, `expect`, `jest`) are referenced explicitly here
// rather than widening the whole project's tsconfig for one test file.
/// <reference types="jest" />

import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import {
  buildReportExportHtml,
  buildReportExportRows,
  exportReportsAsPdf,
  exportReportsAsXlsx,
  type ReportExportInput,
} from "@/lib/reportExport";
import { formatReportDate, getTodayIsoDate } from "@/lib/reports";
import type { SyncedUser } from "@/store/appUsersStore";
import type { Category, InventoryItem, Report, Unit } from "@/types/inventory";

jest.mock("expo-print", () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

/**
 * `expo-file-system`'s `File`/`Paths` are native-backed, so they are replaced by
 * an in-memory stand-in that records what the export code asked it to do. The
 * spies are exported from the factory itself because a `jest.mock` factory runs
 * during import hoisting, before any top-level `const` in this file exists.
 *
 * `writeSpy`/`moveSpy` are typed explicitly rather than left as bare `jest.fn()`
 * — an untyped mock erases its argument types to `any`, which would let a wrong
 * call shape (wrong argument count, wrong types) pass silently instead of
 * failing typecheck.
 */
jest.mock("expo-file-system", () => {
  const writeSpy = jest.fn<void, [string, string, { encoding?: string } | undefined]>();
  const moveSpy = jest.fn<void, [string, string]>();

  class MockFile {
    uri: string;
    exists = false;

    constructor(base: string | { uri: string }, name?: string) {
      const basePath = typeof base === "string" ? base : base.uri;
      this.uri = name === undefined ? basePath : `${basePath}${name}`;
    }

    create(): void {}

    delete(): void {}

    write(contents: string, options?: { encoding?: string }): void {
      writeSpy(this.uri, contents, options);
    }

    moveSync(target: { uri: string }): void {
      moveSpy(this.uri, target.uri);
    }
  }

  return {
    File: MockFile,
    Paths: { cache: { uri: "file:///cache/" } },
    EncodingType: { Base64: "base64", UTF8: "utf8" },
    __writeSpy: writeSpy,
    __moveSpy: moveSpy,
  };
});

const printToFileAsync = Print.printToFileAsync as jest.MockedFunction<
  typeof Print.printToFileAsync
>;
const isAvailableAsync = Sharing.isAvailableAsync as jest.MockedFunction<
  typeof Sharing.isAvailableAsync
>;
const shareAsync = Sharing.shareAsync as jest.MockedFunction<typeof Sharing.shareAsync>;

const fileSystemMock = FileSystem as unknown as {
  __writeSpy: jest.Mock<void, [string, string, { encoding?: string } | undefined]>;
  __moveSpy: jest.Mock<void, [string, string]>;
};

// --- Fixtures ---------------------------------------------------------------

const units: Unit[] = [
  { id: "unit-kg", label: "kg" },
  { id: "unit-l", label: "L" },
];

const categories: Category[] = [
  { id: "cat-meat", name: "Meat" },
  { id: "cat-dairy", name: "Dairy" },
];

const items: InventoryItem[] = [
  {
    id: "item-chicken",
    name: "Chicken",
    categoryId: "cat-meat",
    currentQuantity: 20,
    unitId: "unit-kg",
    minThreshold: 5,
    assignedEmployeeIds: ["user-amir"],
    statusOverride: null,
    statusUpdatedAt: "2026-01-04T09:00:00.000Z",
    createdAt: "2026-01-04T09:00:00.000Z",
  },
  {
    id: "item-yogurt",
    name: "Yogurt",
    categoryId: "cat-dairy",
    currentQuantity: 8,
    unitId: "unit-l",
    minThreshold: 3,
    assignedEmployeeIds: ["user-amir"],
    statusOverride: null,
    statusUpdatedAt: "2026-01-04T09:00:00.000Z",
    createdAt: "2026-01-04T09:00:00.000Z",
  },
];

const appUsers: SyncedUser[] = [
  { clerkUserId: "user-amir", name: "Amir Khan", email: "amir@majesticflavours.sa" },
];

/** Two items: one with a full snapshot history, one with a note but no snapshots. */
const multiItemReport: Report = {
  id: "report-1",
  reporterId: "user-amir",
  date: "2026-07-12",
  content: "Busy service, fridge two was warm.",
  itemEntries: [
    {
      itemId: "item-chicken",
      snapshots: [
        { quantity: 12, recordedAt: "2026-07-12T08:15:00.000Z" },
        { quantity: 9, recordedAt: "2026-07-12T11:30:00.000Z" },
        { quantity: 20, recordedAt: "2026-07-12T16:45:00.000Z" },
      ],
      statusPings: [],
      note: "",
    },
    {
      itemId: "item-yogurt",
      snapshots: [],
      statusPings: [],
      note: "Leaking carton, moved to a tray.",
    },
  ],
  isLocked: false,
};

/** Written report only — no items touched at all. */
const writtenOnlyReport: Report = {
  id: "report-2",
  reporterId: "user-amir",
  date: "2026-07-13",
  content: "Quiet day, nothing moved.",
  itemEntries: [],
  isLocked: true,
};

/** Both the reporter and the item have since disappeared from their lookups. */
const orphanedReport: Report = {
  id: "report-3",
  reporterId: "user-ghost",
  date: "2026-07-14",
  content: "",
  itemEntries: [
    {
      itemId: "item-removed",
      snapshots: [{ quantity: 4, recordedAt: "2026-07-14T05:00:00.000Z" }],
      statusPings: [],
      note: "Crate was already open.",
    },
  ],
  isLocked: true,
};

function buildInput(reports: Report[], filterSummary = "Today · All reporters · All"): ReportExportInput {
  return { reports, items, categories, units, appUsers, filterSummary };
}

// --- buildReportExportRows --------------------------------------------------

describe("buildReportExportRows", () => {
  it("joins a multi-snapshot quantity history in chronological order", () => {
    const rows = buildReportExportRows([multiItemReport], items, categories, units, appUsers);

    expect(rows[0]).toEqual({
      date: "12 Jul 2026",
      reporterName: "Amir Khan",
      dayContent: "Busy service, fridge two was warm.",
      itemName: "Chicken",
      categoryName: "Meat",
      unitLabel: "kg",
      quantityHistory: "12 (11:15) → 9 (14:30) → 20 (19:45)",
      itemNote: "",
    });
  });

  it("still produces a row for an item that has a note but no snapshots", () => {
    const rows = buildReportExportRows([multiItemReport], items, categories, units, appUsers);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({
      date: "12 Jul 2026",
      reporterName: "Amir Khan",
      dayContent: "Busy service, fridge two was warm.",
      itemName: "Yogurt",
      categoryName: "Dairy",
      unitLabel: "L",
      quantityHistory: "",
      itemNote: "Leaking carton, moved to a tray.",
    });
  });

  it("produces exactly one row with empty item fields for a written-report-only day", () => {
    const rows = buildReportExportRows([writtenOnlyReport], items, categories, units, appUsers);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      date: "13 Jul 2026",
      reporterName: "Amir Khan",
      dayContent: "Quiet day, nothing moved.",
      itemName: "",
      categoryName: "",
      unitLabel: "",
      quantityHistory: "",
      itemNote: "",
    });
  });

  it("falls back to placeholders when the item and the reporter no longer resolve", () => {
    const rows = buildReportExportRows([orphanedReport], items, categories, units, appUsers);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      date: "14 Jul 2026",
      reporterName: "Unknown reporter",
      dayContent: "",
      itemName: "Deleted item",
      categoryName: "",
      unitLabel: "",
      quantityHistory: "4 (08:00)",
      itemNote: "Crate was already open.",
    });
  });

  it("flattens several reports into one row per item touched, in report order", () => {
    const rows = buildReportExportRows(
      [multiItemReport, writtenOnlyReport, orphanedReport],
      items,
      categories,
      units,
      appUsers,
    );

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => [row.date, row.itemName])).toEqual([
      ["12 Jul 2026", "Chicken"],
      ["12 Jul 2026", "Yogurt"],
      ["13 Jul 2026", ""],
      ["14 Jul 2026", "Deleted item"],
    ]);
  });

  it("returns no rows when there are no reports", () => {
    expect(buildReportExportRows([], items, categories, units, appUsers)).toEqual([]);
  });
});

// --- buildReportExportHtml --------------------------------------------------

describe("buildReportExportHtml", () => {
  it("includes the document header, the export date and the filter summary", () => {
    // Frozen so `buildReportExportHtml`'s internal `getTodayIsoDate()` call and
    // this test's own independent call are guaranteed to see the same "now" —
    // without this, a test running across a real Riyadh-midnight boundary
    // could assert a different date than the implementation produced.
    jest.useFakeTimers().setSystemTime(new Date("2026-07-20T10:00:00.000Z"));
    try {
      const html = buildReportExportHtml(
        buildInput([multiItemReport], "This Week · Amir Khan · Meat"),
      );

      expect(html).toContain("Majestic Flavours — Report Export");
      expect(html).toContain(`Exported ${formatReportDate(getTodayIsoDate())}`);
      expect(html).toContain("Filters: This Week · Amir Khan · Meat");
    } finally {
      jest.useRealTimers();
    }
  });

  it("renders one report section per report, not one per row", () => {
    const html = buildReportExportHtml(
      buildInput([multiItemReport, writtenOnlyReport, orphanedReport]),
    );

    // multiItemReport alone contributes two rows, so a per-row bug would show four.
    expect(html.match(/<section class="report">/g)).toHaveLength(3);
    expect(html).toContain("<td>Chicken</td>");
    expect(html).toContain("<td>Yogurt</td>");
    expect(html).toContain("<td>Deleted item</td>");
  });

  it("marks a written-report-only day as having no items", () => {
    const html = buildReportExportHtml(buildInput([writtenOnlyReport]));

    expect(html).toContain("No items reported.");
    expect(html).toContain("Quiet day, nothing moved.");
    expect(html).not.toContain("<table>");
  });

  it("labels a report with no written content", () => {
    const html = buildReportExportHtml(buildInput([orphanedReport]));

    expect(html).toContain("No written report");
    expect(html).toContain("Unknown reporter");
  });

  it("escapes HTML in reporter names, item names, notes and the filter summary", () => {
    const trickyItems: InventoryItem[] = [
      {
        id: "item-tricky",
        name: 'Tomato "Roma" & <b>fresh</b>',
        categoryId: "cat-meat",
        currentQuantity: 4,
        unitId: "unit-kg",
        minThreshold: 1,
        assignedEmployeeIds: [],
        statusOverride: null,
        statusUpdatedAt: "2026-01-04T09:00:00.000Z",
        createdAt: "2026-01-04T09:00:00.000Z",
      },
    ];
    const trickyUsers: SyncedUser[] = [
      { clerkUserId: "user-tricky", name: "Bilal <admin> & Co", email: "b@example.com" },
    ];
    const trickyReport: Report = {
      id: "report-tricky",
      reporterId: "user-tricky",
      date: "2026-07-15",
      content: "Delivery arrived late",
      itemEntries: [
        {
          itemId: "item-tricky",
          snapshots: [{ quantity: 4, recordedAt: "2026-07-15T05:00:00.000Z" }],
          statusPings: [],
          note: 'Spilled <script>alert(1)</script> & "cracked" crate',
        },
      ],
      isLocked: true,
    };

    const html = buildReportExportHtml({
      reports: [trickyReport],
      items: trickyItems,
      categories,
      units,
      appUsers: trickyUsers,
      filterSummary: 'All Time · <All> & "any"',
    });

    // Raw markup from user text must never survive into the printed document.
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    expect(html).not.toContain("<b>fresh</b>");
    expect(html).not.toContain("<admin>");
    expect(html).not.toContain("<All>");

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&quot;cracked&quot; crate");
    expect(html).toContain("Tomato &quot;Roma&quot; &amp; &lt;b&gt;fresh&lt;/b&gt;");
    expect(html).toContain("Bilal &lt;admin&gt; &amp; Co");
    expect(html).toContain("Filters: All Time · &lt;All&gt; &amp; &quot;any&quot;");
  });
});

// --- exportReportsAsPdf / exportReportsAsXlsx -------------------------------
//
// These are thin wrappers over native I/O. Jest cannot verify a real file write
// or a real share sheet, so the underlying libraries are mocked and only the
// shape of the arguments they receive is checked.

describe("exportReportsAsPdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    printToFileAsync.mockResolvedValue({ uri: "file:///tmp/print-a1b2c3.pdf", numberOfPages: 1 });
    isAvailableAsync.mockResolvedValue(true);
    shareAsync.mockResolvedValue(undefined);
  });

  it("prints the built HTML, renames the file and shares it as a PDF", async () => {
    await exportReportsAsPdf(buildInput([multiItemReport], "Today · Amir Khan · All"));

    expect(printToFileAsync).toHaveBeenCalledTimes(1);
    const html = printToFileAsync.mock.calls[0][0]?.html ?? "";
    expect(html).toContain("Majestic Flavours — Report Export");
    expect(html).toContain("Filters: Today · Amir Khan · All");
    expect(html).toContain("<td>Chicken</td>");
    expect(html).toContain("12 (11:15) → 9 (14:30) → 20 (19:45)");

    expect(fileSystemMock.__moveSpy).toHaveBeenCalledWith(
      "file:///tmp/print-a1b2c3.pdf",
      "file:///cache/majestic-flavours-reports.pdf",
    );

    expect(shareAsync).toHaveBeenCalledWith("file:///cache/majestic-flavours-reports.pdf", {
      mimeType: "application/pdf",
      dialogTitle: "Export Reports (PDF)",
    });
  });

  it("throws instead of sharing when sharing is unavailable", async () => {
    isAvailableAsync.mockResolvedValue(false);

    await expect(exportReportsAsPdf(buildInput([multiItemReport]))).rejects.toThrow(
      "Sharing is not available on this device.",
    );
    expect(shareAsync).not.toHaveBeenCalled();
  });
});

describe("exportReportsAsXlsx", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAvailableAsync.mockResolvedValue(true);
    shareAsync.mockResolvedValue(undefined);
  });

  it("writes a base64 workbook and shares it with the spreadsheet mime type", async () => {
    await exportReportsAsXlsx(buildInput([multiItemReport, writtenOnlyReport]));

    expect(fileSystemMock.__writeSpy).toHaveBeenCalledTimes(1);
    const [uri, contents, options] = fileSystemMock.__writeSpy.mock.calls[0];
    expect(uri).toBe("file:///cache/majestic-flavours-reports.xlsx");
    expect(typeof contents).toBe("string");
    expect(contents.length).toBeGreaterThan(0);
    expect(options).toEqual({ encoding: "base64" });

    expect(shareAsync).toHaveBeenCalledWith("file:///cache/majestic-flavours-reports.xlsx", {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Export Reports (XLSX)",
    });
  });

  it("throws instead of sharing when sharing is unavailable", async () => {
    isAvailableAsync.mockResolvedValue(false);

    await expect(exportReportsAsXlsx(buildInput([multiItemReport]))).rejects.toThrow(
      "Sharing is not available on this device.",
    );
    expect(shareAsync).not.toHaveBeenCalled();
  });
});