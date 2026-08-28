-- ============================================================
-- Majestic Flavours — patch (round 9)
-- Replaces the single-value report_item_entries.status_ping column with a
-- full timestamped history table, mirroring report_item_snapshots exactly —
-- Yahya wants "the same as when quantity is changed," not just the latest
-- value.
-- ============================================================

-- ---------- STEP 1: run this first, read the output ----------
-- The policies below are a best reconstruction of report_item_snapshots'
-- actual policies, not a verified copy — I was never shown their exact SQL
-- directly. Check what comes back here and adjust STEP 3 below to genuinely
-- match it, rather than trusting my reconstruction blindly.

select policyname, cmd, qual, with_check
from pg_policies
where tablename = 'report_item_snapshots';


-- ---------- STEP 2: the new table ----------

create table report_item_status_pings (
  id text primary key,
  report_item_entry_id text not null references report_item_entries(id) on delete cascade,
  status text not null check (status in ('out_of_stock', 'low_stock', 'in_stock')),
  recorded_at timestamptz not null default now()
);

alter table report_item_status_pings enable row level security;


-- ---------- STEP 3: policies — adjust to match STEP 1's actual results ----------

-- Insert only for the entry's own reporter.
create policy "status_pings_insert_own" on report_item_status_pings for insert
  with check (
    exists (
      select 1 from report_item_entries e
      join reports r on r.id = e.report_id
      where e.id = report_item_entry_id
        and r.reporter_id = current_clerk_user_id()
    )
  );

-- Readable alongside the entries/snapshots they belong to — match whatever
-- STEP 1 shows for report_item_snapshots' own select policy exactly.
create policy "status_pings_select_all" on report_item_status_pings for select
  using (true);

-- Admin-only delete for the 4-month cleanup cascade — same pattern as
-- round7's policies on report_item_entries/report_item_snapshots, required
-- for the same reason: a cascade delete still needs RLS permission on every
-- child table it touches, not just the parent.
create policy "status_pings_delete_old" on report_item_status_pings for delete
  using (
    current_user_role() = 'admin'
    and exists (
      select 1 from report_item_entries e
      join reports r on r.id = e.report_id
      where e.id = report_item_entry_id
        and r.date < (current_riyadh_date() - interval '4 months')::date
    )
  );


-- ---------- STEP 4: drop the superseded column ----------
-- Any pings recorded during 17c's own testing are lost here — acceptable,
-- this is still active development, not live data that matters. Skip this
-- step and migrate the existing values first if that's not true anymore by
-- the time this runs.

alter table report_item_entries drop column if exists status_ping;
