// TypeScript 6 does not pull in `@types/*` packages automatically, so the Jest
// globals (`describe`, `it`, `expect`) are referenced explicitly here rather
// than widening the whole project's tsconfig for one test file.
/// <reference types="jest" />

import { getAssignableEmployees, getAssignableTaskParticipants } from "@/lib/assignableEmployees";
import type { SyncedUser } from "@/store/appUsersStore";
import type { AppUser } from "@/types/inventory";

const roster: AppUser[] = [
  { id: "user-1", name: "Roster Admin", email: "admin@example.com", role: "admin" },
  { id: "user-2", name: "Roster Manager", email: "manager@example.com", role: "manager" },
  { id: "user-3", name: "Roster Amina", email: "amina@example.com", role: "employee" },
  { id: "user-4", name: "Roster Bilal", email: "bilal@example.com", role: "employee" },
];

function syncedUser(clerkUserId: string, name: string, email: string): SyncedUser {
  return { clerkUserId, name, email };
}

describe("getAssignableEmployees", () => {
  it("returns only employees, dropping admins and managers", () => {
    const result = getAssignableEmployees(roster, []);

    expect(result.map((employee) => employee.id)).toEqual(["user-3", "user-4"]);
  });

  it("attaches the real Clerk id and synced display name on an email match", () => {
    const result = getAssignableEmployees(roster, [
      syncedUser("clerk_amina", "Amina K. (Clerk)", "amina@example.com"),
    ]);

    expect(result[0]).toEqual({
      id: "user-3",
      name: "Amina K. (Clerk)",
      clerkUserId: "clerk_amina",
    });
  });

  it("leaves clerkUserId undefined for someone who has not signed in yet", () => {
    const result = getAssignableEmployees(roster, [
      syncedUser("clerk_amina", "Amina K. (Clerk)", "amina@example.com"),
    ]);

    expect(result[1]).toEqual({
      id: "user-4",
      name: "Roster Bilal",
      clerkUserId: undefined,
    });
  });

  it("matches regardless of email casing on either side", () => {
    const result = getAssignableEmployees(
      [{ id: "user-3", name: "Roster Amina", email: "AMINA@Example.com", role: "employee" }],
      [syncedUser("clerk_amina", "Amina K.", "amina@EXAMPLE.COM")],
    );

    expect(result[0].clerkUserId).toBe("clerk_amina");
  });

  it("matches despite stray surrounding whitespace in either email", () => {
    // The whole point of trimming: a single leading/trailing space in
    // `sampleUsers.ts` used to silently break that person's assignability,
    // with no visible error anywhere in the UI.
    const result = getAssignableEmployees(
      [{ id: "user-3", name: "Roster Amina", email: " amina@example.com ", role: "employee" }],
      [syncedUser("clerk_amina", "Amina K.", "amina@example.com\n")],
    );

    expect(result[0].clerkUserId).toBe("clerk_amina");
  });

  it("returns an empty list when the roster has no employees", () => {
    expect(getAssignableEmployees(roster.slice(0, 2), [])).toEqual([]);
  });
});

describe("getAssignableTaskParticipants", () => {
  it("gives an admin creator the entire roster, including admins and managers", () => {
    const result = getAssignableTaskParticipants("admin", "clerk_admin", roster, []);

    expect(result.map((person) => person.id)).toEqual(["user-1", "user-2", "user-3", "user-4"]);
  });

  it("limits a manager creator to employees plus themselves", () => {
    const result = getAssignableTaskParticipants(
      "manager",
      "clerk_manager",
      roster,
      [syncedUser("clerk_manager", "Roster Manager", "manager@example.com")],
    );

    expect(result.map((person) => person.id)).toEqual(["user-2", "user-3", "user-4"]);
  });

  it("excludes other managers and all admins for a manager creator", () => {
    const result = getAssignableTaskParticipants(
      "manager",
      "clerk_someone_else",
      roster,
      [syncedUser("clerk_someone_else", "Someone Else", "someone-else@example.com")],
    );

    expect(result.map((person) => person.id)).toEqual(["user-3", "user-4"]);
  });

  it("returns an empty pool for any other creator role", () => {
    expect(getAssignableTaskParticipants("employee", "clerk_amina", roster, [])).toEqual([]);
  });
});
