import type { SupabaseClient } from "@supabase/supabase-js";

import { useInventoryStore } from "@/store/inventoryStore";

type DbRow = Record<string, unknown>;

const returnedRow: DbRow = {
  id: "item-rice",
  name: "Basmati Rice",
  category_id: "cat-dry",
  current_quantity: 12,
  unit_id: "unit-kg",
  min_threshold: 5,
  assigned_employee_ids: [],
  status_override: null,
  status_updated_at: "2026-01-04T09:00:00.000Z",
  created_at: "2026-01-04T09:00:00.000Z",
};

/** Captures the payload handed to `.update()` — the only thing these tests
 * care about — while satisfying the chain `updateItem` calls through. */
function createSupabaseMock() {
  const payloads: DbRow[] = [];
  const single = jest.fn(async () => ({ data: returnedRow, error: null }));
  const select = jest.fn(() => ({ single }));
  const eq = jest.fn(() => ({ select }));
  const update = jest.fn((payload: DbRow) => {
    payloads.push(payload);
    return { eq };
  });
  const from = jest.fn(() => ({ update }));

  return { client: { from } as unknown as SupabaseClient, payloads };
}

describe("updateItem — status override composition", () => {
  it("clears the override when only the quantity changes", async () => {
    const { client, payloads } = createSupabaseMock();

    await useInventoryStore.getState().updateItem(client, "item-rice", { currentQuantity: 3 });

    expect(payloads[0]).toEqual({
      current_quantity: 3,
      status_override: null,
      status_updated_at: expect.any(String),
    });
  });

  it("sets the override without touching the quantity when only a status is pinged", async () => {
    const { client, payloads } = createSupabaseMock();

    await useInventoryStore
      .getState()
      .updateItem(client, "item-rice", { statusOverride: "out_of_stock" });

    expect(payloads[0]).toEqual({
      status_override: "out_of_stock",
      status_updated_at: expect.any(String),
    });
    expect(payloads[0]).not.toHaveProperty("current_quantity");
  });

  // The case the merged single-call write exists for: as two sequential
  // writes, the quantity change's auto-clear could land last and silently
  // undo the ping.
  it("keeps the pinged status when quantity and status change in the same call", async () => {
    const { client, payloads } = createSupabaseMock();

    await useInventoryStore
      .getState()
      .updateItem(client, "item-rice", { currentQuantity: 0, statusOverride: "low_stock" });

    expect(payloads[0]).toEqual({
      current_quantity: 0,
      status_override: "low_stock",
      status_updated_at: expect.any(String),
    });
  });

  it("leaves an existing override alone when neither quantity nor status is part of the update", async () => {
    const { client, payloads } = createSupabaseMock();

    await useInventoryStore.getState().updateItem(client, "item-rice", { name: "Basmati Rice" });

    expect(payloads[0]).toEqual({ name: "Basmati Rice" });
    expect(payloads[0]).not.toHaveProperty("status_override");
  });

  it("accepts an explicit null as a deliberate clear", async () => {
    const { client, payloads } = createSupabaseMock();

    await useInventoryStore.getState().updateItem(client, "item-rice", { statusOverride: null });

    expect(payloads[0]).toEqual({
      status_override: null,
      status_updated_at: expect.any(String),
    });
  });
});

// The Dashboard's elapsed-time timer is only as truthful as this stamp, and
// `updateItem` is the one write path that can set it — hence its own block.
describe("updateItem — status_updated_at stamping", () => {
  it("restarts the clock on a quantity change", async () => {
    const { client, payloads } = createSupabaseMock();

    await useInventoryStore.getState().updateItem(client, "item-rice", { currentQuantity: 7 });

    expect(payloads[0]).toHaveProperty("status_updated_at");
  });

  it("restarts the clock on a ping", async () => {
    const { client, payloads } = createSupabaseMock();

    await useInventoryStore
      .getState()
      .updateItem(client, "item-rice", { statusOverride: "in_stock" });

    expect(payloads[0]).toHaveProperty("status_updated_at");
  });

  it("leaves the clock alone for an edit that touches neither", async () => {
    const { client, payloads } = createSupabaseMock();

    await useInventoryStore
      .getState()
      .updateItem(client, "item-rice", { name: "Sella Rice", minThreshold: 8 });

    expect(payloads[0]).not.toHaveProperty("status_updated_at");
  });

  it("writes an ISO timestamp the timer can parse", async () => {
    const { client, payloads } = createSupabaseMock();

    await useInventoryStore.getState().updateItem(client, "item-rice", { currentQuantity: 1 });

    const stamp = payloads[0].status_updated_at as string;
    expect(Number.isNaN(Date.parse(stamp))).toBe(false);
  });
});
