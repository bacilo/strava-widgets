import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  buildZoomPluginOptionsShape,
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
  panStepRange,
  PAN_FRACTION,
  rangesEqual,
  restoreOrDefault,
  volumeScaleKey,
  withRangeSuffix,
  ZOOM_FACTOR,
  zoomHintText,
  zoomStepRange,
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

describe('zoomStepRange and panStepRange', () => {
  const full = computeFullRange('volume-weekly', weeklyBounds);
  const def = computeDefaultWindow('volume-weekly', weeklyBounds);
  const minRange = computeLimits('volume-weekly', weeklyBounds).minRange;

  it('PAN_FRACTION is 0.25 and ZOOM_FACTOR is 1.5', () => {
    expect(PAN_FRACTION).toBe(0.25);
    expect(ZOOM_FACTOR).toBe(1.5);
  });

  it('formatRangeLabel(def.min, def.max) is "Aug 2025 to Aug 2026" (unchanged baseline)', () => {
    expect(formatRangeLabel(def.min, def.max)).toBe('Aug 2025 to Aug 2026');
  });

  it('zoomStepRange("in") from the weekly default formats to "Oct 2025 to Jun 2026" — the designed 8-month window, not Round 1\'s 6-month "Nov 2025 to May 2026"', () => {
    const zoomedIn = zoomStepRange(def, full, minRange, 'in');
    expect(formatRangeLabel(zoomedIn.min, zoomedIn.max)).toBe('Oct 2025 to Jun 2026');
  });

  it('zoomStepRange("in") span is within 1 ms of (def.max - def.min) / 1.5', () => {
    const zoomedIn = zoomStepRange(def, full, minRange, 'in');
    const expectedSpan = (def.max - def.min) / ZOOM_FACTOR;
    expect(Math.abs(zoomedIn.max - zoomedIn.min - expectedSpan)).toBeLessThanOrEqual(1);
  });

  it('zoomStepRange("out") from the weekly default formats to "Feb 2025 to Aug 2026" — 18 months, shifted left so it does not pass full.max', () => {
    const zoomedOut = zoomStepRange(def, full, minRange, 'out');
    expect(formatRangeLabel(zoomedOut.min, zoomedOut.max)).toBe('Feb 2025 to Aug 2026');
  });

  it('zoomStepRange("out") already at the ceiling (full) returns full unchanged', () => {
    const zoomedOut = zoomStepRange(full, full, minRange, 'out');
    expect(zoomedOut).toEqual(full);
  });

  it('repeated zoomStepRange("in") never produces a span below minRange, and never produces min >= max', () => {
    let current = def;
    for (let i = 0; i < 20; i++) {
      current = zoomStepRange(current, full, minRange, 'in');
      expect(current.max - current.min).toBeGreaterThanOrEqual(minRange - 1);
      expect(current.min).toBeLessThan(current.max);
    }
  });

  it('panStepRange("earlier") from the weekly default formats to "May 2025 to May 2026" — the exact string R8 failed on, not "Apr 2025 to Apr 2026"', () => {
    const panned = panStepRange(def, full, 'earlier');
    expect(formatRangeLabel(panned.min, panned.max)).toBe('May 2025 to May 2026');
  });

  it('panStepRange("earlier") preserves the span exactly and moves min back by exactly PAN_FRACTION * span', () => {
    const panned = panStepRange(def, full, 'earlier');
    const span = def.max - def.min;
    expect(Math.abs(panned.max - panned.min - span)).toBeLessThanOrEqual(1);
    expect(Math.abs(def.min - panned.min - PAN_FRACTION * span)).toBeLessThanOrEqual(1);
  });

  it('panStepRange("later") from the weekly default returns def unchanged (already clamped at the latest edge)', () => {
    const panned = panStepRange(def, full, 'later');
    expect(panned).toEqual(def);
  });

  it('panStepRange("earlier") at the earliest edge clamps min to full.min without shrinking the span', () => {
    const edge: ZoomRange = { min: full.min, max: full.min + 86400000 };
    const panned = panStepRange(edge, full, 'earlier');
    expect(panned.min).toBe(full.min);
    expect(panned.max - panned.min).toBe(edge.max - edge.min);
  });

  it('zoomStepRange and panStepRange return current unchanged, without throwing, on malformed input', () => {
    const malformedCases: ZoomRange[] = [
      { min: NaN, max: def.max },
      { min: def.min, max: NaN },
      { min: def.max, max: def.min }, // min >= max
    ];
    for (const malformed of malformedCases) {
      expect(() => zoomStepRange(malformed, full, minRange, 'in')).not.toThrow();
      expect(zoomStepRange(malformed, full, minRange, 'in')).toEqual(malformed);
      expect(() => panStepRange(malformed, full, 'earlier')).not.toThrow();
      expect(panStepRange(malformed, full, 'earlier')).toEqual(malformed);
    }
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

  it('formatRangeLabel(NaN, NaN) returns the empty string rather than throwing', () => {
    expect(() => formatRangeLabel(NaN, NaN)).not.toThrow();
    expect(formatRangeLabel(NaN, NaN)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Finding 10 (23-08 gap closure): the shipped shape put `onZoomComplete`/
// `onPanComplete` as top-level siblings of `zoom`/`pan`, so
// `chartjs-plugin-zoom` never saw either callback and `settle()` never ran
// on any gesture. These structural assertions are the ones that would have
// caught it — the exact inversion of the shipped defect.
// ---------------------------------------------------------------------------

describe('buildZoomPluginOptionsShape', () => {
  it('nests onZoomComplete inside zoom and onPanComplete inside pan, not as top-level siblings', () => {
    const shape = buildZoomPluginOptionsShape<{ id: string }>({
      scaleKey: 'volume-weekly',
      bounds: weeklyBounds,
      modifierKey: 'meta',
      onSettle: () => {},
    });
    const zoom = shape.zoom as Record<string, unknown>;
    const pan = shape.pan as Record<string, unknown>;

    expect(typeof zoom.onZoomComplete).toBe('function');
    expect(typeof pan.onPanComplete).toBe('function');
    // The exact inversion of the shipped defect (Finding 10): the shipped
    // shape had these two callbacks at the TOP LEVEL of the returned
    // object. They must NOT be there any more.
    expect('onZoomComplete' in shape).toBe(false);
    expect('onPanComplete' in shape).toBe(false);
  });

  it('invoking the nested callbacks forwards chart to onSettle exactly once', () => {
    const sentinel = { id: 'sentinel-chart' };
    let calls: unknown[] = [];
    const shape = buildZoomPluginOptionsShape<typeof sentinel>({
      scaleKey: 'volume-weekly',
      bounds: weeklyBounds,
      modifierKey: 'meta',
      onSettle: (chart) => calls.push(chart),
    });
    const zoom = shape.zoom as { onZoomComplete: (args: { chart: typeof sentinel }) => void };
    const pan = shape.pan as { onPanComplete: (args: { chart: typeof sentinel }) => void };

    zoom.onZoomComplete({ chart: sentinel });
    expect(calls).toEqual([sentinel]);

    calls = [];
    pan.onPanComplete({ chart: sentinel });
    expect(calls).toEqual([sentinel]);
  });

  it('wires wheel modifierKey, pinch/drag/mode and pan.enabled per D-07/D-14/D-15/D-16', () => {
    const metaShape = buildZoomPluginOptionsShape<{ id: string }>({
      scaleKey: 'volume-weekly',
      bounds: weeklyBounds,
      modifierKey: 'meta',
      onSettle: () => {},
    });
    const zoom = metaShape.zoom as Record<string, unknown>;
    const pan = metaShape.pan as Record<string, unknown>;

    expect(zoom.wheel).toEqual({ enabled: true, modifierKey: 'meta' });
    expect((zoom.pinch as { enabled: boolean }).enabled).toBe(true);
    expect((zoom.drag as { enabled: boolean }).enabled).toBe(false);
    expect(zoom.mode).toBe('x');
    expect(pan.mode).toBe('x');
    expect(pan.enabled).toBe(true);

    const ctrlShape = buildZoomPluginOptionsShape<{ id: string }>({
      scaleKey: 'volume-weekly',
      bounds: weeklyBounds,
      modifierKey: 'ctrl',
      onSettle: () => {},
    });
    expect((ctrlShape.zoom as Record<string, unknown>).wheel).toEqual({ enabled: true, modifierKey: 'ctrl' });
  });

  it('limits.x deep-equals computeLimits and never emits the plugin original sentinel', () => {
    const shape = buildZoomPluginOptionsShape<{ id: string }>({
      scaleKey: 'volume-weekly',
      bounds: weeklyBounds,
      modifierKey: 'meta',
      onSettle: () => {},
    });
    const limits = shape.limits as { x: unknown };

    expect(limits.x).toEqual(computeLimits('volume-weekly', weeklyBounds));
    expect(JSON.stringify(shape.limits)).not.toContain('original');
  });
});

// ---------------------------------------------------------------------------
// This block proves that the option PATH the vendored plugin reads still
// matches the path this module writes (`state.options.zoom.onZoomComplete`
// / `state.options.pan.onPanComplete`), so a future dependency upgrade that
// moves the lookup fails this test loudly instead of silently reintroducing
// Finding 10 at a real gesture. It proves NOTHING about a real gesture
// itself — that stays browser-checkpoint-only (see 23-VALIDATION.md).
// ---------------------------------------------------------------------------

describe('chartjs-plugin-zoom option lookup contract', () => {
  const pluginSource = readFileSync(
    new URL('../../../node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js', import.meta.url),
    'utf8',
  );

  it('reads onZoomComplete and onPanComplete off state.options.zoom / state.options.pan', () => {
    expect(pluginSource).toContain('state.options.zoom.onZoomComplete');
    expect(pluginSource).toContain('state.options.pan.onPanComplete');
  });

  it('never reads either callback as an unqualified top-level sibling of state.options', () => {
    expect(pluginSource).not.toContain('state.options.onZoomComplete');
    expect(pluginSource).not.toContain('state.options.onPanComplete');
  });
});

// ---------------------------------------------------------------------------
// CR-01 (phase 23 code review) — the zoom plugin's `bounds` argument MUST be
// the ARCHIVE bounds at every call site, never the opening window.
//
// `computeDefaultWindow(...)` and `computeArchiveBounds(...)` both return a
// `ZoomRange`, so TypeScript cannot tell them apart. `trends-charts.ts`'s
// Cadence & HR call site passed `zoom.initial` — the opening window — which
// caged gesture zoom-out at ~5 years of a ~15-year archive. The `-` button
// still reached full range (`applyRange` bypasses plugin limits), so every
// button-driven check passed and three browser rounds missed it: no round
// ever gestured OUTWARD past the default on that tab.
//
// The first test below proves the two arguments are not interchangeable —
// i.e. that the mix-up has a real effect worth guarding. The second is a
// source-text consumer guard over `trends-charts.ts` in the same spirit as
// the plugin-lookup contract above: it fails loudly if any call site goes
// back to handing a window where archive bounds belong.
// ---------------------------------------------------------------------------

describe('CR-01 — zoom plugin bounds are archive bounds, not the opening window', () => {
  it('clamping to the opening window is strictly narrower than clamping to the archive', () => {
    const archiveLimits = computeLimits('cadence-hr', monthlyBounds);
    const windowLimits = computeLimits('cadence-hr', computeDefaultWindow('cadence-hr', monthlyBounds));

    // The window-derived cage starts later than the archive-derived one, so
    // the two are demonstrably not interchangeable.
    expect(windowLimits.min).toBeGreaterThan(archiveLimits.min);
    expect(archiveLimits.min).toBe(computeFullRange('cadence-hr', monthlyBounds).min);
  });

  it('every buildZoomPluginOptions call site in trends-charts.ts passes archive bounds', () => {
    const source = readFileSync(new URL('./trends-charts.ts', import.meta.url), 'utf8');
    const callSites = source.match(/buildZoomPluginOptions\(\{[^}]*\}\)/g) ?? [];

    // All three zoomable tabs (Volume, Cadence & HR, Training Load).
    expect(callSites).toHaveLength(3);

    for (const site of callSites) {
      // Either the bare `bounds` shorthand or an explicit `bounds: <x>.bounds`.
      expect(site).toMatch(/\bbounds(\s*:\s*[A-Za-z_$][\w$]*\.bounds)?\s*[,}]/);
      // Never the opening window, under any of the names it travels under.
      expect(site).not.toMatch(/\bbounds\s*:\s*[A-Za-z_$][\w$]*\.initial\b/);
      expect(site).not.toMatch(/\bbounds\s*:\s*initial\b/);
    }
  });
});
