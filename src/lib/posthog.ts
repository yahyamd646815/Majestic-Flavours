/**
 * PostHog configuration only — deliberately no client instance here.
 *
 * The single PostHog client for the whole app is created by the
 * `PostHogProvider` wrapping the root layout (`src/app/_layout.tsx`).
 * Everywhere else reads it through `usePostHog()`. Constructing a second
 * `PostHog` here would double-initialize the SDK (two queues, two device
 * ids), so this file exports config values and nothing more.
 *
 * The project API key is a client-side key, same trust model as Clerk's
 * publishable key and Supabase's anon key. The host differs per PostHog
 * region (US vs EU), so it stays an env var rather than being hardcoded.
 */
export const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY!;
export const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST!;

if (!posthogApiKey || !posthogHost) {
  throw new Error(
    "Missing EXPO_PUBLIC_POSTHOG_API_KEY or EXPO_PUBLIC_POSTHOG_HOST. Add them to your .env file.",
  );
}
