import type { StockStatus } from "@/lib/stockStatus";
import type { Role } from "@/types/role";

export type Category = {
  id: string;
  name: string;
};

export type Unit = {
  id: string;
  label: string;
};

/** `categoryId` / `unitId` are real foreign keys into `categories` / `units`
 * (matching the Supabase schema). They replaced the display-name strings the
 * app used before — resolve them to text with `@/lib/inventoryLabels`. */
export type InventoryItem = {
  id: string;
  name: string;
  categoryId: string;
  currentQuantity: number;
  unitId: string;
  minThreshold: number;
  assignedEmployeeIds: string[];
  /** A status pinged manually from a report. `null` — the normal case — means
   * status is purely quantity-derived. Never set from the item form; only a
   * report ping writes it, and a quantity change clears it. Always read it
   * through `getEffectiveStatus` (@/lib/stockStatus), never directly. */
  statusOverride: StockStatus | null;
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
  statusPings: { status: StockStatus; recordedAt: string }[];
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
