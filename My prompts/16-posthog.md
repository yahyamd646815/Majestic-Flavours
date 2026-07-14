Read AGENTS.md first and follow it strictly.

Add PostHog event tracking to the inventory app. Initialize PostHog in lib/posthog.ts using the PostHog React Native library. Use the PostHog project API key from environment variables only. Never expose keys in client code.

User identification:
- After Clerk authentication completes, call posthog.identify() with the Clerk user ID as the distinct ID
- Set user properties: role (Admin/Manager/Employee), signup_date (via $set_once)

Track these four custom events:

1. user_signed_in — fires after successful Clerk authentication
   Properties: { role: string }

2. inventory_item_deleted — fires when an Admin confirms and completes the two-step DELETE flow for an item
   Properties: { item_name: string, category: string }

3. report_submitted — fires when an Employee submits a daily report
   Properties: { item_name: string, employee_id: string, date: string }

4. low_stock_alert_viewed — fires when the Dashboard mounts and there is at least one low-stock item
   Properties: { low_stock_count: number }

Implementation rules:
- Do not modify any UI
- Do not expose any keys
- Do not reinitialize PostHog more than once

---

(Here paste the latest [PostHog React Native documentation](https://posthog.com/docs/libraries/react-native))
