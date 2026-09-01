-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round9
-- Fixes the "infinite recursion detected in policy for relation
-- task_completions" (42P17) error blocking every task completion.
--
-- Root cause: task_completions_insert_own's WITH CHECK includes a
-- subquery against task_completions itself (checking "is this task
-- already marked completed by anyone"). A self-referential subquery
-- inside a policy on the same table is a documented source of this
-- exact Postgres error — evaluating the INSERT check pulls the SELECT
-- policy back into evaluation on the same table, and 42P17 is Postgres's
-- own guard against that cycle rather than hanging indefinitely.
--
-- Fix: move the self-check into a SECURITY DEFINER function, which runs
-- with elevated privilege and bypasses RLS for its own internal query —
-- breaking the cycle. The function is narrowly scoped to exactly one
-- boolean check and exposes no row data, so this doesn't loosen what
-- the policy actually allows; it only changes how the "already
-- completed" fact is established.
-- ============================================================

create or replace function public.task_completions_task_already_completed(target_task_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from task_completions
    where task_id = target_task_id and status = 'completed'
  );
$$;

drop policy if exists "task_completions_insert_own" on task_completions;

create policy "task_completions_insert_own" on task_completions for insert
  with check (
    employee_clerk_id = current_clerk_user_id()
    and exists (
      select 1 from task_assignments a
      where a.task_id = task_completions.task_id
        and a.employee_clerk_id = current_clerk_user_id()
    )
    and not task_completions_task_already_completed(task_id)
  );
