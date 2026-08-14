# Majestic Flavours — Project Context

**Hand this to a new Claude.ai chat at the start, together with `ADVISOR.md` and `AGENTS.md`.**
This replaces the older `project-summary.md`, which is now out of date.

---

## What this is

A private internal inventory-management app for **Majestic Flavours**, an authentic Pakistani restaurant in Riyadh, Saudi Arabia. ~15–25 staff, three roles. Distributed privately as an APK — never listed in an app store.

**v1 is complete and running in production.** Real staff accounts and the real 144-item inventory are in the live database. The project is now working through a queue of new features requested by Yahya's dad.

- Repo: `yahyamd646815/Majestic-Flavours` (public; secrets in gitignored `.env`)
- Working branch `dev_2` → `main`
- Local path: verify the repository path in the current environment rather than assuming one — it varies by machine.

**Yahya** is a beginner developer using this project to learn, with a longer-term goal of Python and commercial apps. His **dad** owns the restaurant and is a software engineer — he defined the requirements and requests features, but is too busy for day-to-day input. **Yahya makes architecture, security, and design decisions himself.**

---

## Roles

**This table is the authorization policy — who is *allowed* to do what — not a list of currently-built features.** User management specifically is intended for Admin but is not yet functional; see "What's built" below. Don't treat a row here as confirmation a feature exists yet.

| Role | Authorized to |
|---|---|
| **Admin** | Everything, including deletions and user management (once built) |
| **Manager** | Add items, view all reports, export — no deletions, no user management |
| **Employee** | Submit/edit daily reports for assigned items only; editable until midnight |

Roles live in Clerk `publicMetadata` as lowercase `admin` / `manager` / `employee`.

---

## Stack

Expo + React Native + TypeScript · Expo Router · NativeWind v5 · Zustand (in-memory only) · Clerk (auth) · Supabase (Postgres + RLS, native Clerk third-party auth — **not** the deprecated JWT-template method) · PostHog (analytics) · `expo-updates` (OTA) · Jest + jest-expo (tests) · EAS Build (distribution)

**Brand:** gold `#C8A44A`, deep maroon `#7B1515`, dark green `#1B3A2D`, cream `#F8EDD5`. Stock status: green `#16a34a` / amber `#d97706` / red `#dc2626`. MF crown logo at `assets/images/logo.jpeg`; app icons generated from it.

---

## What's built (v1 — all done, merged, running)

Prompts 01–16 plus sub-prompts (04b, 06b, 08b, 10b/c/d, 13a–d, 16b):

NativeWind setup · design theme · Clerk auth + role-based routing · bottom tab nav · Dashboard · Inventory (CRUD, category filter, search, two-step DELETE requiring the user to type "DELETE") · Reports (draft-until-submit, per-item timestamped snapshot history, per-item notes, midnight locking) · User Management (placeholder) · Settings · full Supabase migration · PDF/XLSX export · report auto-delete after 4 months · PostHog analytics · Jest test infrastructure · `expo-updates` OTA + a "Check for Updates" button in Settings.

---

## Settled architecture (do not re-litigate)

- **No `userStore`, ever.** Clerk is the source of truth for identity and role.
- **Supabase is authoritative.** Zustand stores are pure in-memory caches — no AsyncStorage persistence anywhere.
- **Reports are draft-until-submit** (`DraftReportContext`, session-only).
- **Snapshot history is append-only**, enforced at both app and RLS level.
- **Real Clerk user ids** are used for report attribution (`reporterId`) and item assignment (`assignedEmployeeIds`).
- **Riyadh timezone is pinned explicitly** (fixed UTC+3, no DST) rather than read from the device — see `getTodayIsoDate()` in `src/lib/reports.ts`, and `current_riyadh_date()` in SQL.
- Trilingual modals (EN/AR/UR) are intentional and correct.

---

## Live database state

- 13 categories, **144 real items** seeded from Yahya's dad's PDF checklist.
- **Units were guessed at the category level** (Meat/Vegetables/Rice → Kg, Ready Made/Sweets/Disposables → Pcs, Dairy/Cleaning → Ltr) because the source PDF had no unit data. Yahya is reviewing these with his dad and correcting them per item.
- **`min_threshold` is 0 on every item** — a safe "never falsely alert" default, not a real threshold. Real values to be set later.
- The PDF's typo "Grocerries" was corrected to "Groceries"; every other item name is verbatim.
- SQL patches applied through **round 7** (round 7 = admin-only DELETE policies on `reports`, `report_item_entries`, `report_item_snapshots`, required for the 4-month auto-delete to work at all — cascade deletes still need RLS permission on child tables).

---

## Deployment (important — this bit is non-obvious)

- **`development` profile** — dev client, needs `npx expo start` running on Yahya's laptop. His own iteration only.
- **`preview` profile** — standalone APK, JS bundle baked in, no laptop needed. **This is what staff use.** Essential for a 24-hour restaurant.
- Both coexist on one phone: `APP_VARIANT` in `eas.json` + `.dev`-suffixed Android package id in `app.config.js`.
- **Env vars must be registered with EAS** — a local `.env` only reaches the dev client. Currently they exist in *both* `eas env:set` and `eas.json`'s `env` block (see open items).
- **OTA updates:** `eas update --branch preview --message "..."` ships JS-only changes with no rebuild. Native changes still require a full rebuild; `runtimeVersion: "fingerprint"` enforces that automatically.
- **EAS build times are queue-dependent and can exceed an hour at peak.** Don't promise timeframes.

---

## Next up — urgent feature queue (from Yahya's dad, in this order, one prompt each)

**1. Multi-select assignment on the Inventory page.** Assign multiple items, or an entire category, to an employee at once. No limit on categories per employee; a category can go to multiple employees — same many-to-many premise as items already have.

**2. Stock-status "ping" buttons on reports.** Out-of-stock / low-stock / in-stock buttons on both employee reports and the Admin/Manager "+ Make a Report" flow. During rush hour, staff flag an item in one tap instead of counting it — the restaurant has no dedicated inventory staff. Rules:
- A ping alone is a valid report.
- A manual ping **overrides** the quantity-derived status and persists for all assigned employees plus Admin/Manager.
- It clears when the item's **quantity changes** (status reverts to quantity-derived), or when someone pings a different status.
- **Implementation note:** put the ping-clearing inside `updateItem` in the inventory store, not at the call sites. Quantity changes from two paths (report submission *and* the Inventory edit form) and a call-site approach will eventually miss one, leaving pings stuck permanently.
- **Decided:** in-app visibility only for now. Real push notifications (`expo-notifications`) come in v2.

**3. Sort/filter on Inventory and Reports.** Alphabetical, or by stock status (out/low/in) with alphabetical ordering inside each status group.

---

## Then — v2, in priority order

1. **This document set.** (Being written now — `ADVISOR.md` + this file.)
2. **In-app sign-up page** for new users, plus removing/migrating `sampleUsers.ts` to rely directly on Clerk. Yahya has explicitly confirmed he wants this even knowing it may introduce issues — he prefers it that way.
3. **Collapsible views** — the Admin/Manager "All Time" reports view grouped into month (probably week too) dropdowns; also collapse the units and categories sections on Settings. Yahya may add more Settings requests from his dad at this point.
4. **`expo-notifications`** for real push on stock-status pings — he wants this *before* the Users page work.
5. **Lower priority, order flexible:**
   - Make the Users page functional
   - Convert ping buttons to a slider-style control (plain buttons ship first)
   - Small +/− steppers when editing quantity and min-threshold in the Inventory edit form
   - Let employees type a quantity directly when reporting, instead of only +/−
   - A **force-update screen**: when a change requires a full rebuild (not OTA), the app should say an update is required and refuse to function until it's installed
   - **Employee offboarding** — there is currently no way to deactivate someone who leaves; they'd stay in the roster and stay assigned to items. Yahya's stopgap is changing the password. Deliberately at the bottom — resignations are unlikely near-term.
   - **Yahya's own idea, still to discuss with his dad:** a page where employees can see pings/reports other people filed on items they're assigned to. Note this is likely near-free once in-app ping visibility exists — same surface.

---

## Open items / loose ends

- **Pre-launch data cleanup — still pending.** Before real counting begins: delete all test/dev reports and reset every item's quantity to zero, so the first real count happens through an actual submitted report. (The stray test items and "test category" have already been removed.) Yahya will ask for this SQL when ready.
- **Possible empty-report bug — unconfirmed.** An employee with no assigned items submitted an empty report (no items, no note) and it appeared in the UI but not the database. It may have been a side effect of the assignment bug (since fixed) rather than a real bug. If it resurfaces, inspect `submitReport` in `src/store/reportStore.ts` for a short-circuit on empty submissions.
- **Env vars have two sources of truth** — the same five keys exist in both `eas env:set` and `eas.json`'s `env` block. Not a security issue (all are `EXPO_PUBLIC_`, client-visible by design), but they can drift. Worth consolidating to one.
- **`xlsx@0.18.5`** carries known prototype-pollution/ReDoS advisories. Currently safe because the app only ever *writes* xlsx from its own trusted data and never parses an uploaded one. **If a "bulk-import inventory from Excel" feature is ever built, this needs revisiting** — that's exactly the exposure those advisories describe.
- **`xlsx` bold headers don't render** — verified by unzipping the output and reading `styles.xml`; cell styling is a SheetJS Pro feature. Column widths do work. Not a bug.
- **`sampleUsers.ts` whitespace trap** — see `ADVISOR.md` §9. Check it first for any assignment/visibility bug.

---

## Memory: what a new chat should store

Ask before overwriting existing entries. Suggested set:

1. Yahya makes architecture/security/design decisions himself; his dad is too busy for day-to-day input. Flag tradeoffs as "your call" with the tradeoff explained rather than deferring to "consult your dad."
2. Communication preferences: **full files, not snippets**, unless a reason is stated; he reads ~75% of long responses, so **always end with short ordered next steps**; lead with the answer.
3. The urgent feature queue (three items above, in order).
4. The v2 priority order (above).
5. Pre-launch data cleanup task — do not act until real counting is about to begin.
6. Deployment facts: dev vs preview profiles, OTA covers JS-only changes, env vars must be registered with EAS, EAS build times are unpredictable.