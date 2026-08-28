-- ============================================================
-- Majestic Flavours — patch (round 3)
-- Run in Supabase's SQL editor. Both are safe to run on top of
-- what's already applied — `create or replace` and `drop policy
-- if exists` handle the update in place.
-- ============================================================

-- 1. Claim path corrected for Clerk's native Supabase integration
-- (the JWT-template method used before this is deprecated as of
-- April 1, 2025). Requires the Clerk Dashboard session token
-- customization described in the 13a setup notes — a custom claim
-- named `metadata` set to {{user.public_metadata}}.
create or replace function current_user_role() returns text as $$
  select auth.jwt() -> 'metadata' ->> 'role';
$$ language sql stable;

-- 2. report_item_entries_write used `for all`, which silently granted
-- DELETE — letting a reporter erase their own submitted quantity
-- history (report_item_snapshots cascades on delete). Split into
-- insert/update only, same as report_item_snapshots already was.
drop policy if exists "report_item_entries_write" on report_item_entries;

create policy "report_item_entries_insert" on report_item_entries for insert
  with check (
    exists (
      select 1 from reports r
      where r.id = report_id
        and r.reporter_id = current_clerk_user_id()
        and r.is_locked = false
        and r.date = current_date
    )
  );

create policy "report_item_entries_update" on report_item_entries for update
  using (
    exists (
      select 1 from reports r
      where r.id = report_id
        and r.reporter_id = current_clerk_user_id()
        and r.is_locked = false
        and r.date = current_date
    )
  )
  with check (
    exists (
      select 1 from reports r
      where r.id = report_id
        and r.reporter_id = current_clerk_user_id()
        and r.is_locked = false
        and r.date = current_date
    )
  );
