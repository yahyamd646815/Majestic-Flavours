Read AGENTS.md first and follow it strictly.

**Prerequisite:** `supabase-patch-round8.sql` must already be applied (adds `inventory_items.status_override` and `report_item_entries.status_ping`). Verify these columns exist before starting.

## Task

Add three stock-status buttons — Out of Stock / Low Stock / In Stock — to report entry, for both Employee reports and Admin/Manager's "+ Make a Report" (same `ReportEntryView` component serves both). Tapping one is a valid report on its own, with no quantity change or note required. It sets a manual override that wins over quantity-derived status everywhere status is shown, until either the item's quantity changes or a different status is pinged.

**In-app visibility only — this is deliberate, not a placeholder for something bigger.** No new screen. The override feeds into the exact same status display that already exists (Inventory card badges, Dashboard's Low Stock Alerts, Dashboard's counts). `expo-notifications` for real push is explicitly deferred to v2.

### 1. Shared status type and the one function everything must route through

New file, `src/lib/stockStatus.ts`:

```ts
export type StockStatus = "out_of_stock" | "low_stock" | "in_stock";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  out_of_stock: "Out of Stock",
  low_stock: "Low Stock",
  in_stock: "In Stock",
};

/**
 * The single source of truth for an item's current status. A manual override
 * always wins over the quantity-derived calculation — that is the entire
 * point of pinging. Every place in the app that currently derives status from
 * `currentQuantity`/`minThreshold` independently must be routed through this
 * instead, not just the new UI. As of this feature, that's at least:
 * `InventoryCard`'s badge, and TWO separate spots in the Dashboard
 * (`index.tsx`'s count computation and its alert-list filter) — verify there
 * aren't others. If the override isn't wired into all of them, an item can
 * show "Out of Stock" on its card while not appearing in the Dashboard's
 * alert list, which is exactly the kind of silent inconsistency this
 * function exists to prevent.
 */
export function getEffectiveStatus(item: {
  currentQuantity: number;
  minThreshold: number;
  statusOverride: StockStatus | null;
}): StockStatus {
  if (item.statusOverride !== null) return item.statusOverride;
  if (item.currentQuantity === 0) return "out_of_stock";
  if (item.currentQuantity <= item.minThreshold) return "low_stock";
  return "in_stock";
}
```

Also worth extracting here (verify against `InventoryCard`'s current implementation, which already computes this as inline ternaries): a helper mapping `StockStatus` to the existing `status-badge`/`status-badge__text` class name pairs, so the three-way ternary chain currently duplicated wherever a badge renders collapses to one call.

### 2. `InventoryItem` type and where it ripples — read this whole section before touching the type

Add `statusOverride: StockStatus | null` (required, not optional — a database row always has one or the other) to `InventoryItem` in `types/inventory.ts`.

**This ripples into two places that must explicitly exclude it, the same way `assignedEmployeeIds` was excluded from `updateItem`'s type in an earlier prompt — for the same reason: neither of these should ever set it directly.**

- `ItemFormModal.tsx`'s `ItemFormValues` type is currently `Omit<InventoryItem, "id" | "createdAt">`. Change it to `Omit<InventoryItem, "id" | "createdAt" | "statusOverride">`. There's no ping control inside the item-edit form — it doesn't belong there.
- `inventoryStore.ts`'s `addItem` parameter type is the same `Omit<InventoryItem, "id" | "createdAt">` shape. Same exclusion, same reasoning — a brand-new item should simply start with no override (the database column has no explicit default, so a fresh row gets `NULL` automatically when the insert doesn't mention it at all — no code change needed in `addItem`'s implementation itself, only its type).

**`mapDbItemToItem`** (in `inventoryStore.ts`) needs one added line:
```ts
statusOverride: (row.status_override as StockStatus | null) ?? null,
```

### 3. `updateItem` — the critical correctness hazard, with exact current code

The rule "quantity change clears the override" has to coexist with a same-submission case: someone changes an item's quantity **and** pings a status in the same report. If quantity-clear and status-set are applied as two separate sequential writes, whichever happens second wins — get the order wrong (or have it vary) and a same-submission ping silently loses to the auto-clear. The fix is to never apply them sequentially — one `updateItem` call per item, and only auto-null the override when quantity is changing and nothing in that same call is also explicitly setting a new one.

`updateItem`'s current implementation builds a `dbUpdates` object field by field. Add the new field mapping with the hazard-avoidance logic built directly into it, rather than as a separate step:

```ts
updateItem: async (supabase, id, updates) => {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
  if (updates.currentQuantity !== undefined)
    dbUpdates.current_quantity = updates.currentQuantity;
  if (updates.unitId !== undefined) dbUpdates.unit_id = updates.unitId;
  if (updates.minThreshold !== undefined) dbUpdates.min_threshold = updates.minThreshold;

  // Quantity change clears a manual override — UNLESS this same call is also
  // explicitly setting a new one, in which case the explicit value wins. This
  // composes correctly for all three real cases: quantity-only clears it,
  // ping-only sets it without touching quantity, and a combined quantity+ping
  // update (same submission) keeps the explicit new override rather than
  // immediately wiping it back to null.
  const effectiveStatusOverride =
    updates.currentQuantity !== undefined && updates.statusOverride === undefined
      ? null
      : updates.statusOverride;
  if (effectiveStatusOverride !== undefined) dbUpdates.status_override = effectiveStatusOverride;

  // ...rest of the function (the .update().select().single() call and local
  // state sync) is unchanged.
};
```

### 4. Draft state — `DraftReportContext`

Add `draftStatusPings: Record<string, StockStatus>` and a `setDraftStatusPing(itemId, status)` setter, alongside the existing `draftQuantities`/`draftNotes`. Include it in `clearDrafts()`. Verify the context's current exact shape before extending it.

Tapping an already-active button (the one currently reflecting the item's effective status) is a no-op — there is no "clear the ping" gesture in this pass, only "change quantity" or "ping something else."

### 5. `ReportEntryView` — the three buttons, and submission

Add the three buttons to wherever each item renders in the report list (`ReportEntryCard` — verify its current props/layout before integrating). One reflects the item's current effective status as active/selected; tapping a different one calls `setDraftStatusPing`.

In `handleSubmit`, a ping is a third trigger alongside the existing `quantityChanged`/`noteChanged` checks — an item with only a ping and nothing else must still produce an `itemSubmission`:

```ts
const draftPing = draftStatusPings[item.id];
const pingChanged = draftPing !== undefined;

if (!quantityChanged && !noteChanged && !pingChanged) continue;

itemSubmissions.push({
  itemId: item.id,
  ...(quantityChanged ? { newSnapshotQuantity: draftQuantity } : {}),
  ...(noteChanged ? { note: draftNote } : {}),
  ...(pingChanged ? { statusPing: draftPing } : {}),
});
```

`ItemSubmission`'s type (in `reportStore`) needs `statusPing?: StockStatus` added, and `submitReport` needs to write it to `report_item_entries.status_ping` — verify its current implementation before extending it.

**Replace the existing post-submission quantity write-back** with one that merges quantity and status into a single `updateItem` call per item, per the hazard in step 3 — not two separate passes:

```ts
type ItemWriteback = { currentQuantity?: number; statusOverride?: StockStatus };
const writebacks = new Map<string, ItemWriteback>();

for (const submission of itemSubmissions) {
  if (submission.newSnapshotQuantity === undefined && submission.statusPing === undefined) continue;
  writebacks.set(submission.itemId, {
    ...(submission.newSnapshotQuantity !== undefined
      ? { currentQuantity: submission.newSnapshotQuantity }
      : {}),
    ...(submission.statusPing !== undefined ? { statusOverride: submission.statusPing } : {}),
  });
}

const writeResults = await Promise.all(
  Array.from(writebacks.entries()).map(([itemId, changes]) =>
    updateItem(supabase, itemId, changes),
  ),
);
```

The existing partial-failure handling (`Alert.alert("Report saved with some issues", ...)`) now covers this combined write instead of the quantity-only one — verify it still reads correctly.

### 6. Dashboard and Inventory — route through `getEffectiveStatus`

- `InventoryCard`'s badge — replace the inline `isOutOfStock`/`isLowStock` derivation with `getEffectiveStatus(item)`.
- `inventoryStore.ts`'s `getLowStockItems` — currently `get().items.filter((item) => item.currentQuantity <= item.minThreshold)`. Change to:
  ```ts
  getLowStockItems: () => get().items.filter((item) => getEffectiveStatus(item) !== "in_stock"),
  ```
- `index.tsx`'s `outOfStockCount`/`lowStockCount` computation and its alert-list filter — both currently derive status inline; both need to go through the same function so the Dashboard's counts and its alert list can never disagree with each other or with the Inventory screen.
- Add a small visual indicator (icon or distinct badge treatment) when `statusOverride !== null`, distinguishing a manually-pinged status from quantity-derived — without one, an item reading "Out of Stock" with 50 units in stock looks like a bug rather than a deliberate flag. Exact styling is your call; a small pin/flag icon next to the badge is a reasonable default.

## Constraints

- Don't touch the multi-select bulk-assignment feature, `BulkAssignModal`, or the employee/category filter logic — unrelated to this feature.
- Don't build a slider control — plain buttons, per the confirmed v1 scope (slider is v2).
- Don't build `expo-notifications` or any push mechanism — in-app only.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` before finishing.

## Reference

Test explicitly: (1) ping an item Out of Stock with no quantity/note change, confirm it appears as a valid report and the Dashboard/Inventory both reflect it. (2) With that override still active, submit a *different* report changing that item's quantity — confirm the override clears and status reverts to quantity-derived. (3) In one single submission, change an item's quantity **and** ping a different status for it — confirm the ping wins, not the auto-clear (this is the scenario step 3 exists to get right). (4) Ping a status, then ping a different one in a later report — confirm it changes rather than stacking. (5) Confirm the Dashboard's alert list and its counts never disagree with what an Inventory card shows for the same item. (6) Add a brand-new item via the normal add-item form — confirm it saves successfully with no `statusOverride`-related type error, and shows quantity-derived status (no override) by default.