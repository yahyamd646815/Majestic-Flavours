Read AGENTS.md first and follow it strictly.

**Suggested: Opus, extra-high effort.** Genuinely novel logic — nothing else in this app generates a sequence of future events from a rule. This isn't a bigger version of pattern-following work; it's the hardest single piece of the whole to-do list feature.

**Prerequisite:** `v2-supabase-patch-round5.sql` must already be applied. Verify before starting.

## Scope — read this before writing anything

This prompt covers the recurrence **data model, occurrence-generation algorithm, and a basic structured form** for creating a recurring task. It does **not** cover the calendar-based custom date picker, the live occurrence preview, or combining custom dates with a structured rule — that's a separate, later prompt. Build the plain "every N weeks on Tuesday and Wednesday, ending after 10 occurrences" case well; don't reach toward calendar UI.

## Background — what's already decided, so you're not re-deriving it

- **"Every N [weekday]" means "every N weeks, on that weekday"** — not "the Nth weekday of the month" (impossible past N=5, and inconsistent with the confirmed "7th Friday ≈ every 2 months" example). This is already baked into the schema's `day_pattern`/`day_interval`/`days_of_week` shape.
- **A recurrence rule is deliberately not a hidden row in `tasks`.** Its own data (title, category, description, assignees) lives in `task_recurrence_rules`/`task_recurrence_assignments`. Each actual occurrence is a genuinely ordinary `tasks` row — reuse all of the existing task machinery (assignment, completion, deletion) unchanged for occurrences; don't special-case them anywhere except generation itself.
- **Generation is client-side**, confirmed with Yahya as an accepted trade-off over a server-side scheduled job — whichever device opens the app first after an occurrence comes due is what generates it.
- **Multiple times per day are a real requirement**, not an edge case — `times_of_day` is an array (e.g. `['03:34','13:19','17:02']`), and `hour_interval` mode (e.g. "every 8 hours") generates multiple due times per occurring day, anchored to midnight Riyadh.

## Task

### 1. Types

Add `TaskRecurrenceRule` and related types to `types/tasks.ts`, matching the SQL schema's shape closely (day pattern, interval, days of week, time pattern, times of day / hour interval, end condition, assignees).

### 2. The generation algorithm — pure, testable, in `lib/`

A function along these lines (exact shape and naming your call, but the behavior below is required):

```ts
function generateDueOccurrences(
  rule: TaskRecurrenceRule,
  existingOccurrenceKeys: Set<string>,
  upToMs: number,
): { dueAt: string; occurrenceKey: string }[]
```

Requirements:
- **Everything in Riyadh wall-clock terms**, matching the existing `riyadhDateTimeToIso`/`getTodayIsoDate` pattern in `lib/reports.ts` — reuse those helpers, don't reimplement Riyadh timezone math.
- **Start point:** the rule's own `created_at` — the first occurrence is the first matching day/time at or after creation. (No separate "start date" field exists in the schema; if this turns out to contradict something Yahya actually wants, flag it rather than silently building around it.)
- **Day pattern:** `daily` steps by `day_interval` days; `weekly` steps by `day_interval` weeks, only landing on days in `days_of_week`; `monthly` steps by `day_interval` months, same day-of-month.
- **Time pattern:** `fixed` applies each entry in `times_of_day` to every occurring day; `interval` generates every `hour_interval` hours starting from midnight Riyadh on each occurring day (so "every 8 hours" always produces 00:00/08:00/16:00, not times relative to when the rule was created).
- **End condition:** stop generating past `ends_on_date`, or once `ends_after_occurrences` total occurrences (not just newly-generated ones — the running total across all time) have been produced.
- **Only return occurrences at or before `upToMs`** that aren't already in `existingOccurrenceKeys` — this function generates "what should exist by now that doesn't yet," not the full future sequence.
- **`occurrenceKey` must be deterministic** from the occurrence's own Riyadh date/time — the same logical occurrence must always produce the same key, since it's what prevents regenerating a duplicate.

Write real tests for this — daily, weekly with multiple days-of-week, monthly, both time patterns, both end conditions, and the "already generated, don't duplicate" case. This is the highest-risk logic in the entire to-do list feature; it deserves real coverage, not a happy-path smoke test.

### 3. Generation hook — runs once per session

A new hook (e.g. `useTaskOccurrenceGeneration`), called once from the authenticated layout alongside `useSupabaseSync`/`useReportCleanup`, following their established pattern: guarded on `isSignedIn`, runs once per session. For each active recurrence rule, compute missing occurrences via the function above and insert them as ordinary `tasks` rows (plus their copied-forward `task_assignments`, from `task_recurrence_assignments` at generation time — not read live from anywhere else).

### 4. Recurrence rule store

CRUD for `task_recurrence_rules`/`task_recurrence_assignments`, mirroring `taskStore.ts`'s existing conventions (in-memory cache, `fetchAll` seeded by `useSupabaseSync`).

### 5. Basic creation UI

Add a One-time / Recurring toggle to task creation. When Recurring is selected, show the structured fields directly (day pattern + interval, day-of-week checkboxes when applicable, time pattern + times, end condition) — plain form controls, no calendar. Where exactly this lives (a variant of `TaskFormModal`, or a new component it delegates to) is your call — verify `TaskFormModal`'s current actual structure before deciding, don't assume the shape from memory of an earlier prompt.

## Constraints

- Don't build the calendar UI, custom date picking, or occurrence preview — separate prompt.
- Don't touch completion, deletion, or category management — unrelated, already shipped.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Create a rule for "every 2 weeks on Monday and Thursday, 09:00 and 15:00, ending after 6 occurrences" and confirm the generated occurrences land on the right dates and times, stop at exactly 6, and reopening the app doesn't duplicate any of them. Separately, create an hourly-interval rule ("every 6 hours, daily") and confirm it produces four occurrences per day at the expected times, not times relative to creation.
