-- ============================================================
-- Majestic Flavours — atomic employee assignment functions
-- Fixes the read-modify-write race CodeRabbit flagged on bulk assign:
-- two concurrent writers to the same item's assigned_employee_ids can
-- silently lose one writer's change, since the client reads the array,
-- computes a new one locally, and overwrites the whole column.
--
-- These functions do the mutation IN the same statement that writes it,
-- using whatever Postgres currently has committed — there's no window
-- for a stale client-side read to overwrite a newer write.
--
-- Deliberately NOT `security definer` — that would run with the function
-- owner's privileges and bypass RLS entirely, meaning even an Employee
-- account could call this successfully regardless of the existing
-- inventory_items UPDATE policy. Omitting it (the default is
-- `security invoker`) means RLS applies exactly as if the calling user
-- ran the UPDATE themselves — Admin/Manager-only stays enforced.
-- ============================================================

create or replace function add_employee_to_item(p_item_id text, p_employee_id text)
returns void
language sql
as $$
  update inventory_items
  set assigned_employee_ids = case
    when p_employee_id = any(assigned_employee_ids) then assigned_employee_ids
    else array_append(assigned_employee_ids, p_employee_id)
  end
  where id = p_item_id;
$$;

create or replace function remove_employee_from_item(p_item_id text, p_employee_id text)
returns void
language sql
as $$
  update inventory_items
  set assigned_employee_ids = array_remove(assigned_employee_ids, p_employee_id)
  where id = p_item_id;
$$;

-- PostgREST needs explicit EXECUTE grants to expose these to API callers
-- via supabase.rpc() at all — new functions aren't automatically callable.
grant execute on function add_employee_to_item(text, text) to authenticated;
grant execute on function remove_employee_from_item(text, text) to authenticated;

-- ------------------------------------------------------------
-- Worth confirming after running this: call one from the app as an
-- Employee account and confirm it has no effect (RLS should silently
-- restrict it, same as a direct UPDATE would) before relying on it.
-- ------------------------------------------------------------
