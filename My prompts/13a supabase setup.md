Read AGENTS.md first and follow it strictly.

## Task

Set up the Supabase client and wire it to authenticate as the signed-in Clerk user, so Row Level Security can enforce real access control. This prompt does **not** touch any Zustand store, any screen, or any UI — that's prompts 13b and 13c. The database schema and RLS policies already exist (applied manually, outside this prompt) — treat them as a fixed external constraint, don't attempt to design or modify them.

### 1. Environment variables

Add to `.env` (already gitignored) and document in `.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```
Only the anon key — never the service role key — per AGENTS.md's Secrets Rule. The anon key is safe for client code; RLS (already applied) is what actually restricts what it can do.

### 2. Install the client

`npx expo install @supabase/supabase-js` — this is the one new dependency this prompt needs; it's already named in AGENTS.md's approved Tech Stack, so no separate approval round-trip needed.

### 3. `src/lib/supabase.ts` — a Clerk-authenticated Supabase client

Clerk supports Supabase as a native Third-Party Auth provider — Supabase verifies Clerk-signed session tokens directly via Clerk's JWKS endpoint. This requires two manual dashboard steps that must be done before this code will actually work (not part of this prompt — confirm with the user these are done):
- **Clerk Dashboard** → `dashboard.clerk.com/setup/supabase` → Activate the Supabase integration → copy the resulting Clerk domain.
- **Supabase Dashboard** → Authentication → Sign In / Providers → Add provider → Clerk → paste the Clerk domain.

The above is confirmed directly from Clerk's own current Supabase integration guide. That guide only ever demonstrates user-ID-based RLS (`auth.jwt()->>'sub'`), not role-based RLS — getting `role` into the token at all requires a separate, general Clerk feature (Sessions → Customize session token → a custom claim such as `{ "metadata": "{{user.public_metadata}}" }`), which is not confirmed by that specific guide. Verify this independently once configured: decode a real session token (e.g. at jwt.io) and confirm a `metadata.role` field is actually present before trusting any RLS policy built on it.

```ts
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/expo";
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
```

This is the current officially supported integration method (the older JWT-template + shared-secret approach is deprecated as of April 2025) — if Supabase's or Clerk's docs describe something different by the time this runs, follow their current docs over this prompt.

### 4. Sanity-check query (temporary, for verification only)

Add a small temporary block — not permanent UI — somewhere easy to trigger (e.g. a `console.log` in the Dashboard, guarded by `if (__DEV__)`, same spirit as previous temporary verification steps in this project) that runs a simple `select` against `categories` (or another table) using `useSupabaseClient()`, and logs the result or any error. This is purely to confirm the connection and auth wiring actually work end to end before 13b/13c build real functionality on top of it. Remove it once confirmed working — same discipline as every previous temporary test block in this project.

## Constraints

- Do not create, modify, or reference `userStore` — there is still no Zustand store for identity. This prompt is only about the Supabase *connection*, not about fetching/caching `app_users` (that's 13b/13c).
- Do not modify `inventoryStore.ts`, `reportStore.ts`, `unitsStore.ts`, or any screen.
- Only the anon key in client code — never the service key.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

The schema and RLS policies this client will talk to are in `supabase-schema-and-rls.sql` (already applied directly in the Supabase dashboard, not part of this repo's migration history yet — that's worth adding as a tracked `supabase/migrations/` file in a later cleanup, not required now).