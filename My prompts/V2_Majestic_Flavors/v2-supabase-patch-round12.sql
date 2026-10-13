-- ============================================================
-- Majestic Flavours — v2-supabase-patch-round12
-- Remote push when somebody is assigned a task (v2-03-e2, Part C).
--
-- This project's first database-triggered outbound HTTP call. Everything
-- here is additive: it does not touch local reminders (round10 /
-- v2-03-e1), and it cannot block or fail an assignment — if any part of
-- it is missing or misconfigured, the INSERT still succeeds and nothing
-- is sent.
--
-- Prerequisite: v2-supabase-patch-round11 (app_users.expo_push_token).
-- ============================================================


-- ------------------------------------------------------------
-- BEFORE YOU RUN THIS — two things have to exist first.
--
-- 1. The Edge Function must be deployed as `notify-task-assignment`
--    (supabase/functions/notify-task-assignment/index.ts):
--
--      supabase functions deploy notify-task-assignment
--
--    or Dashboard -> Edge Functions -> Deploy a new function, pasting
--    that file in. Its own Supabase credentials are injected by the
--    platform; there is no secret to configure on the function side.
--
-- 2. Two Vault secrets, which are how this trigger reaches it. Run these
--    two lines ON THEIR OWN in the SQL editor, with the real values
--    pasted in:
--
--      select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'project_url');
--      select vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'service_role_key');
--
--    Do NOT paste the filled-in version back into this file, or into any
--    other file in this repo. The service role key bypasses every RLS
--    policy in this project; the whole reason it lives in Vault is so it
--    never has to be written down anywhere that gets committed. The
--    project URL is not a secret, but Vault keeps both in one place and
--    keeps this file free of project-specific values.
--
--    Already created them once? create_secret rejects a duplicate name —
--    use vault.update_secret(id, new_secret) instead, with the id from:
--      select id, name from vault.secrets where name in ('project_url', 'service_role_key');
-- ------------------------------------------------------------


begin;

-- Gives Postgres an asynchronous HTTP client. Asynchronous is the point:
-- the assignment INSERT must never wait on a push notification, and must
-- never be rolled back by one failing. A no-op if it is already enabled.
create extension if not exists pg_net with schema extensions;


-- ------------------------------------------------------------
-- The trigger function.
--
-- SECURITY DEFINER for two real reasons, not by habit:
--   * vault.decrypted_secrets is readable by postgres, not by the
--     `authenticated` role the inserting client runs as.
--   * the recurrence check below reads `tasks`, which is behind RLS — an
--     employee generating an occurrence can only see their own rows, so
--     as the caller this lookup would sometimes come back empty and the
--     wrong branch would be taken.
--
-- search_path is pinned empty and every name is schema-qualified, which
-- is the standard guard against search_path capture in a definer
-- function.
-- ------------------------------------------------------------

create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_generated boolean;
  project_url text;
  service_role_key text;
begin
  -- Recurring occurrences copy their rule's assignees forward every time
  -- they generate. Without this, a daily recurring task would push "you
  -- were just assigned a task" every single day, forever, for work that is
  -- routine and expected. The notification is for someone actively handing
  -- you something new — hand-created assignments, bulk-assign included,
  -- still push normally.
  select t.generated_from_recurrence_rule_id is not null
    into is_generated
    from public.tasks t
   where t.id = new.task_id;

  -- Coalesced to true (= skip) on purpose: the foreign key means the task
  -- is always there, so a null result means something is wrong, and silence
  -- is the safe direction for a notification.
  if coalesce(is_generated, true) then
    return null;
  end if;

  select s.decrypted_secret into project_url
    from vault.decrypted_secrets s where s.name = 'project_url';
  select s.decrypted_secret into service_role_key
    from vault.decrypted_secrets s where s.name = 'service_role_key';

  -- Missing configuration warns and returns rather than raising. A task
  -- that saved but did not notify is much better than a task that could
  -- not be assigned at all.
  if project_url is null or service_role_key is null then
    raise warning '[notify_task_assignment] Vault secrets project_url / service_role_key are not both set — no push sent.';
    return null;
  end if;

  -- Fire and forget. net.http_post returns a request id immediately and
  -- does the request out of band; whatever comes back lands in
  -- net._http_response (see the checks at the bottom of this file).
  perform net.http_post(
    url := project_url || '/functions/v1/notify-task-assignment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'task_id', new.task_id,
      'employee_clerk_id', new.employee_clerk_id
    ),
    timeout_milliseconds := 5000
  );

  return null;
end;
$$;


-- AFTER INSERT, per row. AFTER matters: the assignment is already
-- committed to by the time this runs, so nothing here can undo it.
--
-- INSERT only — a removed assignment sends nothing, and an assignment that
-- was already there sends nothing either (addAssignment upserts with
-- ON CONFLICT DO NOTHING, and a row that is not actually inserted does not
-- fire a row trigger).
drop trigger if exists task_assignment_push on public.task_assignments;

create trigger task_assignment_push
  after insert on public.task_assignments
  for each row
  execute function public.notify_task_assignment();

commit;


-- ------------------------------------------------------------
-- Checking this works, without waiting on the app rebuild.
--
-- 1. Both secrets are readable:
--      select name from vault.decrypted_secrets
--       where name in ('project_url', 'service_role_key');
--    Two rows, or the trigger will only ever warn.
--
-- 2. Somebody has actually registered a device yet:
--      select clerk_user_id, name from app_users
--       where expo_push_token is not null;
--    Empty until a rebuilt app has been opened at least once — until then
--    every push correctly resolves to "no_push_token" in step 4.
--
-- 3. Fire it by hand. Pick a real task with
--    generated_from_recurrence_rule_id IS NULL, and a clerk id from
--    step 2 that is not already assigned to it:
--      insert into task_assignments (task_id, employee_clerk_id)
--      values ('<task id>', '<clerk id>');
--
-- 4. What came back (asynchronous — give it a second or two):
--      select id, status_code, content
--        from net._http_response
--       order by id desc limit 5;
--
--    200 {"sent":true}                        Expo accepted it.
--    200 {"sent":false,"reason":"no_push_token"}
--                                             That person has no device
--                                             registered — the deliberate
--                                             silent case, not a failure.
--    401                                      service_role_key is wrong.
--    404                                      project_url is wrong, or the
--                                             function is not deployed.
--
-- 5. The function's own side, including Expo's ticket:
--      Dashboard -> Edge Functions -> notify-task-assignment -> Logs
--
-- 6. The recurrence skip. Insert an assignment for a task whose
--    generated_from_recurrence_rule_id IS NOT NULL and confirm NO new row
--    appears in net._http_response. This is the one behaviour most worth
--    checking by hand — it is the difference between a useful
--    notification and a daily one nobody wants.
--
-- Tidy up afterwards: delete from task_assignments where task_id = '...'
-- and employee_clerk_id = '...', for whichever test rows above were not
-- meant to stay.
-- ------------------------------------------------------------
