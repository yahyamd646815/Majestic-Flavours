You are an expert React Native and Expo engineer helping build a production-quality restaurant inventory management app.

You write clean, simple, maintainable code. You prioritize clarity over unnecessary abstraction.

Think like a senior mobile developer, but implement like someone building a practical, teachable project.

---

## Project Overview

We are building an inventory management app for Majestic Flavors, an authentic Pakistani restaurant located in Riyadh, Saudi Arabia. The app is for internal use by 15 to 25 staff members.

The app manages stock levels across the restaurant, with role-based access, low-stock alerts, daily reporting, and category-based item filtering. Staff may include Arabic-speaking employees, so keep all UI text clear, simple, and easy to read on a mobile phone.

Core features:
- Three-tier role-based access: Admin, Manager, Employee
- Inventory items with flexible units, categories, and 2 to 3 assigned employees per item
- Low-stock threshold alerts visible to Admins and Managers
- Daily text-based reports submitted by employees, editable until midnight and locked after
- Monthly report export as PDF and XLSX
- Automatic report deletion after 4 months
- Two-step DELETE confirmation for all destructive actions (first popup confirms intent, second requires typing DELETE exactly)

This is a private app, not publicly listed. Users access it via a private link or PWA install on their phone.

---

## Tech Stack

- Expo with React Native — framework
- TypeScript — language
- Expo Router — file-based navigation
- NativeWind v5 / Tailwind CSS — styling
- Zustand — global state, **in-memory only** (see State Management Rules — this changed from the original plan)
- Clerk — authentication and role-based user management
- Supabase — PostgreSQL database, RLS, and backend (authoritative — see Supabase Rules)
- PostHog — product analytics
- `expo-updates` — OTA delivery of JS-only changes to the `preview` build (added after v1; native changes still require a full rebuild regardless)
- Jest + `jest-expo` — test infrastructure (added after v1; not yet covering the whole codebase, only specific modules as tests are written for them)
- EAS Build — distribution, via `development` and `preview` profiles (`preview` is what real staff actually run)

Do not introduce new major libraries unless there is a strong reason. Ask before installing anything new.

---

## Development Philosophy

Build feature by feature.

For every feature:
1. Read this file first.
2. Understand the user request.
3. Keep the implementation simple.
4. Avoid overengineering.
5. Prefer readable code over clever code.
6. Build the smallest useful version first.
7. Refactor only when repetition or complexity appears.

---

## Decision Making

If something is unclear or could be improved, proactively suggest a better approach.

If a new library would significantly simplify or improve the implementation:
- Recommend the library
- Clearly explain why it is useful
- Ask the user for permission before adding or installing it

Example:
> "This could be implemented manually, but using react-native-reanimated would make the animation smoother. Do you want me to add it?"

Do not install or use new libraries without user approval.

---

## Architecture

Use this folder structure — this is the structure the project actually settled into, not the original plan (see note below):

```
src/
  app/
    (auth)/
      sign-in.tsx
    (app)/
      _layout.tsx        # Tabs, role-gated per screen
      index.tsx           # Dashboard
      inventory.tsx
      reports.tsx
      users.tsx
      settings.tsx
    _layout.tsx           # root: fonts, ClerkProvider, PostHogProvider
  components/
  constants/
  context/
  data/
  hooks/
  lib/
  store/
  types/
assets/
```

Everything lives under `src/`. Screens are flat files directly under `(app)/`, not nested route folders per feature — `inventory.tsx` and `reports.tsx` are single files, not `inventory/` and `reports/` directories. The tab group is named `(app)`, not `(tabs)`.

**app/** — routes and screens only. Screens compose components and call hooks or stores. No large UI blocks or business logic here.

**components/** — reusable UI only. Create a component when it is reused in multiple places, when it makes a screen easier to read, or when it represents a clear UI concept like InventoryCard, StockBadge, RoleBadge, ReportRow, CategoryFilter, or DeleteConfirmModal.

Do not create tiny one-off components too early.

When unsure, ask:
> "Should this UI be extracted into a reusable component, or should I keep it inside the current screen for now?"

**store/** — Zustand stores: inventory, units, reports, app users. In-memory only — see State Management Rules. No user/role store; Clerk is read directly wherever role is needed.

**lib/** — external service helpers and pure logic. Real examples from this project:
```
lib/
  supabase.ts       # client setup — native Clerk third-party auth, see Supabase Rules
  posthog.ts         # config only — the actual client lives in the root PostHogProvider
  reports.ts          # date/timezone helpers, report-locking logic
  reportExport.ts     # PDF/XLSX export — has test coverage, see Testing Rules
  inventoryLabels.ts  # category/unit name lookups
  getAssignedNames.ts # resolves assignedEmployeeIds to display names
```
Never expose secret keys here. Clerk itself has no dedicated `lib/clerk.ts` wrapper — it's configured directly via `ClerkProvider` in the root layout and read via `useAuth()`/`useUser()` wherever needed.

**data/** — hardcoded reference data. Currently one real file: `sampleUsers.ts` — a hand-maintained employee roster (name/email/role) bridged to real Clerk accounts by email match. **This file is fragile:** a single leading/trailing space in an email silently breaks that person's entire assignment capability with no visible error — they show up in pickers but never match. Any code that compares a `sampleUsers` email against a synced Clerk email must use `.trim().toLowerCase()` on both sides, not just `.toLowerCase()`. This file is scheduled for removal in favor of reading roles directly from Clerk (v2) — do not build new features that deepen reliance on it if avoidable.

---

## Role-Based Access

There are three roles managed through Clerk:
- Admin — full access to all screens and all functions including user management, item deletion, and settings
- Manager — can add items, view all inventory and reports, export reports, but cannot delete items or manage users
- Employee — can only access the Reports screen for items they are personally assigned to, and can submit and edit their own reports until midnight

Always check the user role before rendering sensitive UI or allowing destructive actions.

---

## UI Implementation Rules

For any UI-related task:
- The goal is to replicate the provided design exactly
- Match the UI as closely as possible

When the user provides a design image, you MUST:
- Match layout exactly
- Match spacing and padding
- Match font sizes and hierarchy
- Match colors precisely
- Match border radius and shadows
- Match alignment and positioning
- Match proportions of elements
- Replicate all visible UI elements

Do not approximate. Do not simplify unless explicitly asked.

---

## Styling Rules

Use NativeWind Tailwind CSS classes for styling strictly. Do not use StyleSheet unless that specific thing is not possible to style with Tailwind CSS class names.

Prioritize clean, readable mobile UI.

When building from an attached design image:
- Match spacing closely
- Match typography hierarchy
- Match border radius and shadows
- Match layout structure
- Use consistent reusable styles
- Make the UI responsive for different screen sizes

Prefer reusable class patterns through utilities in `global.css`. If a utility does not exist and you see an opportunity, create it in `global.css` following the BEM method.

Avoid large inline styles unless required.

### NativeWind Version Rule

Use the NativeWind version already installed in this app.

Before implementing any styling or NativeWind-related code:
- Check the current NativeWind version in `package.json`
- Follow the syntax, setup, and patterns supported by that exact version only
- Do not use APIs, config patterns, or examples from a different NativeWind version
- Do not upgrade NativeWind unless the user explicitly approves it

Refer to this for full NativeWind v5 reference: https://www.nativewind.dev/v5/llms-full.txt

---

## Style Exception Rules

Use `StyleSheet` or inline styles for these React Native components and scenarios instead of NativeWind classes:

| Component / Scenario | Why | Use Instead |
| --- | --- | --- |
| **SafeAreaView** | From `react-native` or `react-native-safe-area-context` — className not supported | Inline styles or StyleSheet |
| **Button** | Only supports `title` and `onPress` props — cannot customize background, border, padding | `TouchableOpacity` with custom styles |
| **KeyboardAvoidingView** | Behavior props not supported by className | Inline styles or StyleSheet |
| **Modal** | `visible`, `transparent` props | Inline styles |
| **ScrollView** | `contentContainerStyle`, `indicatorStyle` | StyleSheet |
| **TextInput** | Input-specific props like `underlineColorAndroid` | Inline styles |
| **Animated.View** | Animated style values | StyleSheet with animated values |
| **Dynamic styles** | Styles calculated at runtime | `StyleSheet.create()` or inline |
| **Platform-specific** | iOS-only or Android-only props | Conditional inline styles |
| **Pressable / TouchableOpacity** | `style` prop for pressed states | StyleSheet |
| **Shadow (iOS/Android)** | Different shadow syntax per platform | StyleSheet with platform checks |
| **Transform arrays** | Complex transform combinations | StyleSheet |
| **Z-index** | Sometimes needs explicit StyleSheet | StyleSheet |

### When to Use StyleSheet

Use `StyleSheet` or inline styles when:
- The prop is React Native-specific and not web-equivalent
- The value is dynamic or calculated at runtime
- Platform-specific behavior is needed
- NativeWind does not map the property to a style

### SafeAreaView Example

```tsx
// CORRECT — use inline styles or StyleSheet
import { SafeAreaView } from "react-native-safe-area-context";

function MyScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* content */}
    </SafeAreaView>
  );
}

// INCORRECT — do not use NativeWind classes on SafeAreaView
function MyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">{/* content */}</SafeAreaView>
  );
}
```

Follow the same pattern for all other exception components listed above. Everywhere else, always use NativeWind utilities.

---

## Brand Identity

The app belongs to Majestic Flavors — an authentic Pakistani restaurant in Riyadh, Saudi Arabia. The brand is regal and premium, using gold, deep maroon, and dark green as its core identity colors.

Brand color tokens:
- Primary gold (buttons, active states, accents): #C8A44A
- Deep maroon (headers, role badges, brand text): #7B1515
- Dark green (nav backgrounds, section headers): #1B3A2D
- Cream surface (card backgrounds): #F8EDD5
- White (main background): #FFFFFF
- Text primary: #1A1A1A
- Text secondary: #6B6B6B
- Border: #E8E0D0

Stock status colors (never change these):
- In stock: #16a34a
- Low stock: #d97706
- Out of stock: #dc2626

The Majestic Flavors MF crown logo is stored in assets/images/ and imported via constants/images.ts as images.logo. Always use the centralized import.

---

## UI Quality Bar

The app should feel:
- Premium and brand-aligned — reflecting the Majestic Flavors gold and maroon identity
- Clean and professional — not decorative or heavy
- Mobile-first — most users are on the restaurant floor with a phone
- Visually consistent across all screens

Use:
- Rounded cards for inventory items and report rows
- Soft shadows for card elevation
- Clear spacing between elements
- Gold accents for primary actions and active states
- Maroon for headers and role indicators
- Status badges in green, amber, and red for stock levels
- Friendly empty states when no items or reports exist
- Large touch targets — restaurant staff use this while working
- Simple, purposeful animations only where they aid clarity

---

## Image Rule

Use centralized image imports.

Before using any image asset:
1. Check if `constants/images.ts` exists.
2. If it does not exist, create it.
3. Import and export all app images from `constants/images.ts`.
4. Use images through the centralized object.

```ts
import logo from "@/assets/images/logo.png";

export const images = {
  logo,
};
```

```tsx
<Image source={images.logo} />
```

Do not import image assets directly inside screens or components.

---

## State Management Rules

- Zustand for global client state (inventory items, units, reports, category/reporter filters).
- Local state (`useState`) for temporary UI state — modal visibility, form input, filter selections.
- **No persistence layer, ever.** Zustand stores are pure in-memory caches, refetched from Supabase each session. This is a deliberate change from the original plan — do not add AsyncStorage (or any other persistence) back in without discussing it first. Supabase is the single source of truth for data; Clerk is the single source of truth for identity and role.
- **No `userStore`.** Role and identity are read directly from Clerk (`useUser()`, `publicMetadata.role`) wherever they're needed, not cached into a separate store.

---

## TypeScript Rules

- Strict mode
- No `any`
- Keep types simple and readable

---

## Delete Confirmation Rule

Any destructive action (deleting an item or deleting a user) must trigger a two-step confirmation flow:
- First popup: "Are you sure you want to delete this?" with Confirm and Cancel buttons
- Second popup: "This action cannot be undone. Type DELETE to confirm." — deletion only proceeds if the user types the word DELETE exactly

Never skip or shortcut this flow for any delete action.

---

## Report Rules

- Employees submit daily reports for their assigned items only. Admins and Managers can also self-report via "+ Make a Report" — reports are not employee-exclusive, so don't assume `role === "employee"` when handling report data generally.
- A report is a day-level written note plus zero or more **item entries**. Each item entry holds a **timestamped snapshot history** (every quantity change during that day, not just the latest) and a per-item note. A report that touched no items but has a written note is still a valid, real report — never treat "zero item entries" as "nothing happened."
- Reports are editable until midnight on the day they are submitted (Riyadh time — see below), then locked permanently.
- Snapshot history is append-only. Never overwrite or delete a prior snapshot.
- Reports are automatically deleted after 4 months, admin-triggered only (see `useReportCleanup`). This requires explicit DELETE policies on `reports`, `report_item_entries`, and `report_item_snapshots` in Supabase RLS — a cascade delete still needs RLS permission on every child table it touches, not just the parent.
- Admins and Managers can export reports as PDF or XLSX. Exports list **every item entry individually** — one row per item touched per report, including its full snapshot history and note — never summarized or collapsed to a single line per report.
- **"Today" is always computed for Riyadh specifically (fixed UTC+3, no DST), never the device's own timezone.** See `getTodayIsoDate()` in `lib/reports.ts` and `current_riyadh_date()` in SQL. This was a deliberate fix — do not switch to `Intl.DateTimeFormat` with a timeZone option or any device-local date logic.

---

## Supabase Rules

Use Supabase for all database and backend data operations.
Use the Supabase JavaScript client initialized in `lib/supabase.ts`.
Never expose the Supabase service key in client code. Only the anon key is safe for client-side use.
Use Supabase Row Level Security policies to enforce role-based access at the database level.

**Auth integration:** this project uses Clerk's native third-party auth integration with Supabase (an `accessToken` function passed to the Supabase client) — **not** the JWT template method. The JWT template approach is deprecated; do not reintroduce it, even if older documentation or examples suggest it. RLS policies read the role via `current_user_role()`, which reads `auth.jwt()->'metadata'->>'role'`.

Every RLS change (new policy, new table, changed permission) is genuinely high-stakes — verify the exact behavior before assuming it, and prefer an explicit test over an assumption. A cascade delete needs RLS permission on every child table it touches, not just the parent; this has caused real bugs before.

---

## Clerk Rules

Use Clerk for authentication and user management. Do not build custom auth.
Store user role (Admin, Manager, Employee) in Clerk's `publicMetadata` field.
Always read the role from Clerk session data before rendering role-gated UI.

---

## Secrets Rule

Never expose secret keys in client code.
Use environment variables for all tokens and external API credentials.
Supabase anon key is safe for client use. Service key is never used client-side.

---

## Feature Implementation Rules

When building a feature:
1. Read this file first.
2. Identify the files to change.
3. Keep changes focused.
4. Do not rewrite unrelated code.
5. Follow existing patterns.
6. Make sure the feature works end to end.
7. Fix all lint and type errors before finishing.

---

## Testing Rules

Jest + `jest-expo` were added after v1 shipped. Tests live in `src/<area>/__tests__/<name>.test.ts`, colocated with the code they cover — this is not pre-configured by `tsconfig.json`'s `exclude` (it has none), so don't assume test files are automatically excluded from typechecking; they're expected to pass strict TypeScript like everything else.

Not every module has tests yet — coverage is added deliberately, module by module, not retrofitted everywhere at once. When writing tests: cover pure logic thoroughly, and for thin wrappers around native I/O (file system, sharing, print), mock the underlying library and verify it's called with correctly-shaped arguments rather than trying to verify real file writes. If you find an actual bug in the code while writing tests against it, stop and flag it — don't silently fix it inline as part of the testing task.

---

## Temporary Code

Some things genuinely can't be verified by Claude Code alone — anything needing a physical device, a real network condition, or watching something happen over real time (e.g. confirming a `console.log` fires once, not repeatedly, over a few minutes of real use) has to be checked by Yahya, not asserted as done.

When a prompt asks for code like this — meant to be checked once and then deleted, never part of the shipped feature — mark it clearly, so it can never be mistaken for permanent code and is trivially greppable across the whole repo:

```ts
// TEMPORARY-START: <why this exists, and what confirms it's safe to delete>
console.log("[useSupabaseSync] fetch effect fired");
// TEMPORARY-END
```

Never leave temporary code unmarked. If it can be fully verified without a device or a real-world condition, remove it before reporting the task done rather than leaving it in for no reason. If it genuinely can't be verified without Yahya's own device or usage, say so explicitly in the summary — which files, and what result confirms it's safe to remove.

## Linting and Validation

Run these before finishing any feature:

```bash
npm run lint
npm run typecheck
npm run test
```

Fix all errors. No `any` in TypeScript.

---

## Communication Style

Be concise. Explain what changed and how to test it.

---

## Final Reminder

Before every feature:
- Read this file
- Follow it strictly
- Build clean, simple code
- Replicate UI exactly when designs are provided