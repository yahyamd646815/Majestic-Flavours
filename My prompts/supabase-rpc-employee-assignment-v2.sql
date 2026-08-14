-- ============================================================
-- Majestic Flavours — employee assignment RPCs, revised
-- Fixes: both functions previously returned `void`, so the client had no
-- way to tell "genuinely updated a row" apart from "matched zero rows and
-- silently did nothing" (which can happen if RLS filters the target row,
-- or the item was deleted between the UI loading it and this call firing —
-- Postgres does not error on an UPDATE that matches nothing). Returning the
-- actual row via RETURNING * lets the caller detect a real no-op, and lets
-- the client sync local state from the database's actual value instead of
-- an optimistic guess — matching how every other mutation in
-- inventoryStore.ts already works.
--
-- Postgres does not allow CREATE OR REPLACE to change a function's return
-- type — void to setof inventory_items requires dropping the old version
-- first, not just replacing it in place.
-- ============================================================

drop function if exists add_employee_to_item(text, text);
drop function if exists remove_employee_from_item(text, text);

create function add_employee_to_item(p_item_id text, p_employee_id text)
returns setof inventory_items
language sql
as $$
  update inventory_items
  set assigned_employee_ids = case
    when p_employee_id = any(assigned_employee_ids) then assigned_employee_ids
    else array_append(assigned_employee_ids, p_employee_id)
  end
  where id = p_item_id
  returning *;
$$;

create function remove_employee_from_item(p_item_id text, p_employee_id text)
returns setof inventory_items
language sql
as $$
  update inventory_items
  set assigned_employee_ids = array_remove(assigned_employee_ids, p_employee_id)
  where id = p_item_id
  returning *;
$$;

-- Grants are tied to name + argument types, which haven't changed, but
-- re-stating them is harmless and removes any doubt.
grant execute on function add_employee_to_item(text, text) to authenticated;
grant execute on function remove_employee_from_item(text, text) to authenticated;
