import { getStatusPickerSlots, STATUS_PICKER_ORDER } from "@/lib/statusPicker";

describe("getStatusPickerSlots", () => {
  it("always lists In Stock, Low Stock, Out of Stock top to bottom", () => {
    for (const current of STATUS_PICKER_ORDER) {
      expect(getStatusPickerSlots(current).map((slot) => slot.status)).toEqual([
        "in_stock",
        "low_stock",
        "out_of_stock",
      ]);
    }
  });

  it("puts In Stock above and Out of Stock below a Low Stock item", () => {
    const slots = getStatusPickerSlots("low_stock");
    expect(slots.map((slot) => slot.position)).toEqual(["above", "current", "below"]);
  });

  it("puts both other options above an Out of Stock item", () => {
    const slots = getStatusPickerSlots("out_of_stock");
    expect(slots.map((slot) => slot.position)).toEqual(["above", "above", "current"]);
  });

  it("puts both other options below an In Stock item", () => {
    const slots = getStatusPickerSlots("in_stock");
    expect(slots.map((slot) => slot.position)).toEqual(["current", "below", "below"]);
  });

  it("marks exactly the current slot as current and not selectable", () => {
    for (const current of STATUS_PICKER_ORDER) {
      const slots = getStatusPickerSlots(current);
      const currentSlots = slots.filter((slot) => slot.isCurrent);
      expect(currentSlots).toHaveLength(1);
      expect(currentSlots[0].status).toBe(current);
      expect(slots.filter((slot) => slot.isSelectable).map((slot) => slot.status)).toEqual(
        STATUS_PICKER_ORDER.filter((status) => status !== current),
      );
    }
  });
});
