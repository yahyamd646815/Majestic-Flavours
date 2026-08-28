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

    expect(payloads[0]).toEqual({ current_quantity: 3, status_override: null });
  });

  it("sets the override without touching the quantity when only a status is pinged", async () => {
    const { client, payloads } = createSupabaseMock();

    await useInventoryStore
      .getState()
      .updateItem(client, "item-rice", { statusOverride: "out_of_stock" });

    expect(payloads[0]).toEqual({ status_override: "out_of_stock" });
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

    expect(payloads[0]).toEqual({ current_quantity: 0, status_override: "low_stock" });
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

    expect(payloads[0]).toEqual({ status_override: null });
  });
});
