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

export type Report = {
  id: string;
  itemId: string;
  employeeId: string;
  content: string;
  date: string;
  isLocked: boolean;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};
