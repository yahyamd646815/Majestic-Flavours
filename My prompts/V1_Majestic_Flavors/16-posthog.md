Read AGENTS.md first and follow it strictly.

## Task

Add PostHog event tracking. This is the last prompt of the original build — no UI changes anywhere, this is purely an analytics layer on top of what already exists.

**Do not use PostHog's setup wizard/CLI (`npx @posthog/wizard` or similar).** It requires interactive browser authentication mid-run and autonomously decides where to insert tracking calls — both a mismatch for this project's workflow, where every prompt runs unattended and gets reviewed afterward, and where exactly four events are already deliberately named below. Set this up manually, the same way `lib/supabase.ts` was wired by hand in prompt 13a rather than through any automatic tool.

### 1. Environment variables

Add to `.env` (already gitignored) and `.env.example`:
```
EXPO_PUBLIC_POSTHOG_API_KEY=
EXPO_PUBLIC_POSTHOG_HOST=
```
The project's API key, not a secret key — this is meant for client code, same trust model as Clerk's and Supabase's publishable/anon keys already in use. Host depends on which PostHog region the project was created in (US or EU) — leave it as an env var rather than hardcoding either.

### 2. Install

`npx expo install posthog-react-native` plus whatever peer dependencies its own install instructions specify for Expo — `@react-native-async-storage/async-storage` is already in this project (currently unused since 13c removed the last thing that needed it; this may finally give it a real purpose) and `expo-file-system` is already installed too. **Verify against the package's own current README/type definitions which peer deps are actually required** before assuming the list above is complete — don't guess.

### 3. `src/lib/posthog.ts` — config only, not a manual client instance

```ts
export const posthogApiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY!;
export const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST!;

if (!posthogApiKey || !posthogHost) {
  throw new Error(
    "Missing EXPO_PUBLIC_POSTHOG_API_KEY or EXPO_PUBLIC_POSTHOG_HOST. Add them to your .env file.",
  );
}
```

The actual client lives in exactly one place — the `PostHogProvider` wrapping the root layout (step 4). **Do not** also construct a separate `PostHog` instance anywhere else — that's the double-initialization this prompt is explicitly avoiding. Every event call elsewhere in the app goes through the `usePostHog()` hook the provider exposes, not a manually imported client.

### 4. Wrap the app root — `src/app/_layout.tsx`

Wrap `PostHogProvider` around the existing `ClerkProvider` (outermost), so the SDK initializes exactly once for the app's entire lifetime, before auth state is even known:

```tsx
import { PostHogProvider } from "posthog-react-native";
import { posthogApiKey, posthogHost } from "@/lib/posthog";

// ...

return (
  <PostHogProvider apiKey={posthogApiKey} options={{ host: posthogHost }}>
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <Stack screenOptions={{ headerShown: false }} />
    </ClerkProvider>
  </PostHogProvider>
);
```

**Verify the exact current prop names/shape of `PostHogProvider`'s options against the installed package's types** — the general pattern above is correct, but exact API surface may have shifted since this was written. If it has, follow what the installed version actually exports, not this example.

### 5. User identification — new hook, `src/hooks/useAnalyticsIdentify.ts`

Fires once per real signed-in session — same `sessionId`-ref guard pattern as `useReportCleanup` from prompt 15, reused here for exactly the same reason (so a role flicker or any other re-render mid-session doesn't re-fire this repeatedly):

```ts
import { useAuth, useUser } from "@clerk/expo";
import { useEffect, useRef } from "react";
import { usePostHog } from "posthog-react-native";

import { parseRole } from "@/types/role";

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

    // `signup_date` via $set_once — verify the exact current call shape for
    // this against posthog-react-native's own types before finalizing; the
    // conceptual requirement is: `role` set normally (overwritable on future
    // identify calls if it changes), `signup_date` set only once, ever, per
    // person, never overwritten by a later identify call.
    posthog.identify(user.id, { role }, { signup_date: user.createdAt });
    posthog.capture("user_signed_in", { role });
  }, [isSignedIn, user, role, sessionId, posthog]);
}
```

Call this from `(app)/_layout.tsx`, alongside `useSupabaseSync` and `useReportCleanup` — same placement, above the early returns, same reason.

### 6. The four events — corrected against the current data model

The original spec for two of these predates later reworks. Follow this, not the older wording:

**`user_signed_in`** — as written above, no changes needed.

**`low_stock_alert_viewed`** — fires when the Dashboard mounts and `useInventoryStore().getLowStockItems()` returns at least one item. Properties: `{ low_stock_count: number }`. Unaffected by later changes — implement as originally specified.

**`inventory_item_deleted`** — fires in whichever handler calls `deleteItem(supabase, id)` after the two-step DELETE confirmation completes successfully (locate the current Inventory delete flow — it hasn't been shown in this exact prompt, so find it rather than assume a file/line). Properties: `{ item_name: string, category: string }` — `category` must be resolved to the category's **name** via a lookup (`categories.find(c => c.id === item.categoryId)?.name`), since items store `categoryId` now, not a category name string directly.

**`report_submitted`** — fires in `ReportEntryView.tsx`'s `handleSubmit`, only after `submitReport` returns a non-null result (i.e. actually saved, not rejected for a locked/wrong-day report). The original `{ item_name, employee_id, date }` shape assumed one item per report — that model was replaced back in the 10d rework, where one report now covers many items via `itemEntries`, and reports can come from Admin/Manager self-reporting too, not only Employees. Corrected properties:
```ts
{
  reporter_id: string; // was employee_id — reports aren't employee-only anymore
  date: string;
  items_changed_count: number; // itemSubmissions.length, not a single item name
  has_day_note: boolean; // dayContent.trim().length > 0
}
```

## Constraints

- No UI changes anywhere in the app.
- No keys of any kind hardcoded — env vars only, matching every other credential in this project.
- Exactly one `PostHogProvider`, exactly one place events are captured from (`usePostHog()`), no second manually-constructed client.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

Test each event by checking PostHog's own Activity/Live Events view (not just that the app doesn't crash): sign in and confirm `user_signed_in` with the right role; delete a test item and confirm `inventory_item_deleted` with a real category name, not a raw id; submit a report touching 2–3 items and confirm `items_changed_count` matches; view the Dashboard with at least one item below its threshold and confirm `low_stock_alert_viewed` fires with the right count.