Read AGENTS.md first and follow it strictly.

**Suggested: Opus, extra-high effort.** This project's first Edge Function and first database-triggered webhook — genuinely new infrastructure, an external HTTP call, and real security surface (a service-role key) none of the existing SQL rounds have touched.

**Prerequisite:** `v2-supabase-patch-round11.sql` must already be applied.

**This also needs the native module** (`expo-notifications`, already installed in `v2-03-e1`) for receiving and displaying a push notification on the client — no additional install needed, but this still can't be tested until the same rebuild `v2-03-e1` is waiting on. Do the rebuild once both are done, not after this prompt alone.

## Part A — push token registration

On sign-in, request notification permission (reuse `ensureNotificationPermission` from `v2-03-e1` — same OS-level permission covers both local reminders and push, so requesting it twice under different circumstances is fine; the function already short-circuits when it's already granted). If granted, get this device's Expo push token (`Notifications.getExpoPushTokenAsync`) and store it against this person's `app_users` row.

This is a deliberate departure from `v2-03-e1`'s lazy, reason-attached permission request: local reminders are an opt-in personal preference, so asking felt right only at the moment someone actually wants one. Being notified when you're assigned something is universally relevant to every member of staff, and there's no equivalent "moment" to attach the ask to on the assignee's own device — someone else does the assigning. Requesting it at sign-in is the only place that makes sense here.

Verify the natural place for this — likely alongside `syncSelf` in `useSupabaseSync.ts`, since that's already the established "write my own `app_users` row on session start" path — rather than assuming a new, separate hook is warranted. Confirm the existing RLS on `app_users` actually permits a person to write their own `expo_push_token` before assuming it does.

## Part B — the Edge Function

A new Supabase Edge Function that, given a task id and an employee's Clerk id, looks up that employee's `expo_push_token` and the task's title, and sends a push notification via Expo's push API (`https://exp.host/--/api/v2/push/send`) if a token exists. Needs its own service-role Supabase client to read `app_users`/`tasks` without being subject to RLS — verify whether the service role key is already available to Edge Functions in this project by default (it usually is, injected automatically) rather than assuming a new secret needs configuring.

No push if the employee has no registered token (they were never asked, or declined) — this should fail silently from the trigger's perspective, not retry or error the whole webhook.

## Part C — triggering it

A database trigger on `task_assignments`, firing `AFTER INSERT`, that calls the Edge Function via `supabase_functions.http_request` (or whatever the current, correct mechanism for this actually is in this Supabase project — verify rather than assume, since this is genuinely new territory here). Write this as SQL, in its own round, matching this project's established pattern of every schema/infrastructure change living in a file Yahya runs himself — not a manually-configured dashboard webhook, which would be invisible to this project's own history of what's been applied.

**Scope decision, stated explicitly:** a recurring task's occurrence generation also inserts into `task_assignments` (copying the rule's assignees forward), and a high-frequency recurring task would otherwise trigger a push every single time it regenerates — "you were just assigned a task," daily, forever, for something that's just routine, expected work. Skip sending a push when the newly-assigned task's `generated_from_recurrence_rule_id` is not null. Hand-created assignments (including bulk-assign) still push normally — that's someone actively choosing to hand you something new, which is the actual case being served here.

## Constraints

- Don't touch local reminders, the reminder UI, or anything from `v2-03-e1` — this is additive, separate infrastructure alongside it.
- Don't touch recurrence generation logic itself, only how its resulting inserts are filtered at the trigger level.
- Strict TypeScript, no `any`, for anything on the client side. Follow whatever this Supabase project's own Edge Function conventions are (Deno-based) for the function itself.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` for the client-side changes.

## Reference

This can't be end-to-end tested without the rebuild — note in the summary exactly what was and wasn't verifiable, the same way `v2-03-e1`'s summary did. What can be checked now: that the trigger and function exist and are syntactically valid, and that a manual test insert into `task_assignments` (for a task with a real, hand-created origin and an employee with a token already in `app_users`) actually results in a call reaching Expo's push endpoint — check this via Supabase's own function logs if that's reachable without a rebuilt client.
