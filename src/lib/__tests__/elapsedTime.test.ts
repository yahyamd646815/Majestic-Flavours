import { formatElapsedSince } from "@/lib/elapsedTime";

const BASE = "2026-09-01T12:00:00.000Z";
const BASE_MS = Date.parse(BASE);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatElapsedSince", () => {
  it("reads all zeroes at the moment the status changed", () => {
    expect(formatElapsedSince(BASE, BASE_MS)).toBe("00:00:00");
  });

  it("holds at zero for the rest of the first minute", () => {
    expect(formatElapsedSince(BASE, BASE_MS + 59 * 1000)).toBe("00:00:00");
  });

  it("counts whole minutes", () => {
    expect(formatElapsedSince(BASE, BASE_MS + 7 * MINUTE)).toBe("00:00:07");
  });

  it("rolls minutes into hours and hours into days", () => {
    expect(formatElapsedSince(BASE, BASE_MS + 3 * DAY + 4 * HOUR + 5 * MINUTE)).toBe("03:04:05");
  });

  it("carries a full day at exactly 24 hours", () => {
    expect(formatElapsedSince(BASE, BASE_MS + DAY)).toBe("01:00:00");
  });

  // Reports are kept for four months, so a long-untouched item is a real case,
  // not a hypothetical — the day field must grow rather than wrap.
  it("lets the day count run past two digits", () => {
    expect(formatElapsedSince(BASE, BASE_MS + 120 * DAY + 2 * HOUR)).toBe("120:02:00");
  });

  it("clamps a future timestamp to zero rather than going negative", () => {
    expect(formatElapsedSince(BASE, BASE_MS - 5 * HOUR)).toBe("00:00:00");
  });

  it("falls back to a same-shaped placeholder for an unreadable timestamp", () => {
    expect(formatElapsedSince("not a date", BASE_MS)).toBe("--:--:--");
  });

  // Postgres hands back `+00:00` offsets while a client write uses `Z`; both
  // describe the same instant and must read identically.
  it("treats an offset timestamp and a Z timestamp as the same instant", () => {
    expect(formatElapsedSince("2026-09-01T12:00:00+00:00", BASE_MS + HOUR)).toBe(
      formatElapsedSince(BASE, BASE_MS + HOUR),
    );
  });
});
