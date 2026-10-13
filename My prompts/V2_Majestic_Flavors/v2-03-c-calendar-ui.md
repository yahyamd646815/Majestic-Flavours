Read AGENTS.md first and follow it strictly.

**Suggested: Opus, extra-high effort.** A genuinely substantial new UI component (multi-month calendar, multi-select dates) plus a real schema/generation-logic change, on top of the highest-stakes logic already in this codebase.

**Prerequisite:** `v2-supabase-patch-round7.sql` must already be applied — Step 1 must be run and its result substituted into Step 2 before that step runs; verify this actually happened, not just that the file was opened.

## Part A — the first-occurrence fix

**New requirement, changes existing behavior:** when a recurring task rule is created, its very first occurrence should be generated *immediately*, at creation time — not left invisible until its own due time arrives. Once that due time does pass without completion, it becomes "Overdue" through the entirely existing, unchanged badge mechanism. This is specifically about the *first* occurrence only; every subsequent occurrence continues through the normal lazy, due-time-triggered generation in `useTaskOccurrenceGeneration`.

Reuse `generateDueOccurrences` rather than writing new logic — call it with a sufficiently far-future `upToMs` and take only the first result (the function already returns occurrences in chronological order, confirmed by its own test suite). Right after `addRule` succeeds, generate and insert this first occurrence the same way `useTaskOccurrenceGeneration`'s `generateForRule` does (same insert shape, same copied-forward assignments) — reuse or closely mirror that logic rather than duplicating it from scratch.

Confirm this doesn't fight with the normal per-session generation pass: since the occurrence now already exists (with its real `occurrence_key`) by the time `useTaskOccurrenceGeneration` next runs, its own "already exists" check correctly skips it — no special-casing needed there.

## Part B — the calendar UI

### 1. Custom dates as a first-class option, not just an addition

The Repeat toggle in `TaskFormModal` currently offers One-time / Recurring. When Recurring, a rule can now optionally include explicit custom dates *on top of* whatever structured pattern is chosen — or, via the new `'custom'` `day_pattern` value, use *only* custom dates with no structured pattern at all (verify the round7 schema change landed correctly before building against it).

### 2. The date picker

A calendar popup: year → month → multi-select individual days, letting someone pick dates across different months in one session. Reached from within `RecurrenceFields` (verify its current actual structure before extending it — a lot has been built there since it was last touched).

### 3. The live preview

A scrollable, multi-month calendar showing which actual dates the current draft (structured pattern, custom dates, or both) will produce — computed by calling `generateDueOccurrences` against the in-progress draft, not a separate re-implementation. This needs a far-future `upToMs` (there's no "due yet" concept for a preview) and needs to incorporate whatever custom dates are currently drafted alongside the structured pattern, so it accurately reflects the combination described in the original spec.

### 4. Combining the two

Selecting specific dates on the calendar and having a structured pattern selected aren't mutually exclusive — both can be active on the same rule, and the preview should show the union of what both produce. Deciding the exact interaction details (how switching between "structured," "custom," and "both" reads in the UI) is your call — the underlying data model already supports the combination via round7's schema, so build the interaction naturally from that rather than fighting it.

### 5. Generation logic update

`generateDueOccurrences` needs to also read from `task_recurrence_custom_dates` and merge those dates into its output (deduplicated against the structured pattern's own output, and against `existingOccurrenceKeys`, using the same `occurrenceKey` mechanism already in place). For a `'custom'`-pattern rule, skip the structured half entirely rather than attempting to interpret `day_interval`/`days_of_week` for it.

## Part C — deleting one occurrence cancels the whole series

**New requirement:** deleting a single generated occurrence (via `TaskCard`'s existing Delete action, unchanged otherwise) should also stop the recurring rule it came from — no further occurrences ever generate after this. This is different from, and in addition to, the existing rule-deletion behavior (`deleteRule`, which already leaves already-generated occurrences alone via `on delete set null`).

When `deleteTask` is called on a task whose `generatedFromRecurrenceRuleId` is non-null, it should also delete that recurrence rule (reuse `taskRecurrenceStore`'s existing `deleteRule`, don't duplicate its logic). The existing `on delete set null` behavior on `tasks.generated_from_recurrence_rule_id` means any *other* already-generated occurrences of that same rule are left completely alone — only future generation stops. No new permission logic needed: an occurrence's own `createdBy` already matches its rule's creator (copied forward at generation time), so the existing `canDeleteTask` check already governs this correctly once the additional rule-cancellation step is added.

This is a genuine two-step operation (delete the task, then the rule) without transactional guarantees — same class of trade-off as the already-queued "make task mutations atomic" item. Acceptable to leave as-is for now, consistent with how that's already being handled elsewhere in this project.

## Constraints

- Don't touch notifications, the dashboard, or anything unrelated to tasks/recurrence — separate, later work.
- Don't touch completion, deletion, or category management.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`. Given how much the existing `taskRecurrence.test.ts` suite already proves, extend it rather than working around it — new tests for custom-date merging and the `'custom'` pattern, not a parallel test file.

## Reference

Create a rule with only custom dates (no structured pattern) spanning two different months, confirm the preview shows exactly those dates and the generated occurrences match. Create a rule combining a weekly structured pattern with two extra custom dates, confirm the preview shows the union and nothing is duplicated. Create any recurring rule and confirm its first occurrence appears in the task list immediately, without waiting for the due time — then confirm it correctly shows as Overdue once that time passes. Delete one generated occurrence of an active recurring rule and confirm no further occurrences ever appear for it, while any occurrences already generated before the delete remain exactly as they were.
