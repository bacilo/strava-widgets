/**
 * Fetch-once-per-id, memoized browser client for one activity's pace-quality
 * evidence shard (Phase 27: QUAL-03, D-17, D-18). Reads the per-activity
 * shard file `compute-dashboard-index.ts` writes alongside the archive-wide
 * `data/dashboard/index.json` (`<statsDir>/pace-quality/{id}.json`) — the
 * detail view's quality section needs exactly one activity's evidence
 * (classified gap intervals, impossible-sample list, zero-advance run
 * profile, adaptive window width, resolved device family), never the whole
 * archive.
 *
 * Structural mirror of `best-efforts-client.ts` (Criterion 2's "mirroring
 * the existing `best-efforts/{id}.json` pattern" clause) — same
 * fetch-once/memoize/degrade-to-null shape, same per-id `Map` cache key,
 * same never-reject contract for a missing/malformed shard. Differs only in
 * the URL path, the parse function's field set, and the exported type
 * names. Constructing this client (or merely having this module in the
 * bundle) issues ZERO fetches — a fetch happens only when `load(activityId)`
 * is called, matching the list view never calling `load` and the detail
 * view calling it exactly once per opened activity (D-18).
 */

import type { FetchLike } from './index-client.js';
import { LOOP_RADIUS_M } from '../../analytics/pace-quality.js';
import type {
  ActivityQualitySignals,
  ClosureDriftSignal,
  DecimationSignal,
  DeviceEraSignal,
  DeviceFamilyKind,
  ElapsedVsMovingSignal,
  ElevationSignal,
  ElevationTier,
  ForgottenStopSignal,
  GapProfileSignal,
  ImpossibleSampleSignal,
  PaceQualityShard,
  PauseClassificationSignal,
  QualityTier,
  SubGroundSignal,
  UnreliableSegmentsSignal,
  VerticalRateSignal,
} from '../../analytics/pace-quality.js';
import type { GapInterval, GapKind, SegmentMechanism } from '../../analytics/pace-derivation.js';
import type { PauseClass, PauseSource } from '../../analytics/pause-classification.js';

/** Own-property read only — no prototype key is ever reachable through the parsed document. */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const VALID_TIERS: ReadonlySet<string> = new Set<QualityTier>(['none', 'minor', 'severe', 'not-computable']);

/**
 * Phase 30 (ELEV-01, D-07/T-30-10): a DELIBERATELY SEPARATE set from
 * `VALID_TIERS` — elevation has no `'minor'` band (D-07), and reusing the
 * four-member set would let a `'minor'` value survive the parse into a
 * three-member `ElevationTier` union that has no such member.
 */
const VALID_ELEVATION_TIERS: ReadonlySet<string> = new Set<ElevationTier>(['severe', 'none', 'not-computable']);

const VALID_CLOSURE_DRIFT_STATES: ReadonlySet<string> = new Set<ClosureDriftSignal['state']>([
  'flagged',
  'clear',
  'not-computable',
]);

const VALID_DEVICE_FAMILIES: ReadonlySet<string> = new Set<DeviceFamilyKind>([
  'garmin-fenix-6-pro',
  'suunto-9',
  'garmin-vivoactive-4',
  'strava-app-gpx',
  'intervals-icu',
  'no-device-name',
  'unrecognized-device',
]);

/**
 * Phase 33 (COV-03, T-33-06): the fourth silent-inheritance trap. Before this
 * fix this set was a two-member hardcoded allowlist while `GapKind`
 * (`pace-derivation.ts`) had already widened to three members (plan 33-01) —
 * `parseGapInterval` returns `null` for any `kind` outside this set, and
 * `parsePaceQualityShard`'s `if (parsed)` tolerant-drop loop below then
 * silently dropped every `'unreliable'`-kind entry with no error, no
 * warning, and no telemetry, starving every downstream reader of a fetched
 * shard's `gapIntervals` of the fourth kind. Mirrors the file's own
 * discipline at `VALID_ELEVATION_TIERS` (:53-59) of keeping a validating set
 * adjacent to the union it guards — but unlike that set, this one needs a
 * THIRD MEMBER rather than a separate set, because `GapKind` genuinely has
 * three members here (`ElevationTier` has no `'minor'`, so that case needed
 * its own set instead).
 */
const VALID_GAP_KINDS: ReadonlySet<string> = new Set<GapKind>(['recording-gap', 'pause', 'unreliable']);

/**
 * Phase 33 (SEG-06, D-08, plan 33-09 Task 3): the seventh signal's mechanism
 * set — a validating `Set` adjacent to the union it guards, same discipline
 * as `VALID_ELEVATION_TIERS`/`VALID_GAP_KINDS` above.
 */
const VALID_SEGMENT_MECHANISMS: ReadonlySet<string> = new Set<SegmentMechanism>([
  'gap-adjacent',
  'hidden-pause',
  'isolated-jump',
]);

/**
 * Phase 34 (PAUSE-02, D-15, plan 34-09): the shard's own per-interval
 * `pauseClass` set — DELIBERATELY SEPARATE from `VALID_GAP_KINDS` and
 * `VALID_SEGMENT_MECHANISMS` above, same discipline as `VALID_ELEVATION_TIERS`
 * (:56-62). `PauseClass` is its own four-member union (`'stationary' |
 * 'walked' | 'ran-through' | 'transported'`) sharing no members with
 * `GapKind` (`'recording-gap' | 'pause' | 'unreliable'`) or
 * `SegmentMechanism` (`'gap-adjacent' | 'hidden-pause' | 'isolated-jump'`) —
 * reusing either set would let a value from the WRONG union survive this
 * field's parse.
 */
const VALID_PAUSE_CLASSES: ReadonlySet<string> = new Set<PauseClass>([
  'stationary',
  'walked',
  'ran-through',
  'transported',
]);

/**
 * Phase 34 (PAUSE-02, D-15, plan 34-09): the shard's own per-interval
 * `source` set, one field over from `VALID_PAUSE_CLASSES` above — same
 * "deliberately separate Set" discipline. `PauseSource` is its own
 * four-member union (`'recording-gap' | 'merged-segment' |
 * 'zero-advance-pause' | 'covered-creep'`) — despite the first member's name
 * overlapping `GapKind`'s `'recording-gap'` in spelling, the two unions are
 * unrelated (one names a `pauseIntervals` entry's origin, the other a
 * `gapIntervals` entry's kind), so this validates independently rather than
 * reusing `VALID_GAP_KINDS`.
 */
const VALID_PAUSE_SOURCES: ReadonlySet<string> = new Set<PauseSource>([
  'recording-gap',
  'merged-segment',
  'zero-advance-pause',
  'covered-creep',
]);

function parseTier(raw: unknown): QualityTier | null {
  return typeof raw === 'string' && VALID_TIERS.has(raw) ? (raw as QualityTier) : null;
}

function nullableNumber(raw: unknown): number | null {
  return typeof raw === 'number' ? raw : null;
}

/**
 * Phase 30 (ELEV-01, T-26-02): stricter than `nullableNumber` — rejects
 * `NaN` and `Infinity` in addition to non-numbers, never coercing any of
 * them to `0`. Used for every elevation numeric field (D-07's action text).
 */
function finiteNumberOrNull(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/** Total, never-throwing parse of one tiering signal's shared numeric fields. Returns null on structural failure. */
function parseDecimationSignal(raw: unknown): DecimationSignal | null {
  if (!isPlainObject(raw)) return null;
  const tier = parseTier(raw.tier);
  if (tier === null) return null;
  return {
    tier,
    zeroAdvanceFraction: nullableNumber(raw.zeroAdvanceFraction),
    sampleCount: nullableNumber(raw.sampleCount),
  };
}

function parseGapProfileSignal(raw: unknown): GapProfileSignal | null {
  if (!isPlainObject(raw)) return null;
  const tier = parseTier(raw.tier);
  if (tier === null) return null;
  return {
    tier,
    gapFraction: nullableNumber(raw.gapFraction),
    recordingGapSec: nullableNumber(raw.recordingGapSec),
    pauseSec: nullableNumber(raw.pauseSec),
    spanSec: nullableNumber(raw.spanSec),
  };
}

function parseImpossibleSampleSignal(raw: unknown): ImpossibleSampleSignal | null {
  if (!isPlainObject(raw)) return null;
  const tier = parseTier(raw.tier);
  if (tier === null) return null;
  return {
    tier,
    count: nullableNumber(raw.count),
    maxImpliedSpeedMps: nullableNumber(raw.maxImpliedSpeedMps),
    countInsideZeroAdvanceRun: nullableNumber(raw.countInsideZeroAdvanceRun),
  };
}

function parseElevationTier(raw: unknown): ElevationTier | null {
  return typeof raw === 'string' && VALID_ELEVATION_TIERS.has(raw) ? (raw as ElevationTier) : null;
}

function parseSubGroundSignal(raw: unknown): SubGroundSignal | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.flagged !== 'boolean') return null;
  return { flagged: raw.flagged, minAltM: finiteNumberOrNull(raw.minAltM) };
}

function parseClosureDriftSignal(raw: unknown): ClosureDriftSignal | null {
  if (!isPlainObject(raw)) return null;
  const state = typeof raw.state === 'string' && VALID_CLOSURE_DRIFT_STATES.has(raw.state) ? raw.state : null;
  if (state === null) return null;
  return {
    state: state as ClosureDriftSignal['state'],
    deltaM: finiteNumberOrNull(raw.deltaM),
    startEndDistM: finiteNumberOrNull(raw.startEndDistM),
  };
}

function parseVerticalRateSignal(raw: unknown): VerticalRateSignal | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.flagged !== 'boolean') return null;
  return {
    flagged: raw.flagged,
    worstRateMps: finiteNumberOrNull(raw.worstRateMps),
    violatingSamples: finiteNumberOrNull(raw.violatingSamples),
  };
}

/**
 * Total, never-throwing parse of the sixth signal (Phase 30, ELEV-01,
 * D-07/T-30-09/T-30-10). Mirrors `parseDecimationSignal`'s all-or-nothing
 * shape one level up — `tier` and every one of the three nested sub-objects
 * must each independently validate, or the whole signal returns `null` so
 * the caller's `??` fallback (the whole-signal not-computable literal)
 * applies. Never falls back to a partially-parsed shape: a malformed
 * `closureDrift.state`, for example, invalidates the WHOLE elevation
 * signal, not just that one nested field — this is what makes "a shard
 * with `tier: 'minor'`" or "a shard with a bad `closureDrift.state`" both
 * degrade to the same explicit not-computable reading rather than a
 * partially-trusted shape.
 */
function parseElevationSignal(raw: unknown): ElevationSignal | null {
  if (!isPlainObject(raw)) return null;
  const tier = parseElevationTier(raw.tier);
  if (tier === null) return null;
  const subGround = parseSubGroundSignal(raw.subGround);
  if (subGround === null) return null;
  const closureDrift = parseClosureDriftSignal(raw.closureDrift);
  if (closureDrift === null) return null;
  const verticalRate = parseVerticalRateSignal(raw.verticalRate);
  if (verticalRate === null) return null;
  return { tier, subGround, closureDrift, verticalRate };
}

function parseSegmentMechanism(raw: unknown): SegmentMechanism | null {
  return typeof raw === 'string' && VALID_SEGMENT_MECHANISMS.has(raw) ? (raw as SegmentMechanism) : null;
}

/**
 * Total, never-throwing parse of the seventh signal (Phase 33, SEG-06, D-08,
 * plan 33-09). Mirrors `parseDecimationSignal`'s flat shape (`tier` plus
 * several nullable numeric fields), widened with a `mechanisms` array:
 * `null` passes through as `null` (T-26-02's not-computable state), but any
 * other non-array value, or ANY array entry that fails
 * `parseSegmentMechanism`, invalidates the WHOLE signal — the same
 * all-or-nothing discipline `parseElevationSignal` established, so a shard
 * predating this plan (no `unreliableSegments` key at all) or one carrying a
 * malformed mechanism degrades to the caller's `??` not-computable fallback
 * rather than a partially-trusted shape.
 */
function parseUnreliableSegmentsSignal(raw: unknown): UnreliableSegmentsSignal | null {
  if (!isPlainObject(raw)) return null;
  const tier = parseTier(raw.tier);
  if (tier === null) return null;

  let mechanisms: SegmentMechanism[] | null;
  if (raw.mechanisms === null) {
    mechanisms = null;
  } else if (Array.isArray(raw.mechanisms)) {
    const parsedMechanisms: SegmentMechanism[] = [];
    for (const item of raw.mechanisms) {
      const mechanism = parseSegmentMechanism(item);
      if (mechanism === null) return null; // one malformed entry invalidates the whole signal
      parsedMechanisms.push(mechanism);
    }
    mechanisms = parsedMechanisms;
  } else {
    return null;
  }

  return {
    tier,
    // Phase 33 review WR-01: the Phase-30 finite guard, not `nullableNumber` —
    // a NaN/Infinity here would otherwise render as "NaN m" in the ninth row.
    count: finiteNumberOrNull(raw.count),
    totalMetres: finiteNumberOrNull(raw.totalMetres),
    totalExcessMetres: finiteNumberOrNull(raw.totalExcessMetres),
    totalSeconds: finiteNumberOrNull(raw.totalSeconds),
    excessFraction: finiteNumberOrNull(raw.excessFraction),
    mechanisms,
  };
}

/**
 * `rawDeviceName` is deliberately passed through UNMODIFIED here — no HTML
 * transform of any kind. It is untrusted athlete/device free text
 * (`pace-quality.ts`'s `DeviceEraSignal` doc comment) that must reach the
 * DOM through `textContent` only (plan 27-09). Transforming it in this
 * client would corrupt it before it ever reaches that single DOM boundary,
 * where the one legitimate transform for on-screen safety belongs, not here.
 */
function parseDeviceEraSignal(raw: unknown): DeviceEraSignal | null {
  if (!isPlainObject(raw)) return null;
  const { family, rawDeviceName } = raw;
  if (typeof family !== 'string' || !VALID_DEVICE_FAMILIES.has(family)) return null;
  if (rawDeviceName !== null && typeof rawDeviceName !== 'string') return null;
  return { family: family as DeviceFamilyKind, rawDeviceName };
}

function parseElapsedVsMovingSignal(raw: unknown): ElapsedVsMovingSignal | null {
  if (!isPlainObject(raw)) return null;
  return {
    ratio: nullableNumber(raw.ratio),
    elapsedSec: nullableNumber(raw.elapsedSec),
    movingSec: nullableNumber(raw.movingSec),
  };
}

/**
 * Phase 34 (PAUSE-02, D-11): all-or-nothing parse of the ninth signal — the
 * `parseUnreliableSegmentsSignal` shape minus `tier` (this signal is
 * UNTIERED by design, so there is no tier field to parse). Every field goes
 * through `finiteNumberOrNull` (the Phase 30 elevation guard, not
 * `nullableNumber` — a NaN/Infinity count must never reach the DOM).
 */
function parsePauseClassificationSignal(raw: unknown): PauseClassificationSignal | null {
  if (!isPlainObject(raw)) return null;
  return {
    intervalCount: finiteNumberOrNull(raw.intervalCount),
    stationaryCount: finiteNumberOrNull(raw.stationaryCount),
    walkedCount: finiteNumberOrNull(raw.walkedCount),
    ranThroughCount: finiteNumberOrNull(raw.ranThroughCount),
    transportedCount: finiteNumberOrNull(raw.transportedCount),
    notClassifiableCount: finiteNumberOrNull(raw.notClassifiableCount),
  };
}

/**
 * CR-01 fallback for `parsePauseClassificationSignal` — every count `null`,
 * matching `notComputableSignals`' own literal in `pace-quality.ts`
 * (T-26-02: never zeroed, since a zero here would read as "genuinely no
 * pauses classified" rather than "not looked / stale document").
 */
const NOT_COMPUTABLE_PAUSE_CLASSIFICATION_PARSED: PauseClassificationSignal = {
  intervalCount: null,
  stationaryCount: null,
  walkedCount: null,
  ranThroughCount: null,
  transportedCount: null,
  notClassifiableCount: null,
};

/**
 * Phase 34 (STOP-01, STOP-03, D-09, D-11): all-or-nothing parse of the
 * tenth signal. `computable` must be a genuine boolean and `reason` must be
 * a string or `null` — either field failing that check invalidates the
 * WHOLE signal (never a partially-trusted shape), since a malformed
 * `computable` cannot be trusted to say whether the numeric fields below it
 * are meaningful. Numbers go through `finiteNumberOrNull`.
 */
function parseForgottenStopSignal(raw: unknown): ForgottenStopSignal | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.computable !== 'boolean') return null;
  if (raw.reason !== null && typeof raw.reason !== 'string') return null;
  return {
    computable: raw.computable,
    reason: raw.reason,
    count: finiteNumberOrNull(raw.count),
    totalSec: finiteNumberOrNull(raw.totalSec),
    longestSec: finiteNumberOrNull(raw.longestSec),
    creepCount: finiteNumberOrNull(raw.creepCount),
    creepTotalSec: finiteNumberOrNull(raw.creepTotalSec),
    creepLongestSec: finiteNumberOrNull(raw.creepLongestSec),
    pauseCount: finiteNumberOrNull(raw.pauseCount),
    pauseTotalSec: finiteNumberOrNull(raw.pauseTotalSec),
    pauseLongestSec: finiteNumberOrNull(raw.pauseLongestSec),
  };
}

/**
 * CR-01 fallback for `parseForgottenStopSignal` — `computable: false` with
 * every number `null`, matching the plan's own named literal.
 */
const NOT_COMPUTABLE_FORGOTTEN_STOP_PARSED: ForgottenStopSignal = {
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
};

/**
 * Total, never-throwing parse of the `ActivityQualitySignals` composite. A
 * shard whose `signals` object is present but missing (or malformed on) one
 * sub-signal parses with that sub-signal `null` rather than returning `null`
 * for the whole shard — the detail view (plan 27-09) then renders "not
 * reported" for that one row rather than losing the whole section. Returns
 * null only when `raw` itself is not a plain object.
 */
function parseActivityQualitySignals(raw: unknown): ActivityQualitySignals | null {
  if (!isPlainObject(raw)) return null;
  return {
    decimation: parseDecimationSignal(raw.decimation) ?? {
      tier: 'not-computable',
      zeroAdvanceFraction: null,
      sampleCount: null,
    },
    gapProfile: parseGapProfileSignal(raw.gapProfile) ?? {
      tier: 'not-computable',
      gapFraction: null,
      recordingGapSec: null,
      pauseSec: null,
      spanSec: null,
    },
    impossibleSamples: parseImpossibleSampleSignal(raw.impossibleSamples) ?? {
      tier: 'not-computable',
      count: null,
      maxImpliedSpeedMps: null,
      countInsideZeroAdvanceRun: null,
    },
    // Phase 30 (ELEV-01, T-30-09): a shard/row written before this phase
    // (or carrying a malformed elevation object) has no usable `elevation`
    // key at all and must degrade to this explicit not-computable literal
    // rather than throwing — the same stale-artifact failure mode Phase
    // 26's CR-02 fixed for `paceDisagreement`.
    elevation: parseElevationSignal(raw.elevation) ?? {
      tier: 'not-computable',
      subGround: { flagged: false, minAltM: null },
      closureDrift: { state: 'not-computable', deltaM: null, startEndDistM: null },
      verticalRate: { flagged: false, worstRateMps: null, violatingSamples: null },
    },
    // Phase 33 (SEG-06, D-08, plan 33-09 Task 3): the same stale-artifact
    // defence as `elevation` above — a shard written before this plan (or
    // carrying a malformed unreliableSegments object) has no usable key at
    // all and must degrade to this explicit not-computable literal rather
    // than throwing or silently fabricating a clean 'none' reading.
    unreliableSegments: parseUnreliableSegmentsSignal(raw.unreliableSegments) ?? {
      tier: 'not-computable',
      count: null,
      totalMetres: null,
      totalExcessMetres: null,
      totalSeconds: null,
      excessFraction: null,
      mechanisms: null,
    },
    deviceEra: parseDeviceEraSignal(raw.deviceEra) ?? { family: 'no-device-name', rawDeviceName: null },
    elapsedVsMoving: parseElapsedVsMovingSignal(raw.elapsedVsMoving) ?? {
      ratio: null,
      elapsedSec: null,
      movingSec: null,
    },
    // Phase 34 (PAUSE-02, D-11): the same stale-artifact defence as
    // `elevation`/`unreliableSegments` above — a row written before this
    // plan has no usable `pauseClassification` key at all.
    pauseClassification:
      parsePauseClassificationSignal(raw.pauseClassification) ?? NOT_COMPUTABLE_PAUSE_CLASSIFICATION_PARSED,
    // Phase 34 (STOP-01, STOP-03, D-09, D-11): same defence, one signal later.
    forgottenStop: parseForgottenStopSignal(raw.forgottenStop) ?? NOT_COMPUTABLE_FORGOTTEN_STOP_PARSED,
    anySevere: typeof raw.anySevere === 'boolean' ? raw.anySevere : false,
    notComputableReason: typeof raw.notComputableReason === 'string' ? raw.notComputableReason : null,
  };
}

/** Total, never-throwing parse of one `gapIntervals` entry. Returns null on any structural failure. */
function parseGapInterval(raw: unknown): GapInterval | null {
  if (!isPlainObject(raw)) return null;
  const { startSec, endSec, kind } = raw;
  if (typeof startSec !== 'number' || typeof endSec !== 'number') return null;
  if (typeof kind !== 'string' || !VALID_GAP_KINDS.has(kind)) return null;
  return { startSec, endSec, kind: kind as GapKind };
}

/** Total, never-throwing parse of one `elevationVerticalRateSamples` entry. Returns null on any structural failure. */
function parseElevationVerticalRateSampleEntry(
  raw: unknown
): { index: number; rateMps: number; dtSec: number; dAltM: number } | null {
  if (!isPlainObject(raw)) return null;
  const { index, rateMps, dtSec, dAltM } = raw;
  if (typeof index !== 'number' || typeof rateMps !== 'number') return null;
  if (typeof dtSec !== 'number' || typeof dAltM !== 'number') return null;
  return { index, rateMps, dtSec, dAltM };
}

/** Total, never-throwing parse of one `impossibleSamples` entry. Returns null on any structural failure. */
function parseImpossibleSampleEntry(
  raw: unknown
): { index: number; impliedSpeedMps: number; dtSec: number; ddM: number } | null {
  if (!isPlainObject(raw)) return null;
  const { index, impliedSpeedMps, dtSec, ddM } = raw;
  if (typeof index !== 'number' || typeof impliedSpeedMps !== 'number') return null;
  if (typeof dtSec !== 'number' || typeof ddM !== 'number') return null;
  return { index, impliedSpeedMps, dtSec, ddM };
}

/**
 * Total, never-throwing parse of one shard `unreliableSegments` entry (Phase
 * 33, SEG-06, D-08, plan 33-10 Task 2). Mirrors `parseGapInterval`'s
 * drop-on-failure contract (T-33-13b): returns `null` on any structural
 * failure, and the caller — `parsePaceQualityShard`'s tolerant-drop loop,
 * the same `if (parsed)` shape every other capped shard list already uses —
 * drops just that one entry without invalidating the whole shard or the
 * rest of the list. `mechanism` is validated against `VALID_SEGMENT_MECHANISMS`,
 * not merely checked for `typeof === 'string'` — an unknown mechanism string
 * is exactly as untrustworthy as a missing numeric field.
 */
function parseUnreliableSegment(
  raw: unknown
): { startSec: number; endSec: number; metres: number; excessMetres: number; seconds: number; mechanism: SegmentMechanism } | null {
  if (!isPlainObject(raw)) return null;
  const { startSec, endSec, metres, excessMetres, seconds, mechanism } = raw;
  // Phase 33 review WR-01: finite-only, matching the Phase-30 elevation guard.
  if (typeof startSec !== 'number' || typeof endSec !== 'number') return null;
  if (typeof metres !== 'number' || typeof excessMetres !== 'number' || typeof seconds !== 'number') return null;
  if (![startSec, endSec, metres, excessMetres, seconds].every(Number.isFinite)) return null;
  const parsedMechanism = parseSegmentMechanism(mechanism);
  if (parsedMechanism === null) return null;
  return { startSec, endSec, metres, excessMetres, seconds, mechanism: parsedMechanism };
}

function parsePauseClass(raw: unknown): PauseClass | null {
  return typeof raw === 'string' && VALID_PAUSE_CLASSES.has(raw) ? (raw as PauseClass) : null;
}

function parsePauseSource(raw: unknown): PauseSource | null {
  return typeof raw === 'string' && VALID_PAUSE_SOURCES.has(raw) ? (raw as PauseSource) : null;
}

/**
 * Total, never-throwing parse of one shard `pauseIntervals` entry (Phase 34,
 * PAUSE-02, D-15, plan 34-09). Mirrors `parseUnreliableSegment`'s
 * drop-on-failure contract: returns `null` on any structural failure, and
 * the caller — `parsePaceQualityShard`'s tolerant-drop loop, the same
 * `if (parsed)` shape every other capped shard list here already uses —
 * drops just that one entry without invalidating the whole shard or the
 * rest of the list. `source`/`pauseClass` are each validated against their
 * own set (`VALID_PAUSE_SOURCES`/`VALID_PAUSE_CLASSES`), not merely checked
 * for `typeof === 'string'` — an unknown value is exactly as untrustworthy
 * as a missing numeric field.
 */
function parsePauseInterval(
  raw: unknown
): {
  source: PauseSource;
  pauseClass: PauseClass;
  startSec: number;
  endSec: number;
  seconds: number;
  metres: number;
  startMetres: number;
} | null {
  if (!isPlainObject(raw)) return null;
  const { source, pauseClass, startSec, endSec, seconds, metres, startMetres } = raw;
  if (typeof startSec !== 'number' || typeof endSec !== 'number') return null;
  if (typeof seconds !== 'number' || typeof metres !== 'number' || typeof startMetres !== 'number') return null;
  if (![startSec, endSec, seconds, metres, startMetres].every(Number.isFinite)) return null;
  const parsedSource = parsePauseSource(source);
  if (parsedSource === null) return null;
  const parsedPauseClass = parsePauseClass(pauseClass);
  if (parsedPauseClass === null) return null;
  return {
    source: parsedSource,
    pauseClass: parsedPauseClass,
    startSec,
    endSec,
    seconds,
    metres,
    startMetres,
  };
}

function parseZeroAdvanceRunProfile(raw: unknown): PaceQualityShard['zeroAdvanceRunProfile'] {
  if (raw === null) return null;
  if (!isPlainObject(raw)) return null;
  const { runCount, longestRunSamples, longestRunSec, medianRunSamples, p90RunSec } = raw;
  if (typeof runCount !== 'number' || typeof longestRunSamples !== 'number') return null;
  if (typeof longestRunSec !== 'number' || typeof medianRunSamples !== 'number') return null;
  if (typeof p90RunSec !== 'number') return null;
  return { runCount, longestRunSamples, longestRunSec, medianRunSamples, p90RunSec };
}

/**
 * Total, never-throwing parse of one `<statsDir>/pace-quality/{id}.json`
 * shard body. Requires a non-array object with a string `activityId` and a
 * `signals` object — a shard whose `signals` object is present but missing
 * a sub-signal still parses (see `parseActivityQualitySignals`). Individual
 * malformed elements of `gapIntervals` or `impossibleSamples` are dropped
 * (tolerant, entry-level), never invalidating the whole shard. Returns null
 * on any top-level structural failure (missing/non-string `activityId`,
 * missing `signals` object).
 */
export function parsePaceQualityShard(raw: unknown): PaceQualityShard | null {
  if (!isPlainObject(raw)) return null;
  if (!hasOwn(raw, 'activityId') || typeof raw.activityId !== 'string') return null;
  if (!hasOwn(raw, 'signals') || !isPlainObject(raw.signals)) return null;

  const signals = parseActivityQualitySignals(raw.signals);
  if (signals === null) return null;

  const gapIntervals: GapInterval[] = [];
  if (Array.isArray(raw.gapIntervals)) {
    for (const item of raw.gapIntervals) {
      const parsed = parseGapInterval(item);
      if (parsed) gapIntervals.push(parsed);
    }
  }

  const impossibleSamples: { index: number; impliedSpeedMps: number; dtSec: number; ddM: number }[] = [];
  if (Array.isArray(raw.impossibleSamples)) {
    for (const item of raw.impossibleSamples) {
      const parsed = parseImpossibleSampleEntry(item);
      if (parsed) impossibleSamples.push(parsed);
    }
  }

  // Phase 30 (ELEV-01): same tolerance and cap discipline as the
  // `impossibleSamples` block above — individually malformed entries are
  // dropped, never invalidating the whole shard; the truncation flag and
  // the loop radius/start-end distance degrade to safe defaults rather
  // than throwing.
  const elevationVerticalRateSamples: { index: number; rateMps: number; dtSec: number; dAltM: number }[] = [];
  if (Array.isArray(raw.elevationVerticalRateSamples)) {
    for (const item of raw.elevationVerticalRateSamples) {
      const parsed = parseElevationVerticalRateSampleEntry(item);
      if (parsed) elevationVerticalRateSamples.push(parsed);
    }
  }

  // Phase 33 (SEG-06, D-08, plan 33-10 Task 2): same tolerance/cap-agnostic
  // discipline as `impossibleSamples`/`elevationVerticalRateSamples` above —
  // individually malformed entries are dropped, never invalidating the
  // whole shard; a shard with no `unreliableSegments` key at all (a
  // pre-plan-33-10 stale artifact) yields an empty array, never `undefined`.
  const unreliableSegments: {
    startSec: number;
    endSec: number;
    metres: number;
    excessMetres: number;
    seconds: number;
    mechanism: SegmentMechanism;
  }[] = [];
  if (Array.isArray(raw.unreliableSegments)) {
    for (const item of raw.unreliableSegments) {
      const parsed = parseUnreliableSegment(item);
      if (parsed) unreliableSegments.push(parsed);
    }
  }

  // Phase 34 (PAUSE-02, D-15, plan 34-09): same tolerance/cap-agnostic
  // discipline as `unreliableSegments` above — individually malformed
  // entries are dropped, never invalidating the whole shard; a shard with
  // no `pauseIntervals` key at all (a pre-plan-34-09 stale artifact, or the
  // plan 34-08 stub this parser used to always return) yields an empty
  // array, never `undefined`.
  const pauseIntervals: {
    source: PauseSource;
    pauseClass: PauseClass;
    startSec: number;
    endSec: number;
    seconds: number;
    metres: number;
    startMetres: number;
  }[] = [];
  if (Array.isArray(raw.pauseIntervals)) {
    for (const item of raw.pauseIntervals) {
      const parsed = parsePauseInterval(item);
      if (parsed) pauseIntervals.push(parsed);
    }
  }

  return {
    activityId: raw.activityId,
    signals,
    gapIntervals,
    impossibleSamples,
    impossibleSamplesTruncated: typeof raw.impossibleSamplesTruncated === 'boolean' ? raw.impossibleSamplesTruncated : false,
    zeroAdvanceRunProfile: parseZeroAdvanceRunProfile(raw.zeroAdvanceRunProfile ?? null),
    adaptiveWindowSec: nullableNumber(raw.adaptiveWindowSec),
    notComputableReason: typeof raw.notComputableReason === 'string' ? raw.notComputableReason : null,
    elevationVerticalRateSamples,
    elevationVerticalRateSamplesTruncated:
      typeof raw.elevationVerticalRateSamplesTruncated === 'boolean' ? raw.elevationVerticalRateSamplesTruncated : false,
    elevationLoopRadiusM: finiteNumberOrNull(raw.elevationLoopRadiusM) ?? LOOP_RADIUS_M,
    elevationStartEndDistM: finiteNumberOrNull(raw.elevationStartEndDistM),
    unreliableSegments,
    unreliableSegmentsTruncated:
      typeof raw.unreliableSegmentsTruncated === 'boolean' ? raw.unreliableSegmentsTruncated : false,
    // Phase 34 (PAUSE-02, D-15, plan 34-09): the shard's per-interval pause
    // list, tolerantly parsed entry-by-entry above — a shard predating this
    // plan (no `pauseIntervals` key at all) degrades to the same
    // "present, not absent" empty/untruncated CR-01 shape every other
    // capped list here defaults to on a stale/malformed document.
    pauseIntervals,
    pauseIntervalsTruncated: typeof raw.pauseIntervalsTruncated === 'boolean' ? raw.pauseIntervalsTruncated : false,
  };
}

export interface PaceQualityClientOptions {
  /** Defaults to `'data/'`, relative to the published site root. */
  baseUrl?: string;
  /** Defaults to the global `fetch`, resolved lazily inside the call. */
  fetchImpl?: FetchLike;
}

export interface PaceQualityClient {
  load(activityId: string): Promise<PaceQualityShard | null>;
  /** Test-support only: clears the per-id cache so the next `load()` fetches again. */
  reset(): void;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
}

export function createPaceQualityClient(options: PaceQualityClientOptions = {}): PaceQualityClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? 'data/');

  const inFlight = new Map<string, Promise<PaceQualityShard | null>>();

  async function fetchPaceQualityShard(activityId: string): Promise<PaceQualityShard | null> {
    try {
      const doFetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
      const url = `${baseUrl}stats/pace-quality/${activityId}.json`;
      const response = await doFetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
      const body = await response.json();
      return parsePaceQualityShard(body);
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function load(activityId: string): Promise<PaceQualityShard | null> {
    const existing = inFlight.get(activityId);
    if (existing) {
      return existing;
    }

    const promise = fetchPaceQualityShard(activityId).then((result) => {
      // A null result — 404, malformed body, wrong shape — must not be
      // memoized: a subsequent load() for the same id issues a genuine new
      // fetch rather than replaying the cached failure. Only a successful
      // entry is cached for the rest of the page session.
      if (result === null) {
        inFlight.delete(activityId);
      }
      return result;
    });

    inFlight.set(activityId, promise);
    return promise;
  }

  function reset(): void {
    inFlight.clear();
  }

  return { load, reset };
}
