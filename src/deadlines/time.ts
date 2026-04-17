/**
 * Canonical time primitives per cc. 200–203.
 *
 *   c. 200 — Time is computed according to law unless law expressly states otherwise.
 *   c. 201 §1 — Continuous time admits no interruption.
 *   c. 201 §2 — Useful time is counted only when the person can exercise or pursue
 *               the right, so that if unaware or unable to act, time does not run.
 *   c. 202 §1 — A day is 24 hours continuously computed, beginning at midnight.
 *   c. 202 §2 — A week is 7 days, a month is 30 days, a year is 365 days unless
 *               month and year are said to be taken as they are in the calendar.
 *   c. 203 §1 — The day of commencement is NOT computed in the total.
 *   c. 203 §2 — Unless contrary expressly provided, the last day is computed at
 *               its end (i.e. the period runs through the end of the final day).
 *
 *   c. 1467 / DC art. 83 — If the last day for a judicial act falls on a day the
 *   tribunal is closed, the period is extended to the first following day the
 *   tribunal is open.
 */

import type { ISODate } from "../types/canonical.ts";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse an ISO date (YYYY-MM-DD) to a UTC Date at 00:00. */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) throw new Error(`Invalid ISO date: ${iso}`);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date: Date): ISODate {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Add N calendar days (24-hour periods per c. 202 §1). */
export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  return toISODate(new Date(d.getTime() + days * MS_PER_DAY));
}

/** c. 202 §2: month = 30 days unless expressly calendar. */
export function addCanonicalMonths(date: ISODate, months: number): ISODate {
  return addDays(date, months * 30);
}

/** c. 202 §2: year = 365 days unless expressly calendar. */
export function addCanonicalYears(date: ISODate, years: number): ISODate {
  return addDays(date, years * 365);
}

/** Days between two dates, end-exclusive. */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / MS_PER_DAY);
}

export function isBefore(a: ISODate, b: ISODate): boolean {
  return parseISODate(a).getTime() < parseISODate(b).getTime();
}

export function isAfter(a: ISODate, b: ISODate): boolean {
  return parseISODate(a).getTime() > parseISODate(b).getTime();
}

export function isSameDay(a: ISODate, b: ISODate): boolean {
  return a === b;
}

/**
 * Compute a canonical deadline's due date.
 *
 * Start date is the day of notification/trigger (e.g. date of publication of
 * sentence). Per c. 203 §1 that day does NOT count; the clock begins the day
 * after. Per c. 203 §2 the period runs to the END of its final day.
 *
 * For CONTINUOUS time, no calendar awareness is needed — just add N days.
 * For USEFUL time, callers must pass the set of "unavailable days" (days the
 * person cannot effectively exercise the right — e.g. tribunal closures when
 * the act can only be done at the tribunal, or periods the party was
 * documented as unaware/unable).
 *
 * Returns the last day on which the act is still timely.
 */
export interface ComputeDueDateArgs {
  startDate: ISODate;
  days: number;
  computation: "Continuous" | "Useful";
  /** Days on which useful time does NOT run (unavailable / closed / unaware). */
  unavailableDays?: Set<ISODate>;
}

export function computeDueDate({
  startDate,
  days,
  computation,
  unavailableDays,
}: ComputeDueDateArgs): ISODate {
  if (days <= 0) throw new Error("Deadline must be a positive number of days.");
  // c. 203 §1: the day of commencement is not computed. Start counting from day + 1.
  let cursor = addDays(startDate, 1);

  if (computation === "Continuous") {
    // Period is `days` days starting from day+1, last day inclusive.
    // If days = 15, we advance 14 more days from cursor (which is day+1).
    return addDays(cursor, days - 1);
  }

  // Useful time: consume `days` available days.
  let remaining = days;
  while (remaining > 0) {
    if (!unavailableDays || !unavailableDays.has(cursor)) {
      remaining -= 1;
      if (remaining === 0) return cursor;
    }
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

/**
 * c. 1467 / DC art. 83: if the final day of a judicial-act period falls on a
 * tribunal-closed day, the deadline is extended to the first following open day.
 *
 * This applies to acts that must be filed AT the tribunal. Purely continuous
 * legal-effect deadlines (e.g. a sentence becoming executive) are NOT extended.
 */
export function extendToFirstOpenDay(
  dueDate: ISODate,
  closedDays: Set<ISODate>,
): ISODate {
  let d = dueDate;
  while (closedDays.has(d)) {
    d = addDays(d, 1);
  }
  return d;
}

/** Build a set of closed-day strings from a calendar list. */
export function closedDaySet(
  entries: Array<{ date: ISODate; type: "Holiday" | "Closed" | "ReducedHours" }>,
): Set<ISODate> {
  const s = new Set<ISODate>();
  for (const e of entries) {
    if (e.type === "Holiday" || e.type === "Closed") s.add(e.date);
  }
  return s;
}
