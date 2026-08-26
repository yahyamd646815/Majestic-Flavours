Read AGENTS.md first and follow it strictly.

**Prerequisite:** `supabase-patch-round9.sql` must already be applied (new `report_item_status_pings` table, `report_item_entries.status_ping` dropped). Verify before starting.

## Task

Two things, closing a gap from 17c: `status_ping` was write-only, never read back into the app anywhere. This adds full timestamped history for pings (matching how quantity snapshots already work) and displays it in Reports, which never showed ping state at all before.

**Explicitly not in scope:** the PDF/XLSX export. Confirmed with Yahya's dad — the export is good as-is, don't touch `reportExport.ts`.

### 1. `ReportItemEntry` type — add the history array

In `types/inventory.ts`, add to `ReportItemEntry`:
```ts
statusPings: { status: StockStatus; recordedAt: string }[];
```
Mirrors `snapshots`'s exact shape — same pattern, new field.

### 2. `reportStore.ts` — read it back

`REPORT_SELECT` needs the new nested table added:
```ts
const REPORT_SELECT = "*, report_item_entries(*, report_item_snapshots(*), report_item_status_pings(*))";
```

`mapDbReportToReport` needs a `statusPings` mapping alongside the existing `snapshots` one, same sort-by-`recordedAt` pattern:
```ts
statusPings: ((entryRow.report_item_status_pings as Record<string, unknown>[] | null) ?? [])
  .map((row) => ({
    status: row.status as StockStatus,
    recordedAt: row.recorded_at as string,
  }))
  .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
```

### 3. `submitReport` — write to the new table, not the old column

Replace the removed `status_ping` field on the `report_item_entries` upsert payload with a new insert, mirroring exactly how a quantity snapshot is already written:

```ts
if (submission.statusPing !== undefined) {
  const { error: pingError } = await supabase.from("report_item_status_pings").insert({
    id: generateId("status-ping"),
    report_item_entry_id: entryData.id,
    status: submission.statusPing,
  });
  if (pingError) failedItemIds.push(submission.itemId);
}
```

### 4. Display in Reports — historical, not live

**This is a different kind of display than Dashboard/Inventory, and the distinction matters:** Reports shows what was pinged *as part of that specific day's report* — the latest entry in that report's own `statusPings` array — not the item's current live `statusOverride`, which may have changed or cleared since. Don't reach for `getEffectiveStatus` here; it doesn't apply to a historical view.

Locate the current rendering of item entries in `ReportCard` and `ReportDetailModal` — verify their current structure before modifying, neither has been touched by this prompt's design. For an entry whose `statusPings` array is non-empty, show the same flag-differentiated badge treatment already used elsewhere (`StockStatusBadge` with `isOverridden={true}`, using the *last* element of that entry's own `statusPings`), plus its timestamp — matching the existing "Reported at HH:MM" pattern already used for the latest quantity snapshot. An entry with an empty `statusPings` array shows nothing new, same as today.

## Constraints

- Don't touch `reportExport.ts` or anything PDF/XLSX-related.
- Don't touch Dashboard or Inventory's status display — already correct, this prompt is Reports-only.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Test: ping an item twice in the same day's report (out of stock, then later low stock) — confirm both appear in order with distinct timestamps, not just the latest overwriting the first. Confirm a report with no pings at all renders exactly as it did before this prompt. Confirm the export still shows nothing ping-related, unchanged.
