Read AGENTS.md first and follow it strictly.

**Suggested: Sonnet, high effort.** Small, self-contained, pattern-following — a new pool function plus swapping which one `TaskFormModal` calls.

This is Part E of the to-do list foundation supplement. Parts A–D are already complete and merged (task editing, optional description, mass assign/unassign, per-assignee completion). This file is fully self-contained — verify the current state of everything referenced below directly rather than assuming it matches an earlier description; this session has no memory of how A–D were actually built.

## Task

New requirement: Admin can assign tasks to employees, themselves, other admins, and managers. Manager can assign to employees and themselves only — not other managers, not admins. (Employee self-assignment is explicitly deferred, not part of this prompt.)

Currently, `TaskFormModal` uses `getAssignableEmployees` for its employee picker — the same function used for Inventory assignment, which is employee-only. That function should stay exactly as it is; Inventory still needs it unchanged.

Add a new function to `lib/assignableEmployees.ts`:

```ts
export function getAssignableTaskParticipants(
  creatorRole: Role,
  currentUserClerkId: string,
  roster: AppUser[],
  appUsers: SyncedUser[],
): AssignableEmployee[] {
  const bridged = bridgeRosterByEmail(roster, appUsers);
  if (creatorRole === "admin") return bridged;
  if (creatorRole === "manager") {
    return bridged.filter(
      (person) => person.role === "employee" || person.clerkUserId === currentUserClerkId,
    );
  }
  return [];
}
```

**Verify `bridgeRosterByEmail`'s actual current export shape before assuming this signature is exactly right** — check the real function in the current codebase, don't take this snippet as gospel.

`TaskFormModal` should use `getAssignableTaskParticipants` instead of `getAssignableEmployees` for its employee picker, passing the creating user's own role and Clerk id.

## Constraints

- Don't touch `getAssignableEmployees` — it stays employee-only, still correct for Inventory.
- Don't touch anything about task completion, deletion, or categories — separate, unrelated prompts.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Test as Admin: confirm the assignment picker includes employees, other admins, and managers, plus yourself. Test as Manager: confirm the picker includes employees and yourself only — no other managers, no admins.
