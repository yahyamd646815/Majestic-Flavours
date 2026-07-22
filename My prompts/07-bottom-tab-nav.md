Read AGENTS.md first and follow it strictly.

## Task

Implement bottom tab navigation for the app, with simple placeholder screens for now — no real screen content.

**Critical: build this inside the existing `src/app/(app)/` route group. Do not create a new `(tabs)` group.** `(app)` already has a working auth guard (`src/app/(app)/_layout.tsx`) that checks `isLoaded`/`isSignedIn`, shows the branded splash while loading, and redirects signed-out users to Sign In. That guard logic must be preserved exactly as-is — the only change to that file is swapping its returned `<Stack screenOptions={{ headerShown: false }} />` for a `<Tabs>` navigator with the same `screenOptions`. Do not touch the `isLoaded`/`isSignedIn` checks or the `<Redirect>` above it.

### Tabs to create

1. **Dashboard** (home icon) — Admin and Manager only. Already exists at `src/app/(app)/index.tsx` — reuse it as-is (it already has Sign Out, the dev clear-storage button, and its own employee-redirect). Do not recreate this file from scratch.
2. **Inventory** (box/grid icon) — Admin and Manager only. New file: `src/app/(app)/inventory.tsx`.
3. **Reports** (document icon) — all roles. Already exists at `src/app/(app)/reports.tsx` — reuse as-is, same reasoning as Dashboard.
4. **Users** (people icon) — Admin only. New file: `src/app/(app)/users.tsx`.
5. **Settings** (gear icon) — Admin only. New file: `src/app/(app)/settings.tsx`.

New placeholder screens (`inventory.tsx`, `users.tsx`, `settings.tsx`) should follow the same simple shape as the existing `index.tsx`/`reports.tsx` placeholders: centered screen title text, nothing else required.

### Role-based access — two layers, not one

**Layer 1 — hide the tab bar icon** for tabs the current user's role can't access (e.g. `href: null` on that `Tabs.Screen` for unauthorized roles). This is the UI affordance the original request asked for.

**Layer 2 — each role-restricted screen must also guard itself**, the same way `index.tsx` already does for employees:
```tsx
if (role !== "admin" && role !== "manager") return <Redirect href="/reports" />;
```
(adjusted per screen — Users/Settings should redirect anyone who isn't `"admin"`). This is defense in depth: hiding a tab icon doesn't stop direct navigation to that route. Reuse the exact `parseRole(user?.publicMetadata?.role)` pattern already used in `index.tsx` — read role from Clerk via `useUser()`, not from any Zustand store. `userStore` does not exist in this project by design (see prompt 06) — Clerk session data is the single source of truth for role, per AGENTS.md's Clerk Rules.

### Styling

- Active tab: filled icon in the primary gold brand color. Use `colors.gold` (or the equivalent token) from `@/constants/theme` — do not hardcode hex values.
- Inactive tabs: muted icon color with a small label below.
- Tab bar: white background, subtle top border, minimal and professional.
- Use `@expo/vector-icons` for icons — it ships bundled with Expo, no install needed.
- `tabBarStyle`, `tabBarIcon`, and related `screenOptions` are React Navigation style objects, not standard RN view props — use inline styles or `StyleSheet.create()` for these per AGENTS.md's Style Exception Rules (the same reasoning as SafeAreaView/Modal in that table), not NativeWind `className`.

## Constraints

- Do not implement real screen content for any tab — placeholders only.
- Do not modify `(auth)/_layout.tsx`, `sign-in.tsx`, or any Clerk/store logic — this prompt is navigation only.
- Do not recreate `index.tsx` or `reports.tsx` from scratch — extend/wrap them as needed for tab registration, but preserve their existing Sign Out, dev clear-storage button, and (for `index.tsx`) employee-redirect logic exactly.
- No new dependencies beyond `@expo/vector-icons` (already available, not a new install).
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

If the current `(app)/_layout.tsx` guard logic is unclear, read the file directly before making changes — it was built and hardened across prompts 04 and 06/06b and must not regress.