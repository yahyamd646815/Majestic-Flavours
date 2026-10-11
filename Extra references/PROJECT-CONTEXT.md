# Majestic Flavours — Project Context

**Hand this to a new Claude.ai chat at the start, together with `ADVISOR.md` and `AGENTS.md`.**
This replaces the older `project-summary.md`, which is now out of date.

---

## What this is

A private internal inventory-management app for **Majestic Flavours**, an authentic Pakistani restaurant in Riyadh, Saudi Arabia. ~15–25 staff, three roles. Distributed privately as an APK — never listed in an app store.

**v1 is complete and running in production.** Real staff accounts and the real 144-item inventory are in the live database. The urgent post-v1 feature queue (multi-select assignment, stock-status pings, sort/filter) is also complete and shipped — see "What's built since v1" below. **v2 is well underway:** the to-do list feature is built through notifications (`v2-03-a` → `v2-03-e3`), plus two Dashboard rounds. A new batch of requests from Yahya's dad is queued next — see "v2 — status and priority order" below.

- Repo: `yahyamd646815/Majestic-Flavours` (public; secrets in gitignored `.env`)
- Working branch `dev_2` → `main`
- Local path: verify the repository path in the current environment rather than assuming one — it varies by machine.

**Yahya** is a beginner developer using this project to learn, with a longer-term goal of Python and commercial apps. His **dad** owns the restaurant and is a software engineer — he defined the requirements and sends feature batches every so often, but is too busy for day-to-day input. **Yahya makes architecture, security, and design decisions himself.**

**Sibling projects (decided: three fully separate projects — each its own repo, Claude chat, and fresh environment, i.e. its own Supabase/Clerk/Firebase):** his dad has also asked for (1) a billing + table-management app, used by the restaurant and also sold on the Play Store by subscription, and (2) a customer delivery / loyalty-points / reservation app. They talk to each other through an explicit API contract, not a shared database. They're handed off via `NEW-PROJECTS-BRIEF.md`. This app stays the internal inventory and to-do-list tool; nothing from those apps belongs in this repo.

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

Expo + React Native + TypeScript · Expo Router · NativeWind v5 · Zustand (in-memory only) · Clerk (auth, still on its **development** instance — see Open items) · Supabase (Postgres + RLS, native Clerk third-party auth — **not** the deprecated JWT-template method; plus one Edge Function and `pg_net`) · `expo-notifications` + Firebase Cloud Messaging (Android push only) · PostHog (analytics) · `expo-updates` (OTA) · Jest + jest-expo (tests) · EAS Build (distribution)

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
- v1-era SQL patches applied through **round 9** (round 7 = admin-only DELETE policies for the 4-month auto-delete; round 8 = `status_override`/`status_ping` columns, later superseded; round 9 = full timestamped ping history table, `report_item_status_pings`, replacing round 8's single-value column).
- **v2-era SQL** has its own numbering, `v2-supabase-patch-roundN.sql`: task foundation and per-assignee completion (1–4), recurrence schema (5–6), custom recurrence dates + `inventory_items.status_updated_at` (7, applied via `round7-retry` — the original `round7.sql` is broken and should be deleted from the repo), task-completions delete policy for cleanup (8), completion recursion fix (9), reminders (10, reshaped to multi-reminder in a later round), push token column (11), plus the push trigger and three `coderabbit-fixes` files. **This chat's round count drifted from the repo's around 10–12** — check the repo's latest file name before numbering the next one.
- `pg_net` extension enabled; Vault holds `project_url`, `service_role_key`, `task_assignment_push_secret`.

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

## v2 — status and priority order

### Done

1. **Document set** — `ADVISOR.md`, this file, `AGENTS.md`.
2. **Dashboard restructure** (`v2-01`) — Out of Stock / Low Stock as collapsible sections, pinged items first, Reports defaults to Today.
3. **Navigation restructure** (`v2-02`) — Inventory / Reports / Make-a-Report behind one "Manage" tab for Admin/Manager; Employee navigation unchanged.
4. **To-do list feature** (`v2-03-a` → `v2-03-e3`):
   - **a / a2** — task categories, one-time tasks, assignment, search/filter/sort, editing, descriptions, mass assign/unassign, Admin/Manager self- and cross-assignment, deletion (Admin: any; Manager: own only). Completion is per assignee: one completion closes the task for everyone; a miss needs every assignee's own reason.
   - **b** — recurrence engine: daily / weekly / monthly; fixed times or every-N-hours anchored to Riyadh midnight; ends by count or date; idempotent occurrence keys. Monthly day-29–31 rules skip short months.
   - **c / c2** — calendar for custom dates, combinable with a structured pattern; live occurrence preview; a rule's first occurrence is generated at creation; deleting any occurrence cancels the series, with a series-specific warning.
   - **d / d2 / d3** — Records page (per-employee four-state summary + detail view, Admin/Manager only); 4-month task cleanup; overdue status updates live without reload (`useNowTick`); date-picker fix (date mode reads UTC getters, time mode reads local — confirmed on an EDT device); completion `42P17` recursion fix.
   - **e1 / e2 / e3** — personal reminders (up to 3 per task, hours or days before due, not offered on completed/overdue tasks); Tasks time filter (Today / This Week / This Month / All Time); push to the assignee when a task is assigned (Edge Function + `pg_net` trigger + FCM; skipped for recurrence-generated occurrences). CodeRabbit hardening: shared-secret header on the Edge Function, trigger can't roll back an assignment, unique index on completed rows, ownership checks on recurrence-rule updates and occurrence inserts.
5. **Dashboard round 2** (`v2-04`) — shared category filter, `DD:HH:MM` timer since `status_updated_at` on every low/out item, most-recently-updated first within each group; Inventory's "Default" sort replaced by "Recently Added."

### Next, in this order

1. **v2-05 — Today's tasks on the Dashboard, a "Delay" action, and a 2-day window for missed tasks.** From Yahya's dad.
   - **Dashboard (Admin/Manager):** today's tasks in three collapsible sections — **Upcoming** (due later today, not resolved), **Delayed**, and **Missed** (past due, not completed). Same `CollapsibleSection` pattern as the stock sections.
   - **Delay button** beside Complete, for when the assignee already knows it'll be late (dad's example: a waiter can't put lemon slices on the tables until the kitchen has cut the lemons). It moves the due time: originally due **before 20:00** Riyadh → **23:59 that day**; due **at or after 20:00** → **10:00 the next day**.
   - **Missed-task window:** on an assignee's own Tasks page, a missed task with no reason stays visible for 2 days after its due time, then drops off (it stays in Records as "missed, no reason"). Giving a reason removes it immediately, as today. On an Admin/Manager's Tasks page, other people's missed tasks — including other admins' — drop off after 2 days, or as soon as every assignee has given a reason.
   - **Confirmed by Yahya:** "after 8:00" means 8 PM; a delay moves the task for everyone assigned (the due time is shared); one delay per task; only available before the task is overdue; any assignee can press it; the original due time and who delayed it are recorded; no reason required to delay; "2 days" means 48 hours after the (possibly delayed) due time; delaying a recurring occurrence moves only that occurrence. Reminders must reschedule when a task is delayed (AGENTS.md → Notification Rules).
   - **Implementation (written as `v2-05-delay-missed-dashboard-tasks.md`, three parts that halt for commit):** delaying goes through a server-side RPC `public.delay_task` (employees have no UPDATE on `tasks`, and the client must never supply a due time); the 20:00 rule lives in `internal.delayed_due_at` in SQL and is mirrored in TypeScript for the confirmation text only. SQL: `v2-supabase-patch-delay-task.sql`. Dashboard bucket rules: candidates are tasks due today (Riyadh) or delayed from today; Missed (overdue and not hidden by the 2-day rule) takes precedence over Delayed, which takes precedence over Upcoming; sections sit below the stock sections and ignore the category filter; Admin/Manager only. Known edge: editing a delayed task's due date through the edit form leaves its delay fields untouched.
2. **v2-06 — change stock status straight from the Dashboard.** From Yahya's dad.
   - The status badge at the top-right of each Dashboard item becomes a button. Tapping it enlarges it slightly and reveals the other two statuses, always in In → Low → Out order: on a Low item, In Stock appears above and Out of Stock below; on an Out item, In Stock and Low Stock both appear above. Tapping the same badge or anywhere else collapses it with no change.
   - Choosing In Stock takes the item off the Dashboard's low/out lists, same as a ping from a report does today.
   - **Confirmed by Yahya:** a Dashboard ping is recorded in the same timestamped ping history as report pings. **Animation (Yahya left the style to the planning chat):** the badge scales to ~1.08× with a well-damped spring while the other two options fade/slide/scale out of it, staggered ~40ms; closing is the reverse in ~140ms; built with the already-installed `react-native-reanimated`. The picker always lays out In → Low → Out, with the current status keeping its own slot.
   - **Implementation (written as `v2-06-dashboard-status-picker.md`):** keep the expanded picker inside the card's bounds by default (Android doesn't deliver taps to children outside their parent's bounds); one screen-level "which picker is open" state; close on tap-outside and on scroll. **Open risk:** a ping has to belong to a report, and a Dashboard ping has no report — the prompt tells Claude Code to reuse the existing report-submission path if that's clean, and to stop and report if it isn't, rather than invent a schema.
3. **v2-03-f — required photo/video per task.** Pushed behind dad's batch. Tasks assigned only to admin(s) are exempt. Retention (2 days vs. 1 week) still undecided — depends on real storage usage.
4. **Transactional RPC ("Option B").** Originally for report submission (a retry after a partial failure can duplicate append-only snapshot/ping history). CodeRabbit has since confirmed the same non-atomic multi-insert pattern in task creation/editing and recurrence-rule creation, so this now covers both. Confirmed sequencing: before the sign-up migration.
5. **In-app sign-up page** plus removing `sampleUsers.ts` in favor of Clerk directly. Yahya wants this even knowing it may cause issues.
6. **Collapsible views** — "All Time" reports grouped by month (maybe week); collapse the units and categories sections on Settings.
7. **Push for stock-status pings.** Much smaller than when first queued — FCM, the Edge Function pattern, `pg_net`, and per-user push tokens all exist now.
8. **Settings changelog / "what's new"** (later). Not yet verified whether the `eas update --message` text is readable at runtime via `expo-updates`, or whether this needs its own small table.
9. **Lower priority, order flexible:**
   - Recurrence management screen (edit a rule's assignees — must not affect already-generated occurrences)
   - Employee-facing task history
   - Make the Users page functional
   - Ping buttons as a slider-style control
   - +/− steppers for quantity and min-threshold in the Inventory edit form
   - Let employees type a quantity directly when reporting
   - A **force-update screen** when a change needs a full rebuild rather than OTA
   - **Employee offboarding** (no way to deactivate a leaver yet; stopgap is changing their password)
   - Yahya's idea, still to discuss with his dad: a page where employees see pings/reports others filed on items they're assigned to

## Open items / loose ends

- **Pre-launch cutover — still pending, do as one planned step.** (a) Delete all test/dev reports, tasks, and reminders, and reset every item's quantity to zero so the first real count happens through a submitted report. (b) Move Clerk from its development instance to production — this gives every user a **new Clerk id**, so staff accounts get created fresh on the production instance as part of the same step, not migrated. Yahya will ask for the SQL and steps when ready.
- **Delete `v2-supabase-patch-round7.sql`** from the repo — broken and fully superseded by `round7-retry.sql` (CodeRabbit flagged it).
- **A push token belongs to a device, not a person — and nothing releases it.** Confirmed on the preview build: two different accounts signed in on the same phone have the identical `expo_push_token` in `app_users`. Registration only writes at sign-in; nothing clears it on sign-out and nothing stops two rows holding the same token. So after switching accounts, the previous account's assignment pushes still arrive on that phone — a privacy leak on any shared device. Harmless while every employee uses their own phone. Proper fix: a `security definer` RPC that claims a token for the caller and nulls it on every other row (the client can't do that itself — `app_users` RLS only lets you update your own row), plus a release on sign-out. Small, but it touches SQL, auth flow, and the Edge Function's assumptions — queue before real rollout; ask Yahya whether staff share devices.
- **Push end-to-end still needs one real test.** Token registration is confirmed on both dev and preview. The full chain (assign a task → trigger → `pg_net` → Edge Function → FCM → phone) hasn't been confirmed with a real notification arriving yet.
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
3. v1, the post-v1 queue, the to-do list feature (through notifications), and two Dashboard rounds are complete. Dad's batch (`v2-05`, `v2-06`) is next. Billing and delivery apps are separate projects.
4. The v2 priority order (above).
5. Pre-launch data cleanup task — do not act until real counting is about to begin.
6. Deployment facts: dev vs preview profiles, OTA covers JS-only changes only, `--no-bytecode` required on Yahya's machine specifically, env vars must be registered with EAS, EAS build times are unpredictable, `eas build` is safe to walk away from once queued.