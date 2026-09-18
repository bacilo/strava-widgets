/**
 * Behavioral tests for `scripts/curate-queue/format.mjs`'s four formatters (Phase 29 plan 05,
 * Task 1). Asserts against the plan's `<behavior>` block exactly — this file proves the actual
 * duplicated behavior, not just that the module's source text exists (RESEARCH.md Pitfall 1, the
 * collection trap this project has twice shipped a silent-pass guard against).
 */

import { describe, expect, it } from 'vitest';

import {
  activityDetailUrl,
  formatActivityDate,
  formatEffortDuration,
  formatPace,
} from './format.mjs';

describe('collection canary', () => {
  it('this test file is actually collected by vitest', () => {
    expect(true).toBe(true);
  });
});

describe('formatPace', () => {
  it('formats a finite pace as m:ss/km', () => {
    expect(formatPace(143.8)).toBe('2:24/km');
  });

  it('returns an em dash for null', () => {
    expect(formatPace(null)).toBe('—');
  });

  it('returns an em dash for NaN', () => {
    expect(formatPace(Number.NaN)).toBe('—');
  });
});

describe('formatEffortDuration', () => {
  it('formats a sub-minute duration as m:ss with no hour component', () => {
    expect(formatEffortDuration(57.5)).toBe('0:58');
  });

  it('formats an over-an-hour duration as h:mm:ss', () => {
    expect(formatEffortDuration(3661)).toBe('1:01:01');
  });

  it('returns an em dash for a negative duration', () => {
    expect(formatEffortDuration(-1)).toBe('—');
  });
});

describe('formatActivityDate', () => {
  it('formats a Z-suffixed ISO string using UTC components', () => {
    expect(formatActivityDate('2020-04-25T13:32:04Z')).toBe('Apr 25, 2020');
  });

  it('treats a string with no trailing Z as UTC by appending one', () => {
    expect(formatActivityDate('2020-04-25T13:32:04')).toBe('Apr 25, 2020');
  });

  it('returns an em dash for a non-string value', () => {
    expect(formatActivityDate(undefined)).toBe('—');
    expect(formatActivityDate(null)).toBe('—');
    expect(formatActivityDate(12345)).toBe('—');
  });

  it('returns an em dash for an unparseable string', () => {
    expect(formatActivityDate('not-a-date')).toBe('—');
  });
});

describe('activityDetailUrl', () => {
  it('builds the full mount-prefixed hash URL', () => {
    expect(activityDetailUrl('3475711469')).toBe('/strava-widgets/#/activity/3475711469');
  });

  it('percent-encodes an id that needs escaping', () => {
    expect(activityDetailUrl('i 123/x')).toBe('/strava-widgets/#/activity/i%20123%2Fx');
  });
});
