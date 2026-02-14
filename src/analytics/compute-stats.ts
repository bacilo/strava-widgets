/**
 * Statistics computation engine
 *
 * Reads activity JSON files, computes weekly/monthly/yearly aggregations,
 * and writes pre-generated static JSON files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { StravaActivity } from '../types/strava.types.js';
import type {
  WeeklyStats,
  AllTimeTotals,
  PeriodStats,
  StatsMetadata,
} from '../types/analytics.types.js';
import {
  getWeekStart,
  getMonthStart,
  getYearStart,
  formatMonthLabel,
} from './date-utils.js';

interface ComputeStatsOptions {
  activitiesDir?: string;
  statsDir?: string;
}

/**
 * Compute all statistics from activity files
 *
 * @param options - Configuration options for directories
 */
export async function computeAllStats(
  options: ComputeStatsOptions = {}
): Promise<void> {
  const activitiesDir = options.activitiesDir || 'data/activities';
  const statsDir = options.statsDir || 'data/stats';

  console.log(`Reading activities from: ${activitiesDir}`);

  // 1. Load all activity files
  const files = await fs.readdir(activitiesDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const activities: StravaActivity[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(activitiesDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const activity = JSON.parse(content) as StravaActivity;

    // Filter to only include Run activities
    if (activity.type === 'Run') {
      activities.push(activity);
    }
  }

  console.log(`Loaded ${activities.length} run activities from ${jsonFiles.length} files`);

  if (activities.length === 0) {
    console.log('No activities to process');
    return;
  }

  // 2. Sort activities by start_date ascending
  activities.sort((a, b) => {
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  });

  // 3. Compute weekly stats
  const weeklyMap = new Map<string, {
    totalKm: number;
    runCount: number;
    totalMovingTimeSec: number;
    totalDistanceMeters: number;
    elevationGain: number;
  }>();

  for (const activity of activities) {
    const activityDate = new Date(activity.start_date);
    const weekStart = getWeekStart(activityDate);
    const weekStartISO = weekStart.toISOString();

    const existing = weeklyMap.get(weekStartISO) || {
      totalKm: 0,
      runCount: 0,
      totalMovingTimeSec: 0,
      totalDistanceMeters: 0,
      elevationGain: 0,
    };

    existing.totalDistanceMeters += activity.distance;
    existing.totalKm += activity.distance / 1000;
    existing.runCount += 1;
    existing.totalMovingTimeSec += activity.moving_time;
    existing.elevationGain += activity.total_elevation_gain;

    weeklyMap.set(weekStartISO, existing);
  }

  const weeklyStats: WeeklyStats[] = Array.from(weeklyMap.entries())
    .map(([weekStartISO, stats]) => ({
      weekStartISO,
      totalKm: stats.totalKm,
      runCount: stats.runCount,
      avgPaceMinPerKm:
        stats.totalDistanceMeters > 0
          ? (stats.totalMovingTimeSec / 60) / (stats.totalDistanceMeters / 1000)
          : 0,
      elevationGain: stats.elevationGain,
      totalMovingTimeMin: stats.totalMovingTimeSec / 60,
    }))
    .sort((a, b) => a.weekStartISO.localeCompare(b.weekStartISO));

  // 4. Compute all-time totals
  let totalKm = 0;
  let totalRuns = 0;
  let totalMovingTimeSec = 0;
  let totalDistanceMeters = 0;
  let totalElevation = 0;
  let firstActivityDate = activities[0].start_date;
  let lastActivityDate = activities[activities.length - 1].start_date;

  for (const activity of activities) {
    totalDistanceMeters += activity.distance;
    totalKm += activity.distance / 1000;
    totalRuns += 1;
    totalMovingTimeSec += activity.moving_time;
    totalElevation += activity.total_elevation_gain;
  }

  const allTimeTotals: AllTimeTotals = {
    totalKm,
    totalRuns,
    totalHours: totalMovingTimeSec / 3600,
    totalElevation,
    avgPaceMinPerKm:
      totalDistanceMeters > 0
        ? (totalMovingTimeSec / 60) / (totalDistanceMeters / 1000)
        : 0,
    firstActivityDate,
    lastActivityDate,
    generatedAt: new Date().toISOString(),
  };

  // 5. Compute monthly stats
  const monthlyMap = new Map<string, {
    totalKm: number;
    runCount: number;
    totalMovingTimeSec: number;
    totalDistanceMeters: number;
    elevationGain: number;
  }>();

  for (const activity of activities) {
    const activityDate = new Date(activity.start_date);
    const monthStart = getMonthStart(activityDate);
    const monthStartISO = monthStart.toISOString();

    const existing = monthlyMap.get(monthStartISO) || {
      totalKm: 0,
      runCount: 0,
      totalMovingTimeSec: 0,
      totalDistanceMeters: 0,
      elevationGain: 0,
    };

    existing.totalDistanceMeters += activity.distance;
    existing.totalKm += activity.distance / 1000;
    existing.runCount += 1;
    existing.totalMovingTimeSec += activity.moving_time;
    existing.elevationGain += activity.total_elevation_gain;

    monthlyMap.set(monthStartISO, existing);
  }

  const monthlyStats: PeriodStats[] = Array.from(monthlyMap.entries())
    .map(([periodStart, stats]) => ({
      periodStart,
      periodLabel: formatMonthLabel(periodStart),
      totalKm: stats.totalKm,
      runCount: stats.runCount,
      avgPaceMinPerKm:
        stats.totalDistanceMeters > 0
          ? (stats.totalMovingTimeSec / 60) / (stats.totalDistanceMeters / 1000)
          : 0,
      elevationGain: stats.elevationGain,
      totalMovingTimeMin: stats.totalMovingTimeSec / 60,
    }))
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));

  // Compute yearly stats
  const yearlyMap = new Map<string, {
    totalKm: number;
    runCount: number;
    totalMovingTimeSec: number;
    totalDistanceMeters: number;
    elevationGain: number;
  }>();

  for (const activity of activities) {
    const activityDate = new Date(activity.start_date);
    const yearStart = getYearStart(activityDate);
    const yearStartISO = yearStart.toISOString();

    const existing = yearlyMap.get(yearStartISO) || {
      totalKm: 0,
      runCount: 0,
      totalMovingTimeSec: 0,
      totalDistanceMeters: 0,
      elevationGain: 0,
    };

    existing.totalDistanceMeters += activity.distance;
    existing.totalKm += activity.distance / 1000;
    existing.runCount += 1;
    existing.totalMovingTimeSec += activity.moving_time;
    existing.elevationGain += activity.total_elevation_gain;

    yearlyMap.set(yearStartISO, existing);
  }

  const yearlyStats: PeriodStats[] = Array.from(yearlyMap.entries())
    .map(([periodStart, stats]) => {
      const year = new Date(periodStart).getUTCFullYear().toString();
      return {
        periodStart,
        periodLabel: year,
        totalKm: stats.totalKm,
        runCount: stats.runCount,
        avgPaceMinPerKm:
          stats.totalDistanceMeters > 0
            ? (stats.totalMovingTimeSec / 60) / (stats.totalDistanceMeters / 1000)
            : 0,
        elevationGain: stats.elevationGain,
        totalMovingTimeMin: stats.totalMovingTimeSec / 60,
      };
    })
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));

  // 6. Write output files
  await fs.mkdir(statsDir, { recursive: true });

  const outputFiles = [
    'weekly-distance.json',
    'all-time-totals.json',
    'monthly-stats.json',
    'yearly-stats.json',
    'metadata.json',
  ];

  await fs.writeFile(
    path.join(statsDir, 'weekly-distance.json'),
    JSON.stringify(weeklyStats, null, 2),
    'utf-8'
  );

  await fs.writeFile(
    path.join(statsDir, 'all-time-totals.json'),
    JSON.stringify(allTimeTotals, null, 2),
    'utf-8'
  );

  await fs.writeFile(
    path.join(statsDir, 'monthly-stats.json'),
    JSON.stringify(monthlyStats, null, 2),
    'utf-8'
  );

  await fs.writeFile(
    path.join(statsDir, 'yearly-stats.json'),
    JSON.stringify(yearlyStats, null, 2),
    'utf-8'
  );

  const metadata: StatsMetadata = {
    generatedAt: new Date().toISOString(),
    activityCount: activities.length,
    dateRange: {
      from: firstActivityDate,
      to: lastActivityDate,
    },
    files: outputFiles,
  };

  await fs.writeFile(
    path.join(statsDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );

  console.log(`\nGenerated statistics:`);
  console.log(`- ${weeklyStats.length} weeks of data`);
  console.log(`- ${monthlyStats.length} months of data`);
  console.log(`- ${yearlyStats.length} years of data`);
  console.log(`- All-time totals: ${totalRuns} runs, ${totalKm.toFixed(2)} km`);
  console.log(`\nOutput written to: ${statsDir}`);
}
