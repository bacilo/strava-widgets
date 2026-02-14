/**
 * Streak calculation utilities for running analytics
 *
 * All functions use UTC methods exclusively for timezone safety.
 */

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

export function calculateDailyStreaks(activityDates: Date[]): StreakResult {
  // Stub implementation - tests should fail
  return {
    currentStreak: 0,
    longestStreak: 0,
    withinCurrentStreak: false,
    currentStreakStart: null,
    longestStreakStart: null,
    longestStreakEnd: null,
  };
}

export function calculateWeeklyConsistency(
  activityDates: Date[],
  minRunsPerWeek: number = 3
): WeeklyConsistencyResult {
  // Stub implementation - tests should fail
  return {
    currentConsistencyStreak: 0,
    longestConsistencyStreak: 0,
    totalConsistentWeeks: 0,
    totalWeeks: 0,
  };
}
