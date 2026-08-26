export type StockStatus = "out_of_stock" | "low_stock" | "in_stock";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  out_of_stock: "Out of Stock",
  low_stock: "Low Stock",
  in_stock: "In Stock",
};

/** Worst first — the order the three ping buttons are rendered in, matching
 * how staff scan a list for problems. */
export const STOCK_STATUS_ORDER: StockStatus[] = ["out_of_stock", "low_stock", "in_stock"];

/**
 * The single source of truth for an item's current status. A manual override
 * always wins over the quantity-derived calculation — that is the entire
 * point of pinging. Every place in the app that shows status routes through
 * this: `InventoryCard`'s badge, `ReportEntryCard`'s badge,
 * `getLowStockItems`, and both the count computation and the alert-list
 * filter on the Dashboard. If the override were wired into only some of them,
 * an item could show "Out of Stock" on its card while not appearing in the
 * Dashboard's alert list — exactly the silent inconsistency this function
 * exists to prevent.
 */
export function getEffectiveStatus(item: {
  currentQuantity: number;
  minThreshold: number;
  statusOverride: StockStatus | null;
}): StockStatus {
  if (item.statusOverride !== null) return item.statusOverride;
  if (item.currentQuantity === 0) return "out_of_stock";
  if (item.currentQuantity <= item.minThreshold) return "low_stock";
  return "in_stock";
}

/**
 * Class names are written out in full here, never assembled from a status
 * string at runtime: Tailwind extracts them statically from the source, so a
 * concatenated name would simply never be generated.
 */
export const STOCK_STATUS_BADGE_CLASSES: Record<
  StockStatus,
  { badge: string; text: string }
> = {
  out_of_stock: {
    badge: "status-badge status-badge--out-of-stock",
    text: "status-badge__text--out-of-stock",
  },
  low_stock: {
    badge: "status-badge status-badge--low-stock",
    text: "status-badge__text--low-stock",
  },
  in_stock: {
    badge: "status-badge status-badge--in-stock",
    text: "status-badge__text--in-stock",
  },
};

/** The selected look for a status-ping button. Unselected buttons share
 * `STOCK_STATUS_PING_INACTIVE_CLASSES` regardless of which status they are. */
export const STOCK_STATUS_PING_CLASSES: Record<
  StockStatus,
  { button: string; text: string }
> = {
  out_of_stock: {
    button: "status-ping status-ping--out-of-stock",
    text: "status-ping__text--out-of-stock",
  },
  low_stock: {
    button: "status-ping status-ping--low-stock",
    text: "status-ping__text--low-stock",
  },
  in_stock: {
    button: "status-ping status-ping--in-stock",
    text: "status-ping__text--in-stock",
  },
};

export const STOCK_STATUS_PING_INACTIVE_CLASSES = {
  button: "status-ping status-ping--inactive",
  text: "status-ping__text--inactive",
};
