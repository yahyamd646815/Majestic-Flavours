-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round3
-- Fixes a real bug found while writing Part D's tests: round 2's
-- task_completions_select policy restricted an employee to seeing only
-- their OWN completion row. That silently breaks the core "any one
-- completion closes it for everyone" rule for employees specifically —
-- if colleague B completes a shared task, colleague A's own query never
-- returns B's row, so isTaskFullyCompleted stays false for A and they're
-- asked to do work that's already done. Admin/Manager were unaffected
-- (they already read everything).
-- ============================================================

begin;

drop policy "task_completions_select" on task_completions;

create policy "task_completions_select" on task_completions for select
  using (
    current_user_role() in ('admin', 'manager')
    or employee_clerk_id = current_clerk_user_id()
    or exists (
      select 1 from task_assignments a
      where a.task_id = task_completions.task_id
        and a.employee_clerk_id = current_clerk_user_id()
    )
  );

commit;

-- ------------------------------------------------------------
-- The middle clause (employee_clerk_id = current_clerk_user_id()) is kept
-- deliberately, not redundant with the new exists clause — it keeps
-- someone's own response visible to them even after they've since been
-- unassigned from the task.
--
-- The client code in Part D was already written to the correct rule and
-- needs no change — it starts working correctly the moment this policy
-- widens.
-- ------------------------------------------------------------
