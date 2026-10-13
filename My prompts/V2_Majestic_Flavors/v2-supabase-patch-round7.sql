-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round7 (corrected)
-- Same as the version that failed, except this no longer requires
-- manually substituting a constraint name — it finds and drops it
-- dynamically in one block. Safe to run this whole file top to bottom;
-- nothing from the failed attempt partially applied (the error halted
-- execution before anything after Step 1's harmless SELECT ran).
-- ============================================================

-- ------------------------------------------------------------
-- Adds 'custom' as a fourth day_pattern value: a rule can have NO
-- structured pattern at all, generating purely from explicit custom
-- dates. For 'daily'/'weekly'/'monthly' rules, custom dates remain
-- optional and purely additive on top of the structured pattern — never
-- exclusive, matching "you can select recurring tasks along with
-- specific dates on the calendar."
-- ------------------------------------------------------------

do $$
declare
  existing_constraint text;
begin
  select conname into existing_constraint
  from pg_constraint
  where conrelid = 'task_recurrence_rules'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%day_pattern%';

  execute format('alter table task_recurrence_rules drop constraint %I', existing_constraint);
end $$;

alter table task_recurrence_rules
  add constraint task_recurrence_rules_day_pattern_check
  check (day_pattern in ('daily', 'weekly', 'monthly', 'custom'));

-- 'custom' has no structured fields at all — day_interval still needs a
-- value (not null), so it's set but meaningless for this pattern; the
-- generation code must treat 'custom' as "skip the structured half
-- entirely," not attempt to read day_interval for it.
alter table task_recurrence_rules
  drop constraint recurrence_days_of_week_only_weekly;

alter table task_recurrence_rules
  add constraint recurrence_days_of_week_only_weekly check (
    (day_pattern = 'weekly' and days_of_week is not null and array_length(days_of_week, 1) > 0)
    or (day_pattern != 'weekly' and days_of_week is null)
  );

-- Explicit, additional dates — reuses the rule's own time_pattern (the
-- same times_of_day / hour_interval apply to a custom date as to any
-- structurally-generated day). Kept simple deliberately: no per-date
-- time override, matching Yahya's own "so you don't need to fill in
-- three of the options" framing — custom dates replace the day-selection
-- half, not the time half.
create table task_recurrence_custom_dates (
  recurrence_rule_id text not null references task_recurrence_rules(id) on delete cascade,
  -- Riyadh calendar date, YYYY-MM-DD.
  occurrence_date date not null,
  primary key (recurrence_rule_id, occurrence_date)
);

alter table task_recurrence_custom_dates enable row level security;

create policy "task_recurrence_custom_dates_select_all" on task_recurrence_custom_dates for select
  using (true);
create policy "task_recurrence_custom_dates_write_staff" on task_recurrence_custom_dates for all
  using (current_user_role() in ('admin', 'manager'));


-- ------------------------------------------------------------
-- Unrelated: dashboard timer support. Single source of truth for "when
-- did this item's status-relevant information last change" — set
-- whenever either statusOverride or currentQuantity is written, since
-- updateItem is already the one centralized place both of those go
-- through.
-- ------------------------------------------------------------

alter table inventory_items add column status_updated_at timestamptz not null default now();s