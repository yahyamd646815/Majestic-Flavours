Read AGENTS.md first and follow it strictly.

**Suggested: Sonnet, medium effort.** Small, contained — one optional prop, one conditional message.

Small follow-up to `v2-03-c`, delivered separately since that work is already merged. `DeleteConfirmModal` is shared with Inventory, which has no concept of a recurring series — its default confirmation text should stay generic for that context. This adds an optional override, used only when it's actually relevant.

## Task

Verify `DeleteConfirmModal`'s current actual props before changing it — don't assume its shape from this description. Add an optional message prop (e.g. `warningMessage?: string`) that, when provided, replaces the default "Are you sure you want to delete this?" text on the first confirmation step. Leave the second step (typed-DELETE) as-is — it's already a generic, severe-action confirmation and doesn't need per-context wording.

In `tasks.tsx`, when `deleteTarget` has a non-null `generatedFromRecurrenceRuleId`, pass a message making the actual consequence explicit — something like: "This will also cancel the entire recurring series — no further occurrences will be created. This action cannot be undone." For a task with no recurrence link, omit the prop entirely so the modal's existing default text is unchanged.

## Constraints

- Don't touch anything about assignment, completion, or the recurrence generation logic itself.
- Don't change `DeleteConfirmModal`'s behavior for Inventory — confirm its existing call site there still passes no override and gets the same default text as before.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Delete a one-time task and confirm the message is unchanged from before. Delete a generated occurrence of an active recurring rule and confirm the series-specific warning shows instead. Delete an inventory item and confirm nothing about that flow changed at all.
