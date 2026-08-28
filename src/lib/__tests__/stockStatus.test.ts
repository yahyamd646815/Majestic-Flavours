import { getEffectiveStatus, type StockStatus } from "@/lib/stockStatus";

function makeItem(overrides: {
  currentQuantity: number;
  minThreshold: number;
  statusOverride?: StockStatus | null;
}) {
  return {
    currentQuantity: overrides.currentQuantity,
    minThreshold: overrides.minThreshold,
    statusOverride: overrides.statusOverride ?? null,
  };
}

describe("getEffectiveStatus", () => {
  describe("without an override", () => {
    it("is out of stock at zero", () => {
      expect(getEffectiveStatus(makeItem({ currentQuantity: 0, minThreshold: 5 }))).toBe(
        "out_of_stock",
      );
    });

    it("is low stock at exactly the threshold", () => {
      expect(getEffectiveStatus(makeItem({ currentQuantity: 5, minThreshold: 5 }))).toBe(
        "low_stock",
      );
    });

    it("is low stock below the threshold", () => {
      expect(getEffectiveStatus(makeItem({ currentQuantity: 2, minThreshold: 5 }))).toBe(
        "low_stock",
      );
    });

    it("is in stock above the threshold", () => {
      expect(getEffectiveStatus(makeItem({ currentQuantity: 6, minThreshold: 5 }))).toBe(
        "in_stock",
      );
    });

    it("treats zero as out of stock even when the threshold is also zero", () => {
      expect(getEffectiveStatus(makeItem({ currentQuantity: 0, minThreshold: 0 }))).toBe(
        "out_of_stock",
      );
    });
  });

  describe("with an override", () => {
    it("reports out of stock despite a full quantity", () => {
      expect(
        getEffectiveStatus(
          makeItem({ currentQuantity: 50, minThreshold: 5, statusOverride: "out_of_stock" }),
        ),
      ).toBe("out_of_stock");
    });

    it("reports in stock despite a zero quantity", () => {
      expect(
        getEffectiveStatus(
          makeItem({ currentQuantity: 0, minThreshold: 5, statusOverride: "in_stock" }),
        ),
      ).toBe("in_stock");
    });

    it("reports low stock despite a quantity above the threshold", () => {
      expect(
        getEffectiveStatus(
          makeItem({ currentQuantity: 40, minThreshold: 5, statusOverride: "low_stock" }),
        ),
      ).toBe("low_stock");
    });
  });

  it("falls back to the quantity once the override is cleared", () => {
    const pinged = makeItem({
      currentQuantity: 20,
      minThreshold: 5,
      statusOverride: "out_of_stock",
    });
    expect(getEffectiveStatus(pinged)).toBe("out_of_stock");
    expect(getEffectiveStatus({ ...pinged, statusOverride: null })).toBe("in_stock");
  });
});
