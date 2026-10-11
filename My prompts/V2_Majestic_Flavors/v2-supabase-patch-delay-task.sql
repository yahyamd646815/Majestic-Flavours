-- ============================================================
-- Majestic Flavours — Delay feature (v2-05 Part A)
--
-- Named descriptively, not by round number: this chat's round count
-- drifted from the repo's around rounds 10-12 — rename to the repo's
-- next number if you prefer.
--
-- Safe to run top to bottom, and safe to re-run.
--
-- WHY AN RPC: employees have no UPDATE permission on `tasks` (only
-- Admin/Manager do), and they shouldn't — an employee must not be able to
-- write an arbitrary due time. So delaying goes through one function that
-- checks everything and computes the new due time ON THE SERVER. The
-- client never supplies the new time.
--
-- This function is deliberately in `public`: unlike the `internal`
-- helpers, it IS meant to be called by the app through PostgREST. Its
-- safety comes from the authorization checks inside it, from
-- `security definer` + an empty search_path + schema-qualified names, and
-- from revoking EXECUTE from `anon`.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Record the delay on the task itself.
-- All three fields are set together or not at all.
-- ------------------------------------------------------------

alter table public.tasks
  add column if not exists original_due_at timestamptz,
  add column if not exists delayed_at timestamptz,
  add column if not exists delayed_by text;

alter table public.tasks drop constraint if exists tasks_delay_fields_together;

alter table public.tasks
  add constraint tasks_delay_fields_together check (
    (delayed_at is null and delayed_by is null and original_due_at is null)
    or (delayed_at is not null and delayed_by is not null and original_due_at is not null)
  );

-- ------------------------------------------------------------
-- 2. The rule, in one place.
-- Riyadh is fixed UTC+3 (no DST), matching the rest of the project.
--   due BEFORE 20:00 Riyadh  -> 23:59 the same Riyadh day
--   due at/after 20:00       -> 10:00 the next Riyadh day
-- Kept in the non-exposed `internal` schema so it isn't an API endpoint.
-- ------------------------------------------------------------

create schema if not exists internal;

create or replace function internal.delayed_due_at(current_due timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (
    case
      when riyadh.local_ts::time < time '20:00'
        then date_trunc('day', riyadh.local_ts) + interval '23 hours 59 minutes'
      else date_trunc('day', riyadh.local_ts) + interval '1 day 10 hours'
    end - interval '3 hours'
  ) at time zone 'UTC'
  from (
    select (current_due at time zone 'UTC') + interval '3 hours' as local_ts
  ) as riyadh;
$$;

revoke all on function internal.delayed_due_at(timestamptz) from public;

-- ------------------------------------------------------------
-- 3. The RPC. Returns the updated task row.
-- Error messages start with "delay_task:" so the app can map them to
-- friendly text; anything unrecognised gets a generic message.
-- ------------------------------------------------------------

create or replace function public.delay_task(target_task_id text)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller text := public.current_clerk_user_id();
  task_row public.tasks;
begin
  if caller is null then
    raise exception 'delay_task: not signed in' using errcode = '28000';
  end if;

  -- Lock the row: two simultaneous delays can't both pass the
  -- "not already delayed" check below.
  select * into task_row from public.tasks where id = target_task_id for update;

  if not found then
    raise exception 'delay_task: task not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.task_assignments a
    where a.task_id = target_task_id and a.employee_clerk_id = caller
  ) then
    raise exception 'delay_task: not assigned' using errcode = '42501';
  end if;

  if task_row.delayed_at is not null then
    raise exception 'delay_task: already delayed';
  end if;

  if exists (
    select 1 from public.task_completions c
    where c.task_id = target_task_id and c.status = 'completed'
  ) then
    raise exception 'delay_task: already completed';
  end if;

  if task_row.due_at <= now() then
    raise exception 'delay_task: already overdue';
  end if;

  update public.tasks
     set original_due_at = task_row.due_at,
         due_at = internal.delayed_due_at(task_row.due_at),
         delayed_at = now(),
         delayed_by = caller
   where id = target_task_id
   returning * into task_row;

  return task_row;
end;
$$;

revoke all on function public.delay_task(text) from public;
revoke all on function public.delay_task(text) from anon;
grant execute on function public.delay_task(text) to authenticated;

-- ============================================================
-- AFTER RUNNING — check the rule with these five cases. Run each as its
-- own query (the SQL editor only shows the last result of a batch).
-- Riyadh is UTC+3, so e.g. 14:00 Riyadh = 11:00 UTC.
--
-- select internal.delayed_due_at('2026-09-20 11:00+00');  -- 14:00 Riyadh -> expect 2026-09-20 20:59+00 (23:59 same day)
-- select internal.delayed_due_at('2026-09-20 16:59+00');  -- 19:59 Riyadh -> expect 2026-09-20 20:59+00
-- select internal.delayed_due_at('2026-09-20 17:00+00');  -- 20:00 Riyadh -> expect 2026-09-21 07:00+00 (10:00 next day)
-- select internal.delayed_due_at('2026-09-20 20:59+00');  -- 23:59 Riyadh -> expect 2026-09-21 07:00+00
-- select internal.delayed_due_at('2026-09-20 21:30+00');  -- 00:30 Riyadh on the 21st -> expect 2026-09-21 20:59+00
--
-- And confirm the columns and function exist:
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'tasks'
--   and column_name in ('original_due_at', 'delayed_at', 'delayed_by');   -- expect 3 rows
-- select proname from pg_proc where proname in ('delay_task', 'delayed_due_at');  -- expect 2 rows
-- ============================================================
