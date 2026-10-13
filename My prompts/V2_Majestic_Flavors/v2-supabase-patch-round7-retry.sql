-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round7 (retry)
-- Fixes the real bug from last attempt: matching constraints by which
-- COLUMN they apply to (via conkey), not by text-matching their
-- definition — the text match incorrectly caught two different
-- constraints last time. Every step here uses IF EXISTS / IF NOT EXISTS
-- so this is safe to run regardless of exactly what partially applied
-- before — nothing here depends on the database being in any specific
-- starting state.
-- ============================================================

-- Drops the day_pattern value-list check specifically — identified as
-- the constraint touching exactly one column (day_pattern itself), which
-- correctly excludes recurrence_days_of_week_only_weekly (which touches
-- two columns: day_pattern AND days_of_week).
do $$
declare
  target_constraint text;
begin
  select cc.conname into target_constraint
  from pg_constraint cc
  join pg_attribute a on a.attrelid = cc.conrelid and a.attnum = any(cc.conkey)
  where cc.conrelid = 'task_recurrence_rules'::regclass
    and cc.contype = 'c'
    and a.attname = 'day_pattern'
    and array_length(cc.conkey, 1) = 1;

  if target_constraint is not null then
    execute format('alter table task_recurrence_rules drop constraint %I', target_constraint);
  end if;
end $$;

-- Safety net in case the block above still doesn't catch it for some
-- reason not yet accounted for — harmless no-op if already gone.
alter table task_recurrence_rules
  drop constraint if exists task_recurrence_rules_day_pattern_check;

alter table task_recurrence_rules
  add constraint task_recurrence_rules_day_pattern_check
  check (day_pattern in ('daily', 'weekly', 'monthly', 'custom'));

-- May already be gone from the previous attempt's misdirected drop —
-- IF EXISTS makes this safe either way.
alter table task_recurrence_rules
  drop constraint if exists recurrence_days_of_week_only_weekly;

alter table task_recurrence_rules
  add constraint recurrence_days_of_week_only_weekly check (
    (day_pattern = 'weekly' and days_of_week is not null and array_length(days_of_week, 1) > 0)
    or (day_pattern != 'weekly' and days_of_week is null)
  );


-- ------------------------------------------------------------
-- Neither of these ran last time (the script halted before reaching
-- them) — included fresh, made idempotent regardless.
-- ------------------------------------------------------------

create table if not exists task_recurrence_custom_dates (
  recurrence_rule_id text not null references task_recurrence_rules(id) on delete cascade,
  occurrence_date date not null,
  primary key (recurrence_rule_id, occurrence_date)
);

alter table task_recurrence_custom_dates enable row level security;

drop policy if exists "task_recurrence_custom_dates_select_all" on task_recurrence_custom_dates;
create policy "task_recurrence_custom_dates_select_all" on task_recurrence_custom_dates for select
  using (true);

drop policy if exists "task_recurrence_custom_dates_write_staff" on task_recurrence_custom_dates;
create policy "task_recurrence_custom_dates_write_staff" on task_recurrence_custom_dates for all
  using (current_user_role() in ('admin', 'manager'));

alter table inventory_items add column if not exists status_updated_at timestamptz not null default now();
