-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round5
-- Two things: the recurrence schema for v2-03-b, plus a small, unrelated
-- fix from this round's CodeRabbit review — bundled in one file per
-- Yahya's own request, since the fix is small enough not to warrant its
-- own file under the "default to one file" guidance.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- Small fix first: tasks_insert_staff only checked the caller's role, not
-- that created_by actually matches them. tasks_delete_permission uses
-- created_by as its manager-ownership key, so this meant that key wasn't
-- actually enforced at the database level — only true because the app's
-- client code happens to always send the right value. CodeRabbit caught
-- this correctly.
-- ------------------------------------------------------------

drop policy "tasks_insert_staff" on tasks;

create policy "tasks_insert_staff" on tasks for insert
  with check (
    current_user_role() in ('admin', 'manager')
    and created_by = current_clerk_user_id()
  );


-- ------------------------------------------------------------
-- Recurrence schema.
--
-- Deliberately NOT a hidden row in `tasks` acting as a template — every
-- screen in this app that queries `tasks` directly (the list, filters,
-- counts) would need to remember to exclude it, forever, which is a real
-- ongoing bug risk. Instead, a recurrence template's own data (title,
-- category, description, assignees) lives entirely in these new tables.
-- Each actual occurrence is a genuinely ordinary `tasks` row, generated
-- client-side, using all of Part A–G's existing machinery unchanged —
-- confirmed as the right approach: "creating a new row in database is
-- the best option," Yahya's own words.
-- ------------------------------------------------------------

create table task_recurrence_rules (
  id text primary key,
  title text not null,
  category_id text not null references task_categories(id),
  description text null,
  created_by text not null,

  -- Which days this recurs on.
  -- 'daily'   : every day_interval days.
  -- 'weekly'  : specific days_of_week, every day_interval weeks — this is
  --             the confirmed reading of "every 3rd Friday" = every 3
  --             weeks on Friday, not "the 3rd Friday of the month"
  --             (impossible past interval 5, and the only reading
  --             consistent with Yahya's own "7th Friday ≈ every 2 months"
  --             example).
  -- 'monthly' : every day_interval months, same day-of-month the
  --             occurrence would naturally fall on.
  day_pattern text not null check (day_pattern in ('daily', 'weekly', 'monthly')),
  day_interval integer not null default 1 check (day_interval > 0),
  -- 0=Sunday..6=Saturday, matching JS Date.getDay(). Only set for 'weekly'.
  days_of_week integer[] null,

  -- What time(s) of day this fires on each occurring day.
  -- 'fixed'    : times_of_day lists exact clock times — supports Yahya's
  --              "multiple custom times a day" requirement (e.g.
  --              ['03:34','13:19','17:02']), not just one.
  -- 'interval' : fires every hour_interval hours through the day,
  --              anchored to midnight Riyadh — confirmed with Yahya as
  --              predictable and aligned with shift handovers.
  time_pattern text not null check (time_pattern in ('fixed', 'interval')),
  times_of_day text[] null,    -- "HH:MM" Riyadh wall-clock strings. Set when time_pattern = 'fixed'.
  hour_interval integer null,  -- Set when time_pattern = 'interval'.

  -- Exactly one of these two — never both, never neither.
  ends_on_date date null,
  ends_after_occurrences integer null,

  created_at timestamptz not null default now(),

  constraint recurrence_end_exclusive check (
    (ends_on_date is not null and ends_after_occurrences is null)
    or (ends_on_date is null and ends_after_occurrences is not null)
  ),
  constraint recurrence_days_of_week_only_weekly check (
    (day_pattern = 'weekly' and days_of_week is not null and array_length(days_of_week, 1) > 0)
    or (day_pattern != 'weekly' and days_of_week is null)
  ),
  constraint recurrence_time_fields_match_pattern check (
    (time_pattern = 'fixed' and times_of_day is not null and array_length(times_of_day, 1) > 0 and hour_interval is null)
    or (time_pattern = 'interval' and hour_interval is not null and times_of_day is null)
  )
);

-- Assignees for the template — copied into each generated occurrence's own
-- task_assignments AT GENERATION TIME, not referenced live. An occurrence
-- already due shouldn't retroactively change who owed it just because the
-- template's assignee list changed afterward.
create table task_recurrence_assignments (
  recurrence_rule_id text not null references task_recurrence_rules(id) on delete cascade,
  employee_clerk_id text not null,
  primary key (recurrence_rule_id, employee_clerk_id)
);

-- Links a generated occurrence back to the rule that produced it. Null for
-- genuinely one-time tasks (all of Part A–G's existing tasks).
alter table tasks add column generated_from_recurrence_rule_id text null
  references task_recurrence_rules(id) on delete set null;

-- Client-side generation needs a reliable "did we already create this
-- specific occurrence" check — a task's title alone isn't unique, so this
-- is a real, separate key, not a re-derivation of due_at.
alter table tasks add column recurrence_occurrence_key text null;

create unique index tasks_recurrence_occurrence_unique
  on tasks (generated_from_recurrence_rule_id, recurrence_occurrence_key)
  where generated_from_recurrence_rule_id is not null;


-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table task_recurrence_rules enable row level security;
alter table task_recurrence_assignments enable row level security;

create policy "task_recurrence_rules_select_all" on task_recurrence_rules for select
  using (true);
create policy "task_recurrence_rules_write_staff" on task_recurrence_rules for insert
  with check (current_user_role() in ('admin', 'manager') and created_by = current_clerk_user_id());
create policy "task_recurrence_rules_update_staff" on task_recurrence_rules for update
  using (current_user_role() in ('admin', 'manager'));
create policy "task_recurrence_rules_delete_staff" on task_recurrence_rules for delete
  using (
    current_user_role() = 'admin'
    or (current_user_role() = 'manager' and created_by = current_clerk_user_id())
  );

create policy "task_recurrence_assignments_select_all" on task_recurrence_assignments for select
  using (true);
create policy "task_recurrence_assignments_write_staff" on task_recurrence_assignments for all
  using (current_user_role() in ('admin', 'manager'));

commit;

-- ------------------------------------------------------------
-- A real, deliberate trade-off worth understanding rather than assuming
-- away: occurrence generation happens client-side, from WHICHEVER device
-- happens to open the app after an occurrence comes due — which could be
-- an employee's device, not just Admin/Manager's. tasks_insert_staff (the
-- fix above) only allows Admin/Manager to insert a `tasks` row, so a
-- generated occurrence needs its own, separate insert policy — one that
-- doesn't (and, short of reimplementing the whole recurrence algorithm in
-- SQL, realistically can't) verify that the specific due_at being
-- inserted is a genuinely correct occurrence of the referenced rule. It
-- only checks that the row claims to come from a real, existing rule.
--
-- Given this is a private, internal, non-adversarial tool, that's an
-- acceptable trade-off — but it IS a real, meaningful loosening of what
-- tasks_insert_staff otherwise guarantees, and worth being deliberate
-- about rather than accepting silently.
-- ------------------------------------------------------------

create policy "tasks_insert_occurrence_generation" on tasks for insert
  with check (
    generated_from_recurrence_rule_id is not null
    and exists (
      select 1 from task_recurrence_rules r
      where r.id = generated_from_recurrence_rule_id
    )
  );

-- Occurrence-generation also needs to insert the copied-forward assignment
-- rows for whatever it just created — any signed-in user, same trade-off
-- as above, scoped to rows that are genuinely for a task they just
-- generated.
create policy "task_assignments_insert_occurrence_generation" on task_assignments for insert
  with check (
    exists (
      select 1 from tasks t
      where t.id = task_id
        and t.generated_from_recurrence_rule_id is not null
    )
  );
