import { describe, expect, it } from 'vitest';

import {
  buildBackfillTargets,
  classifyUnavailable,
  formatSizeReport,
  selectReconciliationTargets,
} from './backfill-streams.js';

describe('classifyUnavailable', () => {
  it('maps a manual entry (23 real archive entries share this shape) to "manual"', () => {
    expect(classifyUnavailable({ manual: true, trainer: false })).toBe('manual');
  });

  it('maps a trainer:true entry to "treadmill"', () => {
    expect(classifyUnavailable({ trainer: true })).toBe('treadmill');
  });

  it('maps a record with neither flag to "no-original"', () => {
    expect(classifyUnavailable({ manual: false, trainer: false })).toBe('no-original');
  });

  it('maps a source_provider:"intervals" record with no manual/trainer flags to "no-original"', () => {
    expect(classifyUnavailable({ source_provider: 'intervals' })).toBe('no-original');
  });

  it('gives manual priority over trainer when both flags are true', () => {
    expect(classifyUnavailable({ manual: true, trainer: true })).toBe('manual');
  });
});

describe('buildBackfillTargets', () => {
  it('resolves a strava-sourced original into the export_data path', () => {
    const provenance = {
      generated_at: '',
      note: '',
      sources: {},
      archive_total: 1,
      archive_without_original: [],
      activities: {
        '1': { matched_by: 'strava_id' as const, original: 'strava:activities/3711953752.fit.gz' },
      },
    };
    const { withOriginal } = buildBackfillTargets(provenance, new Set());
    expect(withOriginal).toEqual([{ id: '1', originalPath: 'export_data/strava/activities/3711953752.fit.gz' }]);
  });

  it('resolves a non-strava source directory the same way, so a future export_data/garmin/ drop needs no code change', () => {
    const provenance = {
      generated_at: '',
      note: '',
      sources: {},
      archive_total: 1,
      archive_without_original: [],
      activities: {
        '2': { matched_by: 'strava_id' as const, original: 'garmin:activities/999.fit.gz' },
      },
    };
    const { withOriginal } = buildBackfillTargets(provenance, new Set());
    expect(withOriginal).toEqual([{ id: '2', originalPath: 'export_data/garmin/activities/999.fit.gz' }]);
  });

  it('puts ids listed in archive_without_original into withoutOriginal', () => {
    const provenance = {
      generated_at: '',
      note: '',
      sources: {},
      archive_total: 1,
      archive_without_original: ['3'],
      activities: {},
    };
    const { withoutOriginal } = buildBackfillTargets(provenance, new Set());
    expect(withoutOriginal).toEqual(['3']);
  });

  it('puts an entry whose original is absent into withoutOriginal', () => {
    const provenance = {
      generated_at: '',
      note: '',
      sources: {},
      archive_total: 1,
      archive_without_original: [],
      activities: {
        '4': { matched_by: 'imported' as const },
      },
    };
    const { withoutOriginal } = buildBackfillTargets(provenance, new Set());
    expect(withoutOriginal).toEqual(['4']);
  });

  it('excludes an id already present in existingStreamIds from both lists — re-running after a partial run must be cheap and safe', () => {
    const provenance = {
      generated_at: '',
      note: '',
      sources: {},
      archive_total: 2,
      archive_without_original: ['6'],
      activities: {
        '5': { matched_by: 'strava_id' as const, original: 'strava:activities/5.fit.gz' },
      },
    };
    const { withOriginal, withoutOriginal } = buildBackfillTargets(provenance, new Set(['5', '6']));
    expect(withOriginal).toEqual([]);
    expect(withoutOriginal).toEqual([]);
  });

  it('does not duplicate an id present in both provenance.activities (no original) and archive_without_original', () => {
    const provenance = {
      generated_at: '',
      note: '',
      sources: {},
      archive_total: 1,
      archive_without_original: ['7'],
      activities: {
        '7': { matched_by: 'imported' as const },
      },
    };
    const { withoutOriginal } = buildBackfillTargets(provenance, new Set());
    expect(withoutOriginal).toEqual(['7']);
  });
});

describe('selectReconciliationTargets', () => {
  it('selects an intervals-sourced id with no stream file', () => {
    const archive = new Map([['i1', { source_provider: 'intervals' }]]);
    expect(selectReconciliationTargets(archive, new Set())).toEqual(['i1']);
  });

  it('excludes an intervals-sourced id that already has a stream file', () => {
    const archive = new Map([['i1', { source_provider: 'intervals' }]]);
    expect(selectReconciliationTargets(archive, new Set(['i1']))).toEqual([]);
  });

  it('excludes a strava-sourced id with no stream file (handled by the FIT/GPX branch instead)', () => {
    const archive = new Map([['9', { source_provider: 'strava-export' }]]);
    expect(selectReconciliationTargets(archive, new Set())).toEqual([]);
  });

  it('returns an empty list for an empty archive', () => {
    expect(selectReconciliationTargets(new Map(), new Set())).toEqual([]);
  });
});

describe('formatSizeReport', () => {
  it('includes no WARNING: line when the total is under budget', () => {
    const report = formatSizeReport([{ name: 'a.json', bytes: 1024 }]);
    expect(report).not.toContain('WARNING:');
  });

  it('includes a WARNING: line when the total exceeds budget', () => {
    const report = formatSizeReport([{ name: 'a.json', bytes: 60 * 1024 * 1024 }]);
    expect(report).toContain('WARNING:');
  });

  it('lists the ten largest files largest-first', () => {
    const files = [
      { name: 'small.json', bytes: 100 },
      { name: 'big.json', bytes: 10000 },
      { name: 'medium.json', bytes: 5000 },
    ];
    const report = formatSizeReport(files);
    const bigIndex = report.indexOf('big.json');
    const mediumIndex = report.indexOf('medium.json');
    const smallIndex = report.indexOf('small.json');
    expect(bigIndex).toBeGreaterThan(-1);
    expect(bigIndex).toBeLessThan(mediumIndex);
    expect(mediumIndex).toBeLessThan(smallIndex);
  });

  it('produces a report for an empty file list without throwing', () => {
    expect(() => formatSizeReport([])).not.toThrow();
    expect(typeof formatSizeReport([])).toBe('string');
  });
});
