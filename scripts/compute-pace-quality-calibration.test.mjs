/**
 * Guard test for the pure helpers exported by
 * compute-pace-quality-calibration.mjs (Phase 27 plan 03, QUAL-05).
 * Importing this module must not run the archive sweep, invoke
 * `npm run compute-pace-residual` as a subprocess, or write
 * `27-CALIBRATION.md` — if it does, the self-execution guard documented at
 * the bottom of compute-pace-quality-calibration.mjs is wrong and must be
 * fixed rather than worked around here (mirrors
 * scripts/compute-pace-residual.test.mjs's own contract).
 *
 * The module is loaded via a dynamic `import()` inside `beforeAll` (not a
 * static top-level import) specifically so this file can capture
 * `27-CALIBRATION.md`'s mtime BEFORE the import happens and compare it
 * against the mtime AFTER — a static import is hoisted and would already
 * have run by the time any test-file code could read the "before" mtime.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(
  __dirname,
  '../.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md'
);

let mod;
let mtimeBeforeImport;

beforeAll(async () => {
  mtimeBeforeImport = existsSync(OUTPUT_PATH) ? statSync(OUTPUT_PATH).mtimeMs : null;
  mod = await import('./compute-pace-quality-calibration.mjs');
});

describe('importing the module does not run the sweep or write the report', () => {
  it('leaves 27-CALIBRATION.md byte-for-byte untouched (mtime unchanged across the import)', () => {
    expect(existsSync(OUTPUT_PATH)).toBe(true);
    const mtimeAfterImport = statSync(OUTPUT_PATH).mtimeMs;
    expect(mtimeAfterImport).toBe(mtimeBeforeImport);
  });
});

describe('reduceCompositeUnion — the composite-from-signals reducer', () => {
  it('returns the union size for hand-built signal sets, including the all-three-severe case', () => {
    const allThreeSevere = {
      decimation: { tier: 'severe' },
      gapProfile: { tier: 'severe' },
      impossibleSamples: { tier: 'severe' },
    };
    const oneOfThreeSevere = {
      decimation: { tier: 'severe' },
      gapProfile: { tier: 'none' },
      impossibleSamples: { tier: 'none' },
    };
    const noneSevere = {
      decimation: { tier: 'none' },
      gapProfile: { tier: 'minor' },
      impossibleSamples: { tier: 'not-computable' },
    };

    const entries = [
      { id: 'all-three', signals: allThreeSevere },
      { id: 'one-of-three', signals: oneOfThreeSevere },
      { id: 'none-severe', signals: noneSevere },
    ];

    const union = mod.reduceCompositeUnion(entries);

    expect(union.size).toBe(2);
    expect(union.has('all-three')).toBe(true);
    expect(union.has('one-of-three')).toBe(true);
    expect(union.has('none-severe')).toBe(false);
  });

  it('returns an empty set for the none-severe case (including not-computable entries)', () => {
    const entries = [
      {
        id: 'clean',
        signals: { decimation: { tier: 'none' }, gapProfile: { tier: 'minor' }, impossibleSamples: { tier: 'none' } },
      },
      {
        id: 'stream-less',
        signals: {
          decimation: { tier: 'not-computable' },
          gapProfile: { tier: 'not-computable' },
          impossibleSamples: { tier: 'not-computable' },
        },
      },
    ];

    const union = mod.reduceCompositeUnion(entries);
    expect(union.size).toBe(0);
  });
});

describe('checkSanityGate', () => {
  it('passes when the composite sits between the max marginal and the sum of marginals', () => {
    const result = mod.checkSanityGate(10, [3, 4, 5]);
    expect(result.pass).toBe(true);
    expect(result.maxMarginal).toBe(5);
    expect(result.sumMarginals).toBe(12);
  });

  it('fires (pass: false) on a deliberately inconsistent hand-built input below the max marginal', () => {
    // A true union can never be smaller than its largest marginal set —
    // a composite of 1 against marginals of [5, 5, 5] is definitionally
    // impossible for a real union and must be caught.
    const result = mod.checkSanityGate(1, [5, 5, 5]);
    expect(result.pass).toBe(false);
    expect(result.maxMarginal).toBe(5);
  });

  it('fires (pass: false) on a composite exceeding the sum of marginals', () => {
    const result = mod.checkSanityGate(20, [3, 4, 5]);
    expect(result.pass).toBe(false);
    expect(result.sumMarginals).toBe(12);
  });
});

describe('computeOverlapBreakdown', () => {
  it('classifies exactly-one / exactly-two / all-three membership and pairwise intersections correctly', () => {
    const decimation = new Set(['a', 'b']);
    const gapProfile = new Set(['b', 'c']);
    const impossible = new Set(['b']);
    // a: decimation-only -> exactly one
    // b: all three -> all-three
    // c: gapProfile-only -> exactly one

    const result = mod.computeOverlapBreakdown(decimation, gapProfile, impossible);

    expect(result.exactlyOne).toBe(2);
    expect(result.exactlyTwo).toBe(0);
    expect(result.allThree).toBe(1);
    expect(result.decimationGapProfile).toBe(1);
    expect(result.decimationImpossible).toBe(1);
    expect(result.gapProfileImpossible).toBe(1);
  });

  it('returns all zeros for three disjoint sets', () => {
    const result = mod.computeOverlapBreakdown(new Set(['a']), new Set(['b']), new Set(['c']));
    expect(result.exactlyOne).toBe(3);
    expect(result.exactlyTwo).toBe(0);
    expect(result.allThree).toBe(0);
    expect(result.decimationGapProfile).toBe(0);
    expect(result.decimationImpossible).toBe(0);
    expect(result.gapProfileImpossible).toBe(0);
  });
});

describe('idFromFilename', () => {
  it('strips the trailing .json extension, including intervals.icu "i"-prefixed ids', () => {
    expect(mod.idFromFilename('12345.json')).toBe('12345');
    expect(mod.idFromFilename('i182749188.json')).toBe('i182749188');
  });

  it('returns the input unchanged when it has no .json suffix', () => {
    expect(mod.idFromFilename('12345')).toBe('12345');
  });
});

describe('metadataFromActivity', () => {
  it('maps the four raw activity fields to the ActivityQualityMetadata shape', () => {
    const activity = {
      device_name: 'Garmin fēnix 6 Pro',
      source_provider: null,
      elapsed_time: 3600,
      moving_time: 3500,
    };

    expect(mod.metadataFromActivity(activity)).toEqual({
      deviceName: 'Garmin fēnix 6 Pro',
      sourceProvider: null,
      elapsedTimeSec: 3600,
      movingTimeSec: 3500,
    });
  });

  it('is total: a null/undefined activity returns all-undefined fields rather than throwing', () => {
    expect(() => mod.metadataFromActivity(null)).not.toThrow();
    expect(() => mod.metadataFromActivity(undefined)).not.toThrow();
  });
});

describe('parseResidualReport', () => {
  it('parses cohort size, residual count and residual ids from a hand-built markdown string', () => {
    const markdown = [
      '# Phase 26 PACE-06 Residual Report',
      '',
      '## Summary',
      '',
      '- Archive size scanned: 1866',
      '- Severe stair-step cohort size: 154',
      '- Residual count (after fast mass > 0.5% of covered time): 2',
      '- Max residual: 2.44%',
      '',
      '## Residual Activities',
      '',
      '| Activity ID | After % | Baseline % | Window (s) | Note |',
      '|---|---|---|---|---|',
      '| 4556693525 | 2.44% | 22.39% | 20.00 | Also the PACE-04 worked example |',
      '| 5059204779 | 1.17% | 100.00% | 150.00 | — |',
      '',
      '## Criterion 1 Reconciliation',
      '',
    ].join('\n');

    const parsed = mod.parseResidualReport(markdown);

    expect(parsed.cohortSize).toBe(154);
    expect(parsed.residualCount).toBe(2);
    expect(parsed.residualIds).toEqual(['4556693525', '5059204779']);
  });

  it('is total: an unparseable string returns nulls/empty rather than throwing', () => {
    const parsed = mod.parseResidualReport('not a residual report at all');
    expect(parsed.cohortSize).toBeNull();
    expect(parsed.residualCount).toBeNull();
    expect(parsed.residualIds).toEqual([]);
  });
});

describe('formatPct', () => {
  it('formats a fixed-1-decimal percentage', () => {
    expect(mod.formatPct(299, 1890)).toBe('15.8%');
  });

  it('returns N/A for a zero denominator rather than dividing by zero', () => {
    expect(mod.formatPct(5, 0)).toBe('N/A');
  });
});

describe('renderCalibrationMarkdown — the report renderer', () => {
  it('renders all seven numbered sections plus the composite statement for a hand-built report object', () => {
    const report = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      activityCount: 100,
      activityParseFailures: 0,
      streamCount: 98,
      streamParseFailures: 0,
      streamLessCount: 2,
      decimationSevereCount: 10,
      decimationMinorCount: 5,
      gapProfileSevereCount: 8,
      gapProfileMinorCount: 20,
      impossibleSevereCount: 3,
      impossibleMinorCount: 12,
      deviceFamilyCounts: [['garmin-fenix-6-pro', 50], ['no-device-name', 50]],
      elapsedVsMovingRatioCount: 100,
      elapsedVsMovingP10: 1.0,
      elapsedVsMovingP50: 1.02,
      elapsedVsMovingP90: 1.2,
      elapsedVsMovingMax: 5.0,
      compositeCount: 18,
      overlap: {
        exactlyOne: 15,
        exactlyTwo: 2,
        allThree: 1,
        decimationGapProfile: 2,
        decimationImpossible: 1,
        gapProfileImpossible: 1,
      },
      sanityGate: { pass: true, maxMarginal: 10, sumMarginals: 21 },
      dispositionParagraph: 'Hand-built disposition paragraph for the renderer smoke test.',
      crossCheckParagraph: 'Hand-built cross-check paragraph for the renderer smoke test.',
      thresholdSensitivitySection: null,
    };

    const markdown = mod.renderCalibrationMarkdown(report);

    for (const heading of [
      '## 1. Denominators',
      '## 2. Thresholds in Force',
      '## 3. Per-Signal Severe Cohorts',
      '## 4. THE COMPOSITE',
      '## 5. The D-02 Disposition Paragraph',
      '## 6. The D-04 Boundary Cross-Check',
      '## 7. Regeneration',
    ]) {
      expect(markdown).toContain(heading);
    }

    expect(markdown).toContain('18');
    expect(markdown).toContain('NOT the sum of the three marginals above (10 + 8 + 3 = 21)');
    expect(markdown).toContain('Hand-built disposition paragraph');
    expect(markdown).toContain('Hand-built cross-check paragraph');
  });
});
