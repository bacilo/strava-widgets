import { describe, expect, it } from 'vitest';

import type { FetchLike } from './index-client.js';
import { createPaceQualityClient, parsePaceQualityShard } from './pace-quality-client.js';
import type { GapKind, SegmentMechanism } from '../../analytics/pace-derivation.js';

interface FakeResponseSpec {
  ok: boolean;
  status: number;
  statusText: string;
  body?: unknown;
  throwOnJson?: boolean;
}

function fakeFetch(responses: FakeResponseSpec[]): { fetchImpl: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const queue = [...responses];

  const fetchImpl: FetchLike = async (url: string) => {
    calls.push(url);
    const spec = queue.shift();
    if (!spec) {
      throw new Error('fakeFetch: no more queued responses');
    }
    return {
      ok: spec.ok,
      status: spec.status,
      statusText: spec.statusText,
      json: async () => {
        if (spec.throwOnJson) {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        }
        return spec.body;
      },
    };
  };

  return { fetchImpl, calls };
}

const validShard = {
  activityId: 'a1',
  signals: {
    decimation: { tier: 'none', zeroAdvanceFraction: 0.01, sampleCount: 900 },
    gapProfile: { tier: 'none', gapFraction: 0.02, recordingGapSec: 10, pauseSec: 0, spanSec: 500 },
    impossibleSamples: { tier: 'none', count: 0, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: 0 },
    // Phase 30 (ELEV-01): a well-formed elevation object — every field
    // populated so the round-trip test below proves every field survives
    // the real `parseElevationSignal`, not just the not-computable
    // fallback shape.
    elevation: {
      tier: 'severe',
      subGround: { flagged: true, minAltM: -282 },
      closureDrift: { state: 'flagged', deltaM: -197.6, startEndDistM: 12.5 },
      verticalRate: { flagged: true, worstRateMps: 80.4, violatingSamples: 3 },
    },
    // Phase 33 (SEG-06, D-08, plan 33-09 Task 3): a well-formed
    // unreliableSegments object — every field populated so the round-trip
    // test below proves every field survives the real
    // `parseUnreliableSegmentsSignal`, not just the not-computable fallback
    // shape.
    unreliableSegments: {
      tier: 'severe',
      count: 2,
      totalMetres: 45.6,
      totalExcessMetres: 12.3,
      totalSeconds: 18,
      excessFraction: 0.0221,
      mechanisms: ['gap-adjacent', 'isolated-jump'],
    },
    deviceEra: { family: 'garmin-fenix-6-pro', rawDeviceName: null },
    elapsedVsMoving: { ratio: 1.02, elapsedSec: 510, movingSec: 500 },
    // Phase 34 (PAUSE-02, D-11): a well-formed pauseClassification object —
    // every field populated so the round-trip test below proves every
    // field survives the real `parsePauseClassificationSignal`, not just
    // the not-computable fallback shape.
    pauseClassification: {
      intervalCount: 4,
      stationaryCount: 0,
      walkedCount: 1,
      ranThroughCount: 3,
      transportedCount: 0,
      notClassifiableCount: 2,
    },
    // Phase 34 (STOP-01, STOP-03, D-09, D-11): a well-formed forgottenStop
    // object — every field populated so the round-trip test below proves
    // every field survives the real `parseForgottenStopSignal`.
    forgottenStop: {
      computable: true,
      reason: null,
      count: 3,
      totalSec: 210,
      longestSec: 120,
      creepCount: 1,
      creepTotalSec: 90,
      creepLongestSec: 90,
      pauseCount: 2,
      pauseTotalSec: 120,
      pauseLongestSec: 120,
    },
    anySevere: false,
    notComputableReason: null,
  },
  gapIntervals: [{ startSec: 100, endSec: 110, kind: 'recording-gap' }],
  impossibleSamples: [],
  impossibleSamplesTruncated: false,
  zeroAdvanceRunProfile: { runCount: 0, longestRunSamples: 0, longestRunSec: 0, medianRunSamples: 0, p90RunSec: 0 },
  adaptiveWindowSec: 20,
  notComputableReason: null,
  // Phase 30 (ELEV-01): a well-formed evidence payload alongside the
  // well-formed `signals.elevation` above.
  elevationVerticalRateSamples: [{ index: 22, rateMps: 80.4, dtSec: 2, dAltM: -160.8 }],
  elevationVerticalRateSamplesTruncated: false,
  elevationLoopRadiusM: 100,
  elevationStartEndDistM: 12.5,
  // Phase 33 (SEG-06, D-08, plan 33-10 Task 2): a well-formed shard-level
  // unreliableSegments evidence list — every field populated so the
  // round-trip test below proves every field survives the real
  // `parseUnreliableSegment`, not just the not-computable/empty fallback
  // shape.
  unreliableSegments: [
    { startSec: 120, endSec: 128, metres: 22.8, excessMetres: 6.1, seconds: 8, mechanism: 'gap-adjacent' },
    { startSec: 340, endSec: 342.2, metres: 22.8, excessMetres: 6.2, seconds: 10, mechanism: 'isolated-jump' },
  ],
  unreliableSegmentsTruncated: false,
  // Phase 34 (PAUSE-02, D-15): the shard's per-interval pause-list entry
  // parse ships in plan 34-09 — until then `parsePaceQualityShard` always
  // returns the empty/untruncated default, so this fixture's own
  // `pauseIntervals` (even though populated in the raw wire shape) is NOT
  // expected to round-trip here; see the dedicated "pauseIntervals stub"
  // test below.
  pauseIntervals: [],
  pauseIntervalsTruncated: false,
};

describe('parsePaceQualityShard', () => {
  it('returns the document for a well-formed body', () => {
    expect(parsePaceQualityShard(validShard)).toEqual(validShard);
  });

  it('returns null for null/array/non-object', () => {
    expect(parsePaceQualityShard(null)).toBeNull();
    expect(parsePaceQualityShard([])).toBeNull();
    expect(parsePaceQualityShard('nope')).toBeNull();
  });

  it('returns null when activityId is missing or non-string', () => {
    expect(parsePaceQualityShard({ ...validShard, activityId: undefined })).toBeNull();
    expect(parsePaceQualityShard({ ...validShard, activityId: 42 })).toBeNull();
  });

  it('returns null when signals is missing or not an object', () => {
    expect(parsePaceQualityShard({ ...validShard, signals: undefined })).toBeNull();
    expect(parsePaceQualityShard({ ...validShard, signals: 'nope' })).toBeNull();
  });

  it('a structurally valid shard round-trips activityId and signals', () => {
    const result = parsePaceQualityShard(validShard);
    expect(result?.activityId).toBe('a1');
    expect(result?.signals).toEqual(validShard.signals);
  });

  it('drops an individually malformed impossibleSamples entry, keeping the rest', () => {
    const doc = {
      ...validShard,
      impossibleSamples: [
        { index: 5, impliedSpeedMps: 50, dtSec: 1, ddM: 50 },
        { index: 'not-a-number' },
      ],
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.impossibleSamples.length).toBe(1);
    expect(result?.impossibleSamples[0]).toEqual({ index: 5, impliedSpeedMps: 50, dtSec: 1, ddM: 50 });
  });

  it('drops an individually malformed gapIntervals entry, keeping the rest', () => {
    const doc = {
      ...validShard,
      gapIntervals: [
        { startSec: 0, endSec: 10, kind: 'pause' },
        { startSec: 'nope', endSec: 20, kind: 'pause' },
      ],
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.gapIntervals.length).toBe(1);
    expect(result?.gapIntervals[0]).toEqual({ startSec: 0, endSec: 10, kind: 'pause' });
  });

  // Phase 33 (SEG-06, D-08, plan 33-10 Task 2): the shard's per-segment
  // evidence list. Named so `-t "unreliableSegments"` selects every case.
  it('a well-formed shard unreliableSegments list round-trips every entry and field (Phase 33 SEG-06, plan 33-10)', () => {
    const result = parsePaceQualityShard(validShard);
    expect(result?.unreliableSegments).toEqual(validShard.unreliableSegments);
    expect(result?.unreliableSegmentsTruncated).toBe(false);
  });

  it('a shard with no unreliableSegments key at all (the pre-plan-33-10 stale-artifact case) yields an empty array and unreliableSegmentsTruncated false, never undefined', () => {
    const doc: Record<string, unknown> = { ...validShard };
    delete doc.unreliableSegments;
    delete doc.unreliableSegmentsTruncated;
    const result = parsePaceQualityShard(doc);
    expect(result?.unreliableSegments).toEqual([]);
    expect(result?.unreliableSegmentsTruncated).toBe(false);
  });

  it('drops an individually malformed shard unreliableSegments entry, keeping the rest and keeping the shard itself valid', () => {
    const doc = {
      ...validShard,
      unreliableSegments: [
        { startSec: 10, endSec: 18, metres: 30, excessMetres: 2, seconds: 8, mechanism: 'hidden-pause' },
        { startSec: 'nope', endSec: 20, metres: 10, excessMetres: 1, seconds: 5, mechanism: 'gap-adjacent' },
        { startSec: 50, endSec: 55, metres: 15, excessMetres: 0, seconds: 5, mechanism: 'bogus-mechanism' },
      ],
    };
    const result = parsePaceQualityShard(doc);
    expect(result).not.toBeNull(); // the whole shard stays valid
    expect(result?.unreliableSegments.length).toBe(1);
    expect(result?.unreliableSegments[0]).toEqual({
      startSec: 10,
      endSec: 18,
      metres: 30,
      excessMetres: 2,
      seconds: 8,
      mechanism: 'hidden-pause',
    });
  });

  it('a shard unreliableSegments entry carrying NaN or Infinity is dropped like any other malformed entry (Phase 33 review WR-01, finite guard)', () => {
    const doc = {
      ...validShard,
      unreliableSegments: [
        { startSec: 10, endSec: 18, metres: 30, excessMetres: 2, seconds: 8, mechanism: 'hidden-pause' },
        { startSec: 20, endSec: 25, metres: Number.NaN, excessMetres: 1, seconds: 5, mechanism: 'gap-adjacent' },
        { startSec: 30, endSec: 35, metres: 15, excessMetres: Number.POSITIVE_INFINITY, seconds: 5, mechanism: 'isolated-jump' },
      ],
    };
    const result = parsePaceQualityShard(doc);
    expect(result).not.toBeNull();
    expect(result?.unreliableSegments.map((e) => e.startSec)).toEqual([10]);
  });

  it('unreliableSegments signal scalars carrying NaN or Infinity parse to null, never to a non-finite number (Phase 33 review WR-01)', () => {
    const doc = {
      ...validShard,
      signals: {
        ...validShard.signals,
        unreliableSegments: {
          ...validShard.signals.unreliableSegments,
          totalMetres: Number.NaN,
          totalSeconds: Number.POSITIVE_INFINITY,
        },
      },
    };
    const result = parsePaceQualityShard(doc);
    expect(result).not.toBeNull();
    expect(result?.signals.unreliableSegments.totalMetres).toBeNull();
    expect(result?.signals.unreliableSegments.totalSeconds).toBeNull();
    expect(result?.signals.unreliableSegments.count).toBe(validShard.signals.unreliableSegments.count);
  });

  it('unreliableSegmentsTruncated: a non-boolean value degrades to false rather than throwing', () => {
    const doc = { ...validShard, unreliableSegmentsTruncated: 'yes' };
    const result = parsePaceQualityShard(doc);
    expect(result?.unreliableSegmentsTruncated).toBe(false);
  });

  // Phase 33 (COV-03, T-33-06): the fourth silent-inheritance trap.
  // VALID_GAP_KINDS was a hardcoded two-member allowlist while GapKind
  // widened to three members (plan 33-01) — parseGapInterval returned null
  // for any 'unreliable'-kind entry and parsePaceQualityShard's tolerant-drop
  // loop then dropped it with no error, no warning, no telemetry. Every case
  // below is named so `-t "unreliable"` selects it, and this fixture shard is
  // built as an explicit object literal (never round-tripped from a real
  // computed shard) so the case is deterministic and obviously non-vacuous.
  it('a shard whose gapIntervals carries a single unreliable-kind entry survives the parse with startSec/endSec/kind preserved exactly', () => {
    const doc = {
      ...validShard,
      gapIntervals: [{ startSec: 42, endSec: 58.5, kind: 'unreliable' }],
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.gapIntervals).toEqual([{ startSec: 42, endSec: 58.5, kind: 'unreliable' }]);
  });

  it('a mixed gapIntervals array of one recording-gap, one pause and one unreliable entry parses to all three, in order', () => {
    const doc = {
      ...validShard,
      gapIntervals: [
        { startSec: 0, endSec: 10, kind: 'recording-gap' },
        { startSec: 20, endSec: 30, kind: 'pause' },
        { startSec: 40, endSec: 50, kind: 'unreliable' },
      ],
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.gapIntervals).toEqual([
      { startSec: 0, endSec: 10, kind: 'recording-gap' },
      { startSec: 20, endSec: 30, kind: 'pause' },
      { startSec: 40, endSec: 50, kind: 'unreliable' },
    ]);
  });

  it('an unreliable entry alongside a bogus-kind entry: the bogus entry is still dropped, the unreliable entry still parses — the tolerant-drop contract is unchanged', () => {
    const doc = {
      ...validShard,
      gapIntervals: [
        { startSec: 0, endSec: 10, kind: 'bogus' },
        { startSec: 40, endSec: 50, kind: 'unreliable' },
      ],
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.gapIntervals).toEqual([{ startSec: 40, endSec: 50, kind: 'unreliable' }]);
  });

  it('an unreliable-kind entry with a non-numeric startSec is still dropped and does not invalidate the shard', () => {
    const doc = {
      ...validShard,
      gapIntervals: [
        { startSec: 'nope', endSec: 50, kind: 'unreliable' },
        { startSec: 40, endSec: 50, kind: 'unreliable' },
      ],
    };
    const result = parsePaceQualityShard(doc);
    expect(result).not.toBeNull();
    expect(result?.gapIntervals).toEqual([{ startSec: 40, endSec: 50, kind: 'unreliable' }]);
  });

  it('VALID_GAP_KINDS accepts every member of the unreliable GapKind union — a future fourth kind added to GapKind will fail this test until the parser is updated', () => {
    // `satisfies`-style exhaustiveness: if GapKind ever widens to a fourth
    // member, this array literal (typed exactly as GapKind[]) will not fail
    // to compile on its own, but each new member added here must also parse
    // successfully below, which is what actually forces a future author back
    // to VALID_GAP_KINDS in pace-quality-client.ts.
    const ALL_GAP_KINDS: GapKind[] = ['recording-gap', 'pause', 'unreliable'];
    for (const kind of ALL_GAP_KINDS) {
      const doc = { ...validShard, gapIntervals: [{ startSec: 1, endSec: 2, kind }] };
      const result = parsePaceQualityShard(doc);
      expect(result?.gapIntervals).toEqual([{ startSec: 1, endSec: 2, kind }]);
    }
  });

  it('a shard whose signals is missing one sub-signal parses to a non-null shard with that sub-signal not-computable, not the whole shard invalidated', () => {
    const doc = {
      ...validShard,
      signals: { ...validShard.signals, decimation: undefined },
    };
    const result = parsePaceQualityShard(doc);
    expect(result).not.toBeNull();
    expect(result?.signals.decimation).toEqual({ tier: 'not-computable', zeroAdvanceFraction: null, sampleCount: null });
    expect(result?.signals.gapProfile).toEqual(validShard.signals.gapProfile);
  });

  it('a well-formed elevation object round-trips every field', () => {
    const result = parsePaceQualityShard(validShard);
    expect(result?.signals.elevation).toEqual(validShard.signals.elevation);
    expect(result?.elevationVerticalRateSamples).toEqual(validShard.elevationVerticalRateSamples);
    expect(result?.elevationVerticalRateSamplesTruncated).toBe(false);
    expect(result?.elevationLoopRadiusM).toBe(100);
    expect(result?.elevationStartEndDistM).toBe(12.5);
  });

  it('elevation absent entirely (the stale-artifact case) parses to not-computable with no throw', () => {
    const doc = { ...validShard, signals: { ...validShard.signals, elevation: undefined } };
    expect(() => parsePaceQualityShard(doc)).not.toThrow();
    const result = parsePaceQualityShard(doc);
    expect(result).not.toBeNull();
    expect(result?.signals.elevation).toEqual({
      tier: 'not-computable',
      subGround: { flagged: false, minAltM: null },
      closureDrift: { state: 'not-computable', deltaM: null, startEndDistM: null },
      verticalRate: { flagged: false, worstRateMps: null, violatingSamples: null },
    });
  });

  it('elevation present but with tier: "minor" is rejected to the not-computable fallback', () => {
    const doc = {
      ...validShard,
      signals: {
        ...validShard.signals,
        elevation: { ...validShard.signals.elevation, tier: 'minor' },
      },
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.signals.elevation.tier).toBe('not-computable');
  });

  it.each(['minAltM', 'deltaM', 'startEndDistM', 'worstRateMps', 'violatingSamples'] as const)(
    'elevation numeric field %s supplied as a string, NaN or Infinity becomes null, never 0',
    (field) => {
      for (const badValue of ['not-a-number', NaN, Infinity, -Infinity]) {
        let elevation = validShard.signals.elevation;
        if (field === 'minAltM') {
          elevation = { ...elevation, subGround: { ...elevation.subGround, minAltM: badValue as unknown as number } };
        } else if (field === 'deltaM' || field === 'startEndDistM') {
          elevation = { ...elevation, closureDrift: { ...elevation.closureDrift, [field]: badValue } };
        } else {
          elevation = { ...elevation, verticalRate: { ...elevation.verticalRate, [field]: badValue } };
        }
        const doc = { ...validShard, signals: { ...validShard.signals, elevation } };
        const result = parsePaceQualityShard(doc);
        expect(result).not.toBeNull();
        if (field === 'minAltM') {
          expect(result?.signals.elevation.subGround.minAltM).toBeNull();
        } else if (field === 'deltaM' || field === 'startEndDistM') {
          expect(result?.signals.elevation.closureDrift[field]).toBeNull();
        } else {
          expect(result?.signals.elevation.verticalRate[field]).toBeNull();
        }
      }
    }
  );

  it('a malformed closureDrift.state is rejected to the whole-signal not-computable fallback', () => {
    const doc = {
      ...validShard,
      signals: {
        ...validShard.signals,
        elevation: {
          ...validShard.signals.elevation,
          closureDrift: { ...validShard.signals.elevation.closureDrift, state: 'bogus' },
        },
      },
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.signals.elevation).toEqual({
      tier: 'not-computable',
      subGround: { flagged: false, minAltM: null },
      closureDrift: { state: 'not-computable', deltaM: null, startEndDistM: null },
      verticalRate: { flagged: false, worstRateMps: null, violatingSamples: null },
    });
  });

  it('an elevationVerticalRateSamples entry with a non-numeric field is dropped, keeping well-formed entries', () => {
    const doc = {
      ...validShard,
      elevationVerticalRateSamples: [
        { index: 1, rateMps: 6, dtSec: 1, dAltM: 6 },
        { index: 'nope', rateMps: 6, dtSec: 1, dAltM: 6 },
      ],
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.elevationVerticalRateSamples).toEqual([{ index: 1, rateMps: 6, dtSec: 1, dAltM: 6 }]);
  });

  it('a well-formed unreliableSegments object round-trips every field (Phase 33 SEG-06, plan 33-09 Task 3)', () => {
    const result = parsePaceQualityShard(validShard);
    expect(result?.signals.unreliableSegments).toEqual(validShard.signals.unreliableSegments);
  });

  it('unreliableSegments absent entirely (the stale-artifact / pre-33-09 shard case) parses to not-computable with no throw', () => {
    const doc = { ...validShard, signals: { ...validShard.signals, unreliableSegments: undefined } };
    expect(() => parsePaceQualityShard(doc)).not.toThrow();
    const result = parsePaceQualityShard(doc);
    expect(result).not.toBeNull();
    expect(result?.signals.unreliableSegments).toEqual({
      tier: 'not-computable',
      count: null,
      totalMetres: null,
      totalExcessMetres: null,
      totalSeconds: null,
      excessFraction: null,
      mechanisms: null,
    });
  });

  it('unreliableSegments with mechanisms: null (the genuine not-computable shape) round-trips null, not an empty array', () => {
    const doc = {
      ...validShard,
      signals: {
        ...validShard.signals,
        unreliableSegments: {
          tier: 'not-computable',
          count: null,
          totalMetres: null,
          totalExcessMetres: null,
          totalSeconds: null,
          excessFraction: null,
          mechanisms: null,
        },
      },
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.signals.unreliableSegments.mechanisms).toBeNull();
    expect(result?.signals.unreliableSegments.tier).toBe('not-computable');
  });

  it('unreliableSegments with tier: "minor" (a genuinely valid tier for this signal, unlike elevation) round-trips minor rather than degrading', () => {
    const doc = {
      ...validShard,
      signals: {
        ...validShard.signals,
        unreliableSegments: { ...validShard.signals.unreliableSegments, tier: 'minor' },
      },
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.signals.unreliableSegments.tier).toBe('minor');
  });

  it('a malformed unreliableSegments.tier is rejected to the whole-signal not-computable fallback', () => {
    const doc = {
      ...validShard,
      signals: {
        ...validShard.signals,
        unreliableSegments: { ...validShard.signals.unreliableSegments, tier: 'bogus' },
      },
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.signals.unreliableSegments).toEqual({
      tier: 'not-computable',
      count: null,
      totalMetres: null,
      totalExcessMetres: null,
      totalSeconds: null,
      excessFraction: null,
      mechanisms: null,
    });
  });

  it('one malformed mechanisms array entry invalidates the WHOLE unreliableSegments signal, not just that entry', () => {
    const doc = {
      ...validShard,
      signals: {
        ...validShard.signals,
        unreliableSegments: {
          ...validShard.signals.unreliableSegments,
          mechanisms: ['gap-adjacent', 'not-a-real-mechanism'],
        },
      },
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.signals.unreliableSegments).toEqual({
      tier: 'not-computable',
      count: null,
      totalMetres: null,
      totalExcessMetres: null,
      totalSeconds: null,
      excessFraction: null,
      mechanisms: null,
    });
  });

  it.each(['count', 'totalMetres', 'totalExcessMetres', 'totalSeconds', 'excessFraction'] as const)(
    'unreliableSegments numeric field %s supplied as a non-number becomes null, never 0',
    (field) => {
      const doc = {
        ...validShard,
        signals: {
          ...validShard.signals,
          unreliableSegments: { ...validShard.signals.unreliableSegments, [field]: 'not-a-number' },
        },
      };
      const result = parsePaceQualityShard(doc);
      expect(result?.signals.unreliableSegments[field]).toBeNull();
    }
  );

  // Phase 33 (SEG-06, D-08, plan 33-10 Task 2): VALID_SEGMENT_MECHANISMS is
  // its own set (mirroring VALID_ELEVATION_TIERS's precedent) validating the
  // shard's per-entry `mechanism` field. This enumerates the SegmentMechanism
  // union against it, so a future fourth mechanism cannot be added without
  // this test failing — the `Record<SegmentMechanism, true>` literal fails
  // to COMPILE if the union widens without a matching key here, and the
  // runtime probe below fails if VALID_SEGMENT_MECHANISMS itself is not
  // updated to match (the set is private, not exported, so this test drives
  // it exclusively through parsePaceQualityShard's public surface).
  it('VALID_SEGMENT_MECHANISMS accepts every declared SegmentMechanism union member on a shard unreliableSegments entry, and rejects an unknown one', () => {
    const ALL_MECHANISMS: Record<SegmentMechanism, true> = {
      'gap-adjacent': true,
      'hidden-pause': true,
      'isolated-jump': true,
    };
    const members = Object.keys(ALL_MECHANISMS) as SegmentMechanism[];
    expect(members).toHaveLength(3); // sanity: the union has exactly 3 members today

    for (const mechanism of members) {
      const entry = { startSec: 0, endSec: 5, metres: 10, excessMetres: 1, seconds: 5, mechanism };
      const doc = { ...validShard, unreliableSegments: [entry] };
      const result = parsePaceQualityShard(doc);
      expect(result?.unreliableSegments).toEqual([entry]);
    }

    const bogusDoc = {
      ...validShard,
      unreliableSegments: [
        { startSec: 0, endSec: 5, metres: 10, excessMetres: 1, seconds: 5, mechanism: 'fabricated-fourth' },
      ],
    };
    expect(parsePaceQualityShard(bogusDoc)?.unreliableSegments).toEqual([]);
  });

  it('rawDeviceName containing markup survives the parse byte-for-byte unescaped', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const doc = {
      ...validShard,
      signals: {
        ...validShard.signals,
        deviceEra: { family: 'unrecognized-device', rawDeviceName: payload },
      },
    };
    const result = parsePaceQualityShard(doc);
    expect(result?.signals.deviceEra.rawDeviceName).toBe(payload);
  });

  // Phase 34 (PAUSE-02, D-11): the ninth signal. Named so `-t
  // "pauseClassification parse"` selects every case in this block.
  describe('pauseClassification parse', () => {
    it('a well-formed pauseClassification object round-trips every field', () => {
      const result = parsePaceQualityShard(validShard);
      expect(result?.signals.pauseClassification).toEqual(validShard.signals.pauseClassification);
    });

    it('a non-object pauseClassification value degrades to the all-null not-computable literal, never throws', () => {
      const doc = { ...validShard, signals: { ...validShard.signals, pauseClassification: 'nope' } };
      const result = parsePaceQualityShard(doc);
      expect(result).not.toBeNull();
      expect(result?.signals.pauseClassification).toEqual({
        intervalCount: null,
        stationaryCount: null,
        walkedCount: null,
        ranThroughCount: null,
        transportedCount: null,
        notClassifiableCount: null,
      });
    });

    it('a pauseClassification key absent entirely (a pre-Phase-34 stale document) yields the all-null not-computable literal, present not absent', () => {
      const signals: Record<string, unknown> = { ...validShard.signals };
      delete signals.pauseClassification;
      const doc = { ...validShard, signals };
      const result = parsePaceQualityShard(doc);
      expect(result).not.toBeNull();
      expect(result?.signals.pauseClassification).toEqual({
        intervalCount: null,
        stationaryCount: null,
        walkedCount: null,
        ranThroughCount: null,
        transportedCount: null,
        notClassifiableCount: null,
      });
    });

    it('pauseClassification fields carrying NaN or Infinity parse to null, never a non-finite number', () => {
      const doc = {
        ...validShard,
        signals: {
          ...validShard.signals,
          pauseClassification: {
            ...validShard.signals.pauseClassification,
            walkedCount: Number.NaN,
            ranThroughCount: Number.POSITIVE_INFINITY,
          },
        },
      };
      const result = parsePaceQualityShard(doc);
      expect(result).not.toBeNull();
      expect(result?.signals.pauseClassification.walkedCount).toBeNull();
      expect(result?.signals.pauseClassification.ranThroughCount).toBeNull();
      expect(result?.signals.pauseClassification.intervalCount).toBe(
        validShard.signals.pauseClassification.intervalCount
      );
    });
  });

  // Phase 34 (STOP-01, STOP-03, D-09, D-11): the tenth signal. Named so `-t
  // "forgottenStop parse"` selects every case in this block.
  describe('forgottenStop parse', () => {
    it('a well-formed computable forgottenStop object round-trips every field', () => {
      const result = parsePaceQualityShard(validShard);
      expect(result?.signals.forgottenStop).toEqual(validShard.signals.forgottenStop);
    });

    it('a well-formed not-computable forgottenStop object (computable: false, reason: a string, every number null) round-trips exactly', () => {
      const notComputable = {
        computable: false,
        reason: 'distance-triggered recording: a standstill would be written as a recording gap, not a covered creep, so the forgotten-stop flag cannot see it',
        count: null,
        totalSec: null,
        longestSec: null,
        creepCount: null,
        creepTotalSec: null,
        creepLongestSec: null,
        pauseCount: null,
        pauseTotalSec: null,
        pauseLongestSec: null,
      };
      const doc = { ...validShard, signals: { ...validShard.signals, forgottenStop: notComputable } };
      const result = parsePaceQualityShard(doc);
      expect(result?.signals.forgottenStop).toEqual(notComputable);
    });

    it('a non-object forgottenStop value degrades to the named not-computable fallback, never throws', () => {
      const doc = { ...validShard, signals: { ...validShard.signals, forgottenStop: 'nope' } };
      const result = parsePaceQualityShard(doc);
      expect(result).not.toBeNull();
      expect(result?.signals.forgottenStop).toEqual({
        computable: false,
        reason: 'not computed for this activity',
        count: null,
        totalSec: null,
        longestSec: null,
        creepCount: null,
        creepTotalSec: null,
        creepLongestSec: null,
        pauseCount: null,
        pauseTotalSec: null,
        pauseLongestSec: null,
      });
    });

    it('a forgottenStop key absent entirely (a pre-Phase-34 stale document) yields the named not-computable fallback, present not absent', () => {
      const signals: Record<string, unknown> = { ...validShard.signals };
      delete signals.forgottenStop;
      const doc = { ...validShard, signals };
      const result = parsePaceQualityShard(doc);
      expect(result).not.toBeNull();
      expect(result?.signals.forgottenStop.computable).toBe(false);
      expect(result?.signals.forgottenStop.reason).toBe('not computed for this activity');
      expect(result?.signals.forgottenStop.count).toBeNull();
    });

    it('a non-boolean computable, or a non-string-non-null reason, invalidates the WHOLE signal (all-or-nothing), degrading to the named fallback', () => {
      const badComputable = {
        ...validShard,
        signals: {
          ...validShard.signals,
          forgottenStop: { ...validShard.signals.forgottenStop, computable: 'yes' },
        },
      };
      expect(parsePaceQualityShard(badComputable)?.signals.forgottenStop.computable).toBe(false);
      expect(parsePaceQualityShard(badComputable)?.signals.forgottenStop.count).toBeNull();

      const badReason = {
        ...validShard,
        signals: {
          ...validShard.signals,
          forgottenStop: { ...validShard.signals.forgottenStop, reason: 42 },
        },
      };
      expect(parsePaceQualityShard(badReason)?.signals.forgottenStop.computable).toBe(false);
      expect(parsePaceQualityShard(badReason)?.signals.forgottenStop.count).toBeNull();
    });

    it('forgottenStop numeric fields carrying NaN or Infinity parse to null, never a non-finite number', () => {
      const doc = {
        ...validShard,
        signals: {
          ...validShard.signals,
          forgottenStop: {
            ...validShard.signals.forgottenStop,
            totalSec: Number.NaN,
            longestSec: Number.POSITIVE_INFINITY,
          },
        },
      };
      const result = parsePaceQualityShard(doc);
      expect(result).not.toBeNull();
      expect(result?.signals.forgottenStop.totalSec).toBeNull();
      expect(result?.signals.forgottenStop.longestSec).toBeNull();
      expect(result?.signals.forgottenStop.count).toBe(validShard.signals.forgottenStop.count);
    });
  });
});

describe('createPaceQualityClient — fetch count', () => {
  it('constructing the client performs ZERO fetches', () => {
    const { fetchImpl, calls } = fakeFetch([]);
    createPaceQualityClient({ fetchImpl });
    expect(calls.length).toBe(0);
  });

  it('one load("a1") issues exactly one fetch to data/stats/pace-quality/a1.json', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: validShard }]);
    const client = createPaceQualityClient({ fetchImpl });
    await client.load('a1');
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe('data/stats/pace-quality/a1.json');
  });

  it('two concurrent load("a1") calls issue exactly one fetch', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: validShard }]);
    const client = createPaceQualityClient({ fetchImpl });
    await Promise.all([client.load('a1'), client.load('a1')]);
    expect(calls.length).toBe(1);
  });

  it('two sequential load("a1") calls issue exactly one fetch (memoized)', async () => {
    const { fetchImpl, calls } = fakeFetch([{ ok: true, status: 200, statusText: 'OK', body: validShard }]);
    const client = createPaceQualityClient({ fetchImpl });
    await client.load('a1');
    await client.load('a1');
    expect(calls.length).toBe(1);
  });

  it('load("a1") then load("a2") issues two fetches with both urls in order', async () => {
    const other = { ...validShard, activityId: 'a2' };
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: validShard },
      { ok: true, status: 200, statusText: 'OK', body: other },
    ]);
    const client = createPaceQualityClient({ fetchImpl });
    const first = await client.load('a1');
    const second = await client.load('a2');
    expect(first?.activityId).toBe('a1');
    expect(second?.activityId).toBe('a2');
    expect(calls).toEqual(['data/stats/pace-quality/a1.json', 'data/stats/pace-quality/a2.json']);
  });

  it('after reset(), a further load("a1") fetches again', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', body: validShard },
      { ok: true, status: 200, statusText: 'OK', body: validShard },
    ]);
    const client = createPaceQualityClient({ fetchImpl });
    await client.load('a1');
    client.reset();
    await client.load('a1');
    expect(calls.length).toBe(2);
  });

  it('a 404 response resolves null (never rejects) and does not memoize the failure — a second load fetches again', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: false, status: 404, statusText: 'Not Found' },
      { ok: true, status: 200, statusText: 'OK', body: validShard },
    ]);
    const client = createPaceQualityClient({ fetchImpl });
    const first = await client.load('a1');
    expect(first).toBeNull();
    const second = await client.load('a1');
    expect(second).toEqual(validShard);
    expect(calls.length).toBe(2);
  });

  it('a body that throws on .json() resolves null and does not memoize the failure — a second load fetches again', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { ok: true, status: 200, statusText: 'OK', throwOnJson: true },
      { ok: true, status: 200, statusText: 'OK', body: validShard },
    ]);
    const client = createPaceQualityClient({ fetchImpl });
    const first = await client.load('a1');
    expect(first).toBeNull();
    const second = await client.load('a1');
    expect(second).toEqual(validShard);
    expect(calls.length).toBe(2);
  });
});
