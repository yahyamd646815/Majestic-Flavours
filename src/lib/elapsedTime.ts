/** Shown when a timestamp can't be read at all — a placeholder of the same
 * shape as a real reading, so the card layout never shifts. */
const UNKNOWN_ELAPSED = "--:--:--";

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * How long ago `sinceIso` was, as `DD:HH:MM`.
 *
 * `nowMs` is passed in rather than read from `Date.now()` inside so the caller
 * controls when the value moves — see `useNowTick` for why that matters.
 *
 * Days are never truncated: an item untouched for four months reads `120:…`,
 * not a wrapped-around two digits. A timestamp in the future (a device clock
 * running behind the server's) clamps to `00:00:00` rather than showing a
 * negative reading.
 */
export function formatElapsedSince(sinceIso: string, nowMs: number): string {
  const sinceMs = Date.parse(sinceIso);
  if (Number.isNaN(sinceMs)) return UNKNOWN_ELAPSED;

  const totalMinutes = Math.floor(Math.max(0, nowMs - sinceMs) / MS_PER_MINUTE);
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  return `${pad(days)}:${pad(hours)}:${pad(minutes)}`;
}
