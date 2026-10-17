import type { StockStatus } from "@/lib/stockStatus";

/** Top to bottom, best status first. Deliberately the reverse of
 * `STOCK_STATUS_ORDER` (worst first, for the report ping buttons): the picker
 * always reads the same way for every item, so it never has to be re-learned. */
export const STATUS_PICKER_ORDER: StockStatus[] = ["in_stock", "low_stock", "out_of_stock"];

export type StatusPickerSlot = {
  status: StockStatus;
  /** The item's current status — it keeps its own place in the fixed order. */
  isCurrent: boolean;
  /** Only the other two can be chosen; tapping the current one just closes. */
  isSelectable: boolean;
  /** Which way an option slides out from the current badge when opening. */
  position: "above" | "current" | "below";
};

export function getStatusPickerSlots(current: StockStatus): StatusPickerSlot[] {
  const currentIndex = STATUS_PICKER_ORDER.indexOf(current);

  return STATUS_PICKER_ORDER.map((status, index) => ({
    status,
    isCurrent: index === currentIndex,
    isSelectable: index !== currentIndex,
    position: index < currentIndex ? "above" : index > currentIndex ? "below" : "current",
  }));
}
