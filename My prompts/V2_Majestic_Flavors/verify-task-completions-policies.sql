-- Read-only, safe to run. Shows every policy's full definition on
-- task_completions — needed to actually trace the "infinite recursion
-- detected in policy" (42P17) error rather than guess at it.
select policyname, cmd, qual, with_check
from pg_policies
where tablename = 'task_completions';

-- Also worth seeing: current_user_role() is used throughout this project's
-- RLS and is a plausible participant in the recursion if its own definition
-- queries a table that, in turn, depends on task_completions somehow.
select pg_get_functiondef(oid) as definition
from pg_proc
where proname = 'current_user_role';
