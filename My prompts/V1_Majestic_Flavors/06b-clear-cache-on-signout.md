Read AGENTS.md first and follow it strictly.

## Task

Clear this app's locally persisted Zustand state (inventory filter preference and reports) whenever a user signs out. This prevents one person's cached data from being visible to the next person who signs in on the same physical device — relevant because staff share devices during testing and potentially in real use.

### 1. Create a single shared helper

Add `src/lib/clearPersistedState.ts`:

```ts
import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";

/**
 * Wipes this app's locally persisted Zustand state (inventory filter
 * preference, reports). Called on sign-out so the next person to sign in on
 * this device doesn't see the previous user's cached data, and available for
 * the dev-only "clear storage" testing button.
 *
 * This is a local-device convenience, not real per-user data isolation —
 * that is Supabase + Row Level Security's job (prompt 13). This just clears
 * the shared on-device cache between sessions.
 */
export function clearPersistedState() {
  useInventoryStore.persist.clearStorage();
  useReportStore.persist.clearStorage();
}
```

### 2. Reuse it from the existing dev button

Update `src/components/DevClearStorageButton.tsx` to call `clearPersistedState()` instead of calling `.persist.clearStorage()` on each store directly. Behavior is unchanged — this just removes the duplication now that the shared helper exists.

### 3. Call it on sign-out, in both places sign-out currently happens

In `src/app/(app)/index.tsx` and `src/app/(app)/reports.tsx`, update the existing Sign Out button's `onPress` handler to call `clearPersistedState()` before calling `signOut()`, so the cache is already clear before the sign-out redirect happens. Example of the resulting handler shape:

```tsx
onPress={() => {
  clearPersistedState();
  void signOut();
}}
```

Import `clearPersistedState` from `@/lib/clearPersistedState` in both files.

## Constraints

- No visible UI changes. Button labels, styling, and layout stay exactly as they are.
- Do not touch `inventoryStore.ts` or `reportStore.ts` themselves — only add the new helper file and update the two screens plus `DevClearStorageButton`.
- Keep the helper synchronous and simple — no new dependencies, no new stores.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

This directly addresses a CodeRabbit review comment on the prompt-06 PR: `report-storage` is a single AsyncStorage key shared by whoever is signed into the device, so switching test accounts on one phone can leak the previous session's reports into the next. Full per-user isolation belongs to Supabase RLS in prompt 13 — this is the right-sized fix for now: clear the local cache at the natural sign-out boundary.
