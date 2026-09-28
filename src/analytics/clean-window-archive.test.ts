/**
 * Archive-wide invariants for the clean-window search (Phase 36 plan 36-06).
 *
 * ONE shared sweep, in `beforeAll`, over every `available` activity in the
 * REAL committed `data/streams/manifest.json` — reading only TRACKED,
 * committed inputs: `data/streams/{id}.json` and `data/activities/{id}.json`.
 *
 * This file NEVER reads anything under the derived, gitignored stats output
 * directory or the gitignored dashboard output directory (both absent on a
 * fresh runner — Phase 31 TD-01), and NEVER
 * reads the owner-editable `data/best-effort-exclusions.json` (28 WR-09's
 * lesson: a test depending on that file breaks the nightly deploy gate the
 * moment the owner edits it). The exclusion list is applied identically
 * under both of D-01's readings, so it cannot be what makes them differ —
 * that is why omitting it is sound for the equivalence claim below, not an
 * oversight.
 *
 * This file WRITES NOTHING — no filesystem write call of any kind, no temp
 * directory. Every number quoted from `36-CONTEXT.md`/`36-RESEARCH.md` below
 * is a REFERENCE to reconcile against, logged via `console.log` and recorded
 * in the plan's SUMMARY — never asserted as a pinned expected value (that
 * rule is ROADMAP criterion 1's own, repeated verbatim across this phase).
 *
 * Three invariants share the one sweep:
 *   1. `whole-span versus burst-only equivalence (PR-06, D-01)` — the two
 *      exclusion readings agree on the moved/unchanged/no-clean-window
 *      census and on every per-distance ceiling, with their genuine
 *      difference asserted FIRST so the agreement cannot be vacuous.
 *   2. `overlap invariant (PR-08, D-03)` — no RANKED effort's interval
 *      overlaps any segment the DETECTOR reports, watched failing on a
 *      deliberately widened sub-interval before it is trusted.
 *   3. `reason bound (D-07)` — every contamination/no-clean reason string is
 *      within its stated length bound, table-safe, capped and
 *      adjective-free, with the full census the artifact plans (36-10,
 *      36-11, 36-12) need recorded via `console.log`.
 */

import fs from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  CONTAMINATION_REASON_SEGMENT_CAP,
  complementSubIntervals,
  computeActivityEfforts,
  segmentsIntersectingWindow,
  wholeSpanCuts,
} from './compute-best-efforts.js';
import type { ActivityEffortResult, CleanSubInterval } from './compute-best-efforts.js';
import { findBestEffort, isPlausible, validateStreamSeries, WORLD_RECORD_SPEED_MPS } from './best-effort-utils.js';
import { deriveCeilings } from './best-effort-ceiling.js';
import { TARGET_METERS, TARGET_ORDER } from './best-effort.types.js';
import type { ComputedEffort, RawEffort, TargetDistanceKey } from './best-effort.types.js';
import { classifyGapsWithSegments } from './pace-derivation.js';
import type { UnreliableSegment } from './pace-derivation.js';
import type { CanonicalStream, DistanceSource } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';

// ---------------------------------------------------------------------------
// The shared sweep's per-activity/distance storage
// ---------------------------------------------------------------------------

interface DistancePairData {
  distance: TargetDistanceKey;
  raw: RawEffort;
  intersects: boolean;
  wholeSpanClean: RawEffort | undefined;
  burstOnlyClean: RawEffort | undefined;
}

interface ActivitySweepEntry {
  activityId: string;
  t: number[];
  d: number[];
  segments: UnreliableSegment[];
  maxSpeedMps: number | undefined;
  /** The whole-span reading's complement length — a sub-interval COUNT, not a cut count. */
  wholeSpanComplementLength: number;
  /** The burst-only reading's complement length. */
  burstOnlyComplementLength: number;
  pairs: DistancePairData[];
  /**
   * The REAL, shipped `computeActivityEfforts` result — fed the real
   * detector segments, exactly as `compute-best-efforts.ts`'s own per-
   * activity loop calls it. Tasks 2 and 3 assert on THESE records, never on
   * a re-implementation.
   */
  shippedResult: ActivityEffortResult;
}

let sweepEntries: ActivitySweepEntry[] = [];
let skippedCount = 0;
let segmentCarryingCount = 0;
let sweepWallClockMs = 0;

beforeAll(() => {
  const sweepStart = Date.now();

  const manifest = JSON.parse(
    fs.readFileSync(path.join('data/streams', 'manifest.json'), 'utf-8')
  ) as {
    activities: Record<string, { available: boolean; distanceSource: DistanceSource }>;
  };

  const availableIds = Object.entries(manifest.activities)
    .filter(([, entry]) => entry.available)
    .map(([id]) => id);

  for (const id of availableIds) {
    let stream: CanonicalStream;
    let activity: StravaActivity;
    try {
      stream = JSON.parse(
        fs.readFileSync(path.join('data/streams', `${id}.json`), 'utf-8')
      ) as CanonicalStream;
      activity = JSON.parse(
        fs.readFileSync(path.join('data/activities', `${id}.json`), 'utf-8')
      ) as StravaActivity;
    } catch {
      // Missing or unreadable stream/activity file — skip and count, never abort the sweep.
      skippedCount++;
      continue;
    }

    const seriesValidation = validateStreamSeries(stream.t, stream.d);
    if (!seriesValidation.ok) {
      skippedCount++;
      continue;
    }

    // The detector's ONE permitted accessor, called exactly once per
    // activity, with no options — the same call the production per-activity
    // loop makes (`compute-best-efforts.ts`).
    const { segments } = classifyGapsWithSegments(stream.t, stream.d);
    if (segments.length > 0) segmentCarryingCount++;

    // D-01's whole-span reading (the shipped reading, `wholeSpanCuts`) and
    // the burst-only reading (`parts[].kind === 'burst'`, per this plan's
    // own `<interfaces>` block) — both cut lists, both complements, built
    // ONCE per activity here, shared by every distance below.
    const wholeSpanCutList = wholeSpanCuts(segments);
    const burstOnlyCutList: CleanSubInterval[] = segments.flatMap((s) =>
      s.parts
        .filter((p) => p.kind === 'burst')
        .map((p) => ({ startIndex: p.startIndex, endIndex: p.endIndex }))
    );
    const wholeSpanComplement = complementSubIntervals(stream.t.length, wholeSpanCutList);
    const burstOnlyComplement = complementSubIntervals(stream.t.length, burstOnlyCutList);

    // Same eligibility rule production uses (`compute-best-efforts.ts`'s
    // `computeActivityEfforts`): a 1% margin absorbs the difference between
    // the canonical `distance` field and the stream's own span.
    const eligibleTargets = TARGET_ORDER.filter(
      (key) => activity.distance >= TARGET_METERS[key] * 0.99
    );

    const pairs: DistancePairData[] = [];
    for (const key of eligibleTargets) {
      const raw = findBestEffort(stream.t, stream.d, TARGET_METERS[key]);
      if (!raw) continue; // stream never covers this distance — not an error

      const intersects = segmentsIntersectingWindow(segments, raw).length > 0;

      let wholeSpanClean: RawEffort | undefined;
      for (const sub of wholeSpanComplement) {
        const candidate = findBestEffort(stream.t, stream.d, TARGET_METERS[key], sub);
        if (candidate && (!wholeSpanClean || candidate.durationSec < wholeSpanClean.durationSec)) {
          wholeSpanClean = candidate;
        }
      }

      let burstOnlyClean: RawEffort | undefined;
      for (const sub of burstOnlyComplement) {
        const candidate = findBestEffort(stream.t, stream.d, TARGET_METERS[key], sub);
        if (candidate && (!burstOnlyClean || candidate.durationSec < burstOnlyClean.durationSec)) {
          burstOnlyClean = candidate;
        }
      }

      pairs.push({ distance: key, raw, intersects, wholeSpanClean, burstOnlyClean });
    }

    // The REAL, shipped path — fed the real detector segments, exactly the
    // production per-activity loop's own call. Tasks 2/3 assert on this.
    const shippedResult = computeActivityEfforts({
      activityId: id,
      startDate: activity.start_date,
      activityDistanceM: activity.distance,
      maxSpeedMps: activity.max_speed,
      distanceSource: manifest.activities[id].distanceSource,
      t: stream.t,
      d: stream.d,
      segments,
    });

    sweepEntries.push({
      activityId: id,
      t: stream.t,
      d: stream.d,
      segments,
      maxSpeedMps: activity.max_speed,
      wholeSpanComplementLength: wholeSpanComplement.length,
      burstOnlyComplementLength: burstOnlyComplement.length,
      pairs,
      shippedResult,
    });
  }

  sweepWallClockMs = Date.now() - sweepStart;

  // eslint-disable-next-line no-console
  console.log(
    `clean-window-archive sweep: ${sweepEntries.length} activities processed, ` +
      `${skippedCount} skipped (missing file or invalid series), ` +
      `${segmentCarryingCount} carrying >=1 segment, ${sweepWallClockMs}ms wall-clock ` +
      `(${availableIds.length} available per manifest)`
  );
}, 300_000);

// ---------------------------------------------------------------------------
// Task 1: whole-span versus burst-only equivalence (PR-06, D-01)
// ---------------------------------------------------------------------------

describe('whole-span versus burst-only equivalence (PR-06, D-01)', () => {
  it('NON-VACUITY FIRST: the two cut lists genuinely differ for 3475724402, and archive-wide at least one activity differs — without this, the equivalence assertion below could pass for free if the two readings ever collapsed into one', () => {
    const entry = sweepEntries.find((e) => e.activityId === '3475724402');
    expect(entry).toBeDefined();

    // eslint-disable-next-line no-console
    console.log(
      `3475724402: whole-span complement length ${entry!.wholeSpanComplementLength}, ` +
        `burst-only complement length ${entry!.burstOnlyComplementLength} ` +
        `(36-CONTEXT.md probe reference: 17 versus 26)`
    );
    expect(entry!.wholeSpanComplementLength).not.toBe(entry!.burstOnlyComplementLength);

    const archiveWideDiffers = sweepEntries.some(
      (e) => e.wholeSpanComplementLength !== e.burstOnlyComplementLength
    );
    expect(archiveWideDiffers).toBe(true);
  });

  it('the moved/unchanged/no-clean-window counts are IDENTICAL between the two readings', () => {
    // Classification mirrors production's own three-branch shape
    // (`compute-best-efforts.ts`'s `computeActivityEfforts`): `unchanged`
    // when the raw window never intersects a segment (same fact under both
    // readings — it is a property of the detector's real segments, not of
    // either cut-list reading); `noClean` when it intersects and no clean
    // sub-interval covers the distance under THIS reading; `moved`
    // otherwise (a clean sub-interval was found under this reading, and its
    // duration differs from the raw one — the ordinary case once a segment
    // is excluded).
    function classify(pair: DistancePairData, clean: RawEffort | undefined): 'moved' | 'unchanged' | 'noClean' {
      if (!pair.intersects) return 'unchanged';
      if (!clean) return 'noClean';
      return clean.durationSec !== pair.raw.durationSec ? 'moved' : 'unchanged';
    }

    const wholeSpanCounts = { moved: 0, unchanged: 0, noClean: 0 };
    const burstOnlyCounts = { moved: 0, unchanged: 0, noClean: 0 };

    for (const entry of sweepEntries) {
      for (const pair of entry.pairs) {
        wholeSpanCounts[classify(pair, pair.wholeSpanClean)]++;
        burstOnlyCounts[classify(pair, pair.burstOnlyClean)]++;
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `whole-span reading: moved=${wholeSpanCounts.moved} unchanged=${wholeSpanCounts.unchanged} noClean=${wholeSpanCounts.noClean}`
    );
    // eslint-disable-next-line no-console
    console.log(
      `burst-only reading: moved=${burstOnlyCounts.moved} unchanged=${burstOnlyCounts.unchanged} noClean=${burstOnlyCounts.noClean}`
    );
    // eslint-disable-next-line no-console
    console.log(
      `36-CONTEXT.md probe reference: 1200 moved / 7352 unchanged / 439 no-clean-window`
    );

    expect(wholeSpanCounts.moved).toBe(burstOnlyCounts.moved);
    expect(wholeSpanCounts.unchanged).toBe(burstOnlyCounts.unchanged);
    expect(wholeSpanCounts.noClean).toBe(burstOnlyCounts.noClean);
  });

  it('per-distance populationN, p90Mps (4dp) and ceilingMps (4dp) are equal between the two readings, including the both-null fail-open case with equal failOpenReason', () => {
    // Production's own population-entry rule (`compute-best-efforts.ts`
    // Pass 1's `byDistance` accumulator, mirrored here read-only): an
    // effort enters only when it does not intersect (raw speed) or when a
    // clean window exists (clean speed) AND `isPlausible(...).ok` is true.
    // A no-clean-window pair enters neither population.
    function buildPopulation(
      readingClean: 'wholeSpanClean' | 'burstOnlyClean'
    ): Map<TargetDistanceKey, number[]> {
      const populations = new Map<TargetDistanceKey, number[]>();
      for (const key of TARGET_ORDER) populations.set(key, []);

      for (const entry of sweepEntries) {
        for (const pair of entry.pairs) {
          let speedMps: number | undefined;
          if (!pair.intersects) {
            speedMps = TARGET_METERS[pair.distance] / pair.raw.durationSec;
          } else {
            const clean = pair[readingClean];
            if (clean) speedMps = TARGET_METERS[pair.distance] / clean.durationSec;
          }
          if (speedMps === undefined) continue; // no-clean-window pair: neither population

          const plausibility = isPlausible(
            speedMps,
            entry.maxSpeedMps,
            WORLD_RECORD_SPEED_MPS[pair.distance]
          );
          if (plausibility.ok) populations.get(pair.distance)!.push(speedMps);
        }
      }
      return populations;
    }

    const wholeSpanCeilings = deriveCeilings(buildPopulation('wholeSpanClean'));
    const burstOnlyCeilings = deriveCeilings(buildPopulation('burstOnlyClean'));

    for (const key of TARGET_ORDER) {
      const a = wholeSpanCeilings[key];
      const b = burstOnlyCeilings[key];

      // eslint-disable-next-line no-console
      console.log(
        `${key}: whole-span popN=${a.populationN} p90=${a.p90Mps} ceiling=${a.ceilingMps}; ` +
          `burst-only popN=${b.populationN} p90=${b.p90Mps} ceiling=${b.ceilingMps}`
      );

      expect(a.populationN).toBe(b.populationN);

      if (a.ceilingMps === null || b.ceilingMps === null) {
        expect(a.ceilingMps).toBeNull();
        expect(b.ceilingMps).toBeNull();
        expect(a.p90Mps).toBeNull();
        expect(b.p90Mps).toBeNull();
        expect(a.failOpenReason).toBe(b.failOpenReason);
      } else {
        expect(a.p90Mps).toBeCloseTo(b.p90Mps!, 4);
        expect(a.ceilingMps).toBeCloseTo(b.ceilingMps, 4);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Task 2: overlap invariant (PR-08, D-03)
// ---------------------------------------------------------------------------

describe('overlap invariant (PR-08, D-03)', () => {
  // 0.5 s because `startOffsetSec` is written through `Math.round`
  // (`compute-best-efforts.ts`'s `efforts.push` site); 0.05 s because
  // `endOffsetSec` is written through `round1`; plus float slack. This
  // tolerance can only WEAKEN the invariant in the touching direction — the
  // planted violation below is required to exceed it, proving the invariant
  // still catches a real defect.
  const TOLERANCE_SEC = 0.6;

  interface OverlapViolation {
    distance: TargetDistanceKey;
    segStartSec: number;
    segEndSec: number;
    startOffsetSec: number;
    endOffsetSec: number;
    overlapSec: number;
  }

  /**
   * Judges any effort ARRAY against the DETECTOR's own `segments` — never
   * against the partition code's internal state (T-36-30). Considers only
   * RANKED efforts (`effort.demotion === null`); a no-clean-window effort
   * has `demotion` set and DOES overlap by design (D-06), so including it
   * here would make the invariant unsatisfiable.
   */
  function overlapViolations(
    efforts: readonly ComputedEffort[],
    segments: readonly UnreliableSegment[]
  ): OverlapViolation[] {
    const ranked = efforts.filter((e) => e.demotion === null);
    const violations: OverlapViolation[] = [];

    for (const effort of ranked) {
      for (const seg of segments) {
        const violates =
          seg.startSec < effort.endOffsetSec - TOLERANCE_SEC &&
          effort.startOffsetSec + TOLERANCE_SEC < seg.endSec;
        if (!violates) continue;

        const overlapSec =
          Math.min(effort.endOffsetSec, seg.endSec) - Math.max(effort.startOffsetSec, seg.startSec);
        violations.push({
          distance: effort.distance,
          segStartSec: seg.startSec,
          segEndSec: seg.endSec,
          startOffsetSec: effort.startOffsetSec,
          endOffsetSec: effort.endOffsetSec,
          overlapSec,
        });
      }
    }
    return violations;
  }

  it(
    'THE SHIPPED DIRECTION: no ranked effort interval overlaps a detected segment, archive-wide; the maximum zero-tolerance overlap is logged',
    () => {
      const allViolations: string[] = [];
      let maxZeroToleranceOverlap = -Infinity;
      let maxZeroToleranceInfo = '(none)';

      for (const entry of sweepEntries) {
        const violations = overlapViolations(entry.shippedResult.efforts, entry.segments);
        for (const v of violations) {
          allViolations.push(
            `${entry.activityId} ${v.distance}: effort [${v.startOffsetSec}, ${v.endOffsetSec}] ` +
              `overlaps segment [${v.segStartSec}, ${v.segEndSec}] by ${v.overlapSec.toFixed(3)}s`
          );
        }

        // Zero-tolerance scan: log the maximum overlap even where the
        // tolerance above would forgive it, so a window sitting fractions
        // of a second inside a segment stays visible.
        const ranked = entry.shippedResult.efforts.filter((e) => e.demotion === null);
        for (const effort of ranked) {
          for (const seg of entry.segments) {
            const overlap =
              Math.min(effort.endOffsetSec, seg.endSec) - Math.max(effort.startOffsetSec, seg.startSec);
            if (overlap > maxZeroToleranceOverlap) {
              maxZeroToleranceOverlap = overlap;
              maxZeroToleranceInfo = `${entry.activityId} ${effort.distance}`;
            }
          }
        }
      }

      // eslint-disable-next-line no-console
      console.log(
        `overlap invariant: ${allViolations.length} violation(s) archive-wide (TOLERANCE_SEC=${TOLERANCE_SEC}); ` +
          `maximum zero-tolerance overlap ${maxZeroToleranceOverlap === -Infinity ? 'n/a (no segments)' : maxZeroToleranceOverlap.toFixed(3) + 's'} at ${maxZeroToleranceInfo}`
      );

      expect(allViolations, allViolations.join('\n')).toEqual([]);
    },
    120_000
  );

  it('THE PLANTED DIRECTION, watched RED first: a partition widened by cut.startIndex + 2 (one index too far, reaching one pair INTO the segment) produces an overlap strictly greater than TOLERANCE_SEC on the real activity 3475740390', () => {
    // Identical to `complementSubIntervals` except the pre-cut sub-interval
    // ends at `cut.startIndex + 2` instead of `+ 1` — deliberately one index
    // too far, per D-03's own required "watched failing on a deliberately
    // widened sub-interval" bound.
    function widenedComplement(
      streamLength: number,
      cuts: readonly CleanSubInterval[]
    ): CleanSubInterval[] {
      if (streamLength < 2) return [];
      const sorted = [...cuts].sort((a, b) => a.startIndex - b.startIndex);
      const subs: CleanSubInterval[] = [];
      let cursor = 0;
      for (const cut of sorted) {
        if (cut.startIndex >= cursor + 1) {
          subs.push({ startIndex: cursor, endIndex: cut.startIndex + 2 });
        }
        cursor = Math.max(cursor, cut.endIndex);
      }
      if (streamLength - cursor >= 2) subs.push({ startIndex: cursor, endIndex: streamLength });
      return subs;
    }

    const entry = sweepEntries.find((e) => e.activityId === '3475740390');
    expect(entry).toBeDefined();
    const key: TargetDistanceKey = '400m';

    const widened = widenedComplement(entry!.t.length, wholeSpanCuts(entry!.segments));

    // Every widened sub-interval's own best-candidate window, fed to the
    // SAME `overlapViolations` function that judges the shipped output —
    // this is the "is the invariant capable of catching the smallest
    // possible widening" proof, asserted against the detector's own
    // segments (`classifyGapsWithSegments`'s output), independently of
    // whatever the partition decided.
    const plantedEfforts: ComputedEffort[] = [];
    for (const sub of widened) {
      const candidate = findBestEffort(entry!.t, entry!.d, TARGET_METERS[key], sub);
      if (!candidate) continue;
      plantedEfforts.push({
        distance: key,
        durationSec: candidate.durationSec,
        paceSecPerKm: candidate.durationSec / (TARGET_METERS[key] / 1000),
        startOffsetSec: candidate.startOffsetSec,
        endOffsetSec: candidate.endOffsetSec,
        lowConfidence: false,
        demotion: null,
        contaminated: null,
      });
    }
    expect(plantedEfforts.length).toBeGreaterThan(0);

    const violations = overlapViolations(plantedEfforts, entry!.segments);
    expect(violations.length).toBeGreaterThan(0);

    const maxOverlap = Math.max(...violations.map((v) => v.overlapSec));
    // eslint-disable-next-line no-console
    console.log(
      `planted widening (3475740390@400m, cut.startIndex + 2): ${violations.length} candidate window(s) violate; ` +
        `max observed overlap ${maxOverlap.toFixed(3)}s against TOLERANCE_SEC=${TOLERANCE_SEC}`
    );

    // The two-direction proof: if the smallest possible widening produced
    // an overlap the tolerance forgave, the invariant could not catch a
    // real defect. TOLERANCE_SEC is never widened to accommodate this.
    expect(maxOverlap).toBeGreaterThan(TOLERANCE_SEC);
  });
});

// ---------------------------------------------------------------------------
// Task 3: reason bound (D-07), and the census the artifact plans need
// ---------------------------------------------------------------------------

describe('reason bound (D-07)', () => {
  // Phase 27 D-09's house register: measured numbers, never adjectives.
  const BANNED_ADJECTIVES = ['unrealistic', 'implausible', 'suspicious', 'bad', 'wrong'];

  interface CollectedReason {
    reason: string;
    activityId: string;
    distance: TargetDistanceKey;
  }

  function collectReasonStrings(): CollectedReason[] {
    const collected: CollectedReason[] = [];
    for (const entry of sweepEntries) {
      for (const effort of entry.shippedResult.efforts) {
        if (effort.contaminated !== null) {
          collected.push({
            reason: effort.contaminated.reason,
            activityId: entry.activityId,
            distance: effort.distance,
          });
        }
        if (effort.demotion !== null && effort.demotion.guard === 'unreliable-segment') {
          collected.push({
            reason: effort.demotion.reason,
            activityId: entry.activityId,
            distance: effort.distance,
          });
        }
      }
    }
    return collected;
  }

  it('collects a NON-EMPTY set of reason strings archive-wide — a bound asserted over an empty set is vacuous', () => {
    const collected = collectReasonStrings();
    // eslint-disable-next-line no-console
    console.log(`reason bound: ${collected.length} reason strings collected archive-wide`);
    expect(collected.length).toBeGreaterThan(0);
  });

  it('every reason string is at most 320 characters — the cap is never raised to accommodate a long string, only reported', () => {
    const collected = collectReasonStrings();
    let maxLength = 0;
    let maxInfo = '(none)';
    for (const c of collected) {
      if (c.reason.length > maxLength) {
        maxLength = c.reason.length;
        maxInfo = `${c.activityId} ${c.distance}`;
      }
    }
    // eslint-disable-next-line no-console
    console.log(`reason bound: maximum observed length ${maxLength} at ${maxInfo} (cap 320)`);
    expect(maxLength).toBeLessThanOrEqual(320);
  });

  it('every reason string contains no "|", no "\\n" and no "\\r" — the T-28-07-B table-safety discipline, an upstream check, not a substitute for the generators\' own safeCell sanitization (scripts/compute-pr-ceiling-diff.mjs)', () => {
    const collected = collectReasonStrings();
    const offenders = collected.filter(
      (c) => c.reason.includes('|') || c.reason.includes('\n') || c.reason.includes('\r')
    );
    expect(offenders.map((o) => `${o.activityId} ${o.distance}: ${o.reason}`)).toEqual([]);
  });

  it('names at most CONTAMINATION_REASON_SEGMENT_CAP segments individually, and any "+N more" clause\'s N equals the exact arithmetic (statedCount - cap), parsed and checked, not substring-matched', () => {
    const collected = collectReasonStrings();
    let moreClauseCount = 0;

    for (const c of collected) {
      // Each named segment contributes one `<metres>m/<seconds>s at t=<start>`
      // occurrence (`segmentIntersectionReason`'s own format, single- and
      // multi-segment cases both match this shape).
      const namedSegmentMatches = [...c.reason.matchAll(/\d+\.\d+m\/\d+\.\d+s at t=\d+\.\d+/g)];
      expect(namedSegmentMatches.length).toBeLessThanOrEqual(CONTAMINATION_REASON_SEGMENT_CAP);

      const moreMatch = c.reason.match(/\+(\d+) more/);
      if (moreMatch) {
        const statedCountMatch = c.reason.match(/intersecting (\d+) unreliable segments/);
        expect(statedCountMatch).not.toBeNull();
        const statedCount = Number(statedCountMatch![1]);
        const n = Number(moreMatch[1]);
        expect(n).toBe(statedCount - CONTAMINATION_REASON_SEGMENT_CAP);
        moreClauseCount++;
      }
    }

    // eslint-disable-next-line no-console
    console.log(`reason bound: ${moreClauseCount} reason string(s) exercised the "+N more" clause`);
  });

  it('no reason string contains a banned adjective, archive-wide (Phase 27 D-09 register: measured numbers, never adjectives)', () => {
    const collected = collectReasonStrings();
    for (const adjective of BANNED_ADJECTIVES) {
      const offenders = collected.filter((c) => c.reason.toLowerCase().includes(adjective));
      expect(offenders.map((o) => `${o.activityId} ${o.distance}: ${o.reason}`)).toEqual([]);
    }
  });

  it('records, via console.log, the full census plans 36-10/36-11/36-12 need and cannot recompute cheaply', () => {
    const perDistance = new Map<TargetDistanceKey, { moved: number; unchanged: number; noClean: number }>();
    for (const key of TARGET_ORDER) perDistance.set(key, { moved: 0, unchanged: 0, noClean: 0 });

    for (const entry of sweepEntries) {
      for (const pair of entry.pairs) {
        const counts = perDistance.get(pair.distance)!;
        if (!pair.intersects) {
          counts.unchanged++;
        } else if (!pair.wholeSpanClean) {
          counts.noClean++;
        } else {
          counts.moved++;
        }
      }
    }

    let activitiesWithContaminated = 0;
    let activitiesWithUnreliableSegmentDemotion = 0;
    let maxSegmentsIntersected = 0;
    let maxSegmentsInfo = '(none)';

    for (const entry of sweepEntries) {
      let hasContaminated = false;
      let hasUnreliableSegmentDemotion = false;
      for (const effort of entry.shippedResult.efforts) {
        if (effort.contaminated !== null) hasContaminated = true;
        if (effort.demotion !== null && effort.demotion.guard === 'unreliable-segment') {
          hasUnreliableSegmentDemotion = true;
        }
      }
      if (hasContaminated) activitiesWithContaminated++;
      if (hasUnreliableSegmentDemotion) activitiesWithUnreliableSegmentDemotion++;

      for (const pair of entry.pairs) {
        if (!pair.intersects) continue;
        const n = segmentsIntersectingWindow(entry.segments, pair.raw).length;
        if (n > maxSegmentsIntersected) {
          maxSegmentsIntersected = n;
          maxSegmentsInfo = `${entry.activityId}@${pair.distance}`;
        }
      }
    }

    let totalMoved = 0;
    let totalUnchanged = 0;
    let totalNoClean = 0;
    for (const key of TARGET_ORDER) {
      const c = perDistance.get(key)!;
      totalMoved += c.moved;
      totalUnchanged += c.unchanged;
      totalNoClean += c.noClean;
      // eslint-disable-next-line no-console
      console.log(`census ${key}: moved=${c.moved} unchanged=${c.unchanged} noClean=${c.noClean}`);
    }

    // eslint-disable-next-line no-console
    console.log(
      `census totals: moved=${totalMoved} unchanged=${totalUnchanged} noClean=${totalNoClean} ` +
        `(36-CONTEXT.md probe reference: 1200 / 7352 / 439)`
    );
    // eslint-disable-next-line no-console
    console.log(
      `census: ${activitiesWithContaminated} activities carry >=1 contaminated effort, ` +
        `${activitiesWithUnreliableSegmentDemotion} carry >=1 'unreliable-segment' demotion`
    );
    // eslint-disable-next-line no-console
    console.log(
      `census: maximum segments intersected by a single window: ${maxSegmentsIntersected} at ${maxSegmentsInfo} ` +
        `(36-RESEARCH.md reference: 4 segments, 3475740390@400m)`
    );

    // This test asserts none of the census figures — every number here is
    // recorded for the SUMMARY and for plans 36-10/36-11/36-12 to reconcile
    // against, never a pinned expectation.
    expect(sweepEntries.length).toBeGreaterThan(0);
  });
});
