import { useAuth, useUser } from "@clerk/expo";
import { usePostHog } from "posthog-react-native";
import { useEffect, useRef } from "react";

import { parseRole } from "@/types/role";

/**
 * Identifies the signed-in person to PostHog and captures `user_signed_in`,
 * once per real session.
 *
 * Keyed on Clerk's `sessionId` via a ref, exactly like `useReportCleanup` and
 * for the same reason: `isSignedIn`/`role` alone would re-fire if a role
 * flickers off and back on mid-session, or on any other re-render that
 * momentarily changes those values. The ref guarantees at most one identify +
 * one sign-in event per distinct sessionId.
 */
export function useAnalyticsIdentify(isSignedIn: boolean) {
  const { sessionId } = useAuth();
  const { user } = useUser();
  const posthog = usePostHog();
  const role = parseRole(user?.publicMetadata?.role);
  const identifiedSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user || !role || !sessionId) return;
    if (identifiedSessionId.current === sessionId) return;
    identifiedSessionId.current = sessionId;

    // `role` goes in `$set` so a later role change overwrites it; `signup_date`
    // goes in `$set_once` so it records when this person first existed and is
    // never overwritten by a later identify call. Clerk's `createdAt` is a
    // `Date`, which isn't a JSON property value — serialize it, and omit the
    // key entirely rather than writing a null that `$set_once` would lock in.
    const signupDate = user.createdAt?.toISOString();
    posthog.identify(user.id, {
      $set: { role },
      ...(signupDate ? { $set_once: { signup_date: signupDate } } : {}),
    });
    posthog.capture("user_signed_in", { role });
  }, [isSignedIn, user, role, sessionId, posthog]);
}
