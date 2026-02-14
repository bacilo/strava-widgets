import { describe, it, expect } from 'vitest';
import { calculateDailyStreaks, calculateWeeklyConsistency } from './streak-utils.js';

describe('calculateDailyStreaks', () => {
  it('returns zeros for empty array', () => {
    const result = calculateDailyStreaks([]);
    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      withinCurrentStreak: false,
      currentStreakStart: null,
      longestStreakStart: null,
      longestStreakEnd: null,
    });
  });

  it('handles single date today', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const result = calculateDailyStreaks([today]);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
    expect(result.withinCurrentStreak).toBe(true);
  });

  it('handles single date 5 days ago', () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setUTCDate(fiveDaysAgo.getUTCDate() - 5);
    fiveDaysAgo.setUTCHours(0, 0, 0, 0);

    const result = calculateDailyStreaks([fiveDaysAgo]);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(1);
    expect(result.withinCurrentStreak).toBe(false);
  });

  it('handles 3 consecutive days ending yesterday', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

    const result = calculateDailyStreaks([threeDaysAgo, twoDaysAgo, yesterday]);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
    expect(result.withinCurrentStreak).toBe(true);
  });

  it('handles 3 consecutive days ending 5 days ago', () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setUTCDate(fiveDaysAgo.getUTCDate() - 5);
    const sixDaysAgo = new Date(fiveDaysAgo);
    sixDaysAgo.setUTCDate(sixDaysAgo.getUTCDate() - 1);
    const sevenDaysAgo = new Date(fiveDaysAgo);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 2);

    const result = calculateDailyStreaks([sevenDaysAgo, sixDaysAgo, fiveDaysAgo]);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(3);
    expect(result.withinCurrentStreak).toBe(false);
  });

  it('deduplicates same-day activities', () => {
    const jan1 = new Date('2024-01-01T10:00:00Z');
    const jan2a = new Date('2024-01-02T08:00:00Z');
    const jan2b = new Date('2024-01-02T18:00:00Z');
    const jan3 = new Date('2024-01-03T12:00:00Z');

    const result = calculateDailyStreaks([jan1, jan2a, jan2b, jan3]);
    expect(result.longestStreak).toBe(3);
  });

  it('handles multiple streaks with gaps', () => {
    const jan1 = new Date('2024-01-01T10:00:00Z');
    const jan2 = new Date('2024-01-02T10:00:00Z');
    const jan3 = new Date('2024-01-03T10:00:00Z');
    const jan10 = new Date('2024-01-10T10:00:00Z');
    const jan11 = new Date('2024-01-11T10:00:00Z');
    const jan12 = new Date('2024-01-12T10:00:00Z');
    const jan13 = new Date('2024-01-13T10:00:00Z');

    const result = calculateDailyStreaks([jan1, jan2, jan3, jan10, jan11, jan12, jan13]);
    expect(result.longestStreak).toBe(4);
  });

  it('handles dates across month boundary', () => {
    const jan30 = new Date('2024-01-30T10:00:00Z');
    const jan31 = new Date('2024-01-31T10:00:00Z');
    const feb1 = new Date('2024-02-01T10:00:00Z');

    const result = calculateDailyStreaks([jan30, jan31, feb1]);
    expect(result.longestStreak).toBe(3);
  });

  it('withinCurrentStreak is true when last activity was today', () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const result = calculateDailyStreaks([yesterday, today]);
    expect(result.withinCurrentStreak).toBe(true);
  });

  it('withinCurrentStreak is true when last activity was yesterday', () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(12, 0, 0, 0);
    const twoDaysAgo = new Date(yesterday);
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 1);

    const result = calculateDailyStreaks([twoDaysAgo, yesterday]);
    expect(result.withinCurrentStreak).toBe(true);
  });

  it('withinCurrentStreak is false when last activity was more than 1 day ago', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
    threeDaysAgo.setUTCHours(12, 0, 0, 0);

    const result = calculateDailyStreaks([threeDaysAgo]);
    expect(result.withinCurrentStreak).toBe(false);
  });
});

describe('calculateWeeklyConsistency', () => {
  it('returns zeros for empty array', () => {
    const result = calculateWeeklyConsistency([], 3);
    expect(result).toEqual({
      currentConsistencyStreak: 0,
      longestConsistencyStreak: 0,
      totalConsistentWeeks: 0,
      totalWeeks: 0,
    });
  });

  it('handles 1 week with 3 runs, threshold 3', () => {
    const week1run1 = new Date('2024-01-01T10:00:00Z'); // Monday
    const week1run2 = new Date('2024-01-03T10:00:00Z'); // Wednesday
    const week1run3 = new Date('2024-01-05T10:00:00Z'); // Friday

    const result = calculateWeeklyConsistency([week1run1, week1run2, week1run3], 3);
    expect(result.currentConsistencyStreak).toBe(1);
    expect(result.longestConsistencyStreak).toBe(1);
    expect(result.totalConsistentWeeks).toBe(1);
    expect(result.totalWeeks).toBe(1);
  });

  it('handles 3 consecutive weeks with 3+ runs each, threshold 3', () => {
    // Week 1 (Jan 1-7)
    const w1r1 = new Date('2024-01-01T10:00:00Z');
    const w1r2 = new Date('2024-01-03T10:00:00Z');
    const w1r3 = new Date('2024-01-05T10:00:00Z');
    // Week 2 (Jan 8-14)
    const w2r1 = new Date('2024-01-08T10:00:00Z');
    const w2r2 = new Date('2024-01-10T10:00:00Z');
    const w2r3 = new Date('2024-01-12T10:00:00Z');
    const w2r4 = new Date('2024-01-14T10:00:00Z');
    // Week 3 (Jan 15-21)
    const w3r1 = new Date('2024-01-15T10:00:00Z');
    const w3r2 = new Date('2024-01-17T10:00:00Z');
    const w3r3 = new Date('2024-01-19T10:00:00Z');

    const result = calculateWeeklyConsistency(
      [w1r1, w1r2, w1r3, w2r1, w2r2, w2r3, w2r4, w3r1, w3r2, w3r3],
      3
    );
    expect(result.currentConsistencyStreak).toBe(3);
    expect(result.longestConsistencyStreak).toBe(3);
    expect(result.totalConsistentWeeks).toBe(3);
  });

  it('handles gap in consistency streak', () => {
    // Week 1: 3 runs
    const w1r1 = new Date('2024-01-01T10:00:00Z');
    const w1r2 = new Date('2024-01-03T10:00:00Z');
    const w1r3 = new Date('2024-01-05T10:00:00Z');
    // Week 2: 1 run (breaks streak)
    const w2r1 = new Date('2024-01-08T10:00:00Z');
    // Week 3: 3 runs
    const w3r1 = new Date('2024-01-15T10:00:00Z');
    const w3r2 = new Date('2024-01-17T10:00:00Z');
    const w3r3 = new Date('2024-01-19T10:00:00Z');

    const result = calculateWeeklyConsistency(
      [w1r1, w1r2, w1r3, w2r1, w3r1, w3r2, w3r3],
      3
    );
    expect(result.longestConsistencyStreak).toBe(1);
    expect(result.totalConsistentWeeks).toBe(2);
  });

  it('handles threshold 1 (any week with a run counts)', () => {
    const w1r1 = new Date('2024-01-01T10:00:00Z');
    const w2r1 = new Date('2024-01-08T10:00:00Z');
    const w3r1 = new Date('2024-01-15T10:00:00Z');

    const result = calculateWeeklyConsistency([w1r1, w2r1, w3r1], 1);
    expect(result.currentConsistencyStreak).toBe(3);
    expect(result.longestConsistencyStreak).toBe(3);
    expect(result.totalConsistentWeeks).toBe(3);
  });

  it('handles non-consecutive weeks', () => {
    // Week 1: 3 runs
    const w1r1 = new Date('2024-01-01T10:00:00Z');
    const w1r2 = new Date('2024-01-03T10:00:00Z');
    const w1r3 = new Date('2024-01-05T10:00:00Z');
    // Skip week 2
    // Week 3: 3 runs
    const w3r1 = new Date('2024-01-15T10:00:00Z');
    const w3r2 = new Date('2024-01-17T10:00:00Z');
    const w3r3 = new Date('2024-01-19T10:00:00Z');

    const result = calculateWeeklyConsistency(
      [w1r1, w1r2, w1r3, w3r1, w3r2, w3r3],
      3
    );
    expect(result.currentConsistencyStreak).toBe(1);
    expect(result.longestConsistencyStreak).toBe(1);
    expect(result.totalConsistentWeeks).toBe(2);
  });

  it('uses default threshold of 3 when not specified', () => {
    const w1r1 = new Date('2024-01-01T10:00:00Z');
    const w1r2 = new Date('2024-01-03T10:00:00Z');
    const w1r3 = new Date('2024-01-05T10:00:00Z');

    const result = calculateWeeklyConsistency([w1r1, w1r2, w1r3]);
    expect(result.currentConsistencyStreak).toBe(1);
  });
});
