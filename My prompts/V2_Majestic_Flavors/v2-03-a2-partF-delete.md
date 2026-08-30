Read AGENTS.md first and follow it strictly.

**Suggested: Sonnet, high effort.** Reuses an existing component directly; the real permission logic lives in SQL, already applied.

This is Part F of the to-do list foundation supplement. Parts A–D are already complete and merged. This file is fully self-contained — verify the current state of everything referenced below directly rather than assuming it matches an earlier description.

**Prerequisite:** `v2-supabase-patch-round4.sql` must already be applied — it fixes a real bug where an older, broader policy (`tasks_write_staff`) silently overrode the intended delete restriction. Verify this before starting; the delete permission genuinely doesn't work correctly without it.

## Task

Add task deletion with the standard two-step confirmation. **Reuse `DeleteConfirmModal` directly** — the same typed-DELETE component Inventory already uses, not a new one.

**The real permission boundary is already enforced in SQL** (`tasks_delete_permission`, from round 2, now correctly isolated by round 4's fix): Admin can delete any task; Manager can delete only tasks they created themselves. This prompt only needs to decide when to *show* the delete action in the UI, matching that same boundary:

- **Admin** sees a delete option on every task.
- **Manager** sees it only on tasks they created (`task.createdBy === currentUserClerkId`).
- **Employee** never sees it at all.

Showing the option only where it would actually succeed avoids a confusing "delete failed" experience from the RLS policy silently rejecting an attempt the UI shouldn't have offered in the first place.

## Constraints

- Don't touch anything about assignment, completion, or categories — separate, unrelated prompts.
- Don't build any new confirmation UI — `DeleteConfirmModal` already exists and does this correctly elsewhere.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Test as Admin: delete a task you created, and separately a task another admin or a manager created — both should work. Test as Manager: confirm you can delete your own task, and confirm the delete option isn't even offered on an admin-created or another manager's task — not just that it's blocked server-side, but that the UI doesn't present it as an option at all.
