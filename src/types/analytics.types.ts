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
