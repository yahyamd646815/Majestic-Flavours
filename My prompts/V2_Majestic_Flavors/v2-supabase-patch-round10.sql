-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round10
-- Employee-configurable task reminders. One reminder per (task, employee)
-- — setting a new one replaces the old, matching "N hours before OR N
-- days before" (a single choice, not stacked reminders).
--
-- Purely personal: unlike task_completions, nobody but the employee who
-- set a reminder ever needs to see it — it isn't operationally relevant
-- to Admin/Manager, so there's no broader-visibility policy here.
--
-- No self-referential subquery on this table anywhere below — every
-- assignment check queries task_assignments, not task_reminders itself,
-- avoiding round9's exact class of bug from the start.
-- ============================================================

create table task_reminders (
  task_id text not null references tasks(id) on delete cascade,
  employee_clerk_id text not null,
  offset_value integer not null check (offset_value > 0),
  offset_unit text not null check (offset_unit in ('hours', 'days')),
  created_at timestamptz not null default now(),
  primary key (task_id, employee_clerk_id)
);

alter table task_reminders enable row level security;

create policy "task_reminders_select_own" on task_reminders for select
  using (employee_clerk_id = current_clerk_user_id());

create policy "task_reminders_insert_own" on task_reminders for insert
  with check (
    employee_clerk_id = current_clerk_user_id()
    and exists (
      select 1 from task_assignments a
      where a.task_id = task_reminders.task_id
        and a.employee_clerk_id = current_clerk_user_id()
    )
  );

create policy "task_reminders_update_own" on task_reminders for update
  using (employee_clerk_id = current_clerk_user_id())
  with check (
    employee_clerk_id = current_clerk_user_id()
    and exists (
      select 1 from task_assignments a
      where a.task_id = task_reminders.task_id
        and a.employee_clerk_id = current_clerk_user_id()
    )
  );

create policy "task_reminders_delete_own" on task_reminders for delete
  using (employee_clerk_id = current_clerk_user_id());
