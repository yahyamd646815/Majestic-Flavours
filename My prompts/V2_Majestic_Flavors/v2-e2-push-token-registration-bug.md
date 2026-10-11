Read AGENTS.md first and follow it strictly.

**Suggested: Opus, high effort.** Needs to distinguish between several genuinely different failure points before touching anything — guessing wrong here means another round of device testing for nothing.

## The problem

`expo_push_token` on `app_users` is null for every account tested, including a fresh sign-in on both the dev and preview builds (both already rebuilt with `expo-notifications` linked in, confirmed). Local reminders (`v2-03-e1`) are confirmed working end-to-end on this same device, including a real fired notification — so the native module itself and baseline OS notification support are not in question. This is specifically about push token registration (`v2-03-e2`, Part A) never actually landing in the database.

## Diagnose first — check each of these against the actual current code, don't assume which one it is

- **Permission state.** `ensureNotificationPermission` prompts only if not already decided — if the OS permission was ever denied during earlier local-reminder testing on this device, Android typically won't re-prompt on a later call, and registration would silently never proceed past that check. Check whether the registration path actually distinguishes "permission denied" from "not yet asked," and whether it logs which one it hit.
- **`getExpoPushTokenAsync` itself.** This call needs a valid EAS `projectId` to succeed — verify `app.config.js`/`app.json` actually has one configured correctly, and that the call's own success/failure is logged rather than swallowed.
- **The RLS policy on `app_users`.** Confirm a signed-in user can actually update their own `expo_push_token` column — this was flagged as something to verify when this feature was originally written, not confirmed as actually checked. If the write is being silently rejected, that would produce exactly this symptom.
- **The registration guard's scope.** If this runs through a session-keyed ref pattern (matching `useTaskOccurrenceGeneration`/`useTaskRecordCleanup`'s established shape), verify what the guard is actually keyed on. If it's keyed on something that doesn't change across a sign-out/sign-in cycle on the same device — rather than being scoped to *which account* just signed in — switching accounts would never re-trigger registration at all, which matches what's been observed.

Add logging at each of these checkpoints if it isn't already there (matching the established "don't fail silently" pattern from `taskStore.ts`'s completion logging) — this needs to be genuinely diagnosable the next time, not just fixed once and left silent again.

## Fix whatever it actually turns out to be

Don't fix all four preemptively — find the actual cause first, then fix that one, and confirm the others are fine rather than leaving them as unverified assumptions either way.

## Constraints

- Don't touch local reminders or anything about the Edge Function/push-sending side — this is specifically about the client-side registration step that writes the token in the first place.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Sign out and back into a test account on the dev build and confirm a token actually appears in `app_users.expo_push_token` afterward. Switch to a different account on the same device without reinstalling and confirm that account also gets its own token written — this is the specific case that's been failing.
