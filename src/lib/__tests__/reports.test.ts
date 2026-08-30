/// <reference types="jest" />

import { getEndOfDayRiyadhIso, riyadhDateTimeToIso } from "@/lib/reports";

describe("riyadhDateTimeToIso", () => {
  it("converts Riyadh wall-clock components to the equivalent UTC instant", () => {
    // 12 Jul 2026, 14:30 Riyadh (UTC+3) == 11:30 UTC the same day.
    expect(riyadhDateTimeToIso(2026, 7, 12, 14, 30)).toBe("2026-07-12T11:30:00.000Z");
  });

  it("stays within the same UTC calendar day for times after 03:00 Riyadh", () => {
    // 00:30 Riyadh == 21:30 UTC the PREVIOUS day.
    expect(riyadhDateTimeToIso(2026, 7, 12, 0, 30)).toBe("2026-07-11T21:30:00.000Z");
  });
});

describe("getEndOfDayRiyadhIso", () => {
  it("resolves to 23:59 Riyadh (20:59 UTC) on the given date", () => {
    expect(getEndOfDayRiyadhIso("2026-07-12")).toBe("2026-07-12T20:59:00.000Z");
  });
});
