Read AGENTS.md first and follow it strictly.

**Suggested: Opus, extra-high effort.** Two of these three issues genuinely can't be fixed confidently from code alone — this prompt is structured as diagnose-then-fix specifically because guessing wrong here risks a second broken "fix" on top of the first, real bug.

## Part A — the timezone picker bug (diagnose first, then fix)

**Do not skip straight to the fix. Verify the hypothesis on a real device first.**

Working hypothesis, from Yahya's own device testing: `@expo/ui/community/datetime-picker`'s `NativeDateTimePicker` appears to construct its returned `Date` as *midnight UTC on the picked calendar day* (for date mode) and *the picked clock time interpreted as UTC* (for time mode) — not as the device's own local time, which is what every piece of code reading it (`resolveDueAt`, `pickerTimeToHHMM`, `dueAtToPickerDate`, `RecurrenceFields`'s `addTime`) currently assumes. On a device whose local offset happens to equal Riyadh's (AST, UTC+3), this bug is invisible, since local getters happen to coincide with the intended Riyadh digits. On any other offset (Yahya tested EDT, UTC-4), it produces a real, wrong shift — a day back for dates, several hours off for times.

**Step 1 — confirm this directly.** Add temporary, clearly-marked logging (per AGENTS.md's Temporary Code convention) somewhere a date/time picker's raw returned value can be inspected — log both its local getters (`getFullYear()`, `getDate()`, `getHours()`, etc.) and its UTC getters (`getUTCFullYear()`, `getUTCDate()`, `getUTCHours()`, etc.) side by side. Ask Yahya to pick a specific, known date/time on a device set to a non-Riyadh, non-UTC timezone (EDT is what he already has available) and report back both sets of numbers against what he actually tapped.

**Step 2 — only if Step 1 confirms the hypothesis:** the fix is reading the picker's *UTC* getters instead of local ones everywhere its return value is currently read as "the Riyadh digits the person picked" — `resolveDueAt`, `pickerTimeToHHMM`, `pickerDateToIsoDate`, and the reverse conversion in `dueAtToPickerDate` (which would need to *write* UTC components instead of local ones when seeding a picker for editing, the exact inverse of whatever Step 1 reveals). Update every test in `tasks.test.ts` and `taskRecurrence.test.ts` that constructs a `Date` to simulate a picker's return value, since they currently construct via the local `new Date(year, month, day, ...)` constructor — if the real picker doesn't behave that way, these tests have been validating the wrong thing since they were written, and need to change to match the picker's actual, confirmed contract.

**If Step 1 does not confirm the hypothesis** — stop, report exactly what the logged numbers show, and do not apply a fix based on a guess.

## Part B — completion failures need to be diagnosable, not silent

`completeTask` in `taskStore.ts` currently discards the actual Supabase error on any failure — `if (error || !data) return false;` with no logging at all. Right now neither Yahya nor anyone else can see *why* every completion attempt is failing. Add `console.warn` logging of the real error object before returning `false`, matching the pattern already used elsewhere in this codebase (e.g. `useTaskOccurrenceGeneration`'s own warn-on-failure logging) — this is permanent diagnostic logging, not temporary code, since silent store failures are a real, recurring risk worth always being able to see.

Also add the same kind of logging to `addTask`, `updateTask`, `addAssignment`, and `removeAssignment` in the same file if they don't already have it — check each one's current state rather than assuming; several already log via other means, and this shouldn't duplicate that.

**Do not attempt to fix the actual completion failure in this prompt** — the cause isn't known yet. Once this logging lands, Yahya will reproduce the failure and report the actual error message, and that becomes its own follow-up.

## Part C — overdue status needs to update without a manual reload

Nothing currently causes the Tasks screen (or the Records page) to re-render as time passes, so a task that crosses its due time stays showing as "not overdue" until some *other* event happens to trigger a render.

Add a small, reusable hook (e.g. `useNowTick(intervalMs: number)`) that holds the current time in state and updates it on an interval, causing its caller to re-render periodically. A minute-level interval is enough given nothing here needs sub-minute precision. Use it in `tasks.tsx` (driving `isTaskOverdueForEmployee`/`isTaskPastDue`'s implicit `nowMs`, and the overdue-first sort) and in `records.tsx`/`EmployeeRecordDetailModal.tsx` (same reasoning — the Records page shows live overdue status too). Keep the hook itself generic and placed somewhere reusable, since the Dashboard's own live timer (`v2-04`, not yet built) will likely want the identical primitive rather than a second implementation.

## Constraints

- Part A: no fix without Step 1's confirmation first. This is the one place in this whole project where guessing and moving fast is explicitly the wrong call.
- Part B: diagnostic logging only — no attempt to fix the underlying completion failure in this prompt.
- Don't touch anything about recurrence generation logic, the calendar UI, or task deletion — unrelated to these three issues.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` after each part.

## Reference

Part A: the real test is Yahya's own device, both before Step 1 (to see the raw numbers) and after Step 2's fix (to confirm a picked date/time now matches exactly on both EDT and AST). Part B: Yahya reproduces the completion failure once logging lands and reports the actual console output. Part C: create a task due a couple of minutes out, leave the app open without touching anything, and confirm it flips to Overdue on its own once the time passes.
