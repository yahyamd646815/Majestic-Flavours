import { useEffect, useState } from "react";

/** A minute — fine-grained enough for every "is this overdue yet?" question in
 * the app, and coarse enough that a screen sitting open costs nothing. */
export const ONE_MINUTE_MS = 60 * 1000;

/**
 * The current time, re-read on an interval so whatever renders it re-renders as
 * time passes.
 *
 * Nothing else in the app makes a screen re-render just because the clock
 * moved, so anything derived from "now" — a task's Overdue badge, the
 * overdue-first sort, Riyadh's notion of today — otherwise stays frozen at
 * whatever it was when that screen last rendered for some unrelated reason.
 *
 * Pass the returned value explicitly into the helpers that need it
 * (`isTaskPastDue(task, nowMs)`, not `isTaskPastDue(task)`): their own
 * `Date.now()` default is read during render and so is invisible to React,
 * which means a re-render is not by itself enough to move it.
 */
export function useNowTick(intervalMs: number): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return nowMs;
}
