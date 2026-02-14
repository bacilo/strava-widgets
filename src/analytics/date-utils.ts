/**
 * UTC date utility functions for analytics
 *
 * All functions use UTC methods exclusively for timezone safety.
 */

/**
 * Returns Monday 00:00:00 UTC of the given date's week.
 * Week starts on Monday (ISO 8601 standard).
 *
 * @param date - Date to get week start for
 * @returns Date object representing Monday 00:00:00 UTC
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getUTCDay();

  // Monday offset: if Sunday (0), go back 6 days; otherwise go back (dayOfWeek - 1) days
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(0, 0, 0, 0);

  return d;
}

/**
 * Returns first day of month at 00:00:00 UTC.
 *
 * @param date - Date to get month start for
 * @returns Date object representing first day of month at 00:00:00 UTC
 */
export function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns January 1st at 00:00:00 UTC.
 *
 * @param date - Date to get year start for
 * @returns Date object representing January 1st at 00:00:00 UTC
 */
export function getYearStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCMonth(0, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns human-readable "Week of M/D" format.
 *
 * @param isoDate - ISO 8601 date string
 * @returns Formatted string like "Week of 1/15"
 */
export function formatWeekLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const month = d.getUTCMonth() + 1; // 1-indexed
  const day = d.getUTCDate();
  return `Week of ${month}/${day}`;
}

/**
 * Returns "Jan 2024" format.
 *
 * @param isoDate - ISO 8601 date string
 * @returns Formatted string like "Jan 2024"
 */
export function formatMonthLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const month = monthNames[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${month} ${year}`;
}
