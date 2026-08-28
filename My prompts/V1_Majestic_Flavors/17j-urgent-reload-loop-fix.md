Read AGENTS.md first and follow it strictly.

**Urgent — reported directly from the restaurant as making the app practically unusable on their WiFi.** Video evidence: the Reports screen repeatedly and involuntarily drops back into a full "Loading inventory..." spinner every few seconds, discarding already-loaded content each time. Confirmed from the actual video, not just the description.

## Root cause

`useSupabaseClient()` (`lib/supabase.ts`) recreates the entire Supabase client via `useMemo(..., [getToken])`. Clerk's `getToken` reference changes periodically as the session token refreshes in the background, producing a new client object each time — and `useSupabaseSync.ts`'s fetch-triggering effect has `supabase` in its dependency array, so React treats each new client as a reason to re-run the effect, calling `fetchInventory`/`fetchUnits`/`fetchReports` again. Each call flips `isLoading` back to `true`, discarding the screen's already-loaded content. On a fast connection this can resolve fast enough to go unnoticed; on a slow, congested connection each cycle is a multi-second visible reload, repeating every few seconds.

`useReportCleanup.ts` has the identical `supabase`-in-dependencies pattern, but its `sessionId`-ref guard happens to make every extra re-fire a harmless no-op (no loading state involved) — worth fixing for consistency and to stop the wasted repeated work, even though it isn't causing a visible bug there.

## Task

### 1. Stabilize the client itself — `lib/supabase.ts`

Use a ref to always call the *latest* `getToken`, while keeping the client's own identity permanently stable (created exactly once per component instance) rather than tied to `getToken`'s reference:

```ts
export function useSupabaseClient() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken; // updated every render, no effect needed

  return useMemo(
    () =>
      createClient(supabaseUrl, supabaseAnonKey, {
        accessToken: async () => (await getTokenRef.current()) ?? null,
      }),
    [], // created once — accessToken always calls whatever getToken currently is via the ref, so this never goes stale despite never recreating the client
  );
}
```

This fixes the root cause for every consumer of this hook throughout the app, not just the two files below.

### 2. Decouple the fetch trigger — `useSupabaseSync.ts`

Remove `supabase` from both effects' dependency arrays. The fetch functions still use `supabase` inside the effect body (closure capture is fine here — the value read is whatever the stable client currently is), but re-running should be driven only by what's actually supposed to gate it (`isSignedIn`, and for the second effect, the Clerk identity fields):

```ts
useEffect(() => {
  if (!isSignedIn) return;
  void fetchInventory(supabase);
  void fetchUnits(supabase);
  void fetchReports(supabase);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isSignedIn, fetchInventory, fetchUnits, fetchReports]);
```

Same removal for the second effect (`syncSelf`/`fetchAppUsers`) — keep `isSignedIn`, `clerkUserId`, `name`, `email`, `syncSelf`, `fetchAppUsers`, drop `supabase`.

### 3. Same cleanup in `useReportCleanup.ts`

Remove `supabase` from its effect's dependency array too, for the same reason — currently harmless there only because of the `sessionId` ref-guard, but there's no reason to leave the same fragile pattern in place once it's being fixed elsewhere.

### 4. Search for any other instance of this pattern

Grep the codebase for `useSupabaseClient()` combined with `supabase` appearing in a `useEffect` dependency array elsewhere — the two files above are the ones already confirmed, but don't assume they're the only ones. Apply the same fix anywhere else it's found.

## Constraints

- Don't touch anything about *what* gets fetched or *when* it should conceptually run — only how the trigger is wired. `useSupabaseSync` should still fetch exactly once per signed-in session, same as its own doc comment already says was always the intent.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

The visible symptom is network-dependent, so testing on good WiFi can give false confidence. The real test: add a temporary log inside `useSupabaseSync`'s first effect, marked per AGENTS.md's Temporary Code convention —

```ts
// TEMPORARY-START: confirms this effect fires once per session, not repeatedly.
// Safe to delete once Yahya confirms exactly one log line over 2–3 minutes of real use.
console.log("[useSupabaseSync] fetch effect fired");
// TEMPORARY-END
```

— then leave the app open and signed in for 2–3 minutes on any connection and confirm it logs exactly once, not repeatedly. Remove the marked block once confirmed. Optionally, throttling the connection (Android's network condition settings, or equivalent) can reproduce the original visible flicker for a direct before/after comparison, but the log-count check is the one that actually proves the mechanism is fixed rather than just currently fast enough to hide it.
