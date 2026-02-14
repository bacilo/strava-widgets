/**
 * Analytics type definitions for statistics computation
 */

/**
 * Weekly aggregation for bar chart data
 */
export interface WeeklyStats {
  weekStartISO: string;   // ISO 8601 Monday UTC (e.g., "2024-01-01T00:00:00.000Z")
  totalKm: number;        // Total distance in km
  runCount: number;        // Number of runs
  avgPaceMinPerKm: number; // Average pace in min/km (total_time/total_distance)
  elevationGain: number;   // Total elevation gain in meters
  totalMovingTimeMin: number; // Total moving time in minutes
}

/**
 * All-time cumulative totals
 */
export interface AllTimeTotals {
  totalKm: number;
  totalRuns: number;
  totalHours: number;      // Total moving time in hours
  totalElevation: number;  // Total elevation gain in meters
  avgPaceMinPerKm: number; // Overall average pace
  firstActivityDate: string; // ISO date of earliest activity
  lastActivityDate: string;  // ISO date of latest activity
  generatedAt: string;       // ISO timestamp of computation
}

/**
 * Per-period stats (reusable for monthly/yearly)
 */
export interface PeriodStats {
  periodStart: string;     // ISO date
  periodLabel: string;     // Human-readable label (e.g., "Jan 2024", "2024")
  totalKm: number;
  runCount: number;
  avgPaceMinPerKm: number;
  elevationGain: number;
  totalMovingTimeMin: number;
}

/**
 * Metadata about the generated stats
 */
export interface StatsMetadata {
  generatedAt: string;
  activityCount: number;
  dateRange: { from: string; to: string };
  files: string[];
}

// Year-over-year monthly comparison
export interface YearOverYearMonth {
  month: number;        // 1-12
  monthLabel: string;   // "Jan", "Feb", ...
  years: Record<string, { totalKm: number; totalRuns: number; totalHours: number }>;
}

// Time-of-day pattern
export interface TimeOfDayPattern {
  period: string;       // "Morning (6am-12pm)", "Afternoon (12pm-6pm)", "Evening (6pm-10pm)", "Night (10pm-6am)"
  runCount: number;
  totalKm: number;
  percentage: number;   // % of total runs
}

// Seasonal trends (monthly volume per year)
export interface SeasonalTrendMonth {
  year: number;
  month: number;        // 1-12
  totalKm: number;
  totalRuns: number;
  totalHours: number;
}

// Streak data (output from streak-utils, stored in JSON)
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  withinCurrentStreak: boolean;
  currentStreakStart: string;
  longestStreakStart: string;
  longestStreakEnd: string;
  weeklyConsistency: {
    currentStreak: number;
    longestStreak: number;
    totalConsistentWeeks: number;
    totalWeeks: number;
    minRunsPerWeek: number;
  };
}
