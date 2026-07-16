/**
 * Staff roles, stored in Clerk `publicMetadata.role` as a lowercase string.
 * @see AGENTS.md → Role-Based Access
 */
export type Role = "admin" | "manager" | "employee";

const ROLES: readonly Role[] = ["admin", "manager", "employee"];

/**
 * Narrows the untyped `publicMetadata.role` value to a valid {@link Role}.
 * Returns `undefined` when the account has no valid role assigned.
 */
export function parseRole(value: unknown): Role | undefined {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : undefined;
}
