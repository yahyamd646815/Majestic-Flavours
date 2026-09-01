-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round8
-- Required for v2-03-d's 4-month task cleanup to actually work.
--
-- task_completions has never had a DELETE policy across any prior round.
-- Postgres RLS defaults to deny for any operation with no matching
-- policy — a cascade delete from `tasks` (which is what the cleanup does)
-- would silently fail to remove task_completions rows without this. This
-- is the exact same class of gap the original reports cleanup hit in
-- round 7 of the v1-era rounds: a cascade delete needs RLS permission on
-- every child table it touches, not just the parent.
--
-- Admin-only, matching useReportCleanup's own admin-only scope for the
-- analogous reports cleanup — task_completions holds someone's personal
-- response record, which is more sensitive than a plain assignment row
-- (task_assignments_write_staff already covers admin+manager for its
-- own table).
-- ============================================================

create policy "task_completions_delete_staff" on task_completions for delete
  using (current_user_role() = 'admin');
