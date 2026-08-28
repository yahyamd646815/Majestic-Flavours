# Majestic Flavours — Project Context

**Hand this to a new Claude.ai chat at the start, together with `ADVISOR.md` and `AGENTS.md`.**
This replaces the older `project-summary.md`, which is now out of date.

---

## What this is

A private internal inventory-management app for **Majestic Flavours**, an authentic Pakistani restaurant in Riyadh, Saudi Arabia. ~15–25 staff, three roles. Distributed privately as an APK — never listed in an app store.

**v1 is complete and running in production.** Real staff accounts and the real 144-item inventory are in the live database. The urgent post-v1 feature queue (multi-select assignment, stock-status pings, sort/filter) is also complete and shipped — see "What's built since v1" below. The project is now between that and starting v2 in earnest.

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

## What's built since v1 (prompts 17d–17l — all done, merged, running)

The full urgent feature queue from Yahya's dad, plus fixes that came out of it:

- **Atomic employee assignment** — two Postgres RPC functions (`add_employee_to_item`/`remove_employee_from_item`) replaced a client-computed full-array overwrite, closing a real concurrent-write race CodeRabbit caught. Same atomic functions used everywhere assignment happens (bulk and individual edit), not just the newest code.
- **Multi-select bulk assignment** on Inventory — select many items or a whole category (via filtering), assign or unassign one employee to all of them at once. Additive/subtractive only, never destructive.
- **Employee filter + "Unassigned" filter** on Inventory — asymmetric by design: combined with a real employee, "Unassigned" means *not assigned to that employee* (exclusion), not "assigned to nobody" — see `matchesEmployeeFilter` in `lib/inventoryFilters.ts`.
- **Multi-select category/employee/reporter filters** on both Inventory and Reports — OR within one filter type, AND across types, empty selection means the whole dimension is inactive (matches everything, not nothing).
- **Alphabetical sort** on both screens (item name for Inventory, reporter name for Reports) alongside the existing default order.
- **Stock-status ping buttons** — Out of Stock / Low Stock / In Stock, on both employee reports and Admin/Manager self-reports. A ping alone is a valid report. Manual override wins over quantity-derived status everywhere status displays (Dashboard, Inventory, Reports); clears automatically when quantity changes, *unless* the same update also explicitly sets a new ping (same-submission case, handled in one merged `updateItem` call, not two sequential writes). Full timestamped ping history (not just the latest) shown in Reports specifically — a historical record of that day's report, distinct from the item's current live status.
- **Reload-loop fix** — an unstable Supabase client reference (recreated on every Clerk token refresh) was re-triggering data fetches, visible as a full-screen "Loading inventory..." flicker every few seconds on slow connections. Root-caused and fixed at the client-stability level, not patched per-symptom.

---

## Settled architecture (do not re-litigate)

- **No `userStore`, ever.** Clerk is the source of truth for identity and role.
- **Supabase is authoritative.** Zustand stores are pure in-memory caches — no AsyncStorage persistence anywhere.
- **Reports are draft-until-submit** (`DraftReportContext`, session-only).
- **Snapshot history is append-only**, enforced at both app and RLS level. Ping history (`report_item_status_pings`) follows the identical pattern.
- **Real Clerk user ids** are used for report attribution (`reporterId`) and item assignment (`assignedEmployeeIds`).
- **Riyadh timezone is pinned explicitly** (fixed UTC+3, no DST) rather than read from the device — see `getTodayIsoDate()` in `src/lib/reports.ts`, and `current_riyadh_date()` in SQL.
- Trilingual modals (EN/AR/UR) are intentional and correct.
- **Stock status is always read through `getEffectiveStatus()`** (`lib/stockStatus.ts`) for *live* display (Dashboard, Inventory) — never derive out-of-stock/low-stock inline. Reports is the one deliberate exception: it shows historical ping records from that day's report, not the item's current live override.

---

## Live database state

- 13 categories, **144 real items** seeded from Yahya's dad's PDF checklist.
- **Units were guessed at the category level** (Meat/Vegetables/Rice → Kg, Ready Made/Sweets/Disposables → Pcs, Dairy/Cleaning → Ltr) because the source PDF had no unit data. Yahya is reviewing these with his dad and correcting them per item.
- **`min_threshold` is 0 on every item** — a safe "never falsely alert" default, not a real threshold. Real values to be set later.
- The PDF's typo "Grocerries" was corrected to "Groceries"; every other item name is verbatim.
- SQL patches applied through **round 9** (round 7 = admin-only DELETE policies for the 4-month auto-delete; round 8 = `status_override`/`status_ping` columns, later superseded; round 9 = full timestamped ping history table, `report_item_status_pings`, replacing round 8's single-value column).

---

## Deployment (important — this bit is non-obvious)

- **`development` profile** — dev client, needs `npx expo start` running on Yahya's laptop. His own iteration only.
- **`preview` profile** — standalone APK, JS bundle baked in, no laptop needed. **This is what staff use.** Essential for a 24-hour restaurant.
- Both coexist on one phone: `APP_VARIANT` in `eas.json` + `.dev`-suffixed Android package id in `app.config.js`.
- **Env vars must be registered with EAS** — a local `.env` only reaches the dev client. Currently they exist in *both* `eas env:set` and `eas.json`'s `env` block (see open items).
- **OTA updates:** `eas update --branch preview --no-bytecode --message "..."` ships JS-only changes with no rebuild. `--no-bytecode` is required on Yahya's specific machine — Windows Security's Smart App Control blocks `hermesc.exe` as unsigned/unrecognized; there's no `eas.json` or env-var equivalent, it must be typed by hand every time. Native changes still require a full rebuild regardless; `runtimeVersion: "fingerprint"` enforces that automatically.
- **`eas build` runs remotely on Expo's servers**, not locally — safe to close VS Code/the laptop entirely once a build shows as queued.
- **EAS build times are queue-dependent and can exceed an hour at peak.** Don't promise timeframes.
- **`npm ci` (what EAS's remote build always uses) is strict** in a way local `npm install` isn't — a `package.json`/`package-lock.json` drift that `npm install` silently tolerates will hard-fail a remote build. Worth running `npm ci` locally to verify before triggering a remote build, not just `npm install`.

---

## Then — v2, in priority order

1. ~~**This document set.**~~ Done — `ADVISOR.md` + this file, both in active use.
2. **Dashboard restructure** (requested by Yahya's dad, "before everything else" in v2): Out of Stock and Low Stock currently share one combined alert list — split them into two separate collapsible sections so each is easier to scan. Also: pinged items should sort *first*, ahead of quantity-derived-status items — **Dashboard-only**, not a global sort preference affecting Inventory or Reports.
3. **Checklist/Tasks page** (requested by Yahya's dad, "before everything else" in v2, full spec still coming): a new page for assigning tasks to employees not tied to inventory items — examples given: organizing a shipment that just arrived, checking specific tables are set up for a reservation. **One firm requirement already given, ahead of full spec:** once this page exists, Admin/Manager access to Reports and Inventory should move from direct tabs to buttons instead — implies a real navigation restructure, not just an added tab. Yahya will provide a reference photo and more detail when this is actually scoped.
4. **Transactional RPC for report submission ("Option B")** — CodeRabbit caught a real retry-duplication gap: if a report's snapshot/ping writes succeed but the separate inventory writeback fails afterward, retrying re-inserts the same snapshot/ping as a false duplicate in what's meant to be an append-only history. Affects both quantity snapshots (present since prompt 13c) and status pings, not just pings. A quick idempotency-key patch ("Option A") shipped first as a stopgap; this is the proper fix — move the entry + snapshot + ping + inventory writeback into one transactional Postgres function so partial failure becomes structurally impossible rather than patched around. **Confirmed sequencing: after the Tasks/to-do list (above), before the sign-up/`sampleUsers.ts` migration (below).**
5. **In-app sign-up page** for new users, plus removing/migrating `sampleUsers.ts` to rely directly on Clerk. Yahya has explicitly confirmed he wants this even knowing it may introduce issues — he prefers it that way.
6. **Collapsible views** — the Admin/Manager "All Time" reports view grouped into month (probably week too) dropdowns; also collapse the units and categories sections on Settings. Yahya may add more Settings requests from his dad at this point.
7. **`expo-notifications`** for real push on stock-status pings — he wants this *before* the Users page work.
8. **Settings changelog / "what's new"** (explicitly "for later, not now") — a small or detailed note in Settings telling employees and Admin/Manager what changed in a recent update. Yahya's own idea: reuse the `--message` text he already writes for every `eas update`/`eas build` rather than requiring separate release notes. **Not yet verified:** whether that message text is actually readable by the app at runtime via `expo-updates`' own API, or whether this needs a separate mechanism (e.g. a small Supabase table Yahya writes to) — needs checking when this is actually scoped, not assumed.
9. **Lower priority, order flexible:**
   - Make the Users page functional
   - Convert ping buttons to a slider-style control (plain buttons ship first)
   - Small +/− steppers when editing quantity and min-threshold in the Inventory edit form
   - Let employees type a quantity directly when reporting, instead of only +/−
   - A **force-update screen**: when a change requires a full rebuild (not OTA), the app should say an update is required and refuse to function until it's installed
   - **Employee offboarding** — there is currently no way to deactivate someone who leaves; they'd stay in the roster and stay assigned to items. Yahya's stopgap is changing the password. Deliberately at the bottom — resignations are unlikely near-term.
   - **Yahya's own idea, still to discuss with his dad:** a page where employees can see pings/reports other people filed on items they're assigned to. Note this is likely near-free now that in-app ping visibility already exists — same surface.

---

## Open items / loose ends

- **Pre-launch data cleanup — still pending.** Before real counting begins: delete all test/dev reports and reset every item's quantity to zero, so the first real count happens through an actual submitted report. (The stray test items and "test category" have already been removed.) Yahya will ask for this SQL when ready.
- **Empty-report investigation — resolved, was the assignment/whitespace bug.** An employee with no assigned items appeared to submit an empty report successfully. Traced to the `sampleUsers.ts` email-bridge bug (a stray leading space silently broke that person's assignability) — since fixed. Not a `reportStore` issue.
- **Env vars have two sources of truth** — the same five keys exist in both `eas env:set` and `eas.json`'s `env` block. Not a security issue (all are `EXPO_PUBLIC_`, client-visible by design), but they can drift. Worth consolidating to one.
- **`xlsx@0.18.5`** carries known prototype-pollution/ReDoS advisories. Currently safe because the app only ever *writes* xlsx from its own trusted data and never parses an uploaded one. **If a "bulk-import inventory from Excel" feature is ever built, this needs revisiting** — that's exactly the exposure those advisories describe.
- **`xlsx` bold headers don't render** — verified by unzipping the output and reading `styles.xml`; cell styling is a SheetJS Pro feature. Column widths do work. Not a bug.
- **`sampleUsers.ts` whitespace trap** — see `ADVISOR.md` §9. Check it first for any assignment/visibility bug. Directly caused the empty-report confusion above — a real, recurring risk until this file is removed (v2 item 4).

---

## Memory: what a new chat should store

Ask before overwriting existing entries. Suggested set:

1. Yahya makes architecture/security/design decisions himself; his dad is too busy for day-to-day input. Flag tradeoffs as "your call" with the tradeoff explained rather than deferring to "consult your dad."
2. Communication preferences: **full files, not snippets**, unless a reason is stated; he reads ~75% of long responses, so **always end with short ordered next steps**; lead with the answer.
3. v1 and the urgent post-v1 feature queue are both complete (see "What's built since v1"). The project is between that and starting v2.
4. The v2 priority order (above).
5. Pre-launch data cleanup task — do not act until real counting is about to begin.
6. Deployment facts: dev vs preview profiles, OTA covers JS-only changes only, `--no-bytecode` required on Yahya's machine specifically, env vars must be registered with EAS, EAS build times are unpredictable, `eas build` is safe to walk away from once queued.