Read AGENTS.md first and follow it strictly.

Implement the bottom tab navigation for the inventory app. Create tab routes for these five screens with simple placeholder screens for now:

1. Dashboard (home icon) — visible to Admin and Manager only
2. Inventory (box or grid icon) — visible to Admin and Manager only
3. Reports (document icon) — visible to all roles
4. Users (people icon) — visible to Admin only
5. Settings (gear icon) — visible to Admin only

Build a clean custom tab bar. The active tab should show a filled colored icon using the primary gold brand color (#C8A44A). Inactive tabs show a muted icon and a small label below. Keep the tab bar minimal and professional with a white background and a subtle top border.

Hide tabs from the tab bar that the current user's role does not have access to. Read the role from the Clerk session data (publicMetadata.role), which is the single source of truth for roles as defined in AGENTS.md. Do not use userStore as the role source for tab gating. If the Clerk session or role has not loaded yet, do not render role-gated tabs until it is available.

Do not implement any screen content yet. Placeholder text for each screen is fine.

Do not change any existing auth or navigation logic.