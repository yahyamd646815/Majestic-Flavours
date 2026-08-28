Read AGENTS.md first and follow it strictly.

## Task

Implement the Settings screen at `src/app/(app)/settings.tsx` (currently an Admin-only placeholder from prompt 07). This prompt also opens the tab to every role and centralizes Sign Out there — read all of this before starting, since it touches more than just this one screen.

### 1. Open the Settings tab to all roles

In `src/app/(app)/_layout.tsx`, change the Settings `Tabs.Screen`'s `href` from `isAdmin ? undefined : null` to always visible (`undefined`) for any signed-in role. Leave the Users tab exactly as it is (Admin-only, unchanged).

In `settings.tsx`, remove the `if (role !== "admin") return <Redirect href="/reports" />;` guard entirely — every signed-in role should reach this screen now; the screen's *content* branches by role instead.

### 2. Centralize Sign Out and the dev clear-storage button here

Remove the Sign Out button and `<DevClearStorageButton />` from `src/app/(app)/index.tsx` (Dashboard) and `src/app/(app)/reports.tsx` (Reports) — leave everything else in both files untouched. Both now live only in Settings, at the bottom of the screen, below whatever role-specific sections apply — but not identically: **Sign Out is shown to every role; `<DevClearStorageButton />` is only rendered when `role === "admin"`.** It wipes every test user's local data at once (reports included), so Manager and Employee test accounts shouldn't be able to reach it. `DevClearStorageButton` itself already has `__DEV__` gating and its own confirmation dialog — this is purely about who can see it, not changing the button.

### 3. Screen content, branched by role

Read role via `parseRole(user?.publicMetadata?.role)` from Clerk, as everywhere else.

**Admin sees three sections, in order:**

- **Units** — list of `useUnitsStore().units`, each row showing the label and a delete (trash) icon. Add via a text input + Add button, calling `addUnit`. Delete: before calling `deleteUnit`, check `isUnitInUse(id)` first — if true, show `Alert.alert("Unit in use", "Some items are still using this unit. Remove them first.")` and do not attempt the delete. Otherwise, a single native confirmation (`Alert.alert("Delete this unit?", ..., [{Cancel}, {text: "Delete", style: "destructive", onPress: () => deleteUnit(id)}])`) — one popup only, no typed-DELETE flow (units aren't destructive business data, per the original spec).
- **Categories** — same shape, using `useInventoryStore().categories`, `addCategory`, `isCategoryInUse`, `deleteCategory`. Before deleting, check `isCategoryInUse(id)` first — if true, show `Alert.alert("Category in use", "Some items are still assigned to this category. Remove them first.")` and do not attempt the delete. Otherwise the same single native confirmation as Units.
- **Report Retention** — a read-only info card: "Daily reports are automatically deleted after 4 months." No controls.

**Manager sees one section:**

- **Categories** — the *same* component as Admin's Categories section, but with `canDelete={false}` (or equivalent prop) so no delete icon renders per row — Add still works identically. No Units section, no Report Retention.

**Employee sees no sections** — just the Sign Out / dev button footer described in step 2.

Build the Units and Categories lists as one shared, reusable piece (e.g. `src/components/SettingsListSection.tsx`) taking `title`, `items`, `onAdd`, `onDelete`, and `canDelete` props, rather than writing near-duplicate Units and Categories implementations — they're structurally identical.

## Constraints

- No new stores — `addUnit`/`deleteUnit`/`isUnitInUse` and `addCategory`/`deleteCategory`/`isCategoryInUse` already exist (prompt 08b) and have never been wired to real UI until now.
- No new dependencies.
- Do not touch Users tab visibility or `users.tsx`.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

`deleteUnit`/`deleteCategory` return `false` for both "not found" and "in use" (a deliberate simplification from prompt 08b's CodeRabbit review) — that's exactly why the UI must check `isUnitInUse`/`isCategoryInUse` *before* attempting the delete, not just react to a failed delete call afterward.