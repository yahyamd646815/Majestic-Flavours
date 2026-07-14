Read AGENTS.md first and follow it strictly.

Implement the User Management screen. This screen is visible to Admins only.

Use userStore as the single authoritative source for the user list and all user mutations. Hydrate userStore once from sampleUsers.ts during initialization if the store is empty, then render all users — existing and newly added — exclusively from the store. Do not read sampleUsers.ts directly in the screen.

Show a list of all app users from userStore. Each user card displays:
- The user's name and email
- A role badge showing Admin, Manager, or Employee in a distinct color
- An Edit Role button that opens a bottom sheet or modal to change the user's role
- A Remove User button that triggers the two-step DELETE confirmation flow as defined in AGENTS.md. Do not skip or simplify this.

At the top right, show an Add User button. Tapping it opens a simple form modal with fields for name, email, and role selection. Show a "Saving..." state while submitting. Save the new user to userStore — Supabase integration comes later.

If the Admin tries to change their own role or remove themselves, show an error: "You cannot modify your own account."

Do not change the tab navigation or any other screen.