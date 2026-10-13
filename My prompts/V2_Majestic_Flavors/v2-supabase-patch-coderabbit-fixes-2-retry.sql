-- ============================================================
-- Majestic Flavours — CodeRabbit fixes, batch 2 (corrected)
-- Same fix as before, reordered: the old policy depends on the old
-- function, so it has to be dropped first — dropping the function while
-- the policy still references it is what failed last time.
-- ============================================================

create schema if not exists internal;

-- Drop the dependent policy first — this is what was missing.
drop policy if exists "task_completions_insert_own" on task_completions;

drop function if exists public.task_completions_task_already_completed(text);

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
