Read AGENTS.md first and follow it strictly.

## Task

Replace the current mocked sign-in behavior with real Clerk email + password authentication, and route users by their role after they sign in. Do this using Clerk's **custom flow** so the existing Sign In screen design is preserved exactly. Do not use Clerk's prebuilt UI components.

This is one feature: authentication + role-based routing. Do not build any dashboard, reports, inventory, or user-management UI beyond the minimal placeholders described below.

### 1. Provider and session persistence

- Wrap the app's root layout with `ClerkProvider`, passing the `tokenCache` imported from `@clerk/expo/token-cache` and the publishable key from `process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- Install `expo-secure-store` (use `npx expo install expo-secure-store`) — the token cache uses it to persist the session on native builds so users stay signed in across app restarts. On web/PWA it is inert; Clerk handles web session storage itself. This is the only new dependency permitted for this prompt.
- Add `expo-secure-store` to the plugins array in `app.json` if the Clerk Expo setup requires it.

### 2. Real sign-in on the existing screen

- Keep the existing Sign In screen's layout, colors, spacing, logo, and text exactly as they are.
- Wire the email and password fields and the Sign In button to Clerk using the `useSignIn()` custom-flow hook.
- Keep the loading spinner behavior on the Sign In button, driven by Clerk's real request state.
- Surface authentication errors to the user in a simple, readable way (for example, an inline message under the fields) — wrong password, unknown email, etc. Do not leave errors silent.
- Do NOT add a Sign Up flow to the UI. Accounts are created by Admins in the Clerk dashboard, not in the app.

### 3. Role-based routing after sign-in

- The user's role is stored in Clerk `publicMetadata` under the key `role`, as a lowercase string: `"admin"`, `"manager"`, or `"employee"`.
- Create `types/role.ts` exporting: `export type Role = "admin" | "manager" | "employee";`
- Read the role from the signed-in user's `publicMetadata` (via `useUser()`), typed against `Role`.
- Route after a successful sign-in:
  - **No role set (undefined/empty):** do NOT navigate into the app. Sign the user back out and show this error on the Sign In screen: `"Your account has not been assigned a role. Please contact your administrator."` This prevents a session with no permissions from getting stuck inside the app.
  - **`admin` or `manager`:** navigate to the Dashboard route (`/`).
  - **`employee`:** navigate to the Reports route (`/reports`).

### 4. Auth guards (who can see what)

- Add guards at the layout level of the route groups, not with `router.push` inside effects.
- Each guard must check `isLoaded` **before** `isSignedIn` (both from `useAuth()`), and while `isLoaded` is false it must render the branded splash loading UI (see step 5) — never a blank screen and never a redirect.
- Protected screens (Dashboard, Reports, and everything built later): if the user is signed OUT, redirect to the Sign In screen using Expo Router's `<Redirect>`.
- Auth screens (Sign In): if the user is signed IN, redirect them away — `admin`/`manager` to `/`, `employee` to `/reports`. A signed-in user must never see the Sign In screen.
- An `employee` must never land on the Dashboard (`/`). If an employee reaches `/`, redirect them to `/reports`.

### 5. Convert the splash into the loading state (do not keep it as a timed route)

- The existing branded splash screen (MF crown logo + Arabic branding) currently uses a fixed ~2-second timer and auto-navigates to Sign In. **Remove that timer and the auto-navigation.**
- Extract the branding visuals into a small reusable component (for example `components/SplashScreen.tsx` or similar, following AGENTS.md architecture — reusable UI belongs in `components/`).
- The guards render this component while `isLoaded` is false. This replaces the timer: the branding shows for exactly as long as Clerk takes to resolve the session, then routing happens automatically. Do not reintroduce any `setTimeout`-based navigation.
- If the splash currently occupies the `app/index.tsx` (`/`) route, that route must be freed for the Dashboard. Repurpose that file as the Dashboard placeholder (step 6) and move the branding into the reusable component above.

### 6. Minimal placeholder destination screens

The Dashboard, Reports, and tab navigation are built in later prompts (07, 08, 10). For now, create the two destination routes as minimal placeholders so routing can be tested end to end:

- **Dashboard** at `/`: a centered screen showing the text `"Dashboard"` and a **Sign Out** button.
- **Reports** at `/reports`: a centered screen showing the text `"Reports"` and a **Sign Out** button.
- Each Sign Out button calls Clerk's `signOut()` and returns the user to the Sign In screen. This is required so both roles can be tested without reinstalling the app.
- Style these placeholders minimally with NativeWind (brand background, readable text) — do not invest in real dashboard/report layout; those come later.

## Constraints

- Preserve the Sign In screen design pixel-for-pixel. Only wire up behavior; do not restyle it.
- No Sign Up UI. No social login. No password reset in this prompt (the "Forgot password?" link stays visible but non-functional for now — a later prompt handles it).
- Use the **current Clerk Expo custom-flow API** (v3.4+): `signIn.password({ emailAddress, password })`, check the returned `error`, then `signIn.finalize({ navigate })` when `signIn.status === 'complete'`. Handle the `needs_second_factor` / `needs_client_trust` branches defensively even though MFA is not enabled. **Do NOT** generate the legacy pattern (`signIn.create()` + `attemptFirstFactor()` + `setActive({ session })`) — that lives at `@clerk/expo/legacy` and must not be used for new code.
- Read the publishable key from `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Never hardcode keys. Never reference the secret key in client code.
- Do not install any dependency other than `expo-secure-store`. If you believe another library is genuinely needed, stop and ask before installing.
- Keep changes focused. Do not rewrite unrelated code or restructure folders beyond what steps 4–6 require.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors. No `any`.

Before implementing, confirm your understanding of the file structure you'll touch (root layout, the auth group layout, the protected group layout, `app/index.tsx`, `types/role.ts`, and the splash component) and note anything that conflicts with the existing repo. If anything is unclear, ask before implementing.

## Reference

Use the installed `clerk-expo` skill, specifically its custom-flows reference, as the source of truth for the current API. Key facts it confirms:

- `useSignIn()` returns `{ signIn, errors, fetchStatus }`. Use `fetchStatus === 'fetching'` to drive the button spinner and disable submit. Field errors are at `errors.fields.identifier` / `errors.fields.password`.
- `signIn.finalize({ navigate })` replaces the old `setActive`. Handle session tasks in the navigate callback if present.
- Session persistence: `tokenCache` from `@clerk/expo/token-cache`, backed by `expo-secure-store`.
- Layout guards: `useAuth()` gives `isLoaded` and `isSignedIn`; check `isLoaded` first, use Expo Router `<Redirect>`.
- Role: read `user.publicMetadata.role` from `useUser()`.

If the installed `@clerk/expo` version is older than 3.4 and the hooks don't match this shape, stop and tell me before writing any code — do not fall back to the legacy API.