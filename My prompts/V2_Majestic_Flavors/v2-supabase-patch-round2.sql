-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round2
-- Restructures task_completions from one-row-per-task to
-- one-row-per-(task, assignee) — required for per-assignee miss-reasons.
-- Adds task deletion permissions (admin: any task; manager: own only).
-- ============================================================

begin;

-- The old table enforced exactly one terminal state per TASK. The new rule
-- (everyone assigned must submit their own reason when missed; any one
-- completion still closes it for everyone) needs one row per PERSON who has
-- responded, not one per task. No data migration — this is pre-launch.
drop table if exists task_completions;

create table task_completions (
  task_id text not null references tasks(id) on delete cascade,
  employee_clerk_id text not null,
  status text not null check (status in ('completed', 'missed')),
  note text,
  recorded_at timestamptz not null default now(),
  primary key (task_id, employee_clerk_id),
  constraint missed_requires_note check (
    status = 'completed' or (status = 'missed' and note is not null and length(trim(note)) > 0)
  )
);

alter table task_completions enable row level security;

create policy "task_completions_select" on task_completions for select
  using (
    current_user_role() in ('admin', 'manager')
    or employee_clerk_id = current_clerk_user_id()
  );

-- Tightened from round 1: previously any admin/manager could complete any
-- task. Now — matching the new rule directly — you can only insert a row
-- for YOURSELF, and only if you're genuinely assigned. This is what makes
-- "delete the task" the correct fix for the rare admin-completed-something-
-- not-assigned-to-them scenario, rather than needing a special override.
create policy "task_completions_insert_own" on task_completions for insert
  with check (
    employee_clerk_id = current_clerk_user_id()
    and exists (
      select 1 from task_assignments a
      where a.task_id = task_completions.task_id
        and a.employee_clerk_id = current_clerk_user_id()
    )
  );

-- New: task deletion. Admin deletes anything. Manager deletes only tasks
-- they created themselves — matches Manager's existing no-deletion baseline
-- everywhere else in this app, with a narrow carve-out for their own tasks.
create policy "tasks_delete_permission" on tasks for delete
  using (
    current_user_role() = 'admin'
    or (current_user_role() = 'manager' and created_by = current_clerk_user_id())
  );

commit;

-- ------------------------------------------------------------
-- No change needed to `tasks.description` — it already exists from round 1
-- but was never wired up anywhere in the app. This patch doesn't touch it;
-- v2-03-a2 wires up the existing column.
-- ------------------------------------------------------------
