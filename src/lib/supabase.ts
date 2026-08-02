import { useAuth } from "@clerk/expo";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";

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

  return useMemo(
    () =>
      createClient(supabaseUrl, supabaseAnonKey, {
        accessToken: async () => (await getToken()) ?? null,
      }),
    [getToken],
  );
}
