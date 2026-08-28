-- ============================================================
-- Majestic Flavours — patch (round 5)
-- Fixes a real, recurring bug: Postgres's `current_date` defaults to
-- UTC, but the app sends the device's local (Riyadh, UTC+3) date.
-- Between midnight and 3am Riyadh time, these disagree — every report
-- submitted in that window would be silently rejected by RLS.
-- Run after round 4.
-- ============================================================

create or replace function current_riyadh_date() returns date as $$
  select (now() at time zone 'Asia/Riyadh')::date;
$$ language sql stable;

-- reports: replace both policies that compared against current_date.
drop policy if exists "reports_insert_own_today" on reports;
create policy "reports_insert_own_today" on reports for insert
  with check (
    reporter_id = current_clerk_user_id()
    and date = current_riyadh_date()
  );

drop policy if exists "reports_update_own_unlocked" on reports;
create policy "reports_update_own_unlocked" on reports for update
  using (
    reporter_id = current_clerk_user_id()
    and is_locked = false
    and date = current_riyadh_date()
  );

-- report_item_entries: same fix, both policies.
drop policy if exists "report_item_entries_insert" on report_item_entries;
create policy "report_item_entries_insert" on report_item_entries for insert
  with check (
    exists (
      select 1 from reports r
      where r.id = report_id
        and r.reporter_id = current_clerk_user_id()
        and r.is_locked = false
        and r.date = current_riyadh_date()
    )
  );

drop policy if exists "report_item_entries_update" on report_item_entries;
create policy "report_item_entries_update" on report_item_entries for update
  using (
    exists (
      select 1 from reports r
      where r.id = report_id
        and r.reporter_id = current_clerk_user_id()
        and r.is_locked = false
        and r.date = current_riyadh_date()
    )
  )
  with check (
    exists (
      select 1 from reports r
      where r.id = report_id
        and r.reporter_id = current_clerk_user_id()
        and r.is_locked = false
        and r.date = current_riyadh_date()
    )
  );

-- report_item_snapshots: same fix.
drop policy if exists "report_item_snapshots_insert" on report_item_snapshots;
create policy "report_item_snapshots_insert" on report_item_snapshots for insert
  with check (
    exists (
      select 1 from report_item_entries e
      join reports r on r.id = e.report_id
      where e.id = report_item_entry_id
        and r.reporter_id = current_clerk_user_id()
        and r.is_locked = false
        and r.date = current_riyadh_date()
    )
  );
