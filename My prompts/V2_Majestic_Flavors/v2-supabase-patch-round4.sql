-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round4
-- Two fixes, both from CodeRabbit review of round 2/3:
--
-- 1. tasks_write_staff (round 1, FOR ALL) was never removed when
--    tasks_delete_permission (round 2) was added. Postgres OR-combines
--    permissive policies on the same operation — the older, broader policy
--    let any manager delete any task regardless of the newer, more
--    restrictive one. This is a real bug in round 2's own design, not a
--    hypothetical: it completely undermined the delete-permission feature.
--
-- 2. A second person could still submit a completion/miss response after
--    someone else already completed the task, creating a confusing mixed
--    record. Blocking that specific case — NOT adding due-time enforcement,
--    which isn't reachable through the app's own UI and isn't worth the
--    added complexity for a currently-unreachable path.
-- ============================================================

begin;

-- Fix 1: replace the single FOR ALL policy with precise, separate ones.
drop policy "tasks_write_staff" on tasks;

create policy "tasks_insert_staff" on tasks for insert
  with check (current_user_role() in ('admin', 'manager'));

create policy "tasks_update_staff" on tasks for update
  using (current_user_role() in ('admin', 'manager'))
  with check (current_user_role() in ('admin', 'manager'));

-- created_by must be immutable once set — otherwise a manager could
-- reassign a task's ownership to themselves via an update, then delete it
-- under the "own tasks" rule, circumventing tasks_delete_permission
-- entirely. RLS's `with check` can't compare old vs. new values of the
-- same column directly, so this needs a trigger, not a policy.
create or replace function prevent_task_created_by_change()
returns trigger
language plpgsql
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

create trigger tasks_created_by_immutable
  before update on tasks
  for each row
  execute function prevent_task_created_by_change();

-- tasks_select_staff and tasks_delete_permission are unaffected by this
-- fix — the OR-override problem was specific to tasks_write_staff also
-- covering DELETE with no ownership check; SELECT was never actually in
-- conflict (tasks_select_staff already granted admin/manager everything).

-- Fix 2: block a response once the task is already fully completed by
-- anyone, regardless of who's submitting.
drop policy "task_completions_insert_own" on task_completions;

create policy "task_completions_insert_own" on task_completions for insert
  with check (
    employee_clerk_id = current_clerk_user_id()
    and exists (
      select 1 from task_assignments a
      where a.task_id = task_completions.task_id
        and a.employee_clerk_id = current_clerk_user_id()
    )
    and not exists (
      select 1 from task_completions existing
      where existing.task_id = task_completions.task_id
        and existing.status = 'completed'
    )
  );

commit;
