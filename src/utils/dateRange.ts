/**
 * src/utils/dateRange.ts
 *
 * Utilities for working with IST (Asia/Kolkata) calendar-day ranges and
 * parsing optional date query parameters from Express route handlers.
 *
 * Ranges are returned as { start: Date; end: Date } where start is inclusive
 * and end is exclusive; pass directly to Mongo as { createdAt: { $gte: start, $lt: end } }.
 */

export const IST_TZ = 'Asia/Kolkata';
export const IST_OFFSET = '+05:30';

export interface DateRange {
  /** inclusive UTC start */
  start: Date;
  /** exclusive UTC end */
  end: Date;
}

/** YYYY-MM-DD basic validation. */
export function isYmd(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

/**
 * Convert a YYYY-MM-DD string (interpreted in IST) to the equivalent UTC Date
 * at that day's midnight in IST.
 *
 * We build an ISO timestamp with the explicit +05:30 offset so the JS engine
 * can parse and normalize to UTC reliably.
 */
export function istMidnightToUtc(ymd: string): Date | null {
  if (!isYmd(ymd)) return null;
  const d = new Date(`${ymd}T00:00:00${IST_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Given a UTC Date, return a new UTC Date advanced by N whole days.
 * (Used to build an exclusive end bound.)
 */
export function addUtcDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * Build a 1-day IST range for the given YYYY-MM-DD.
 */
export function istDayRange(ymd: string): DateRange | null {
  const start = istMidnightToUtc(ymd);
  if (!start) return null;
  const end = addUtcDays(start, 1);
  return { start, end };
}

/**
 * Build an IST range from startYmd .. endYmd *inclusive* of both days.
 * We emit start-of-start day and start-of-(day after end) to keep an exclusive end.
 */
export function istSpanRange(startYmd: string, endYmd: string): DateRange | null {
  const start = istMidnightToUtc(startYmd);
  const endStart = istMidnightToUtc(endYmd);
  if (!start || !endStart) return null;
  // exclusive end = endStart + 1 day
  const end = addUtcDays(endStart, 1);
  return { start, end };
}

/**
 * Return today's IST date as YYYY-MM-DD by using Intl.DateTimeFormat
 * to format a UTC "now" instant in the Asia/Kolkata zone and reading its parts.
 */
export function todayIstYmd(): string {
  const now = Date.now();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year')?.value ?? '0000';
  const m = parts.find(p => p.type === 'month')?.value ?? '01';
  const d = parts.find(p => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

/**
 * Convenience: last N IST calendar days ending *today* (inclusive).
 * e.g., lastNDaysIst(7) gives a 7-day window that includes today and the 6
 * preceding days. Default N=1 => today only.
 */
export function lastNDaysIst(n: number = 1): DateRange {
  const today = todayIstYmd();
  const end = istMidnightToUtc(today)!;          // start of today
  const start = addUtcDays(end, -n + 1);         // go back n-1 days
  const exclusiveEnd = addUtcDays(end, 1);       // end of today
  // When n==1, start=end, exclusiveEnd=end+1d => one-day range.
  return { start, end: exclusiveEnd, ...(n > 1 ? {} : {}) };
}

/**
 * Parse typical query params used in our routes:
 *   ?date=YYYY-MM-DD                // exactly one IST day
 *   ?start=YYYY-MM-DD&end=YYYY-MM-DD // multi-day span (inclusive)
 * If neither present, returns undefined (caller can decide default window).
 *
 * Invalid params => undefined.
 */
export function rangeFromQuery(
  query: Record<string, unknown>
): DateRange | undefined {
  const date = typeof query.date === 'string' ? query.date : undefined;
  const start = typeof query.start === 'string' ? query.start : undefined;
  const end = typeof query.end === 'string' ? query.end : undefined;

  // single-day takes precedence if supplied
  if (date) {
    const r = istDayRange(date);
    return r ?? undefined;
  }

  if (start && end) {
    const r = istSpanRange(start, end);
    return r ?? undefined;
  }

  return undefined;
}

/**
 * High-level helper used by routes:
 *  1. Try to derive a range from query (?date= or ?start=&end=).
 *  2. If absent, optionally fall back to N most recent IST days (defaultDaySpan).
 *  3. If defaultDaySpan is 0/undefined, return undefined (no range filter).
 */
export function resolveDateRange(
  query: Record<string, unknown>,
  defaultDaySpan: number | undefined = undefined
): DateRange | undefined {
  const r = rangeFromQuery(query);
  if (r) return r;

  if (defaultDaySpan && defaultDaySpan > 0) {
    return lastNDaysIst(defaultDaySpan);
  }

  return undefined;
}
