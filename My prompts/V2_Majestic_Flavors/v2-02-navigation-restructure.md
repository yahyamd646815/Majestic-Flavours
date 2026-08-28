Read AGENTS.md first and follow it strictly.

## Task

Restructure the bottom tab navigation for Admin and Manager. Inventory and Reports currently have their own tabs; replace both with a single tab containing three large buttons: **Inventory**, **Reports**, and **Make a Report**.

**This is deliberately a step "backwards" in design sophistication, and that's the point.** Yahya's dad asked for it specifically: the "+ Make a Report" button already exists inside the Reports screen's header, which is the more elegant placement — but many of the staff using this app aren't tech-familiar, and he wants the simplest, most obvious version first, with familiarity built up before design is tightened. Don't "improve" this by collapsing the third button back into Reports.

**Employees are unaffected.** They keep going straight to their Reports screen exactly as they do now — the combined tab is Admin/Manager only. Employees never see it.

### 1. New screen

Create a new screen under `(app)/`. **Name it and label the tab whatever reads best** — "Manage" is a reasonable default, but pick something that fits the app's voice; flag your choice in the summary so Yahya can veto it.

It renders three large, obvious, well-spaced navigation buttons — big touch targets, per AGENTS.md's UI Quality Bar (staff are on the restaurant floor holding a phone):
- **Inventory** → navigates to the existing inventory screen
- **Reports** → navigates to the existing reports screen
- **Make a Report** → navigates to reports *and* opens the self-report view directly

The third one is the only non-obvious piece: `reports.tsx` currently owns `isSelfReporting` as local state, toggled by a callback passed into `ManagerReportsView`. Getting an external navigation to land directly in that state needs a route param (or equivalent) that `reports.tsx` reads on mount. **Verify how `reports.tsx` currently manages that state before choosing an approach** — don't assume the shape from this description.

### 2. Tab visibility

The existing tabs use `href: canManage ? undefined : null` to hide themselves per role. Apply the same pattern so that:
- **Admin/Manager** see: Dashboard, [new combined tab], Users (admin only), Settings — Inventory and Reports no longer appear as their own tabs.
- **Employee** sees: Reports, Settings — exactly as now, unchanged.

Inventory and Reports must remain real, reachable *routes* (the new buttons navigate to them, and employees still route to Reports directly) — they're only being hidden from the Admin/Manager tab bar, not removed.

### 3. Leave a slot in mind

A Tasks/to-do tab is coming next and will sit alongside these. Don't build it — just don't do anything that would make adding one awkward.

## Constraints

- Don't change anything *inside* the Inventory or Reports screens except the minimum needed for the "Make a Report" deep-link in step 1.
- Don't remove the existing "+ Make a Report" button from the Reports header — both entry points coexist for now.
- Employee navigation and permissions are untouched.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Test all three roles. As Admin: confirm the tab bar shows the new combined tab instead of Inventory and Reports, and that all three buttons land where they should — especially "Make a Report," which must open the self-report view directly, not the browsing view. As Manager: same. As Employee: confirm nothing changed at all — Reports still opens directly from the tab bar.
