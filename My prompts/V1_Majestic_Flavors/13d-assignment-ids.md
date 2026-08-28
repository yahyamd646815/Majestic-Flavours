Read AGENTS.md first and follow it strictly.

## Task

Fix `inventory_items.assigned_employee_ids` to hold real Clerk ids instead of placeholder `sampleUsers` ids. This is the last piece of the identity migration that's been deliberately deferred since 13a — closing it makes the Employee row-level RLS policy (`items_employee_update_assigned`) actually match real data for the first time.

### 1. `ItemFormModal.tsx` — resolve real ids in the employee picker

Bridge `sampleUsers` employees to their real Clerk id the same way `ManagerReportsView.tsx` already does — via `appUsersStore`, matched by email, case-insensitively:

```ts
const appUsers = useAppUsersStore((state) => state.users);

const assignableEmployees = useMemo(
  () =>
    sampleUsers
      .filter((user) => user.role === "employee")
      .map((sampleUser) => {
        const targetEmail = sampleUser.email.toLowerCase();
        const synced = appUsers.find((appUser) => appUser.email.toLowerCase() === targetEmail);
        return { ...sampleUser, clerkUserId: synced?.clerkUserId };
      }),
  [appUsers],
);
```

In the picker UI: an employee with no resolved `clerkUserId` (hasn't signed in yet) should render disabled/grayed out with a short label like "Hasn't signed in yet" — they genuinely can't be assigned until a real id exists for them. Toggling selection, and what gets written into `assignedEmployeeIds` on save, uses `clerkUserId` — never the `sampleUsers` id.

**Expected side effect when editing an existing item, worth knowing rather than fixing:** since currently-stored assignments still hold the old placeholder ids, none of them will match any real `clerkUserId` in the picker — every existing item will show as "nobody assigned" the first time it's reopened for editing after this ships. That's the correct, honest signal, not a bug — see the manual cleanup step below.

### 2. `reports.tsx` — Employee item-scoping switches to the real Clerk id directly

Now that `assignedEmployeeIds` will (once re-saved) hold real ids, the `assignedItems` filter no longer needs the `sampleUsers` email bridge at all:

```ts
const assignedItems = useMemo(
  () => (user?.id ? items.filter((item) => item.assignedEmployeeIds.includes(user.id)) : []),
  [items, user?.id],
);
```

This also means `currentSampleUser` and the "No matching employee profile found" fallback are no longer needed anywhere in this file — remove them. Both `reporterId` and item-scoping now derive from `user.id` alone; the `sampleUsers` email bridge is fully gone from this specific file. (It's still needed in `ManagerReportsView.tsx` for the Today-roster/reporter-name lookup — that's a different problem, resolving *which real people are employees at all*, which still has no answer other than `sampleUsers` since role isn't stored in `app_users`. Don't touch that file.)

## Constraints

- Do not modify `assigned_employee_ids`'s column type or add any database constraint on it — it stays a plain `text[]`, no schema change needed for this prompt.
- Do not touch `ManagerReportsView.tsx`'s reporter-bridging logic — that's solving a different, still-open problem (no role in `app_users`) and is unaffected by this fix.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference — manual cleanup needed after this ships, not part of the prompt itself

Every currently-existing inventory item needs to be reopened in Edit and have its assigned employees re-selected once, to replace the old placeholder ids with real ones picked up through the corrected form. This is a one-time, by-hand data cleanup — nothing here can safely automate mapping an old fake id to a specific real person, since the fix's own purpose is to stop guessing at that mapping.
