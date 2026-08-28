Read AGENTS.md first and follow it strictly.

## Task

Implement the User Management screen at `src/app/(app)/users.tsx` (currently a placeholder from prompt 07 — build the real screen there, keeping its existing `parseRole` + `Redirect` guard exactly as-is; the tab is already Admin-only at both the tab-bar-icon level and the screen level).

### Data source

Read directly from `sampleUsers` (`@/data/sampleUsers`) — **do not create or use a `userStore`.** There is no backend yet that can create real Clerk accounts or edit another user's role from the client (that requires Clerk's secret key, which per AGENTS.md's Secrets Rule can never be used client-side). `sampleUsers` is the same placeholder data already used elsewhere (Dashboard, Inventory, Reports) for exactly this reason.

### List

A card per user showing:
- Name and email
- A role badge in a distinct color per role. Reuse the existing (currently unused) `badge-maroon`/`badge-maroon__text` utilities for Admin and `badge-gold`/`badge-gold__text` for Manager — both already exist in `global.css` from prompt 02. For Employee, add one new small utility following the same BEM pattern, using the dark-green brand token (e.g. `badge-green` / `badge-green__text`, `bg-dark-green` background with white text).

### Add / Edit Role / Remove — all honest placeholders, none of them do anything real yet

- **Add User** button (top right): tapping it shows `Alert.alert("Coming soon", "User creation will be available in a future update.")` — no form, no modal. Building a real-looking form with a fake "Saving..." state for something that doesn't actually save anywhere would be more misleading than a flat placeholder, not less.
- **Edit Role** button per card: same pattern, `Alert.alert("Coming soon", "Role editing will be available in a future update.")` — no bottom sheet, no modal.
- **Remove User** button per card: same pattern, `Alert.alert("Coming soon", "User removal will be available in a future update.")`. Do **not** run the two-step DELETE confirmation flow here — that flow (already built as `DeleteConfirmModal` in prompt 09) exists to gate something actually destructive; running it for an action that then does nothing is confusing, not safe. Reuse `DeleteConfirmModal` directly, unmodified, whenever real deletion is wired up later — don't rebuild it now, and don't exercise it in this prompt.

Do not build "you cannot modify your own account" logic in this prompt — there's nothing to protect yet, since every action shows the same message regardless of whose card it's on. That belongs in whichever future prompt wires up real mutations.

## Constraints

- No `userStore`, no other new store.
- No new dependencies.
- Do not change tab navigation, the existing `users.tsx` guard, or any other screen.
- Reuse existing `global.css` utilities (`card`, `badge-maroon`, `badge-gold`) — only add the one new `badge-green` variant, following the same pattern.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

This follows the same "Coming soon" pattern already established for PDF/XLSX export in prompt 10 (`Alert.alert`, no toast library) — now also written into AGENTS.md's Supabase Rules section as a general rule for any feature that needs a backend the app doesn't have yet.