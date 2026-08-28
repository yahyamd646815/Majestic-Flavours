-- ============================================================
-- Majestic Flavours — patch (round 4)
-- Run in Supabase's SQL editor BEFORE testing 13c. Safe to
-- re-run: each policy is dropped first.
-- ============================================================

-- `app_users` could only ever be written by an admin ("app_users_admin_write"),
-- but from 13c onwards every signed-in person upserts their own row on sign-in
-- (appUsersStore.syncSelf). That is not cosmetic: `reports.reporter_id` is a
-- foreign key into `app_users`, so a manager or employee whose row is missing
-- cannot file a report at all — the insert fails on the foreign key.
--
-- Allow anyone signed in to write ONLY their own row. The admin-wide policy
-- stays exactly as it is for everything else, including delete.
drop policy if exists "app_users_insert_self" on app_users;
drop policy if exists "app_users_update_self" on app_users;

create policy "app_users_insert_self" on app_users for insert
  with check (clerk_user_id = current_clerk_user_id());

create policy "app_users_update_self" on app_users for update
  using (clerk_user_id = current_clerk_user_id())
  with check (clerk_user_id = current_clerk_user_id());
