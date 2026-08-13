import type { SyncedUser } from "@/store/appUsersStore";
import type { AppUser } from "@/types/inventory";

export type AssignableEmployee = {
  /** The roster row's own id — stable list key, never an assignment target. */
  id: string;
  name: string;
  /**
   * `undefined` until this person has signed in at least once and been synced
   * into `app_users`. Only a real Clerk id can be written to
   * `InventoryItem.assignedEmployeeIds`, so an entry without one must be shown
   * as disabled rather than silently assigned to a placeholder.
   */
  clerkUserId: string | undefined;
};

/**
 * Bridges a roster of `AppUser`-shaped entries (typically all of
 * `sampleUsers`, any role) to real synced Clerk accounts by email.
 *
 * Both sides are compared with `.trim().toLowerCase()` per AGENTS.md: Clerk
 * normalizes case on sign-up regardless of how the address was hand-typed into
 * the roster, and a stray leading/trailing space would otherwise silently break
 * that person's entire assignment capability with no visible error.
 *
 * Kept role-agnostic (no employee-only filter) so it also serves
 * `ManagerReportsView`'s reporter list, where Admins and Managers must remain
 * present too — they can self-report.
 *
 * The roster is a parameter rather than a direct `sampleUsers` import so this
 * stays pure and testable — and so swapping the roster for Clerk-sourced roles
 * (v2) touches the callers, not this function.
 */
export function bridgeRosterByEmail<T extends AppUser>(
  roster: T[],
  appUsers: SyncedUser[],
): (T & { clerkUserId: string | undefined })[] {
  return roster.map((rosterUser) => {
    const targetEmail = rosterUser.email.trim().toLowerCase();
    const synced = appUsers.find(
      (appUser) => appUser.email.trim().toLowerCase() === targetEmail,
    );
    return {
      ...rosterUser,
      name: synced?.name ?? rosterUser.name,
      clerkUserId: synced?.clerkUserId,
    };
  });
}

/** Same bridge, narrowed to employees only — the shape `ItemFormModal`'s and
 * `BulkAssignModal`'s pickers need, since only employees are ever assigned to
 * inventory items. */
export function getAssignableEmployees(
  roster: AppUser[],
  appUsers: SyncedUser[],
): AssignableEmployee[] {
  return bridgeRosterByEmail(
    roster.filter((user) => user.role === "employee"),
    appUsers,
  ).map((employee) => ({
    id: employee.id,
    name: employee.name,
    clerkUserId: employee.clerkUserId,
  }));
}
