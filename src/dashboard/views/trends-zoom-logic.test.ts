import { describe, expect, it } from 'vitest';

import {
  computeArchiveBounds,
  computeDefaultWindow,
  computeFullRange,
  computeLimits,
  formatRangeLabel,
  isAtEarliestEdge,
  isAtFullRange,
  isAtLatestEdge,
  loadWindowRange,
  modifierKeyForPlatform,
  panDeltaPx,
  PAN_FRACTION,
  rangesEqual,
  restoreOrDefault,
  volumeScaleKey,
  withRangeSuffix,
  ZOOM_FACTOR,
  zoomHintText,
  type ZoomRange,
} from './trends-zoom-logic.js';

// ---------------------------------------------------------------------------
// Real archive bounds — a regression here is expressed in dates a human can
// check against the published data.
// ---------------------------------------------------------------------------

const weeklyBounds: ZoomRange = {
  min: Date.parse('2011-08-15T00:00:00.000Z'),
  max: Date.parse('2026-08-10T00:00:00.000Z'),
};

const monthlyBounds: ZoomRange = {
  min: Date.parse('2011-08-01T00:00:00.000Z'),
  max: Date.parse('2026-08-01T00:00:00.000Z'),
};

const yearlyBounds: ZoomRange = {
  min: Date.parse('2011-01-01T00:00:00.000Z'),
  max: Date.parse('2026-01-01T00:00:00.000Z'),
};

const trainingLoadBounds: ZoomRange = {
  min: Date.parse('2011-08-16T00:00:00.000Z'),
  max: Date.parse('2026-08-11T00:00:00.000Z'),
};

describe('computeDefaultWindow', () => {
  it('weekly opens on the trailing ~12 months, not the full 15-year archive', () => {
    const win = computeDefaultWindow('volume-weekly', weeklyBounds);
    expect(win.min).toBe(Date.parse('2025-08-13T12:00:00.000Z'));
    expect(win.max).toBe(Date.parse('2026-08-13T12:00:00.000Z'));
  });

  it('weekly full range pads the archive bounds by half a week on each side', () => {
    const full = computeFullRange('volume-weekly', weeklyBounds);
    expect(full.min).toBe(Date.parse('2011-08-11T12:00:00.000Z'));
    expect(full.max).toBe(Date.parse('2026-08-13T12:00:00.000Z'));
  });

  it('monthly opens on the trailing ~5 years', () => {
    const win = computeDefaultWindow('volume-monthly', monthlyBounds);
    expect(win.min).toBe(Date.parse('2021-08-15T23:15:00.000Z'));
    expect(win.max).toBe(Date.parse('2026-08-16T05:15:00.000Z'));
  });

  it('yearly default window equals the yearly full range exactly (yearly opens on everything)', () => {
    const win = computeDefaultWindow('volume-yearly', yearlyBounds);
    const full = computeFullRange('volume-yearly', yearlyBounds);
    expect(win).toEqual(full);
    expect(win.min).toBe(Date.parse('2010-07-02T09:00:00.000Z'));
    expect(win.max).toBe(Date.parse('2026-07-02T15:00:00.000Z'));
  });

  it('never returns a window wider than computeFullRange for the same key and bounds', () => {
    for (const key of ['volume-weekly', 'volume-monthly', 'volume-yearly', 'cadence-hr', 'training-load'] as const) {
      const bounds = key === 'training-load' ? trainingLoadBounds : weeklyBounds;
      const win = computeDefaultWindow(key, bounds);
      const full = computeFullRange(key, bounds);
      expect(win.max - win.min).toBeLessThanOrEqual(full.max - full.min);
    }
  });

  it('TRN-01 outcome: the weekly default window min is strictly after the archive start, and its label does not read 2011', () => {
    const win = computeDefaultWindow('volume-weekly', weeklyBounds);
    expect(win.min).toBeGreaterThan(weeklyBounds.min);
    expect(formatRangeLabel(win.min, win.max)).not.toContain('2011');
  });
});

describe('computeLimits', () => {
  it('returns three finite numbers whose min/max equal computeFullRange', () => {
    const limits = computeLimits('volume-weekly', weeklyBounds);
    const full = computeFullRange('volume-weekly', weeklyBounds);
    expect(Number.isFinite(limits.min)).toBe(true);
    expect(Number.isFinite(limits.max)).toBe(true);
    expect(Number.isFinite(limits.minRange)).toBe(true);
    expect(limits.min).toBe(full.min);
    expect(limits.max).toBe(full.max);
  });

  it('never emits the plugin original sentinel string in any field', () => {
    const limits = computeLimits('volume-monthly', monthlyBounds);
    expect(typeof limits.min).toBe('number');
    expect(typeof limits.max).toBe('number');
    expect(typeof limits.minRange).toBe('number');
  });
});

describe('panDeltaPx and zoomFactor', () => {
  it('panDeltaPx(800, "earlier") returns +200 (25% of plot width)', () => {
    expect(panDeltaPx(800, 'earlier')).toBe(200);
  });

  it('panDeltaPx(800, "later") returns -200 — Pitfall 5 sign convention', () => {
    expect(panDeltaPx(800, 'later')).toBe(-200);
  });

  it('PAN_FRACTION is 0.25 and ZOOM_FACTOR is 1.5', () => {
    expect(PAN_FRACTION).toBe(0.25);
    expect(ZOOM_FACTOR).toBe(1.5);
  });
});

describe('formatRangeLabel', () => {
  it('formats the weekly default window as "Aug 2025 to Aug 2026"', () => {
    const min = Date.parse('2025-08-13T12:00:00.000Z');
    const max = Date.parse('2026-08-13T12:00:00.000Z');
    expect(formatRangeLabel(min, max)).toBe('Aug 2025 to Aug 2026');
  });

  it('withRangeSuffix composes onto an existing aria-label base', () => {
    const min = Date.parse('2025-08-13T12:00:00.000Z');
    const max = Date.parse('2026-08-13T12:00:00.000Z');
    expect(withRangeSuffix('Weekly distance chart', min, max)).toBe('Weekly distance chart, Aug 2025 to Aug 2026');
  });

  it('withRangeSuffix returns base unchanged when the range is invalid', () => {
    expect(withRangeSuffix('Weekly distance chart', NaN, NaN)).toBe('Weekly distance chart');
  });
});

describe('restoreOrDefault', () => {
  const fallback: ZoomRange = { min: 0, max: 100 };

  it('returns fallback when saved is null', () => {
    expect(restoreOrDefault(null, fallback)).toEqual(fallback);
  });

  it('returns saved when present and valid', () => {
    const saved: ZoomRange = { min: 10, max: 20 };
    expect(restoreOrDefault(saved, fallback)).toEqual(saved);
  });

  it('returns fallback when saved.min >= saved.max', () => {
    expect(restoreOrDefault({ min: 20, max: 10 }, fallback)).toEqual(fallback);
    expect(restoreOrDefault({ min: 10, max: 10 }, fallback)).toEqual(fallback);
  });

  it('returns fallback when a saved bound is non-finite', () => {
    expect(restoreOrDefault({ min: NaN, max: 100 }, fallback)).toEqual(fallback);
    expect(restoreOrDefault({ min: 0, max: Infinity }, fallback)).toEqual(fallback);
  });
});

describe('rangesEqual', () => {
  it('true when both bounds match within 1 ms', () => {
    expect(rangesEqual({ min: 100, max: 200 }, { min: 100.5, max: 199.5 })).toBe(true);
  });

  it('false when either bound differs by more than 1 ms', () => {
    expect(rangesEqual({ min: 100, max: 200 }, { min: 103, max: 200 })).toBe(false);
    expect(rangesEqual({ min: 100, max: 200 }, { min: 100, max: 205 })).toBe(false);
  });
});

describe('isAtFullRange / isAtEarliestEdge / isAtLatestEdge', () => {
  const full: ZoomRange = { min: 0, max: 1000 };

  it('isAtFullRange is true exactly at the full range', () => {
    expect(isAtFullRange({ min: 0, max: 1000 }, full)).toBe(true);
    expect(isAtFullRange({ min: 100, max: 1000 }, full)).toBe(false);
  });

  it('isAtEarliestEdge is true within 1 ms of full.min', () => {
    expect(isAtEarliestEdge({ min: 0, max: 500 }, full)).toBe(true);
    expect(isAtEarliestEdge({ min: 50, max: 500 }, full)).toBe(false);
  });

  it('isAtLatestEdge is true within 1 ms of full.max', () => {
    expect(isAtLatestEdge({ min: 500, max: 1000 }, full)).toBe(true);
    expect(isAtLatestEdge({ min: 500, max: 900 }, full)).toBe(false);
  });
});

describe('modifierKeyForPlatform', () => {
  it('returns meta for MacIntel and macOS', () => {
    expect(modifierKeyForPlatform('MacIntel')).toBe('meta');
    expect(modifierKeyForPlatform('macOS')).toBe('meta');
  });

  it('returns ctrl for Win32, Linux and empty string', () => {
    expect(modifierKeyForPlatform('Win32')).toBe('ctrl');
    expect(modifierKeyForPlatform('Linux x86_64')).toBe('ctrl');
    expect(modifierKeyForPlatform('')).toBe('ctrl');
  });

  it('zoomHintText differs between the two variants and both mention scroll to zoom', () => {
    const meta = zoomHintText('meta');
    const ctrl = zoomHintText('ctrl');
    expect(meta).not.toBe(ctrl);
    expect(meta).toContain('scroll to zoom');
    expect(ctrl).toContain('scroll to zoom');
  });
});

describe('loadWindowRange', () => {
  it('"all" equals computeFullRange for training-load', () => {
    expect(loadWindowRange('all', trainingLoadBounds)).toEqual(computeFullRange('training-load', trainingLoadBounds));
  });

  it('"12mo" returns the trailing 12mo default window, computed in advance', () => {
    const win = loadWindowRange('12mo', trainingLoadBounds);
    expect(win.min).toBe(Date.parse('2025-08-11T12:00:00.000Z'));
    expect(win.max).toBe(Date.parse('2026-08-11T12:00:00.000Z'));
  });

  it('"3mo" and "12mo" progressively narrow while sharing the same max', () => {
    const win12 = loadWindowRange('12mo', trainingLoadBounds);
    const win3 = loadWindowRange('3mo', trainingLoadBounds);
    expect(win3.max).toBe(win12.max);
    expect(win3.max - win3.min).toBeLessThan(win12.max - win12.min);
  });
});

describe('volumeScaleKey', () => {
  it('maps each granularity to its own zoomable scale key', () => {
    expect(volumeScaleKey('weekly')).toBe('volume-weekly');
    expect(volumeScaleKey('monthly')).toBe('volume-monthly');
    expect(volumeScaleKey('yearly')).toBe('volume-yearly');
  });
});

describe('computeArchiveBounds', () => {
  it('returns null for an empty array', () => {
    expect(computeArchiveBounds([])).toBeNull();
  });

  it('ignores non-finite entries and returns {min, max} over the rest', () => {
    expect(computeArchiveBounds([NaN, 10, Infinity, 5, -Infinity, 20])).toEqual({ min: 5, max: 20 });
  });

  it('returns null when every entry is non-finite', () => {
    expect(computeArchiveBounds([NaN, Infinity, -Infinity])).toBeNull();
  });
});

describe('never throws on malformed input', () => {
  it('computeArchiveBounds on an empty array', () => {
    expect(() => computeArchiveBounds([])).not.toThrow();
  });

  it('computeArchiveBounds on [NaN, Infinity]', () => {
    expect(() => computeArchiveBounds([NaN, Infinity])).not.toThrow();
    expect(computeArchiveBounds([NaN, Infinity])).toBeNull();
  });

  it('restoreOrDefault with a saved range whose min > max', () => {
    expect(() => restoreOrDefault({ min: 100, max: 0 }, { min: 0, max: 1 })).not.toThrow();
  });

  it('panDeltaPx(0, "earlier") returns 0 rather than throwing', () => {
    expect(() => panDeltaPx(0, 'earlier')).not.toThrow();
    expect(panDeltaPx(0, 'earlier')).toBe(0);
  });

  it('panDeltaPx(NaN, "later") returns 0 rather than throwing', () => {
    expect(() => panDeltaPx(NaN, 'later')).not.toThrow();
    expect(panDeltaPx(NaN, 'later')).toBe(0);
  });

  it('formatRangeLabel(NaN, NaN) returns the empty string rather than throwing', () => {
    expect(() => formatRangeLabel(NaN, NaN)).not.toThrow();
    expect(formatRangeLabel(NaN, NaN)).toBe('');
  });
});
