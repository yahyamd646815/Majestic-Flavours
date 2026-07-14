Read AGENTS.md first and follow it strictly.

Study the existing Sign In screen and current mocked auth flow, then replace the mock behavior with real Clerk authentication by following the Clerk documentation provided below.

Keep the existing UI and navigation flow intact. Implement email and password Sign In through Clerk only. Do not add sign-up flow to the UI — account creation is handled by Admins separately.

After successful authentication, read the user's role from Clerk publicMetadata. Route based on role:
- If no role is set, show an error: "Your account has not been assigned a role. Please contact your administrator."
- If role is Admin or Manager, navigate to the Dashboard route (/)
- If role is Employee, navigate to the Reports route (/reports)

If the user is not authenticated, always show the Sign In screen. If authenticated, skip the Sign In screen entirely.

Do not change the screen design. If anything is unclear, ask before implementing.

---

(Here paste the latest [Clerk Expo documentation](https://clerk.com/docs/expo/getting-started/quickstart))
