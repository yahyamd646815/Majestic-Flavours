Read AGENTS.md first and follow it strictly.

## Task

`updateItem` in `inventoryStore.ts` still accepts `assignedEmployeeIds` as an updatable field, even though nothing should ever write it through that path anymore — `addEmployeeToItem`/`removeEmployeeFromItem` (the atomic RPCs from the previous prompt) are the only correct way to touch that field now. Leaving `updateItem` able to accept it means the read-modify-write race that was just closed could be silently reintroduced by any future call site that doesn't know better — a type-level guarantee is what actually makes that structurally impossible, not just currently-true-by-convention.

1. Change `updateItem`'s type signature from:
   ```ts
   updates: Partial<Omit<InventoryItem, "id" | "createdAt">>,
   ```
   to:
   ```ts
   updates: Partial<Omit<InventoryItem, "id" | "createdAt" | "assignedEmployeeIds">>,
   ```
2. Remove the corresponding line from the implementation:
   ```ts
   if (updates.assignedEmployeeIds !== undefined) dbUpdates.assigned_employee_ids = updates.assignedEmployeeIds;
   ```
3. `addItem`'s signature is unrelated and stays exactly as-is — creating a brand-new item legitimately sets its initial assignments directly, and there's no concurrency risk against an item that doesn't exist yet.
4. This will likely surface as a type error wherever `ItemFormModal`'s submitted values currently get passed to `updateItem` (in `inventory.tsx`'s edit path, from the previous prompt's diff-based rework) — verify it actually compiles cleanly rather than assuming it does. If it doesn't, that call site needs to explicitly exclude `assignedEmployeeIds` before calling `updateItem`, which is what should already be happening logically, just not yet enforced by the type system.

## Constraints

- Don't change anything about `addEmployeeToItem`/`removeEmployeeFromItem` themselves — they're already correct.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

The real test here is that it's now a compile error, not a runtime check, to try `updateItem(supabase, id, { assignedEmployeeIds: [...] })` anywhere in the codebase — confirm by trying that call somewhere temporarily and checking TypeScript rejects it, then revert.
