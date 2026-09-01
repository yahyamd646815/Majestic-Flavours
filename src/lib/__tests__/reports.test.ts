/// <reference types="jest" />

import { getEndOfDayRiyadhIso, getRiyadhIsoDate, riyadhDateTimeToIso } from "@/lib/reports";

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

describe("getRiyadhIsoDate", () => {
  it("reads the Riyadh calendar date of a UTC instant", () => {
    // 11:30 UTC on 12 Jul is 14:30 Riyadh the same day.
    expect(getRiyadhIsoDate(Date.parse("2026-07-12T11:30:00.000Z"))).toBe("2026-07-12");
  });

  it("rolls forward into the next Riyadh day for a late-UTC instant", () => {
    // 21:30 UTC on 11 Jul is already 00:30 on 12 Jul in Riyadh.
    expect(getRiyadhIsoDate(Date.parse("2026-07-11T21:30:00.000Z"))).toBe("2026-07-12");
  });
});
