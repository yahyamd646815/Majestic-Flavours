Read AGENTS.md first and follow it strictly.

Study the existing Zustand stores and hardcoded data, then replace the local data with real Supabase database calls by following the Supabase documentation provided below.

Create lib/supabase.ts using the Supabase JavaScript client with the project URL and anon key from environment variables. Never expose the service key.

Set up these tables in Supabase (you can generate the SQL migration):
- inventory_items: id, name, category_id, current_quantity, unit_id, min_threshold, assigned_employee_ids (array), created_at
- categories: id, name
- units: id, label
- reports: id, item_id, employee_id, content, date, is_locked, created_at
- app_users: id, name, email, role, clerk_user_id

Update the Zustand stores to fetch from Supabase instead of hardcoded data:
- inventoryStore: fetch items, categories on mount
- reportStore: fetch reports, save new reports and edits to Supabase
- userStore: fetch user profile from app_users by clerk_user_id after sign in

Enable Row Level Security on all tables. Employees should only read and write their own reports. Managers can read all items and reports. Admins have full access.

Keep the existing UI exactly as is. If anything is unclear about the schema, ask before implementing.

---

(Here paste the latest [Supabase JavaScript documentation](https://supabase.com/docs/reference/javascript/introduction))
