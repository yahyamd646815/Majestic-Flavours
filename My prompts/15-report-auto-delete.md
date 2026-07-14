Read AGENTS.md first and follow it strictly.

Implement automatic report deletion after 4 months.

When the app loads and the user is authenticated, run a background cleanup function that:
1. Fetches all reports from Supabase where the date is older than 4 months from today
2. Deletes those reports in a single batch operation
3. Logs how many reports were deleted (console only, no UI notification needed)

This cleanup should run once per app session on mount, not on every screen visit. Place the logic in a hook called useReportCleanup and call it once from the root layout after authentication is confirmed.

Do not show any loading state or UI for this. It should be silent and automatic.

Do not change any existing UI or navigation.
