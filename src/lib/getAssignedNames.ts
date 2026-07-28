import { sampleUsers } from "@/data/sampleUsers";

/** Resolves assigned employee ids to their display names, dropping any that no longer exist. */
export function getAssignedNames(employeeIds: string[]): string[] {
  return employeeIds
    .map((id) => sampleUsers.find((user) => user.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}
