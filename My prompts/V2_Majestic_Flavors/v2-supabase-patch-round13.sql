-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round12
-- Reshapes task_reminders from "one row per (task, employee)" to "up to
-- three rows per (task, employee)" — each reminder now needs its own
-- identity rather than sharing a composite key.
--
-- Clean drop-and-recreate rather than an in-place migration: reminders
-- are regenerable local-scheduling preferences, not historical records,
-- so there's nothing worth preserving across the shape change.
--
-- The "up to 3" limit itself is enforced client-side only, not here —
-- see v2-03-e3's own notes on why that's the deliberate choice for this
-- specific rule.
-- ============================================================

drop table if exists task_reminders;

create table task_reminders (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  employee_clerk_id text not null,
  offset_value integer not null check (offset_value > 0),
  offset_unit text not null check (offset_unit in ('hours', 'days')),
  created_at timestamptz not null default now()
);

create index task_reminders_task_employee_idx on task_reminders(task_id, employee_clerk_id);

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
