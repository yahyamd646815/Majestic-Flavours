Read AGENTS.md first and follow it strictly.

**Suggested: Opus, high effort.** The diagnosis is already confirmed by both source-code reading and real device logs, so this is narrower than the original diagnostic work — but timezone math is exactly the kind of thing that's easy to get subtly wrong a second time while fixing the first mistake, and one part of this (the minimum-date behavior) is still a genuine, unexplained investigation.

## Background — what's confirmed, so this isn't guessed at again

Real device logs (EDT, UTC-4) confirm the split hypothesis from the prior session precisely:
- **Date mode is broken**: the picker's raw returned value has UTC midnight of the picked day baked in — local getters read it as 4 hours short of midnight, landing on the previous day.
- **Time mode's raw picker value is already correct**: local getters on the picker's return value match what was actually picked, exactly as the Kotlin source predicted.

## Part A — fix date mode, leave time mode alone

Everywhere a date picker's value is read as "the Riyadh date the person picked," switch from local getters to UTC getters: `pickerDateToIsoDate`, the date half of `resolveDueAt`. **Do not touch how time is read anywhere** — `pickerTimeToHHMM` and the time half of `resolveDueAt` are already correct; changing them would introduce a new, real bug on top of fixing this one.

`dueAtToPickerDate` needs more care than a blind getter swap: it currently constructs one `Date` and hands the same value to both the date and time pickers. Since date and time now need genuinely different construction (UTC-based for date, local-based for time — confirmed by the logs above), a single shared value can no longer correctly seed both. Split this into two separate seeding functions, or otherwise make the date half construct a value whose *UTC* digits carry the intended Riyadh date, while the time half keeps constructing a value whose *local* digits carry the intended Riyadh time, matching how each picker actually reads its own `value` prop back.

Update every test in `tasks.test.ts` and `taskRecurrence.test.ts` that constructs a `Date` to simulate a picked date via the local constructor (`new Date(year, month, day, ...)`) — these were validating the wrong contract for date mode specifically, and need to construct via `Date.UTC(...)` instead to match the picker's actual, confirmed behavior. Leave any test simulating a picked *time* exactly as it is.

## Part B — investigate the minimum-selectable-date behavior

Yahya observed: at EDT 17:10 on 31 Aug (Riyadh already past midnight into 1 Sep at that instant), the date picker would no longer let him select 31 Aug at all — its earliest selectable date had already advanced to match Riyadh's current date, not his device's own current date. Neither `TaskFormModal.tsx` nor `RecurrenceFields.tsx`'s end-date picker currently pass an explicit `minimumDate` prop, so this is coming from the library's own default behavior — read the relevant Kotlin/Swift source the same way the prior session did for the core bug, rather than guessing at the mechanism. Explain what's actually happening before proposing any change, and only change something if it's genuinely wrong (a person on a legitimately different device timezone should be able to pick their own device's current date, at minimum) — this may turn out to already be resolved by Part A's fix, in which case say so rather than adding an unneeded change.

## Part C — verify time mode is actually correct, don't just trust the arithmetic

Yahya's own observation ("-7 hours" between what he picked and what he later saw) is very likely `formatDueDateTime` correctly re-rendering an already-correctly-stored value in device-local terms — not a stored-data bug. Confirm this directly rather than taking it on faith: create a task, note its picked time, and check the actual `due_at` value written to Supabase against what Riyadh's own equivalent of that picked time should be. Report this confirmation explicitly in the summary — this determines whether Part A's scope (date only) was correctly bounded, or whether time needs attention after all.

## Part D — remove the temporary diagnostic code

`pickerDebug.ts` and its four call sites (`TaskFormModal.tsx`, `RecurrenceFields.tsx`) were marked TEMPORARY-START/END specifically for this diagnosis, which is now complete. Remove all of it.

## Constraints

- Don't touch the RLS/completion-failure issue — that's a separate, unrelated SQL problem being handled independently.
- Don't touch recurrence generation logic, the calendar UI, or anything about task deletion.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Create a task, pick a specific known date and time on the EDT device, and confirm both the date and time saved match what was actually picked — checked directly against Supabase, not just the in-app display (which will still legitimately show device-local digits by design). Confirm the date picker's minimum-selectable-date behavior now matches expectations, or that Part B's investigation explains why it already did. Edit an existing task without touching either picker and confirm its due time round-trips unchanged, the same guarantee `dueAtToPickerDate`'s original tests already proved for the old (broken) contract — this needs to hold under the new one too.
