-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round6
-- Small, single fix: hour_interval was missing a check constraint that
-- day_interval already has. My own gap in round5, not Claude Code's —
-- caught while reviewing v2-03-b's implementation.
-- ============================================================

alter table task_recurrence_rules
  add constraint hour_interval_positive check (hour_interval is null or hour_interval > 0);
