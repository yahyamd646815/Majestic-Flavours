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

/** One assigned item an employee touched during a reported day. */
export type ReportItemChange = {
  itemId: string;
  startQuantity: number;
  endQuantity: number;
};

/** One report per employee per calendar day, covering every item they touched. */
export type Report = {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  content: string; // "" is valid — written content is optional
  itemChanges: ReportItemChange[];
  isLocked: boolean;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};
