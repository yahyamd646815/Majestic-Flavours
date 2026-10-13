Read AGENTS.md first and follow it strictly.

**Suggested: Sonnet, high effort.** Pattern-following work throughout — a filter mirroring existing ones, a sort refinement, one new small UI element.

**Prerequisite:** `v2-supabase-patch-round7.sql` must already be applied (adds `inventory_items.status_updated_at`).

This prompt is unrelated to the to-do list / recurrence work — pure Dashboard and Inventory changes, bundled together only because both are small.

## Part A — Dashboard: category filter

The Dashboard currently has no filters at all. Add a single category filter (reuse `CategoryFilter` directly) that affects both the Out of Stock and Low Stock sections simultaneously — one shared control, not two separate ones. No employee filter on the Dashboard; this is a quick-overview screen, not detailed assignment browsing, and Inventory/Tasks already own that use case.

## Part B — Dashboard: live elapsed-time timer

Every item card in both Out of Stock and Low Stock sections gets a timer showing elapsed time since `status_updated_at`, formatted `DD:HH:MM` (days:hours:minutes). Applies to both pinged and quantity-derived ("real status") items alike — the timer doesn't care which produced the current status, only when it last changed. **Dashboard-only** — don't add this to Inventory or Reports.

This needs to actually tick — a local interval updating a "now" reference roughly once a minute is enough given the display granularity; no need for second-level updates.

**Wiring `status_updated_at`:** set it in `updateItem` (the single centralized write path for both `currentQuantity` and `statusOverride`) whenever either of those two fields is included in the update — matching the same "the logic belongs where all paths funnel through" reasoning as the existing ping-clearing logic in that same function. Verify the current exact shape of `updateItem` before modifying it.

## Part C — Dashboard: refined sort

Extend the existing `sortPingedFirst` (Dashboard-only, from `v2-01`) with a secondary sort: within each of the two groups it already produces (pinged first, then quantity-derived), order by `status_updated_at` descending — most recently updated at the top, oldest at the bottom. Pinned-first stays the primary sort; this is purely a secondary tiebreaker within each group, using the same stable-sort approach already in place.

## Part D — Inventory: "Recently Added" replaces "Default"

Inventory's sort toggle currently offers Default / A–Z. Replace Default with "Recently Added" (sort by `createdAt` descending), matching Tasks' own Recently Added / A–Z pattern exactly. This was originally planned to wait until after the sign-up/`sampleUsers.ts` migration, but that sequencing is no longer being followed — build it now.

## Constraints

- Don't touch anything about tasks, recurrence, or notifications — unrelated.
- Don't add the timer or the category filter to Inventory or Reports — Dashboard-only, per the spec.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Ping one item and separately change another item's quantity — confirm both get a fresh `status_updated_at` and both timers start counting from that moment. Confirm the category filter narrows both Dashboard sections together, not independently. Confirm the secondary recency sort holds within each group without disturbing the pinned-first primary sort. Confirm Inventory's sort toggle now reads "Recently Added" and actually sorts by creation time, newest first.
