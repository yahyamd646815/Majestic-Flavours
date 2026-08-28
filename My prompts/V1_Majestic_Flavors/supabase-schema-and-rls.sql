-- ============================================================
-- Majestic Flavours — Supabase schema + RLS (prompt 13a)
-- Run this in Supabase's SQL editor, in one go, before any app
-- code depends on it. Review it once yourself first — this is
-- the real security boundary for the whole app.
-- ============================================================

-- ---------- Tables ----------

-- Synced from Clerk. Deliberately no `role` column: role authority
-- stays with Clerk's publicMetadata.role, read from the JWT in RLS
-- policies below — never duplicated into a table that could drift
-- out of sync with Clerk (the same mistake this project avoided
-- three separate times on the client side, now avoided here too).
create table app_users (
  clerk_user_id text primary key,
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table categories (
  id text primary key,
  name text not null unique
);

create table units (
  id text primary key,
  label text not null unique
);

-- category_id / unit_id are real foreign keys — this finally fixes the
-- name-based linkage flagged as a known simplification back in prompt 05.
create table inventory_items (
  id text primary key,
  name text not null,
  category_id text not null references categories(id),
  current_quantity integer not null default 0 check (current_quantity >= 0),
  unit_id text not null references units(id),
  min_threshold integer not null default 0 check (min_threshold >= 0),
  assigned_employee_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- One row per employee per day (the 10b model, not the older one-row-
-- per-item shape). The unique constraint enforces "one report per
-- employee per day" at the database level, on top of the existing
-- client-side check in submitReport — defense in depth, same principle
-- used everywhere else in this app.
create table reports (
  id text primary key,
  employee_id text not null references app_users(clerk_user_id),
  date date not null,
  content text not null default '',
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (employee_id, date)
);

create table report_item_changes (
  id text primary key,
  report_id text not null references reports(id) on delete cascade,
  item_id text not null references inventory_items(id),
  start_quantity integer not null,
  end_quantity integer not null
);

-- ---------- Row Level Security ----------

alter table app_users enable row level security;
alter table categories enable row level security;
alter table units enable row level security;
alter table inventory_items enable row level security;
alter table reports enable row level security;
alter table report_item_changes enable row level security;

-- Current Clerk user id, from the verified JWT's `sub` claim.
create or replace function current_clerk_user_id() returns text as $$
  select auth.jwt() ->> 'sub';
$$ language sql stable;

-- Current role, read from the Clerk JWT's publicMetadata claim.
-- ⚠️ VERIFY the exact claim path against Clerk's current Supabase
-- integration docs before trusting this in production — the path
-- depends on how the JWT template is configured on Clerk's side.
-- See the 13a prompt's notes on this.
create or replace function current_user_role() returns text as $$
  select auth.jwt() -> 'publicMetadata' ->> 'role';
$$ language sql stable;

-- app_users: everyone signed in can read (names shown throughout the
-- app); only admins can write.
create policy "app_users_select" on app_users for select
  using (auth.role() = 'authenticated');
create policy "app_users_admin_write" on app_users for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- categories: everyone reads; admin+manager insert; admin only deletes
-- or updates. Matches prompt 12's Settings screen exactly.
create policy "categories_select" on categories for select
  using (auth.role() = 'authenticated');
create policy "categories_insert" on categories for insert
  with check (current_user_role() in ('admin', 'manager'));
create policy "categories_admin_update" on categories for update
  using (current_user_role() = 'admin');
create policy "categories_admin_delete" on categories for delete
  using (current_user_role() = 'admin');

-- units: admin only, end to end.
create policy "units_select" on units for select
  using (auth.role() = 'authenticated');
create policy "units_admin_insert" on units for insert
  with check (current_user_role() = 'admin');
create policy "units_admin_update" on units for update
  using (current_user_role() = 'admin');
create policy "units_admin_delete" on units for delete
  using (current_user_role() = 'admin');

-- inventory_items: everyone reads. admin+manager can insert/update any
-- item. Employees can only update items they're assigned to — row-level
-- only, by agreement: the client is trusted to only send quantity
-- changes on this path (true column-level enforcement would need a
-- trigger or RPC function, deliberately not built here).
create policy "items_select" on inventory_items for select
  using (auth.role() = 'authenticated');
create policy "items_manager_insert" on inventory_items for insert
  with check (current_user_role() in ('admin', 'manager'));
create policy "items_manager_update" on inventory_items for update
  using (current_user_role() in ('admin', 'manager'));
create policy "items_employee_update_assigned" on inventory_items for update
  using (
    current_user_role() = 'employee'
    and current_clerk_user_id() = any(assigned_employee_ids)
  );
create policy "items_admin_delete" on inventory_items for delete
  using (current_user_role() = 'admin');

-- reports: employees read/write only their own, and only today's,
-- unlocked report. admin/manager read all. This enforces the same
-- lock/today rule submitReport already checks client-side — now also
-- enforced at the database level, not just trusted from the app.
create policy "reports_employee_select_own" on reports for select
  using (
    current_user_role() = 'employee'
    and employee_id = current_clerk_user_id()
  );
create policy "reports_manager_select_all" on reports for select
  using (current_user_role() in ('admin', 'manager'));
create policy "reports_employee_insert_own_today" on reports for insert
  with check (
    current_user_role() = 'employee'
    and employee_id = current_clerk_user_id()
    and date = current_date
  );
create policy "reports_employee_update_own_unlocked" on reports for update
  using (
    current_user_role() = 'employee'
    and employee_id = current_clerk_user_id()
    and is_locked = false
    and date = current_date
  );

-- report_item_changes follows its parent report's access exactly.
create policy "report_item_changes_select" on report_item_changes for select
  using (
    exists (
      select 1 from reports r
      where r.id = report_id
        and (
          (current_user_role() = 'employee' and r.employee_id = current_clerk_user_id())
          or current_user_role() in ('admin', 'manager')
        )
    )
  );
create policy "report_item_changes_insert" on report_item_changes for insert
  with check (
    exists (
      select 1 from reports r
      where r.id = report_id
        and r.employee_id = current_clerk_user_id()
        and r.is_locked = false
        and r.date = current_date
    )
  );
create policy "report_item_changes_update" on report_item_changes for update
  using (
    exists (
      select 1 from reports r
      where r.id = report_id
        and r.employee_id = current_clerk_user_id()
        and r.is_locked = false
        and r.date = current_date
    )
  );
