-- ============================================================
-- Majestic Flavours — CodeRabbit fixes, batch 3
-- Two findings against the task-assignment push trigger installed in
-- v2-supabase-patch-round12.sql. Both are corrections to that one
-- function; nothing else in the database changes, and local reminders
-- (round10 / round13) are untouched.
--
--   A. net.http_post could roll back the assignment that triggered it.
--   B. The Edge Function had no way to tell the trigger from any other
--      signed-in caller.
--
-- The batch's third finding (the recurrence preview's truncation flag)
-- is app-side only — src/lib/taskRecurrence.ts — and needs nothing here.
--
-- Not numbered as a "round" file, matching the two earlier CodeRabbit
-- batches: round numbering has diverged between my own tracking and the
-- actual repo.
-- ============================================================


-- ------------------------------------------------------------
-- BEFORE YOU RUN THIS — the new shared secret has to exist on both
-- sides, and the redeployed function has to be live, or every push
-- silently stops. (Assignments keep working throughout; that is the
-- whole point of fix A. But nobody gets notified until all four steps
-- below are done.)
--
-- 1. Pick one long random value. Anything unguessable will do — a
--    password manager's 32+ character output, or from the SQL editor:
--
--      select gen_random_uuid()::text || gen_random_uuid()::text;
--
--    Copy it somewhere you can paste twice. Do NOT paste it back into
--    this file or any other file in this repo.
--
-- 2. Store it in Vault, where this trigger reads it — the same
--    mechanism round12 already uses for project_url and
--    service_role_key, so this adds no new place for secrets to live:
--
--      select vault.create_secret('<the value>', 'task_assignment_push_secret');
--
--    Already created it once? create_secret rejects a duplicate name —
--    use vault.update_secret(id, new_secret), with the id from:
--      select id, name from vault.secrets where name = 'task_assignment_push_secret';
--
-- 3. Store the SAME value on the Edge Function, Dashboard -> Edge
--    Functions -> Secrets (or `supabase secrets set`), as:
--
--      TASK_ASSIGNMENT_PUSH_SECRET=<the value>
--
--    It cannot be read from Vault on that side: Edge Functions have no
--    direct read of vault.decrypted_secrets, and reaching it through an
--    RPC would mean a database round-trip before the caller has been
--    authenticated — exactly what the check exists to avoid. The name
--    may not start with SUPABASE_, SB_ or DENO_; those are reserved.
--
-- 4. Redeploy the function with the updated
--    supabase/functions/notify-task-assignment/index.ts. Until it is
--    redeployed it ignores the new header and still works; once it is
--    redeployed it rejects anything without it, so do steps 2 and 3
--    first.
-- ------------------------------------------------------------


begin;

-- ------------------------------------------------------------
-- The trigger function, replaced whole. Two changes from round12,
-- both marked below; everything else — the recurrence skip, SECURITY
-- DEFINER, the pinned empty search_path — is unchanged and is there for
-- the reasons round12 gives.
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
  push_secret text;
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

  -- CHANGE 2 of 2 (finding B) — the shared secret that proves this call
  -- came from the trigger and not from a signed-in employee poking the
  -- endpoint by hand. The service_role_key alone never proved that: the
  -- function accepts any valid JWT, and every member of staff holds one.
  select s.decrypted_secret into push_secret
    from vault.decrypted_secrets s where s.name = 'task_assignment_push_secret';

  -- Missing configuration warns and returns rather than raising. A task
  -- that saved but did not notify is much better than a task that could
  -- not be assigned at all. Sending without the secret would only earn a
  -- 401 from the function, so there is nothing to gain by trying.
  if project_url is null or service_role_key is null or push_secret is null then
    raise warning '[notify_task_assignment] Vault secrets project_url / service_role_key / task_assignment_push_secret are not all set — no push sent.';
    return null;
  end if;

  -- CHANGE 1 of 2 (finding A) — the enqueue is wrapped.
  --
  -- net.http_post does the HTTP call out of band, but it first INSERTs a
  -- row into net.http_request_queue, and that insert is ordinary work in
  -- this transaction. If it fails — pg_net not installed, its queue table
  -- gone, permissions changed underneath us — the exception propagates out
  -- of an AFTER INSERT trigger and takes the assignment down with it.
  --
  -- (round12's comment claiming AFTER means "nothing here can undo it" was
  -- wrong: an AFTER trigger still runs inside the inserting transaction.
  -- What is genuinely safe is the *HTTP call*, which happens later, in
  -- pg_net's own worker. The enqueue is not.)
  --
  -- Catching it here confines the failure to this block's subtransaction:
  -- the queue row is rolled back, the assignment is not, and the trigger
  -- returns normally. Somebody being given a task is the real business
  -- operation; the notification is a side effect of it, never a gate on it.
  begin
    perform net.http_post(
      url := project_url || '/functions/v1/notify-task-assignment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'x-task-assignment-secret', push_secret
      ),
      body := jsonb_build_object(
        'task_id', new.task_id,
        'employee_clerk_id', new.employee_clerk_id
      ),
      timeout_milliseconds := 5000
    );
  exception
    when others then
      raise warning '[notify_task_assignment] Could not queue the push for task % / %: % (%)',
        new.task_id, new.employee_clerk_id, sqlerrm, sqlstate;
  end;

  return null;
end;
$$;

commit;


-- The trigger itself is unchanged — task_assignment_push already points
-- at this function by name, so replacing the function is the whole
-- deployment. Confirm it is still attached:
--
--   select tgname, tgenabled from pg_trigger
--    where tgrelid = 'public.task_assignments'::regclass and not tgisinternal;
--
-- Expect one row: task_assignment_push, enabled 'O'.


-- ------------------------------------------------------------
-- Checking this works.
--
-- 1. All three secrets are readable now, not two:
--      select name from vault.decrypted_secrets
--       where name in ('project_url', 'service_role_key', 'task_assignment_push_secret');
--    Three rows, or the trigger will only ever warn.
--
-- 2. The happy path still works, exactly as in round12 — insert an
--    assignment for a real task with generated_from_recurrence_rule_id
--    IS NULL and a clerk id that has a registered device, then:
--      select id, status_code, content
--        from net._http_response order by id desc limit 5;
--
--    200 {"sent":true}          Expo accepted it.
--    200 {"sent":false}         Nothing to send — unknown task, unknown
--                               employee, or no device registered. One
--                               answer for all three on purpose now
--                               (finding B): distinct replies would let a
--                               caller probe which ids exist. Which one it
--                               actually was is in the function's logs.
--    401                        The shared secret is missing or does not
--                               match, OR service_role_key is wrong.
--                               Steps 2 and 3 at the top, and check the
--                               function's own secret is the same value.
--    404                        project_url is wrong, or the function is
--                               not deployed.
--
-- 3. Finding B, from the outside. From any terminal, with an ordinary
--    signed-in user's token (or the anon key) — this is what an employee
--    could do before this patch:
--
--      curl -i -X POST 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/notify-task-assignment' \
--        -H 'Authorization: Bearer <any valid JWT or the anon key>' \
--        -H 'Content-Type: application/json' \
--        -d '{"task_id":"<real task id>","employee_clerk_id":"<real clerk id>"}'
--
--    Expect 401 {"error":"Unauthorized"} and NO notification on the
--    target's phone. Repeat with -H 'x-task-assignment-secret: <the
--    value>' added and it goes through — which is the trigger's own call,
--    reproduced by hand.
--
-- 4. Finding A, the part that matters. Force the enqueue itself to fail
--    and confirm the assignment survives. Run this as one block; the
--    rollback puts pg_net back, so nothing is left broken:
--
--      begin;
--        drop extension pg_net;
--        insert into task_assignments (task_id, employee_clerk_id)
--        values ('<non-recurring task id>', '<clerk id not already assigned>');
--        -- Expect: WARNING [notify_task_assignment] Could not queue the
--        -- push ... and INSERT 0 1 — the warning is the caught failure,
--        -- the INSERT is the point.
--        select count(*) from task_assignments
--         where task_id = '<same task id>' and employee_clerk_id = '<same clerk id>';
--        -- Expect 1. Before this patch it was the whole statement that
--        -- failed, and the count never got a chance to run.
--      rollback;
--
--    If `drop extension pg_net` complains about dependent objects, stop
--    and do not force it — the trace above is the argument, and step 2
--    already shows the healthy path still works.
--
-- 5. The function's own side, including Expo's ticket and the log line
--    saying which of the three quiet cases it was:
--      Dashboard -> Edge Functions -> notify-task-assignment -> Logs
--
-- Tidy up afterwards: delete from task_assignments where task_id = '...'
-- and employee_clerk_id = '...', for whichever test rows above were not
-- meant to stay.
-- ------------------------------------------------------------
