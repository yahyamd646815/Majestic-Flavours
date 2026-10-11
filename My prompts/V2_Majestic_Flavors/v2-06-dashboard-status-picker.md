Read AGENTS.md first and follow it strictly.

**Suggested: Sonnet, high effort.** The write path (`updateItem`, the ping mechanism) already exists; the new parts are an animated picker and one real investigation (how a Dashboard ping reaches ping history). If that investigation turns up something that isn't clean, the prompt tells you to stop and report rather than invent a schema.

**Prerequisites:** none outside the code — `inventory_items.status_updated_at` and the existing ping machinery were shipped earlier. If you find a prerequisite is actually missing, say so in the summary rather than working around it.

Throughout: verify the current names and behavior of everything referenced (`getEffectiveStatus`, `updateItem`, the Dashboard's item card, the report-submission path, `report_item_status_pings`) in the actual repo. Where this prompt describes them, it's describing them from memory.

---

## What it is

On the Dashboard (Admin/Manager), each Out of Stock / Low Stock item has a status badge at its top-right. Today it's display-only. Make it a button: tapping it opens a small picker to change the item's stock status right there, without going through a report. Yahya's dad wants it to feel pleasant to use, so the animation matters as much as the logic.

## Behavior

**The picker always uses the fixed order In Stock → Low Stock → Out of Stock, top to bottom.** The current status keeps its own slot in that order, so the layout feels the same for every item:
- A **Low Stock** item: In Stock appears above it, Out of Stock below.
- An **Out of Stock** item: In Stock and Low Stock both appear above it.
- (An In Stock item doesn't appear on the Dashboard's low/out lists today, but build the picker generically so it would work: Low and Out both below.)

**Opening:** tap the current badge. It enlarges slightly, and the other two statuses appear around it.
**Closing with no change:** tap the same badge again, tap anywhere else on the screen, or start scrolling. The picker collapses back to the original size and **nothing happens** — no write, no status change.
**Choosing a status:** tap one of the other two. It's applied, and the picker collapses.

Choosing **In Stock** takes the item off the Dashboard's low/out lists — exactly what a report ping of "In Stock" already does today, since the Dashboard reads status through `getEffectiveStatus()` and a manual override wins over quantity. Don't add special handling beyond making sure the list updates cleanly.

Colors stay as defined in AGENTS.md (green `#16a34a`, amber `#d97706`, red `#dc2626`) — never change them. Touch targets must be large, as everywhere in this app.

## The animation (the designer's call was left open — this is the chosen style)

Clean and quick, no bounce-for-its-own-sake:
- **Open:** the current badge scales up to about 1.08× with a gentle spring (well-damped — it should settle, not wobble). The other two options fade in from 0 → 1 while sliding about 8px out from the badge and scaling from ~0.92 → 1, staggered by ~40ms, so they appear to "pop out" of the badge.
- **Close:** the reverse, faster — about 140ms, ease-out, no spring.
- **Choosing:** the chosen option briefly emphasizes, then the whole picker collapses with the close animation.

Use `react-native-reanimated`, which is already a dependency — **do not add any library.** Verify the exact API names (spring/timing helpers, layout/entering/exiting animations) against the installed version's types rather than assuming; the shape above is the intent, the API may differ. Keep it to animated opacity/transform/scale where possible, so it stays smooth on a mid-range Android phone.

## Two layout traps — decide with evidence, not assumption

1. **Touches outside a parent's bounds.** On Android, a child positioned outside its parent's bounds (e.g. an absolutely-positioned popover hanging off the card) can render but may not receive taps — a known React Native Android behavior. **Safest default: keep the expanded picker inside the card's bounds** — let the badge area grow downward/upward within the card, with the card's height animating smoothly (a reanimated layout transition is the natural tool), instead of floating a popover outside it. If you choose a floating overlay instead, you must verify on a real Android build that every option is tappable, and say so in the summary. Yahya tests on a real phone; this cannot be verified in Jest.
2. **Tap-anywhere-to-close.** Keep a single piece of state at the screen level for "which item's picker is open" (so opening one closes any other), and close it on tap-outside and on scroll start. Don't let one open picker leave another stuck open.

## Writing the change

1. **Live status.** Set the item's status override to the chosen status through the existing `updateItem` — the single write path where quantity changes already clear pings and where `status_updated_at` is set. Do not write to the table from the component directly. Confirm the `DD:HH:MM` timer on that item resets, since `updateItem` sets `status_updated_at` whenever the override changes.
2. **Failure.** If the write fails, show an alert and leave the item's displayed status unchanged (no optimistic change that sticks). Disable the options while a write is in flight so they can't be double-tapped.
3. **Who:** Admin and Manager only (they're the ones who see the Dashboard — verify, and don't render the picker for anyone else). Verify RLS lets an Admin/Manager update an item they aren't assigned to; if it doesn't, stop and report.

## Ping history — investigate first, then decide

**Decision already made by Yahya:** a Dashboard ping should be recorded in the same timestamped ping history that Reports shows, so an item's history doesn't have silent gaps whenever someone uses this shortcut.

**The catch:** from memory, `report_item_status_pings` hangs off a report's item entry, i.e. a ping belongs to a specific person's report for a specific day. A Dashboard ping has no report. Before writing anything, read how a ping is currently recorded and how an Admin/Manager self-report is submitted ("a ping alone is a valid report" is an existing, deliberate rule), then:

- **If a Dashboard ping can reuse the existing submission path cleanly** — i.e. it records as a ping-only entry on *that person's report for today* (creating the report if they don't have one yet, appending to it if they do), going through the same code that already handles this — do that. Reuse, don't duplicate. Check the consequences honestly: the report now exists in Reports and in exports, and today's report remains editable until midnight.
- **If it can't reuse that path cleanly** (the path assumes an in-progress draft, needs fields a Dashboard ping doesn't have, or the report is already locked), **stop and report.** Describe what you found and the realistic options, with the tradeoffs. Do not invent a new table or alter the ping schema on your own — that's a decision for Yahya, and it needs a SQL file from the planning chat.

In either case, **finish the picker UI and the live-status write first**, so the visible feature works. If history recording needs a decision, hand it back as a clearly separated open item in the summary rather than half-building it.

Note for context: report submission isn't yet atomic (a known, queued item — "Option B"). A Dashboard ping routed through it inherits that same gap. Don't try to fix that here; just don't make it worse, and mention it.

## Constraints

- No new libraries. No changes to colors, `getEffectiveStatus`'s logic, or the existing report-entry screens' behavior.
- Don't touch the new Today's Tasks sections or anything about tasks — that's a separate prompt (`v2-05`).
- Strict TypeScript, no `any`. Run `npm run lint`, `npm run typecheck`, `npm run test`. Add tests for any new pure logic (e.g. the option-ordering function: given a current status, return the ordered list of slots and which are selectable).
- If something here conflicts with what you find in the repo, say what you'd do instead and why, rather than quietly following the prompt into a bug.

## Reference

On a Low item: confirm the picker shows In Stock above and Out of Stock below, and that tapping Out of Stock turns it red and keeps it listed. On an Out item: confirm In Stock and Low Stock are both above. Open a picker, then tap a different item's badge — the first must close. Open one and tap empty space, then scroll — both must close with no change. Choose In Stock — the item should leave the list and the section count should drop. Confirm the `DD:HH:MM` timer restarts. **Test on the real Android phone** — specifically that every option in the expanded picker is tappable, and that the animation is smooth rather than janky. Confirm the Reports screen shows the ping in that item's history for today (or, if you stopped at the history decision, that the summary says so plainly).

## Prerequisites to verify (list in your final summary)
- None expected. State any you discover.

End your summary with the **Files changed** list required by AGENTS.md.
