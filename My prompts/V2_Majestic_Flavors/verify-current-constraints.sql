-- Read-only, completely safe to run — just shows what actually exists
-- right now, so we're fixing the real state rather than my assumption of it.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'task_recurrence_rules'::regclass
  and contype = 'c';
