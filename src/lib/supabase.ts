import { useAuth } from "@clerk/expo";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef } from "react";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Add them to your .env file.",
  );
}

/**
 * Returns a Supabase client authenticated as the current Clerk user, via
 * Clerk's native Supabase third-party auth integration (`accessToken`
 * returns the current Clerk session token; Supabase verifies it directly
 * against Clerk's JWKS endpoint — no shared JWT secret, no custom template).
 * RLS policies (applied directly in Supabase, not in this codebase) check
 * this token's claims to decide what a request can see or change.
 */
export function useSupabaseClient() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);

  // Ref mutation is kept in an effect (not inline during render) to satisfy
  // the react-hooks/refs rule — it still lands before accessToken is ever
  // actually invoked, since Supabase only calls it later, asynchronously.
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  // Created once per component instance — accessToken always calls whatever
  // getToken currently is via the ref, so this never goes stale despite never
  // recreating the client. Clerk's getToken reference changes periodically as
  // the session token refreshes in the background; if the client identity
  // were tied to it (via [getToken] deps), every refresh would produce a new
  // client object and re-trigger every effect keyed on it downstream.
  // react-hooks/refs can't see that Supabase only calls accessToken later,
  // asynchronously — never synchronously during this render.
  /* eslint-disable react-hooks/refs */
  return useMemo(
    () =>
      createClient(supabaseUrl, supabaseAnonKey, {
        accessToken: async () => (await getTokenRef.current()) ?? null,
      }),
    [],
  );
  /* eslint-enable react-hooks/refs */
}
