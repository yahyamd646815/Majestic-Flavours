-- ============================================================
-- Majestic Flavours — CodeRabbit fixes, batch 2
-- Both findings are about round9.sql's task_completions_task_already_completed
-- helper. round9 itself is already applied and live, so this is additive
-- (replaces the function and policy in place) rather than a retroactive
-- edit to a prior round file, matching how every other round in this
-- project has been layered.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The helper had no privilege restriction — SECURITY DEFINER
-- functions grant EXECUTE to PUBLIC by default, and the policy that
-- calls it needs `authenticated` to have EXECUTE regardless, so a bare
-- REVOKE would break the policy itself. Moving the function to a schema
-- PostgREST's API never routes to closes the direct-call path entirely:
-- Postgres itself can still call it from within the policy (evaluated
-- directly, not through the REST API), but no client can invoke it as
-- an RPC endpoint anymore.
-- ------------------------------------------------------------

create schema if not exists internal;

drop function if exists public.task_completions_task_already_completed(text);

-- 2. Schema-qualifying the table reference AND explicitly including
-- pg_temp in search_path (placed after public, not omitted) together
-- close the temp-table shadowing vulnerability: pg_temp is otherwise
-- always searched first regardless of what's listed, so a caller's own
-- same-named temp table would silently be queried instead of the real
-- one, making the "already completed" check always pass.
create or replace function internal.task_completions_task_already_completed(target_task_id text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.task_completions
    where task_id = target_task_id and status = 'completed'
  );
$$;

revoke all on function internal.task_completions_task_already_completed(text) from public;
grant usage on schema internal to authenticated;
grant execute on function internal.task_completions_task_already_completed(text) to authenticated;

drop policy if exists "task_completions_insert_own" on task_completions;

create policy "task_completions_insert_own" on task_completions for insert
  with check (
    employee_clerk_id = current_clerk_user_id()
    and exists (
      select 1 from task_assignments a
      where a.task_id = task_completions.task_id
        and a.employee_clerk_id = current_clerk_user_id()
    )
    and not internal.task_completions_task_already_completed(task_id)
  );
