-- ============================================================
-- Majestic Flavours — patch (round 10)
-- To-do list foundation: categories, one-time tasks, assignment,
-- completion. Recurrence is NOT in this patch — v2-03-b will ALTER
-- `tasks` to add it once this foundation is confirmed working.
-- ============================================================

begin;

-- Task categories are a fresh set, deliberately separate from inventory's
-- `categories` table — these are Yahya's dad's own categories for tasks,
-- not a reuse of inventory categories.
create table task_categories (
  id text primary key,
  name text not null unique
);

create table tasks (
  id text primary key,
  category_id text not null references task_categories(id),
  title text not null,
  description text,
  -- Always a concrete value — the app resolves "no deadline chosen" to end
  -- of day (Riyadh) before writing, rather than allowing null and handling
  -- the default everywhere this gets read.
  due_at timestamptz not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- Many-to-many. Zero rows is a valid state (an admin can remove the last
-- assignee, per Yahya's spec) — only creation requires at least one, and
-- that's enforced in the app, not here, since the app needs to allow this
-- table to reach zero rows for an existing task.
create table task_assignments (
  task_id text not null references tasks(id) on delete cascade,
  employee_clerk_id text not null,
  assigned_at timestamptz not null default now(),
  primary key (task_id, employee_clerk_id)
);

-- One row per task — completion is task-level, not per-assignee (confirmed:
-- any assigned employee completing it closes it for everyone). `task_id` as
-- the primary key enforces exactly one terminal state per task.
--
-- Forward-looking note for v2-03-b: recurring tasks need completion tracked
-- per OCCURRENCE, not per task — this table's shape won't directly extend
-- to that. v2-03-b will likely need a separate `task_occurrence_completions`
-- table rather than retrofitting this one.
create table task_completions (
  task_id text primary key references tasks(id) on delete cascade,
  status text not null check (status in ('completed', 'missed')),
  note text,
  actor_clerk_id text not null,
  recorded_at timestamptz not null default now(),
  -- Enforced at the database level, not just the UI: a missed task must
  -- carry a real reason. Matches Yahya's "mandatory note... submit reason"
  -- requirement as an actual constraint, not just a form validation.
  constraint missed_requires_note check (
    status = 'completed' or (status = 'missed' and note is not null and length(trim(note)) > 0)
  )
);

alter table task_categories enable row level security;
alter table tasks enable row level security;
alter table task_assignments enable row level security;
alter table task_completions enable row level security;

-- Categories: admin/manager manage, everyone signed in can read (needed for
-- the category filter to work for employees too).
create policy "task_categories_select_all" on task_categories for select
  using (true);
create policy "task_categories_write_staff" on task_categories for all
  using (current_user_role() in ('admin', 'manager'));

-- Tasks: admin/manager see and manage everything. Employees see only tasks
-- they're currently assigned to.
create policy "tasks_select_staff" on tasks for select
  using (
    current_user_role() in ('admin', 'manager')
    or exists (
      select 1 from task_assignments a
      where a.task_id = id and a.employee_clerk_id = current_clerk_user_id()
    )
  );
create policy "tasks_write_staff" on tasks for all
  using (current_user_role() in ('admin', 'manager'));

-- Assignments: admin/manager manage and see everything. Employees see only
-- their own assignment rows.
create policy "task_assignments_select" on task_assignments for select
  using (
    current_user_role() in ('admin', 'manager')
    or employee_clerk_id = current_clerk_user_id()
  );
create policy "task_assignments_write_staff" on task_assignments for all
  using (current_user_role() in ('admin', 'manager'));

-- Completions: admin/manager see everything. An assigned employee can
-- insert a completion/miss-reason for a task they're actually assigned to
-- — verified via the same assignment check as the tasks select policy.
create policy "task_completions_select" on task_completions for select
  using (
    current_user_role() in ('admin', 'manager')
    or exists (
      select 1 from task_assignments a
      where a.task_id = task_id and a.employee_clerk_id = current_clerk_user_id()
    )
  );
create policy "task_completions_insert" on task_completions for insert
  with check (
    current_user_role() in ('admin', 'manager')
    or exists (
      select 1 from task_assignments a
      where a.task_id = task_id and a.employee_clerk_id = current_clerk_user_id()
    )
  );

commit;

-- ------------------------------------------------------------
-- Worth a quick sanity check after running this: confirm
-- current_user_role() and current_clerk_user_id() are the exact real
-- function names already in use elsewhere in this schema (they should be,
-- based on every prior round, but this patch is large enough to be worth
-- double-checking rather than assuming).
-- ------------------------------------------------------------
