/**
 * Advanced statistics computation engine
 *
 * Computes year-over-year comparisons, time-of-day patterns, and seasonal trends
 * from activity data and outputs as static JSON files for widget consumption.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { StravaActivity } from '../types/strava.types.js';
import type {
  YearOverYearMonth,
  TimeOfDayPattern,
  SeasonalTrendMonth,
  StreakData,
} from '../types/analytics.types.js';

interface ComputeAdvancedStatsOptions {
  activitiesDir?: string;
  statsDir?: string;
}

/**
 * Compute advanced statistics from activity files
 *
 * @param options - Configuration options for directories
 */
export async function computeAdvancedStats(
  options: ComputeAdvancedStatsOptions = {}
): Promise<void> {
  const activitiesDir = options.activitiesDir || 'data/activities';
  const statsDir = options.statsDir || 'data/stats';

  console.log(`Computing advanced statistics from: ${activitiesDir}`);

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

  console.log(`Processing ${activities.length} run activities`);

  if (activities.length === 0) {
    console.log('No activities to process');
    return;
  }

  // 2. Sort activities by start_date ascending
  activities.sort((a, b) => {
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  });

  // 3. Compute year-over-year data
  const yearMonthMap = new Map<
    number,
    Map<string, { totalKm: number; totalRuns: number; totalHours: number }>
  >();

  for (const activity of activities) {
    const activityDate = new Date(activity.start_date);
    const year = activityDate.getUTCFullYear().toString();
    const month = activityDate.getUTCMonth() + 1; // 1-12

    if (!yearMonthMap.has(month)) {
      yearMonthMap.set(month, new Map());
    }

    const monthMap = yearMonthMap.get(month)!;
    const existing = monthMap.get(year) || {
      totalKm: 0,
      totalRuns: 0,
      totalHours: 0,
    };

    existing.totalKm += activity.distance / 1000;
    existing.totalRuns += 1;
    existing.totalHours += activity.moving_time / 3600;

    monthMap.set(year, existing);
  }

  // Get the 3 most recent years with data
  const allYears = new Set<string>();
  for (const monthMap of yearMonthMap.values()) {
    for (const year of monthMap.keys()) {
      allYears.add(year);
    }
  }
  const sortedYears = Array.from(allYears).sort().slice(-3);

  // Build year-over-year output with all 12 months pre-filled
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yearOverYearData: YearOverYearMonth[] = [];

  for (let month = 1; month <= 12; month++) {
    const monthData: YearOverYearMonth = {
      month,
      monthLabel: monthLabels[month - 1],
      years: {},
    };

    // Pre-fill all years with zeros
    for (const year of sortedYears) {
      monthData.years[year] = { totalKm: 0, totalRuns: 0, totalHours: 0 };
    }

    // Fill in actual data if it exists
    const monthMap = yearMonthMap.get(month);
    if (monthMap) {
      for (const year of sortedYears) {
        const data = monthMap.get(year);
        if (data) {
          monthData.years[year] = data;
        }
      }
    }

    yearOverYearData.push(monthData);
  }

  // 4. Compute time-of-day patterns
  const timeOfDayBuckets = {
    'Morning (6am-12pm)': { runCount: 0, totalKm: 0 },
    'Afternoon (12pm-6pm)': { runCount: 0, totalKm: 0 },
    'Evening (6pm-10pm)': { runCount: 0, totalKm: 0 },
    'Night (10pm-6am)': { runCount: 0, totalKm: 0 },
  };

  for (const activity of activities) {
    const activityDate = new Date(activity.start_date);
    const hour = activityDate.getUTCHours();

    let bucket: keyof typeof timeOfDayBuckets;
    if (hour >= 6 && hour < 12) {
      bucket = 'Morning (6am-12pm)';
    } else if (hour >= 12 && hour < 18) {
      bucket = 'Afternoon (12pm-6pm)';
    } else if (hour >= 18 && hour < 22) {
      bucket = 'Evening (6pm-10pm)';
    } else {
      bucket = 'Night (10pm-6am)';
    }

    timeOfDayBuckets[bucket].runCount += 1;
    timeOfDayBuckets[bucket].totalKm += activity.distance / 1000;
  }

  const totalRuns = activities.length;
  const timeOfDayData: TimeOfDayPattern[] = Object.entries(timeOfDayBuckets).map(
    ([period, stats]) => ({
      period,
      runCount: stats.runCount,
      totalKm: stats.totalKm,
      percentage: (stats.runCount / totalRuns) * 100,
    })
  );

  // 5. Compute seasonal trends (monthly volume per year)
  const seasonalMap = new Map<
    string,
    { year: number; month: number; totalKm: number; totalRuns: number; totalHours: number }
  >();

  for (const activity of activities) {
    const activityDate = new Date(activity.start_date);
    const year = activityDate.getUTCFullYear();
    const month = activityDate.getUTCMonth() + 1; // 1-12
    const key = `${year}-${month}`;

    const existing = seasonalMap.get(key) || {
      year,
      month,
      totalKm: 0,
      totalRuns: 0,
      totalHours: 0,
    };

    existing.totalKm += activity.distance / 1000;
    existing.totalRuns += 1;
    existing.totalHours += activity.moving_time / 3600;

    seasonalMap.set(key, existing);
  }

  // Filter to 3 most recent years
  const seasonalTrendsData: SeasonalTrendMonth[] = Array.from(seasonalMap.values())
    .filter((entry) => sortedYears.includes(entry.year.toString()))
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

  // 6. Write placeholder streaks.json (will be updated by Plan 03+)
  const placeholderStreaks: StreakData = {
    currentStreak: 0,
    longestStreak: 0,
    withinCurrentStreak: false,
    currentStreakStart: '',
    longestStreakStart: '',
    longestStreakEnd: '',
    weeklyConsistency: {
      currentStreak: 0,
      longestStreak: 0,
      totalConsistentWeeks: 0,
      totalWeeks: 0,
      minRunsPerWeek: 3,
    },
  };

  // 7. Write output files
  await fs.mkdir(statsDir, { recursive: true });

  await fs.writeFile(
    path.join(statsDir, 'year-over-year.json'),
    JSON.stringify(yearOverYearData, null, 2),
    'utf-8'
  );

  await fs.writeFile(
    path.join(statsDir, 'time-of-day.json'),
    JSON.stringify(timeOfDayData, null, 2),
    'utf-8'
  );

  await fs.writeFile(
    path.join(statsDir, 'seasonal-trends.json'),
    JSON.stringify(seasonalTrendsData, null, 2),
    'utf-8'
  );

  await fs.writeFile(
    path.join(statsDir, 'streaks.json'),
    JSON.stringify(placeholderStreaks, null, 2),
    'utf-8'
  );

  console.log(`\nGenerated advanced statistics:`);
  console.log(`- Year-over-year: 12 months across ${sortedYears.length} years`);
  console.log(`- Time-of-day: 4 buckets`);
  console.log(`- Seasonal trends: ${seasonalTrendsData.length} month entries`);
  console.log(`- Streaks: placeholder (will be computed in Plan 03+)`);
  console.log(`\nOutput written to: ${statsDir}`);
}
