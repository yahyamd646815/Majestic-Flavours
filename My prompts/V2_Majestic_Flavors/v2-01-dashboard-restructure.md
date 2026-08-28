Read AGENTS.md first and follow it strictly.

**First prompt of v2.** Two small, unrelated UI-default changes bundled deliberately — Part B is a genuinely one-line change that doesn't justify its own prompt, and both are "how a screen looks when you first open it" changes to already-working screens.

Stop after each part and tell Yahya it's ready to commit — don't run git yourself.

---

### Part A — Dashboard: split the alert list into two collapsible sections

The Dashboard currently renders one combined "Low Stock Alerts" section containing everything `getLowStockItems()` returns (anything whose effective status isn't `in_stock`). Yahya's dad wants these separated so each is easier to scan.

1. **Two sections instead of one:** "Out of Stock" and "Low Stock", each independently collapsible, each showing its own count in the header (e.g. "Out of Stock (3)"). Split by `getEffectiveStatus(item)` — never re-derive status inline, per AGENTS.md.
2. **Default expanded state is your call**, but pick deliberately and say why in your summary — the whole point is scanability, and two collapsed sections showing nothing may defeat that.
3. **A section with zero items** should still render its header with `(0)` rather than disappearing — a missing section reads as a bug, an empty one reads as good news. Keep the existing "All items are well stocked" checkmark state for when *both* are empty.
4. **Sort pinged items first within each section** — items where `statusOverride !== null` come before quantity-derived ones. Within each of those two groups, keep whatever order they already arrive in; don't add a secondary sort. **This is Dashboard-only** — do not touch Inventory's or Reports' sorting.
5. **Verify whether a collapsible/accordion component already exists** in `components/` before building one. If not, a new one is fine — keep it simple (a pressable header row that toggles local state), and match the existing `section-header` styling rather than inventing new visual language.

The three count cards at the top (Total / Out of Stock / Low Stock) stay exactly as they are — they already route through `getEffectiveStatus` correctly.

---

### Part B — Reports: default the date filter to Today

In `ManagerReportsView`, `dateFilter`'s initial state is currently `"all"`. Change it to `"today"`.

That's the whole change. Admins and Managers open this screen to see what's happening *today* far more often than to browse all history, and All Time gets slower to scan as reports accumulate. Nothing else about the filter changes — All Time is still one tap away.

## Constraints

- Don't touch `getEffectiveStatus`, `getLowStockItems`, or anything about how status is computed — this is presentation only.
- Don't change Inventory's default sort. (Yahya wants that changed to "recently added" later, deliberately sequenced after the sign-up/`sampleUsers.ts` work — not now.)
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` after each part.

## Reference

Part A: with at least one out-of-stock item, one low-stock item, and one manually pinged item, confirm each lands in the right section and pinged ones sort to the top of theirs. Collapse and expand both sections independently. Then check a state where one section is empty and the other isn't. Part B: open Reports as Admin — it should land on Today, not All Time.
