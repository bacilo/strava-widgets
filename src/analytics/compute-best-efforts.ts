/**
 * Manifest-driven best-effort computation over committed streams.
 *
 * Reads the Phase 14 stream manifest (`data/streams/manifest.json`) plus
 * per-activity stream and canonical activity JSON, sweeps every available
 * activity's stream for the seven target distances, guards and flags the
 * results, marks personal records chronologically, and writes the
 * gitignored `data/stats/best-efforts.json` that Phases 16-18 read and
 * never recompute.
 */

import * as path from 'path';

import type {
  ActivityBestEfforts,
  BestEffortsDocument,
  ComputedEffort,
  EffortContamination,
  EffortDemotion,
  PRRankingEntry,
  RawEffort,
  RejectedEffort,
  TargetDistanceKey,
} from './best-effort.types.js';
import { BEST_EFFORTS_SCHEMA_VERSION, TARGET_METERS, TARGET_ORDER } from './best-effort.types.js';
import {
  findBestEffort,
  isPlausible,
  markPRs,
  rankTopN,
  validateStreamSeries,
  WORLD_RECORD_SPEED_MPS,
} from './best-effort-utils.js';
// `deriveCeilings(...)` is imported here and called exactly once below, in
// the derivation pass between accumulation and filtering (PR-01's
// no-iteration clause) — see the "no iteration to convergence" suite in
// compute-best-efforts.test.ts.
import { ceilingDemotion, deriveCeilings } from './best-effort-ceiling.js';
import {
  buildCeilingStateFile,
  diffCeilingState,
  formatCeilingMovement,
  loadCeilingState,
} from './best-effort-ceiling-state.js';
import { isExcluded, loadExclusions } from './best-effort-exclusions.js';
// The detector's ONE permitted accessor (Phase 33 plan 33-09) — this file
// must never call `detectUnreliableSegments` directly, only through this
// function, so the detector never runs twice per activity with two results
// that could disagree. Exactly one call site exists below.
//
// `UnreliableSegment` is imported from THIS module too (its own re-export at
// `pace-derivation.ts:46`), never from `unreliable-segments.js` directly —
// `pace-single-source.test.ts`'s SEG-05a audit confines a direct
// `unreliable-segments.js`/`'unreliable-segments'` import to the detector
// file itself, `pace-derivation.ts` (its one allowed importer) and
// `*.test.ts` files; importing the type straight from the detector module
// here would trip that audit even though it is type-only.
import { classifyGapsWithSegments } from './pace-derivation.js';
import type { UnreliableSegment } from './pace-derivation.js';
import { loadManifest } from '../streams/stream-manifest.js';
import type { CanonicalStream, DistanceSource } from '../streams/stream.types.js';
import type { StravaActivity } from '../types/strava.types.js';
import { FileStore } from '../storage/file-store.js';

/** Rounds to at most one decimal place. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Builds the demotion that D-08's shared path records for an absolute-guard
 * rejection. This is the ONLY site in this file that constructs a
 * `demotion` value from `isPlausible`'s failing variant — the ceiling's own
 * rejection (Task 2 below) constructs its `EffortDemotion` via
 * `ceilingDemotion` instead, but nothing else in this file may assign to an
 * effort's `demotion` field, so one guard cannot silently diverge from
 * another (Phase 24's `resolveExcluded` lesson: duplicated derivations
 * defeat checkpoints).
 *
 * `guard` is optional on `PlausibilityResult`'s failing variant only because
 * `validateStreamSeries` shares that type for series-shape failures that
 * carry no absolute guard at all (plan 28-03's decision) — but
 * `validateStreamSeries`'s result is handled earlier, before the per-target
 * loop even starts, and never reaches this function. `isPlausible`'s own two
 * rejection branches always set `guard`, so the throw below is a defensive
 * assertion, not an expected path: it fails loudly (caught by this
 * function's caller's `try`/`catch`, landing as an `unexpected error:` row)
 * rather than silently mis-recording which guard fired.
 */
function demotionFromPlausibility(result: {
  ok: false;
  reason: string;
  guard?: 'max-speed' | 'world-record';
}): EffortDemotion {
  if (!result.guard) {
    throw new Error(
      `demotionFromPlausibility: isPlausible's failing result carried no guard (reason: ${result.reason})`
    );
  }
  return { guard: result.guard, reason: result.reason };
}

/**
 * A half-open sample-space bound, in the SAME `{ startIndex, endIndex }`
 * shape `findBestEffort`'s optional `bounds` parameter takes (Phase 36
 * plan 36-02) — samples `startIndex .. endIndex - 1`, and therefore pairs
 * `startIndex .. endIndex - 2`. Deliberately the identical shape rather than
 * a differently-named type, so a `CleanSubInterval` can be passed straight
 * into `findBestEffort`'s `bounds` argument with no conversion.
 */
export interface CleanSubInterval {
  startIndex: number;
  endIndex: number;
}

/**
 * D-01's resolved reading: cut the stream at the WHOLE merged segment span
 * (`segment.startIndex`..`segment.endIndex`), never at a narrower
 * `parts[].kind === 'burst'` sub-range. This is the IDENTICAL index range
 * `classifyGapsWithSegments`'s own pass 3 already uses to reclassify pairs as
 * `'unreliable'` (`pace-derivation.ts`: `for (let i = seg.startIndex; i <
 * seg.endIndex; i++) pairKinds[i] = 'unreliable';`), so "clean" means the
 * same real-time span in the best-effort search as it already means in the
 * pace chart, histogram, splits and coverage caption. A burst-only reading
 * would be a SECOND boundary convention — the exact defect class 32-13/32-17
 * fixed twice (two disagreeing conventions for "what counts as inside the
 * segment" silently dropping metres/seconds). Plan 36-06's archive-wide
 * equivalence test is the committed check that the two readings agree on
 * today's archive, so a future divergence between them is a visible failure
 * rather than silent drift.
 */
export function wholeSpanCuts(segments: readonly UnreliableSegment[]): CleanSubInterval[] {
  return segments.map((s) => ({ startIndex: s.startIndex, endIndex: s.endIndex }));
}

/**
 * The complement of a generic cut list over `[0, streamLength)`, in sample
 * space. Takes a generic `CleanSubInterval[]` rather than
 * `UnreliableSegment[]` directly so plan 36-06 can feed it either the
 * whole-span or the burst-only reading and assert the two agree.
 *
 * THE `+ 1` BOUNDARY CORRECTION: samples `cut.startIndex` and `cut.endIndex`
 * are shared boundary samples belonging to the CLEAN side
 * (32-CONTEXT.md D-06/D-07: adjacency is touching-only, a clean sample is
 * never swallowed) — so the clean run BEFORE a cut ends at sample
 * `cut.startIndex` INCLUSIVE, which under this function's own half-open
 * convention is `endIndex: cut.startIndex + 1`. `36-RESEARCH.md`'s
 * illustrative snippet pushes `endIndex: cut.startIndex` instead — that is
 * OFF BY ONE against this rule and silently drops the last clean pair
 * (`cut.startIndex - 1`). This function carries the correction; do not copy
 * the research snippet's bound.
 *
 * Overlapping and adjacent cuts are both handled by the `Math.max` cursor
 * below (never regressing backward), and a sub-interval shorter than 2
 * samples is never emitted — `findBestEffort` would reject it anyway
 * (its own totality guard requires `endIndex - startIndex >= 2`).
 *
 * Never mutates `cuts`; the detector's own `segments` output is documented
 * as unsorted, so this function sorts a COPY before walking it.
 */
export function complementSubIntervals(
  streamLength: number,
  cuts: readonly CleanSubInterval[]
): CleanSubInterval[] {
  if (streamLength < 2) return [];

  const sorted = [...cuts].sort((a, b) => a.startIndex - b.startIndex);
  const subs: CleanSubInterval[] = [];
  let cursor = 0;

  for (const cut of sorted) {
    if (cut.startIndex >= cursor + 1) {
      subs.push({ startIndex: cursor, endIndex: cut.startIndex + 1 });
    }
    cursor = Math.max(cursor, cut.endIndex);
  }

  if (streamLength - cursor >= 2) {
    subs.push({ startIndex: cursor, endIndex: streamLength });
  }

  return subs;
}

/**
 * Every segment whose PAIR range overlaps `window`'s PAIR range —
 * `seg.startIndex < window.endIndex && window.startIndex < seg.endIndex`.
 * INDEX-based on purpose: `pace-derivation.ts`'s own docblock names a
 * `startSec`/`endSec` float re-derivation of segment membership as the exact
 * 32-13/32-17 defect class. Touching is NOT overlap — a window ending
 * exactly at sample `seg.startIndex` shares only that boundary sample and
 * does not intersect, which is what keeps this predicate consistent with
 * `complementSubIntervals`'s own `+ 1` (the boundary sample belongs to the
 * clean side in both places, never counted as contaminated in one and clean
 * in the other). Sorted ascending by `startSec` so a rendered reason string
 * is deterministic regardless of the detector's own (documented-unsorted)
 * output order.
 */
export function segmentsIntersectingWindow(
  segments: readonly UnreliableSegment[],
  window: { startIndex: number; endIndex: number }
): UnreliableSegment[] {
  return segments
    .filter((seg) => seg.startIndex < window.endIndex && window.startIndex < seg.endIndex)
    .sort((a, b) => a.startSec - b.startSec);
}

/**
 * The bound D-07 requires on the contamination reason string's segment list.
 * A single 400m window on real activity `3475740390` intersects FOUR real
 * segments (measured 2026-09-28) and an unbounded list would grow without
 * limit as more segments merge into a window. This mirrors the
 * `SHARD_LIST_CAP` discipline already shipped for `unreliableSegments`/
 * `impossibleSamples` shard lists. This is a RENDERING bound on this ONE new
 * string only — it is not an attempt to fix the still-open
 * read/render-cap todo tracked elsewhere for shard lists, which stays out of
 * this plan's scope.
 */
export const CONTAMINATION_REASON_SEGMENT_CAP = 2;

/**
 * The reason string for a window that intersects one or more unreliable
 * segments (D-07). House register: a named condition plus MEASURED numbers,
 * never an adjective (Phase 27 D-09) — every figure here is read DIRECTLY
 * off `UnreliableSegment`/`RawEffort` and formatted with `toFixed(1)`, never
 * recomputed or rounded by a second rule. This is what makes the string
 * INDEPENDENTLY RECOMPUTABLE (D-07's bound): every number is re-derivable
 * from a fresh `classifyGapsWithSegments` call plus the shipped offsets,
 * which is what lets plan 36-12's recount check the claim without importing
 * this file.
 *
 * `intersecting` must be non-empty — callers only invoke this once a window
 * is already known to intersect at least one segment (Branch 2/3 of
 * `computeActivityEfforts`'s per-target search, below).
 */
export function segmentIntersectionReason(
  distance: TargetDistanceKey,
  raw: RawEffort,
  intersecting: readonly UnreliableSegment[]
): string {
  const windowPart =
    `contaminated window: ${distance} in ${raw.durationSec.toFixed(1)}s at ` +
    `t=${raw.startOffsetSec.toFixed(1)}-${raw.endOffsetSec.toFixed(1)}s`;

  if (intersecting.length === 1) {
    const s = intersecting[0];
    return (
      `${windowPart}, intersecting an unreliable segment at ` +
      `t=${s.startSec.toFixed(1)}-${s.endSec.toFixed(1)}s ` +
      `(${s.mechanism}, ${s.metres.toFixed(1)}m/${s.seconds.toFixed(1)}s)`
    );
  }

  const n = intersecting.length;
  const named = intersecting
    .slice(0, CONTAMINATION_REASON_SEGMENT_CAP)
    .map((s) => `${s.mechanism} ${s.metres.toFixed(1)}m/${s.seconds.toFixed(1)}s at t=${s.startSec.toFixed(1)}`)
    .join('; ');
  const remainder = n - CONTAMINATION_REASON_SEGMENT_CAP;
  const moreClause = remainder > 0 ? `; +${remainder} more` : '';

  return `${windowPart}, intersecting ${n} unreliable segments (${named}${moreClause})`;
}

/**
 * D-06's no-clean-window reason: the same `segmentIntersectionReason` text,
 * prefixed with the MEASURED longest clean sub-interval's span — the number
 * that makes "no clean sub-interval covers the distance" falsifiable rather
 * than asserted. `longestCleanSpanM` is recomputable from the detector's
 * segments plus the raw distance channel alone (D-07's independent-
 * recomputability bound, same as the segment reason it wraps).
 */
export function noCleanWindowReason(
  distance: TargetDistanceKey,
  raw: RawEffort,
  intersecting: readonly UnreliableSegment[],
  longestCleanSpanM: number
): string {
  return (
    `no clean ${distance} sub-interval covers the distance ` +
    `(longest clean sub-interval spans ${longestCleanSpanM.toFixed(1)}m); ` +
    segmentIntersectionReason(distance, raw, intersecting)
  );
}

/**
 * Builds the `contaminated` sibling record for Branch 2 (D-05): a clean
 * sub-interval was found, so this effort ranks on the CLEAN figure, and this
 * record preserves what the ORIGINAL unpartitioned window was and why it was
 * unusable. Nothing else in this file may construct an `EffortContamination`
 * value, so one branch cannot silently diverge from another — the same
 * single-owner discipline `demotionFromPlausibility` states above. Uses the
 * IDENTICAL `round1`/`Math.round` rounding the top-level `efforts.push` site
 * uses for its own duration/pace/offset fields, so a consumer comparing
 * `contaminated.durationSec` against the top-level `durationSec` compares
 * like with like.
 */
function contaminationRecord(
  distance: TargetDistanceKey,
  raw: RawEffort,
  targetMeters: number,
  reason: string
): EffortContamination {
  return {
    guard: 'unreliable-segment',
    reason,
    durationSec: round1(raw.durationSec),
    paceSecPerKm: round1(raw.durationSec / (targetMeters / 1000)),
    startOffsetSec: Math.round(raw.startOffsetSec),
    endOffsetSec: round1(raw.endOffsetSec),
  };
}

/**
 * Builds the `demotion` for Branch 3 (D-06): no clean sub-interval covers
 * the distance, so the effort is kept-and-demoted under the new guard.
 * Nothing else in this file may construct an `'unreliable-segment'`
 * `EffortDemotion` value, so this branch cannot silently diverge from
 * `demotionFromPlausibility`'s absolute-guard path above — the same
 * single-owner discipline that function's own docblock states.
 */
function unreliableSegmentDemotion(reason: string): EffortDemotion {
  return { guard: 'unreliable-segment', reason };
}

/** Input to `computeActivityEfforts` — one activity's canonical record plus its stream series. */
export interface ActivityEffortInput {
  activityId: string;
  startDate: string;
  activityDistanceM: number;
  maxSpeedMps: number | undefined;
  distanceSource: DistanceSource;
  t: number[];
  d: number[];
  /**
   * The detector's own segments for this activity's stream, computed by the
   * CALLER through `classifyGapsWithSegments` — the detector's one permitted
   * accessor (`pace-derivation.ts`) — so `computeActivityEfforts` itself
   * stays pure and unit-testable with a synthetic array, never calling
   * `detectUnreliableSegments` directly (this function's own docblock's "the
   * seam the fixture-validation suite calls directly without any file
   * writing" claim stays true either way).
   *
   * REQUIRED, not optional: an optional field would let a forgotten call
   * site silently default to `[]`, disabling the clean-window search exactly
   * the way plan 36-05's deliberate stub proof is designed to detect.
   */
  segments: readonly UnreliableSegment[];
}

/** Output of `computeActivityEfforts` — per-activity efforts, rejections, and eligibility metadata. */
export interface ActivityEffortResult {
  efforts: ComputedEffort[];
  rejected: RejectedEffort[];
  eligibleTargets: TargetDistanceKey[];
  seriesError?: string;
}

/**
 * Computes all plausible efforts for one activity across the seven target
 * distances. Pure — no file I/O. This is the seam the fixture-validation
 * suite (plan 04) calls directly without any file writing.
 *
 * D-14's placement argument, stated as a fact a reader can check: this
 * function — including the clean-window search's own `for` loops below — is
 * defined entirely before the file's derive-and-filter passes' own source
 * markers (this function sits above PASS ONE's marker, which itself precedes
 * the two markers the "no iteration to convergence" suite's audit scans
 * between). Nothing in this function's own loops can trip that audit, and
 * that audit needs zero edits for this plan. (Deliberately NOT spelling the
 * literal marker text here — the audit locates its scanned slice by
 * `indexOf` on that exact text, and a second occurrence earlier in the file
 * would shift the slice it finds.)
 *
 * PR-08's ordering consequence, not just a comment but demonstrated by plan
 * 36-05's ceiling-population test: because line ~590's existing filter
 * (`if (effort.demotion !== null) continue;`) admits only `demotion === null`
 * efforts into `byDistance`, and because the top-level `durationSec` below is
 * now always the CLEAN figure whenever one exists (Branch 2), a contaminated
 * timing can never reach the ceiling's population through any path — no new
 * filter and no change to `best-effort-ceiling.ts` is required.
 */
export function computeActivityEfforts(input: ActivityEffortInput): ActivityEffortResult {
  const { activityId, activityDistanceM, maxSpeedMps, distanceSource, t, d, segments } = input;

  const seriesValidation = validateStreamSeries(t, d);
  if (!seriesValidation.ok) {
    return { efforts: [], rejected: [], eligibleTargets: [], seriesError: seriesValidation.reason };
  }

  // D-01: 1% margin absorbs the difference between the canonical `distance`
  // field and the stream's own span.
  const eligibleTargets = TARGET_ORDER.filter(
    (key) => activityDistanceM >= TARGET_METERS[key] * 0.99
  );

  const efforts: ComputedEffort[] = [];
  const rejected: RejectedEffort[] = [];

  // D-01/Pattern 1: the clean sub-interval complement depends only on the
  // stream length and the detector's own segments — never on the target
  // distance — so it is computed ONCE per activity here, hoisted out of the
  // per-target loop below, rather than recomputed per distance. Computed
  // LAZILY: an activity with no segments at all (the common case) does zero
  // extra work — `cleanSubs` stays `undefined` and Branch 1 below never
  // reads it.
  const cleanSubs: CleanSubInterval[] | undefined =
    segments.length > 0 ? complementSubIntervals(t.length, wholeSpanCuts(segments)) : undefined;

  for (const key of eligibleTargets) {
    try {
      const raw = findBestEffort(t, d, TARGET_METERS[key]);
      if (!raw) {
        // The stream simply never covers this distance — not an error, not a rejection.
        continue;
      }

      const intersecting = segmentsIntersectingWindow(segments, raw);

      if (intersecting.length === 0) {
        // Branch 1 — today's code path, byte-for-byte unchanged apart from
        // the `contaminated: null` field (already added by plan 36-03). This
        // is exactly what plan 36-05's stubbed-segments proof asserts is
        // identical to today's output.
        const impliedSpeedMps = TARGET_METERS[key] / raw.durationSec;
        const plausibility = isPlausible(impliedSpeedMps, maxSpeedMps, WORLD_RECORD_SPEED_MPS[key]);
        const paceSecPerKm = raw.durationSec / (TARGET_METERS[key] / 1000);

        // D-08: an absolute-guard rejection no longer deletes the effort. It
        // still gets a `rejected` row (the archive-wide report), but the
        // effort itself is retained in `efforts[]` below, carrying its
        // demotion — the single shared path `demotionFromPlausibility` builds.
        if (!plausibility.ok) {
          rejected.push({ activityId, distance: key, reason: plausibility.reason });
        }

        efforts.push({
          distance: key,
          durationSec: round1(raw.durationSec),
          paceSecPerKm: round1(paceSecPerKm),
          startOffsetSec: Math.round(raw.startOffsetSec),
          endOffsetSec: round1(raw.endOffsetSec),
          lowConfidence: distanceSource === 'geo',
          demotion: plausibility.ok ? null : demotionFromPlausibility(plausibility),
          contaminated: null,
        });
      } else {
        // The raw window intersects at least one segment. `cleanSubs` is
        // guaranteed defined here: `intersecting.length > 0` requires
        // `segments.length > 0` (segmentsIntersectingWindow can only return a
        // non-empty array by filtering `segments`), the exact condition
        // `cleanSubs` was computed under above.
        //
        // Bounded search over each clean sub-interval — the ONE sweep
        // (`findBestEffort`, plan 36-02's bound), never a second sweep
        // implementation — keeping the minimum-duration result with an
        // `undefined`-safe running comparison.
        let clean: RawEffort | undefined;
        for (const sub of cleanSubs!) {
          const candidate = findBestEffort(t, d, TARGET_METERS[key], sub);
          if (candidate && (!clean || candidate.durationSec < clean.durationSec)) {
            clean = candidate;
          }
        }

        if (clean) {
          // Branch 2 (D-05): a clean sub-interval covers the distance. The
          // existing absolute-guard code path below is UNCHANGED, now fed
          // the CLEAN figure (D-08) — `isPlausible` never sees the raw/
          // contaminated duration in this branch.
          const impliedSpeedMps = TARGET_METERS[key] / clean.durationSec;
          const plausibility = isPlausible(
            impliedSpeedMps,
            maxSpeedMps,
            WORLD_RECORD_SPEED_MPS[key]
          );
          const paceSecPerKm = clean.durationSec / (TARGET_METERS[key] / 1000);

          if (!plausibility.ok) {
            rejected.push({ activityId, distance: key, reason: plausibility.reason });
          }

          efforts.push({
            distance: key,
            durationSec: round1(clean.durationSec),
            paceSecPerKm: round1(paceSecPerKm),
            startOffsetSec: Math.round(clean.startOffsetSec),
            endOffsetSec: round1(clean.endOffsetSec),
            lowConfidence: distanceSource === 'geo',
            demotion: plausibility.ok ? null : demotionFromPlausibility(plausibility),
            contaminated: contaminationRecord(
              key,
              raw,
              TARGET_METERS[key],
              segmentIntersectionReason(key, raw, intersecting)
            ),
          });
        } else {
          // Branch 3 (D-06): no clean sub-interval covers the distance. The
          // effort is kept, carrying the CONTAMINATED figure in its
          // top-level fields, with `demotion` set directly to the new guard.
          // `isPlausible` is NOT independently evaluated here — D-08's
          // short-circuit, not an oversight: once the clean-window search has
          // already resolved that no clean duration exists, no later guard
          // re-evaluates the raw one, mirroring the file's existing "once
          // `demotion` is non-null, no later pass re-evaluates it" invariant.
          // Exactly ONE `rejected` row is pushed, carrying the demotion's own
          // reason — pushing a second row here would break this file's
          // stated `rejected[]` identity (one row per demoted effort across
          // every guard; `totals.effortsRejected` is `rejected.length`).
          const longestCleanSpanM = cleanSubs!.reduce(
            (max, sub) => Math.max(max, d[sub.endIndex - 1] - d[sub.startIndex]),
            0
          );
          const reason = noCleanWindowReason(key, raw, intersecting, longestCleanSpanM);

          rejected.push({ activityId, distance: key, reason });

          efforts.push({
            distance: key,
            durationSec: round1(raw.durationSec),
            paceSecPerKm: round1(raw.durationSec / (TARGET_METERS[key] / 1000)),
            startOffsetSec: Math.round(raw.startOffsetSec),
            endOffsetSec: round1(raw.endOffsetSec),
            lowConfidence: distanceSource === 'geo',
            demotion: unreliableSegmentDemotion(reason),
            // `contaminated` is `null` here DELIBERATELY: D-05/D-06 give each
            // case exactly one unambiguous home for the contaminated figure —
            // Branch 2 uses `contaminated`, Branch 3 (this one) uses
            // `demotion`. Populating both would create two homes for one
            // figure.
            contaminated: null,
          });
        }
      }
    } catch (error) {
      // NOT a demotion of a computed effort (D-08 is about retained-but-
      // flagged efforts) — the computation itself threw, so there is no
      // effort object to retain. This is the one remaining `rejected`-only
      // path; one target throwing must never lose the activity's other six
      // (Pitfall 6).
      rejected.push({
        activityId,
        distance: key,
        reason: `unexpected error: ${(error as Error).message}`,
      });
    }
  }

  return { efforts, rejected, eligibleTargets };
}

/** Options for `computeBestEfforts`, each defaulted to the repo's standard data layout. */
export interface ComputeBestEffortsOptions {
  activitiesDir?: string;
  streamsDir?: string;
  streamsManifestPath?: string;
  statsDir?: string;
  exclusionsPath?: string;
  ceilingStatePath?: string;
  /**
   * DEFAULT `false`. When false, the committed `data/best-effort-ceiling.json`
   * is never written, no matter how far the ceiling moved — closing 28 WR-06
   * ("partially resolved — the hazard is now documented, not removed. No
   * opt-in guard was added."). Two bounds this satisfies (D-11):
   *   (a) reproducible from a clean checkout — this flag affects ONLY the
   *       committed baseline file, never a single figure in the returned
   *       `BestEffortsDocument` or in `<statsDir>/best-efforts.json`, so a
   *       clean checkout re-derives identical ceilings regardless of the flag.
   *   (b) not rewritable as a side effect of an unrelated local command —
   *       every hand-run entry point (`npm run compute-best-efforts`,
   *       `npm run compute-all-stats`, `npm run process`) leaves this false.
   *       The one invocation permitted to opt in is
   *       `.github/workflows/daily-refresh.yml`'s `compute-all-stats` step,
   *       which passes `--write-ceiling-state` explicitly.
   * Resolved below with an explicit `=== true` (never a bare truthy check) so
   * an untyped `.mjs` caller passing a truthy non-boolean cannot opt in by
   * accident.
   */
  writeCeilingState?: boolean;
}

interface PRAccumulatorEntry {
  activityId: string;
  startDate: string;
  durationSec: number;
  paceSecPerKm: number;
  lowConfidence: boolean;
}

/** Cap on rejection rows echoed to the console, so a pathological run cannot flood CI logs. */
const REJECTED_CONSOLE_CAP = 50;

/**
 * Reads the stream manifest, sweeps every available activity's stream for
 * the seven target distances, marks personal records chronologically, and
 * writes `<statsDir>/best-efforts.json` atomically. Returns the document as
 * well as writing it, so tests and the fixture suite can assert without
 * re-reading the file.
 */
export async function computeBestEfforts(
  options: ComputeBestEffortsOptions = {}
): Promise<BestEffortsDocument> {
  const activitiesDir = options.activitiesDir || 'data/activities';
  const streamsDir = options.streamsDir || 'data/streams';
  const streamsManifestPath = options.streamsManifestPath || 'data/streams/manifest.json';
  const statsDir = options.statsDir || 'data/stats';
  const exclusionsPath = options.exclusionsPath || 'data/best-effort-exclusions.json';
  const ceilingStatePath = options.ceilingStatePath || 'data/best-effort-ceiling.json';
  // D-11/28 WR-06: an explicit `=== true`, not a bare truthy check — an
  // untyped `.mjs` caller passing a truthy non-boolean must not opt in by
  // accident. See `ComputeBestEffortsOptions.writeCeilingState`'s docblock.
  const writeCeilingState = options.writeCeilingState === true;

  const fileStore = new FileStore('.');

  console.log(`Computing best efforts from manifest: ${streamsManifestPath}`);

  const manifest = await loadManifest(fileStore, streamsManifestPath);
  const exclusions = await loadExclusions(fileStore, exclusionsPath);
  // D-06/D-07: the previous run's committed ceiling state, loaded ONCE here.
  // This is READ-ONLY input to REPORTING below — Pass 2's `deriveCeilings`
  // call must never consult it, fall back to it, or blend with it. A future
  // reader will be tempted to use the previous value as a stabiliser; D-06
  // rejected exactly that (a hand-maintained/pinned number on the critical
  // path goes stale silently) in favour of re-deriving fresh every run and
  // only comparing against the previous value for the human-facing report.
  const previousState = await loadCeilingState(fileStore, ceilingStatePath);

  let skippedNoStream = 0;
  let skippedUnreadable = 0;
  let effortsExcluded = 0;
  let lowConfidenceEfforts = 0;

  const activities: Record<string, ActivityBestEfforts> = {};
  const rejected: RejectedEffort[] = [];

  // PASS 1 — ACCUMULATE. May read each activity's own stream/canonical
  // record; must not read anything derived from the archive as a whole (no
  // ceiling exists yet). `byDistance` accumulates exactly the population an
  // effort enters only when it PASSED the absolute guard (its `demotion` is
  // null after the per-target loop below) and `isExcluded` is false — this
  // is PR-02's seam: the ceiling's input (Pass 2) is already filtered by the
  // absolute guard and the exclusion list, and it is NOT ceiling-filtered
  // because the ceiling does not exist yet. A demoted effort is retained in
  // `activities[id].efforts` (D-08) but never enters `byDistance`. Owner-
  // excluded efforts likewise skip `byDistance` so they never feed the
  // ceiling's population — but they are NOT exempt from the ceiling CHECK
  // itself: Pass 3's excluded-effort sweep (CR-01) compares every excluded,
  // not-yet-demoted effort's own implied speed against the derived ceiling,
  // after that ceiling exists.
  const byDistance = new Map<TargetDistanceKey, PRAccumulatorEntry[]>();
  for (const key of TARGET_ORDER) byDistance.set(key, []);

  for (const [id, entry] of Object.entries(manifest.activities)) {
    if (!entry.available) {
      skippedNoStream++;
      continue;
    }

    try {
      const activity = await fileStore.readJson<StravaActivity>(
        path.join(activitiesDir, `${id}.json`)
      );
      const stream = await fileStore.readJson<CanonicalStream>(path.join(streamsDir, `${id}.json`));

      // The detector's ONE permitted accessor, called exactly once per
      // activity, with NO options: no production caller anywhere in `src/`
      // overrides `pauseRule` (verified 2026-09-28), so this resolves the
      // identical pause rule every other consumer already resolves — a
      // best-effort-specific override would be a second definition of
      // "clean" (36-CONTEXT.md D-01's rationale).
      const { segments } = classifyGapsWithSegments(stream.t, stream.d);

      const result = computeActivityEfforts({
        activityId: id,
        startDate: activity.start_date,
        activityDistanceM: activity.distance,
        maxSpeedMps: activity.max_speed,
        distanceSource: entry.distanceSource,
        t: stream.t,
        d: stream.d,
        segments,
      });

      if (result.seriesError) {
        console.warn(`  ${id}: ${result.seriesError}; skipping`);
        skippedUnreadable++;
        continue;
      }

      // `rejected` now widens to one row per DEMOTED effort across all three
      // guards (world-record, max-speed, ceiling) plus unexpected-error
      // rows — not a "deleted effort" report any more, since D-08 means
      // nothing is deleted. `totals.effortsRejected` below is `rejected.length`.
      for (const rejection of result.rejected) {
        rejected.push(rejection);
      }

      for (const effort of result.efforts) {
        if (effort.lowConfidence) lowConfidenceEfforts++;

        const isEffortExcluded = isExcluded(exclusions, id, effort.distance);
        if (isEffortExcluded) {
          effortsExcluded++;
          continue;
        }

        // D-08/PR-02: a demoted effort is retained in `activities[id].efforts`
        // (below) but must never feed the ranking/ceiling population — only
        // guard-passed, non-excluded efforts reach `byDistance`. Only
        // absolute-guard demotions exist at this point in the file; the
        // ceiling guard demotes further, downstream of this population (both
        // the survivors loop AND Pass 3's excluded-effort sweep below, CR-01),
        // and never re-admits anything filtered out here.
        if (effort.demotion !== null) continue;

        byDistance.get(effort.distance)!.push({
          activityId: id,
          startDate: activity.start_date,
          durationSec: effort.durationSec,
          paceSecPerKm: effort.paceSecPerKm,
          lowConfidence: effort.lowConfidence,
        });
      }

      activities[id] = {
        activityId: id,
        startDate: activity.start_date,
        distanceSource: entry.distanceSource,
        efforts: result.efforts.map((e) => ({
          ...e,
          wasPRAtTheTime: false,
          excludedFromRecords: isExcluded(exclusions, id, e.distance),
        })),
        excludedFromRecords: exclusions.has(id),
      };
    } catch (error) {
      // A truncated or hand-edited stream/activity file must not abort a
      // 1,842-activity run (threat T-15-02).
      console.warn(`  ${id}: ${(error as Error).message}; skipping`);
      skippedUnreadable++;
      continue;
    }
  }

  // PASS 2 — DERIVE. May read only `byDistance` (Pass 1's already-filtered
  // output); must not read `activities`, `rejected`, or any ranking output.
  // `deriveCeilings` runs EXACTLY ONCE here, per process — PR-01's
  // no-iteration clause: this call is never re-run after Pass 3 demotes
  // anything below. Re-deriving after demotion is the mutation ROADMAP
  // criterion 1 demonstrates failing (see the "no iteration to convergence"
  // suite in compute-best-efforts.test.ts).
  // Built via `.map()` rather than a `for` loop — deliberately, so a
  // source-text audit of this pass (compute-best-efforts.test.ts's "no
  // iteration to convergence" suite) can assert the single `deriveCeilings`
  // call site below sits inside no loop of any kind, between this pass's
  // own marker and the next pass's.
  const impliedSpeedsByDistance = new Map<TargetDistanceKey, number[]>(
    TARGET_ORDER.map((key) => [
      key,
      byDistance.get(key)!.map((entry) => TARGET_METERS[key] / entry.durationSec),
    ])
  );
  const ceilings = deriveCeilings(impliedSpeedsByDistance);

  const rankings: Record<TargetDistanceKey, PRRankingEntry[]> = {} as Record<
    TargetDistanceKey,
    PRRankingEntry[]
  >;
  // Per-distance count of ceiling demotions, for the console tail below.
  const ceilingDemotedCounts = new Map<TargetDistanceKey, number>();
  // Per-distance count of ceiling demotions among OWNER-EXCLUDED efforts —
  // the CR-01 sweep below — reported separately from `ceilingDemotedCounts`
  // so the console tail can show both the total and the excluded share.
  const excludedCeilingDemotedCounts = new Map<TargetDistanceKey, number>();

  // PASS 3 — FILTER AND FLAG. May read `byDistance` and `ceilings` (Pass
  // 2's output); must never remove an entry from `activities[id].efforts` —
  // that array is append-only from Pass 1 onward. Each distance's
  // population is partitioned into survivors and ceiling-demoted; a
  // ceiling-demoted entry's matching effort gains a `demotion` (mirroring
  // Task 1's absolute-guard path) and a matching `rejected` row, but is
  // never spliced out of `activities[id].efforts`. Only survivors reach
  // `markPRs`/`rankTopN`. Both the survivors loop AND the excluded-effort
  // sweep just below it call `ceilingDemotion` — the same constructor,
  // D-08's single shared path — so a demotion can never diverge between the
  // two populations it is applied to. Absolute-guard demotions (set earlier,
  // in `computeActivityEfforts`) always take precedence: neither loop here
  // ever overwrites a non-null `effort.demotion`. An excluded, over-ceiling
  // effort therefore ends up carrying BOTH `excludedFromRecords: true` (the
  // owner's intent) and `demotion: { guard: 'ceiling', ... }` (the machine's
  // judgment) — D-10's two separate, independently-kept claims.
  for (const key of TARGET_ORDER) {
    const entries = byDistance.get(key)!;
    const derivation = ceilings[key];

    const survivors: PRAccumulatorEntry[] = [];
    for (const entry of entries) {
      const impliedSpeedMps = TARGET_METERS[key] / entry.durationSec;
      const demotion = ceilingDemotion(impliedSpeedMps, derivation);
      if (demotion) {
        const activityEfforts = activities[entry.activityId]?.efforts;
        const effort = activityEfforts?.find((e) => e.distance === key);
        if (effort) effort.demotion = demotion;
        rejected.push({ activityId: entry.activityId, distance: key, reason: demotion.reason });
      } else {
        survivors.push(entry);
      }
    }
    ceilingDemotedCounts.set(key, entries.length - survivors.length);

    // CR-01: owner-excluded efforts never enter `byDistance` (Pass 1), so
    // the loop above never sees them — but skipping the population is
    // correct (PR-02) while skipping the CHECK is not. This sweep applies
    // the exact same ceiling to every excluded effort at this distance that
    // no absolute guard has already demoted, without ever touching
    // `byDistance`, `survivors` or `deriveCeilings`. Activity ids are
    // walked in explicit sorted order (never object insertion order) so
    // `rejected`'s ordering stays deterministic (PR-01) within this
    // distance's group of rows.
    for (const id of Object.keys(activities).sort((a, b) => a.localeCompare(b))) {
      const effort = activities[id].efforts.find((e) => e.distance === key);
      if (!effort || !effort.excludedFromRecords || effort.demotion !== null) continue;
      const impliedSpeedMps = TARGET_METERS[key] / effort.durationSec;
      const demotion = ceilingDemotion(impliedSpeedMps, derivation);
      if (demotion) {
        effort.demotion = demotion;
        rejected.push({ activityId: id, distance: key, reason: demotion.reason });
        excludedCeilingDemotedCounts.set(key, (excludedCeilingDemotedCounts.get(key) ?? 0) + 1);
      }
    }

    const withPR = markPRs(survivors);

    // Write wasPRAtTheTime back onto the matching effort inside the
    // per-activity results. Each activity has at most one effort per
    // distance, so matching by (activityId, distance) is unambiguous.
    for (const marked of withPR) {
      const activityEfforts = activities[marked.activityId]?.efforts;
      if (!activityEfforts) continue;
      const effort = activityEfforts.find((e) => e.distance === key);
      if (effort) effort.wasPRAtTheTime = marked.wasPRAtTheTime;
    }

    rankings[key] = rankTopN(survivors);
  }

  // Diff-stable output — sorted activity ids, mirroring saveManifest's convention.
  const sortedActivities: Record<string, ActivityBestEfforts> = {};
  for (const id of Object.keys(activities).sort((a, b) => a.localeCompare(b))) {
    sortedActivities[id] = activities[id];
  }

  const activitiesWithEfforts = Object.values(sortedActivities).filter(
    (a) => a.efforts.length > 0
  ).length;
  const effortsComputed = Object.values(sortedActivities).reduce(
    (sum, a) => sum + a.efforts.length,
    0
  );
  // Derived by walking the shipped data rather than an incrementing
  // counter, so it cannot drift from what a consumer would actually see —
  // counts every effort (any guard: world-record, max-speed, ceiling) whose
  // `demotion` is non-null across the whole built document. A plain `for`
  // loop (not `.filter`) is used deliberately so this read-only count is
  // never mistaken, by source-text audit, for a mutation of
  // `activities[id].efforts` — that array is append-only from Pass 1 onward.
  let effortsDemoted = 0;
  for (const activity of Object.values(sortedActivities)) {
    for (const effort of activity.efforts) {
      if (effort.demotion !== null) effortsDemoted++;
    }
  }

  const doc: BestEffortsDocument = {
    schemaVersion: BEST_EFFORTS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    note:
      'Derived, gitignored, and regenerated by `node dist/index.js compute-best-efforts`. ' +
      'Consumers read this file rather than recomputing.',
    totals: {
      // Activities for which computation was actually attempted — i.e. the
      // manifest total minus entries with no stream available. Entries
      // skipped for lacking a stream are reported separately via
      // `skippedNoStream` and must not be double-counted here.
      activitiesConsidered: Object.keys(manifest.activities).length - skippedNoStream,
      activitiesWithEfforts,
      effortsComputed,
      // Widened meaning (D-08): one row per demoted effort (any guard) plus
      // unexpected-error rows — no longer a "deleted effort" count, since
      // nothing is deleted any more.
      effortsRejected: rejected.length,
      effortsExcluded,
      lowConfidenceEfforts,
      skippedNoStream,
      skippedUnreadable,
      effortsDemoted,
    },
    rankings,
    rejected,
    activities: sortedActivities,
    // D-06: every run records the per-distance ceiling, its p90, its
    // population size, and any failOpenReason — persisted for audit.
    ceilings,
  };

  // D-06/D-07: compare this run's fresh derivation against the committed
  // previous state (loaded, read-only, before Pass 2 above) and report the
  // movement. `previousState` never reaches `deriveCeilings` — it is
  // consulted ONLY here, after Pass 3, purely for the human-facing diff.
  const ceilingMovement = diffCeilingState(previousState, doc.ceilings);
  const ceilingMovementLines = formatCeilingMovement(ceilingMovement);

  await fileStore.writeJson(path.join(statsDir, 'best-efforts.json'), doc);

  // Per-activity shard files (18-13/T-18-AVAIL-04): the detail view's
  // best-efforts panel needs exactly one activity's efforts, and must never
  // fetch this whole archive-wide document in a browser (it is multiple MB
  // for the live archive). Mirrors the existing data/activities/{id}.json /
  // data/streams/{id}.json per-activity file convention already established
  // for the raw record and stream — purely additive, does not change
  // best-efforts.json's own shape or any existing consumer.
  for (const [id, entry] of Object.entries(sortedActivities)) {
    await fileStore.writeJson(path.join(statsDir, 'best-efforts', `${id}.json`), entry);
  }

  console.log(`\nGenerated best efforts:`);
  console.log(`- Activities considered: ${doc.totals.activitiesConsidered}`);
  console.log(`- Activities with efforts: ${doc.totals.activitiesWithEfforts}`);
  console.log(`- Efforts computed: ${doc.totals.effortsComputed}`);
  console.log(`- Low-confidence efforts: ${doc.totals.lowConfidenceEfforts}`);
  console.log(`- Efforts excluded (records): ${doc.totals.effortsExcluded}`);
  console.log(`- Skipped (no stream): ${doc.totals.skippedNoStream}`);
  console.log(`- Skipped (unreadable): ${doc.totals.skippedUnreadable}`);
  for (const key of TARGET_ORDER) {
    console.log(`  ${key}: ${rankings[key].length} ranked`);
  }
  console.log(`\nCeilings (Phase 28 PR-01/PR-02):`);
  for (const key of TARGET_ORDER) {
    const derivation = ceilings[key];
    if (derivation.ceilingMps === null) {
      console.log(`  ${key}: fail-open — ${derivation.failOpenReason}`);
    } else {
      const excludedCount = excludedCeilingDemotedCounts.get(key) ?? 0;
      const demotedCount = (ceilingDemotedCounts.get(key) ?? 0) + excludedCount;
      console.log(
        `  ${key}: ceiling ${derivation.ceilingMps.toFixed(4)} m/s (p90 ${derivation.p90Mps!.toFixed(4)} m/s over ${derivation.populationN}), ${demotedCount} demoted (${excludedCount} of them owner-excluded)`
      );
    }
  }
  console.log(`\nOutput written to: ${path.join(statsDir, 'best-efforts.json')}`);

  // D-06: the ceiling's movement against the committed previous run is
  // always reported in words with numbers — never silent, whether it moved
  // or not. `ceilingMovement` (used just below to gate the conditional
  // write) is empty exactly when this run agrees with the previous one,
  // which is the observation this line makes explicit.
  console.log(`\nCeiling movement vs. previous committed run:`);
  if (ceilingMovement.length === 0) {
    console.log(`  unchanged at every distance`);
  } else {
    for (const line of ceilingMovementLines) {
      console.log(`  ${line}`);
    }
  }

  // Write the committed ceiling-state file CONDITIONALLY: only when the
  // ceiling actually moved (`ceilingMovement.length > 0`). The file carries
  // a `generatedAt` stamp, so an unconditional write would produce a commit
  // on every nightly run — and a nightly commit against a repository whose
  // CI already races `origin/master` (T-28-06-C) is how an occasional
  // non-fast-forward becomes a routine one. In practice this file is
  // rewritten whenever population, p90 or ceiling changes at any distance —
  // p90 moves with most new runs, since it is an observed data point, not
  // only when a ceiling literally crosses a threshold. That includes local
  // runs, which then dirty this CI-committed file with a locally-derived
  // baseline CI never produced. When nothing moved, the file is left
  // byte-untouched so git sees no diff and the auto-commit step below
  // (daily-refresh.yml) has nothing to stage for this path.
  //
  // D-11/28 WR-06: the condition above is now CONJUNCTIVE — the write
  // additionally requires `writeCeilingState === true` (see
  // `ComputeBestEffortsOptions.writeCeilingState`'s docblock). The movement
  // report immediately above still prints UNCONDITIONALLY, so a local run
  // still SEES the movement it is not allowed to persist — the console
  // report and the committed write are deliberately decoupled. A local run
  // that wants to refresh the committed baseline deliberately must pass the
  // opt-in explicitly (`--write-ceiling-state`, threaded through
  // `src/index.ts`/`src/compute-all-stats-steps.ts`); the one invocation
  // that does so today is `.github/workflows/daily-refresh.yml`'s
  // `compute-all-stats` step. This closes 28 WR-06 ("partially resolved —
  // the hazard is now documented, not removed. No opt-in guard was added.").
  if (writeCeilingState && ceilingMovement.length > 0) {
    const stateFile = buildCeilingStateFile(doc.ceilings, doc.generatedAt);
    await fileStore.writeJson(ceilingStatePath, stateFile);
    console.log(`  Committed ceiling state updated: ${ceilingStatePath}`);
  } else if (ceilingMovement.length > 0) {
    // Silence here would make the gate indistinguishable from "nothing
    // moved" — the exact ambiguity the movement report above exists to
    // remove. Name the file and state why the write was skipped.
    console.log(
      `  Ceiling moved but the write to ${ceilingStatePath} was skipped (opt-in --write-ceiling-state absent)`
    );
  }

  if (rejected.length > 0) {
    console.log(`\nDemoted efforts and unexpected errors (retained, not fatal):`);
    for (const r of rejected.slice(0, REJECTED_CONSOLE_CAP)) {
      console.log(`  ${r.activityId} ${r.distance}: ${r.reason}`);
    }
    if (rejected.length > REJECTED_CONSOLE_CAP) {
      console.log(`  ... and ${rejected.length - REJECTED_CONSOLE_CAP} more`);
    }
  }

  return doc;
}
