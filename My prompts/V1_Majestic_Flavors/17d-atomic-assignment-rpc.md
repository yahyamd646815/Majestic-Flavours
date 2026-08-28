Read AGENTS.md first and follow it strictly.

**Prerequisite:** `supabase-rpc-employee-assignment.sql` must already be applied (creates `add_employee_to_item` / `remove_employee_from_item`). Verify both functions exist before starting.

## Task

Close the read-modify-write race CodeRabbit flagged on bulk assignment — and the same race in `ItemFormModal`'s individual edit, which has the identical vulnerability on older code. Every place `assigned_employee_ids` gets written should go through the two new atomic RPC functions instead of a client-computed full-array overwrite.

### 1. Two new store actions in `inventoryStore`

```ts
async function addEmployeeToItem(supabase, itemId: string, employeeId: string): Promise<boolean> {
  const { error } = await supabase.rpc("add_employee_to_item", {
    p_item_id: itemId,
    p_employee_id: employeeId,
  });
  if (error) return false;

  // The RPC computed the new array server-side, so the client doesn't
  // automatically know its new contents. Since add is deterministic
  // (append if absent), it's safe to apply the same transformation to
  // local state optimistically rather than refetch the item.
  set((state) => ({
    items: state.items.map((item) =>
      item.id === itemId && !item.assignedEmployeeIds.includes(employeeId)
        ? { ...item, assignedEmployeeIds: [...item.assignedEmployeeIds, employeeId] }
        : item,
    ),
  }));
  return true;
}
```

`removeEmployeeFromItem` follows the same shape — call `remove_employee_from_item`, then locally filter the employee id out of that item's array on success. Verify the store's actual current state-update pattern (the `set()` call above is illustrative) before matching it exactly — don't assume this is the precise current convention.

### 2. Convert `handleBulkAssign` in `inventory.tsx`

Replace the existing `updateItem(supabase, item.id, { assignedEmployeeIds: [...] })` read-modify-write with `addEmployeeToItem(supabase, item.id, employeeId)`. The already-assigned short-circuit (skip items that already have this employee) can be dropped entirely — the RPC is already idempotent, it's redundant to check client-side first.

### 3. Convert `ItemFormModal`'s save logic — diff-based, not full-array

This is the part that actually closes the gap everywhere, not just in the newest code. Verify `ItemFormModal`'s current state-tracking for the employee picker before restructuring — the shape below is illustrative of the *behavior* needed, not a guarantee of the component's exact current internals:

1. Capture the item's `assignedEmployeeIds` as it was when the form opened (likely already available via the `item` prop).
2. On save, diff that original set against whatever the form's toggles currently reflect — which employees were added, which were removed.
3. Fire `addEmployeeToItem`/`removeEmployeeFromItem` only for employees that actually changed — an untouched employee triggers no call at all.
4. The rest of the form (name, category, quantity, unit, threshold) is unrelated to this change and still goes through the normal `updateItem` call as before.
5. Combine failure-checking across the normal `updateItem` call and the diff-based RPC calls — if any of them fail, the existing "Could not save changes" alert should fire, same as today.

## Constraints

- Don't add the bulk-unassign UI (mode toggle on `BulkAssignModal`) — that's a separate, later prompt. This prompt is only about making the *existing* write paths atomic.
- Don't touch multi-select filters, sort, or the NativeWind cleanup — also separate, later prompts.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` before finishing.

## Reference

Test: edit an item in `ItemFormModal`, toggle two employees off and one on, save, confirm exactly the right net change happened and no untouched employee was affected. The real test this exists for (concurrency) isn't practically triggerable by hand — the correctness argument is structural (the database computes the new value in the same statement that writes it), not something you can click-test directly.
