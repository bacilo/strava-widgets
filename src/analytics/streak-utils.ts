/**
 * Streak calculation utilities for running analytics
 *
 * All functions use UTC methods exclusively for timezone safety.
 */

import { getWeekStart } from './date-utils.js';

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  withinCurrentStreak: boolean;
  currentStreakStart: Date | null;
  longestStreakStart: Date | null;
  longestStreakEnd: Date | null;
}

export interface WeeklyConsistencyResult {
  currentConsistencyStreak: number;
  longestConsistencyStreak: number;
  totalConsistentWeeks: number;
  totalWeeks: number;
}

/**
 * Normalizes date to UTC midnight
 */
function normalizeToUTCMidnight(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Converts Date to YYYY-MM-DD string in UTC
 */
function dateToUTCString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates daily running streaks from activity dates
 */
export function calculateDailyStreaks(activityDates: Date[]): StreakResult {
  if (activityDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      withinCurrentStreak: false,
      currentStreakStart: null,
      longestStreakStart: null,
      longestStreakEnd: null,
    };
  }

  // Normalize and deduplicate dates
  const uniqueDates = new Set<string>();
  for (const date of activityDates) {
    const normalized = normalizeToUTCMidnight(date);
    uniqueDates.add(dateToUTCString(normalized));
  }

  // Sort dates ascending
  const sortedDates = Array.from(uniqueDates)
    .map(s => new Date(s + 'T00:00:00Z'))
    .sort((a, b) => a.getTime() - b.getTime());

  // Track streaks
  let currentStreak = 1;
  let longestStreak = 1;
  let currentStreakStart = sortedDates[0];
  let longestStreakStart = sortedDates[0];
  let longestStreakEnd = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = sortedDates[i - 1];
    const currDate = sortedDates[i];
    const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);

    if (daysDiff === 1) {
      // Consecutive day
      currentStreak++;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
        longestStreakStart = currentStreakStart;
        longestStreakEnd = currDate;
      }
    } else {
      // Streak broken
      currentStreak = 1;
      currentStreakStart = currDate;
    }
  }

  // Update longest streak if final streak is longest
  if (currentStreak === longestStreak) {
    longestStreakEnd = sortedDates[sortedDates.length - 1];
  }

  // Determine if within current streak
  const lastActivityDate = sortedDates[sortedDates.length - 1];
  const today = normalizeToUTCMidnight(new Date());
  const daysSinceLastActivity = Math.round((today.getTime() - lastActivityDate.getTime()) / 86400000);
  const withinCurrentStreak = daysSinceLastActivity <= 1;

  // If not within current streak, reset current streak to 0
  const finalCurrentStreak = withinCurrentStreak ? currentStreak : 0;

  return {
    currentStreak: finalCurrentStreak,
    longestStreak,
    withinCurrentStreak,
    currentStreakStart: withinCurrentStreak ? currentStreakStart : null,
    longestStreakStart,
    longestStreakEnd,
  };
}

/**
 * Calculates weekly consistency streaks
 */
export function calculateWeeklyConsistency(
  activityDates: Date[],
  minRunsPerWeek: number = 3
): WeeklyConsistencyResult {
  if (activityDates.length === 0) {
    return {
      currentConsistencyStreak: 0,
      longestConsistencyStreak: 0,
      totalConsistentWeeks: 0,
      totalWeeks: 0,
    };
  }

  // Group dates by ISO week (Monday start)
  const weekMap = new Map<string, number>();
  for (const date of activityDates) {
    const weekStart = getWeekStart(date);
    const weekKey = dateToUTCString(weekStart);
    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
  }

  // Sort weeks chronologically
  const weeks = Array.from(weekMap.entries())
    .map(([weekKey, count]) => ({
      weekStart: new Date(weekKey + 'T00:00:00Z'),
      count,
      meetsThreshold: count >= minRunsPerWeek,
    }))
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  if (weeks.length === 0) {
    return {
      currentConsistencyStreak: 0,
      longestConsistencyStreak: 0,
      totalConsistentWeeks: 0,
      totalWeeks: 0,
    };
  }

  // Calculate streaks
  let currentConsistencyStreak = 0;
  let longestConsistencyStreak = 0;
  let totalConsistentWeeks = 0;
  let consecutiveCount = 0;

  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];

    if (week.meetsThreshold) {
      totalConsistentWeeks++;

      // Check if consecutive with previous week
      if (i === 0) {
        consecutiveCount = 1;
      } else {
        const prevWeek = weeks[i - 1];
        const weeksDiff = Math.round(
          (week.weekStart.getTime() - prevWeek.weekStart.getTime()) / (7 * 86400000)
        );

        if (weeksDiff === 1 && prevWeek.meetsThreshold) {
          consecutiveCount++;
        } else if (weeksDiff === 1 && !prevWeek.meetsThreshold) {
          consecutiveCount = 1;
        } else {
          consecutiveCount = 1;
        }
      }

      if (consecutiveCount > longestConsistencyStreak) {
        longestConsistencyStreak = consecutiveCount;
      }

      // Last week becomes current streak if it ends close to now
      if (i === weeks.length - 1) {
        currentConsistencyStreak = consecutiveCount;
      }
    } else {
      consecutiveCount = 0;
      if (i === weeks.length - 1) {
        currentConsistencyStreak = 0;
      }
    }
  }

  return {
    currentConsistencyStreak,
    longestConsistencyStreak,
    totalConsistentWeeks,
    totalWeeks: weeks.length,
  };
}
