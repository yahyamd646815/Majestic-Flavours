Read AGENTS.md first and follow it strictly.

**This is the stopgap ("Option A"), not the full fix.** The proper fix (moving everything into one transactional RPC, "Option B") is deliberately deferred — see `PROJECT-CONTEXT.md`'s v2 list for the confirmed sequencing. This prompt closes the immediate data-integrity gap cheaply in the meantime.

## Task

CodeRabbit caught a real bug: if `submitReport`'s snapshot/ping writes succeed but the *separate* inventory writeback in `ReportEntryView` fails afterward, the draft is deliberately kept so the person can retry without re-typing everything — but retrying re-submits the same unchanged draft, causing `submitReport` to insert the *same* snapshot/ping a second time. A false duplicate in what's supposed to be a clean, meaningful append-only history.

**This isn't ping-specific — the identical structural gap exists in the quantity snapshot insert too, and has since prompt 13c.** Fix both together, not just the newer code.

### The core idea

A stable id, generated once per pending submission attempt and *reused* across retries of that same attempt — but a genuinely new submission (after a prior one fully succeeded and drafts cleared) gets a fresh id. Use that id to make the snapshot/ping writes upsert-idempotent: a retry with the same id updates the existing row in place (a harmless no-op) instead of inserting a new one.

### 1. `ReportEntryView.tsx` — a ref that survives retries, doesn't survive success

```ts
const pendingSubmissionIdRef = useRef<string | null>(null);

async function handleSubmit() {
  // ...
  if (pendingSubmissionIdRef.current === null) {
    pendingSubmissionIdRef.current = generateId("submission");
  }
  const submissionId = pendingSubmissionIdRef.current;

  // ... existing itemSubmissions computation, unchanged ...

  const result = await submitReport(
    supabase,
    reporterId,
    todayIsoDate,
    dayContent.trim(),
    itemSubmissions,
    submissionId, // new parameter
  );
  // ... existing null-check, unchanged ...

  // ... existing inventory writeback ...

  if (inventoryFailed || reportPartiallyFailed) {
    // Deliberately NOT clearing pendingSubmissionIdRef here — a retry must
    // reuse the same id, which is the entire point of this fix.
    Alert.alert(/* unchanged */);
    return;
  }

  pendingSubmissionIdRef.current = null; // full success — the next genuinely new submission gets a fresh id
  clearDrafts();
  setShowConfirmation(true);
}
```

Verify the current exact function shape before applying — this shows the parts that change, not a full replacement of logic that's already correct.

### 2. `reportStore.ts` — `submitReport` takes the id, uses it for deterministic upserts

Add `submissionId: string` as a new parameter (after `itemSubmissions`). Use it to build a per-item deterministic id for both the snapshot and ping writes, and switch both from `.insert()` to `.upsert(..., { onConflict: "id" })`:

```ts
if (submission.newSnapshotQuantity !== undefined) {
  const { error: snapshotError } = await supabase.from("report_item_snapshots").upsert(
    {
      id: `snapshot-${submissionId}-${submission.itemId}`,
      report_item_entry_id: entryData.id,
      quantity: submission.newSnapshotQuantity,
    },
    { onConflict: "id" },
  );
  if (snapshotError) failedItemIds.push(submission.itemId);
}

if (submission.statusPing !== undefined) {
  const { error: pingError } = await supabase.from("report_item_status_pings").upsert(
    {
      id: `status-ping-${submissionId}-${submission.itemId}`,
      report_item_entry_id: entryData.id,
      status: submission.statusPing,
    },
    { onConflict: "id" },
  );
  if (pingError) failedItemIds.push(submission.itemId);
}
```

**Why this is correct, worth understanding rather than just applying:** the id is deterministic per *(submissionId, itemId)* pair. A retry of the same failed attempt reuses the same `submissionId` (per step 1's ref), so it hits the same row and updates it in place — `recorded_at` isn't part of the upsert payload, so it correctly keeps its original value from the first real write, not the retry's timestamp. A later, genuinely new submission (after the ref was cleared on full success) gets a fresh `submissionId`, and therefore a genuinely new row — even if the value happens to be identical to a previous one, which is a real, distinct event worth its own row.

### 3. Update the type signature

`submitReport`'s type in the `ReportState` interface needs the new `submissionId: string` parameter added, matching its position in the implementation.

## Constraints

- This does not touch the inventory writeback step itself, or attempt any cross-table transaction — that's Option B's job, deliberately out of scope here.
- Don't change anything about `report_item_entries`' own upsert — it's already correctly idempotent via its existing deterministic id.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

The real test needs an actual induced failure, not just a normal submission — temporarily make the inventory writeback fail on purpose (e.g. force `updateItem` to return `false` for testing), submit a report with a quantity change and a ping, confirm it shows "saved with some issues," then retry with the fix in place — confirm the retry succeeds and check in Supabase that there's exactly one snapshot row and one ping row, not two.
