import type { Role } from "@/types/role";

export type Category = {
  id: string;
  name: string;
};

export type Unit = {
  id: string;
  label: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  currentQuantity: number;
  unit: string;
  minThreshold: number;
  assignedEmployeeIds: string[];
  createdAt: string;
};

export type ReportItemSnapshot = {
  quantity: number;
  recordedAt: string; // ISO timestamp
};

/** One item touched in a report: its optional note, and its chronological,
 * append-only quantity history. */
export type ReportItemEntry = {
  itemId: string;
  snapshots: ReportItemSnapshot[];
  note: string; // "" = no note. Independent of quantity.
};

/** One report per person per calendar day. `reporterId` — not `employeeId`
 * — because Admin and Manager can now also own a report (self-reporting via
 * "+Make a report"). */
export type Report = {
  id: string;
  reporterId: string;
  date: string; // YYYY-MM-DD
  content: string; // "" is valid — written content is optional
  itemEntries: ReportItemEntry[];
  isLocked: boolean;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};
