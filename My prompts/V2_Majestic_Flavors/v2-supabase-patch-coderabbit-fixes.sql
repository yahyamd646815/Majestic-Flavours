-- ============================================================
-- Majestic Flavours — CodeRabbit fixes (SQL-only, self-contained)
-- Three independent findings, bundled since all three are small,
-- direct policy/index corrections needing no application code changes.
-- Not numbered as a "round" file given round numbering has diverged
-- between my own tracking and the actual repo — reconcile separately.
-- ============================================================

-- ------------------------------------------------------------
-- 1. task_recurrence_rules_update_staff had no ownership check and no
-- WITH CHECK at all — any manager could update any rule, including
-- rewriting created_by, bypassing the matching delete policy's
-- deliberate "own rules only" restriction for managers.
-- ------------------------------------------------------------

drop policy if exists "task_recurrence_rules_update_staff" on task_recurrence_rules;

create policy "task_recurrence_rules_update_staff" on task_recurrence_rules for update
  using (
    current_user_role() = 'admin'
    or (current_user_role() = 'manager' and created_by = current_clerk_user_id())
  )
  with check (
    current_user_role() = 'admin'
    or (current_user_role() = 'manager' and created_by = current_clerk_user_id())
  );

-- ------------------------------------------------------------
-- 2. tasks_insert_occurrence_generation checked that the referenced
-- recurrence rule exists, but never verified the inserted row's
-- created_by actually matches that rule's own owner — an invariant the
-- generation code happens to uphold, but one RLS itself didn't enforce.
-- ------------------------------------------------------------

drop policy if exists "tasks_insert_occurrence_generation" on tasks;

create policy "tasks_insert_occurrence_generation" on tasks for insert
  with check (
    generated_from_recurrence_rule_id is not null
    and exists (
      select 1 from task_recurrence_rules r
      where r.id = generated_from_recurrence_rule_id
        and r.created_by = tasks.created_by
    )
  );

-- ------------------------------------------------------------
-- 3. task_completions_insert_own's "not already completed" check is
-- check-then-insert, which is inherently racy under real concurrency —
-- two employees completing the same task at nearly the same instant
-- could both pass the check before either commits, producing two
-- 'completed' rows for one task. A partial unique index closes this
-- atomically at the database level, which an application-side or
-- WITH CHECK-level check never fully can.
-- ------------------------------------------------------------

create unique index if not exists task_completions_one_completed_per_task
  on task_completions (task_id)
  where status = 'completed';
