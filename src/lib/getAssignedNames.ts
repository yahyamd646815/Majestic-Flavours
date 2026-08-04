import type { SyncedUser } from "@/store/appUsersStore";

/**
 * Resolves assigned employee ids (real Clerk ids, since prompt 13d) to
 * display names, using the real synced user directory — not `sampleUsers`,
 * which only carries role information and fictional placeholder names now.
 *
 * Callers must read `users` themselves via `useAppUsersStore` (a proper hook
 * call at their own component's top level) and pass the result in — this
 * function stays a plain utility rather than a hook itself, since at least
 * one caller (Dashboard's low-stock alert list) maps over multiple items in
 * a single render pass, where a hook call per item would break the Rules of
 * Hooks.
 *
 * Any id that doesn't resolve (most commonly: an item whose assignment
 * still holds an old placeholder id from before its last edit-and-resave)
 * is silently dropped rather than shown as broken — an item with no
 * resolvable names correctly reads as "Unassigned".
 */
export function getAssignedNames(assignedEmployeeIds: string[], users: SyncedUser[]): string[] {
  return assignedEmployeeIds
    .map((id) => users.find((user) => user.clerkUserId === id)?.name)
    .filter((name): name is string => name !== undefined);
}