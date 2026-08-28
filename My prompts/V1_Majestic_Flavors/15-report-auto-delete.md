Read AGENTS.md first and follow it strictly.

## Task

Implement automatic deletion of reports older than 4 months, admin-only, running silently once per signed-in admin session.

**Prerequisite, not part of this prompt:** `supabase-patch-round7.sql` must already be applied. Without it, every delete attempt this prompt implements will fail — no table currently has any DELETE policy, and a cascade delete still needs RLS permission on the child tables it touches, not just the parent.

### 1. `src/hooks/useReportCleanup.ts`

```ts
import { useAuth, useUser } from "@clerk/expo";
import { useEffect, useRef } from "react";

import { getTodayIsoDate } from "@/lib/reports";
import { useSupabaseClient } from "@/lib/supabase";
import { parseRole } from "@/types/role";

/** 4 months back from "today" (Riyadh-based, matching the rest of the app's
 * date handling) — this doesn't need day-level precision the way report
 * submission timing does, since it's routine cleanup, not something that
 * can wrongly reject a legitimate action. */
function getCutoffIsoDate(): string {
  const today = getTodayIsoDate();
  const [year, month, day] = today.split("-").map(Number);
  const cutoff = new Date(Date.UTC(year, month - 1 - 4, day));
  const cutoffMonth = String(cutoff.getUTCMonth() + 1).padStart(2, "0");
  const cutoffDay = String(cutoff.getUTCDate()).padStart(2, "0");
  return `${cutoff.getUTCFullYear()}-${cutoffMonth}-${cutoffDay}`;
}

/**
 * Deletes reports older than 4 months, once per signed-in admin session.
 * Silent by design — no loading state, no UI, console logging only.
 *
 * Keyed on Clerk's `sessionId` (via a ref), not just `isSignedIn`/`role` —
 * those two alone could re-run cleanup a second time if an admin's role
 * flickers off and back on mid-session (e.g. a role correction elsewhere
 * while this session is still open), and wouldn't catch a switch to a
 * different already-authenticated admin session if one ever happened
 * without an intervening sign-out. The ref guarantees at most one run per
 * distinct sessionId, regardless of how many times role or isSignedIn
 * happen to toggle around it.
 */
export function useReportCleanup(isSignedIn: boolean) {
  const { sessionId } = useAuth();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const role = parseRole(user?.publicMetadata?.role);
  const lastRunSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || role !== "admin" || !sessionId) return;
    if (lastRunSessionId.current === sessionId) return;
    lastRunSessionId.current = sessionId;

    const cutoff = getCutoffIsoDate();
    void supabase
      .from("reports")
      .delete()
      .lt("date", cutoff)
      .select("id")
      .then(({ data, error }) => {
        if (error) {
          console.warn("[useReportCleanup] Failed to delete old reports:", error);
          return;
        }
        console.log(
          `[useReportCleanup] Deleted ${data?.length ?? 0} report(s) older than ${cutoff}.`,
        );
      });
  }, [sessionId, role, isSignedIn, supabase]);
}
```

### 2. Wire it into `src/app/(app)/_layout.tsx`

Call `useReportCleanup(isSignedIn === true)` once, alongside the existing `useSupabaseSync` call — same placement, above the early returns, for the same rules-of-hooks reason.

## Constraints

- No loading state, no UI of any kind — console only, exactly as specified.
- Do not update `reportStore`'s local `reports` array after a successful cleanup. This is a deliberate, minor limitation, not an oversight: an admin browsing "All Time" for the remainder of that session might still see an already-deleted report until the next natural refetch. Reconciling this isn't worth the complexity for something this infrequent and low-stakes.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

To actually test deletion (not just confirm it doesn't error), you'll need at least one report dated more than 4 months back — the fastest way is editing a test report's `date` column directly in Supabase's Table Editor, then signing in as admin and confirming the console log reports it deleted, followed by a manual check that the row (and its child rows) are genuinely gone.