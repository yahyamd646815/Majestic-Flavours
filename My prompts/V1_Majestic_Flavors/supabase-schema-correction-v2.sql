-- ============================================================
-- Majestic Flavours — schema correction (round 2)
-- Run this in Supabase's SQL editor. Safe to run as-is: there is
-- no real data yet, so this drops and recreates the affected
-- tables rather than writing incremental ALTERs.
-- ============================================================

drop table if exists report_item_changes cascade;
drop table if exists reports cascade;

-- Renamed from employee_id: admin and manager can now also own a
-- report (self-reporting via "+Make a report"), not just employees.
create table reports (
  id text primary key,
  reporter_id text not null references app_users(clerk_user_id),
  date date not null,
  content text not null default '', -- the existing day-level optional note
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (reporter_id, date)
);

-- One row per (report, item) actually touched — holds the optional
-- per-item note. The quantity history is a separate child table below,
-- since it's a growing log, not a single value.
create table report_item_entries (
  id text primary key,
  report_id text not null references reports(id) on delete cascade,
  item_id text not null references inventory_items(id),
  note text not null default '',
  unique (report_id, item_id)
);

-- Append-only: one new row every time this item's quantity is recorded
-- via a Report/Update Report submission (not every stepper tap).
create table report_item_snapshots (
  id text primary key,
  report_item_entry_id text not null references report_item_entries(id) on delete cascade,
  quantity integer not null,
  recorded_at timestamptz not null default now()
);

alter table reports enable row level security;
alter table report_item_entries enable row level security;
alter table report_item_snapshots enable row level security;

-- reports: anyone can read/write their OWN report (no role restriction —
-- admin, manager and employee can all now own a report). Admin/manager
-- can additionally read everyone else's.
create policy "reports_select_own" on reports for select
  using (reporter_id = current_clerk_user_id());
create policy "reports_manager_select_all" on reports for select
  using (current_user_role() in ('admin', 'manager'));
create policy "reports_insert_own_today" on reports for insert
  with check (
    reporter_id = current_clerk_user_id()
    and date = current_date
  );
create policy "reports_update_own_unlocked" on reports for update
  using (
    reporter_id = current_clerk_user_id()
    and is_locked = false
    and date = current_date
  );

-- report_item_entries / report_item_snapshots follow their parent
-- report's access exactly, same pattern as before.
create policy "report_item_entries_select" on report_item_entries for select
  using (
    exists (
      select 1 from reports r
      where r.id = report_id
        and (
          r.reporter_id = current_clerk_user_id()
          or current_user_role() in ('admin', 'manager')
        )
    )
  );
create policy "report_item_entries_write" on report_item_entries for all
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

create policy "report_item_snapshots_select" on report_item_snapshots for select
  using (
    exists (
      select 1 from report_item_entries e
      join reports r on r.id = e.report_id
      where e.id = report_item_entry_id
        and (
          r.reporter_id = current_clerk_user_id()
          or current_user_role() in ('admin', 'manager')
        )
    )
  );
create policy "report_item_snapshots_insert" on report_item_snapshots for insert
  with check (
    exists (
      select 1 from report_item_entries e
      join reports r on r.id = e.report_id
      where e.id = report_item_entry_id
        and r.reporter_id = current_clerk_user_id()
        and r.is_locked = false
        and r.date = current_date
    )
  );
