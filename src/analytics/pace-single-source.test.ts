/**
 * PACE-01 Criterion 4 / D-18 — the single-source audit.
 *
 * What this guards: proves, structurally and in the existing CI chain (not
 * a one-off hand-run grep), that zero per-sample stream-derived pace
 * arithmetic exists anywhere under `src/` outside
 * `src/analytics/pace-derivation.ts`. The two exact expressions that once
 * constituted the phase's two divergent implementations (confirmed by
 * research, both eliminated by plan 26-04) are banned literals:
 *   - `dt / (dd / 1000)`       — was `detail-zones.ts:76`
 *   - `elapsed / (metres / 1000)` — was `detail-charts-logic.ts:127`
 * It also guards the derivation's test-only override surface
 * (`clipAtGaps`, an explicit `windowSec:`, an explicit `pauseRule:`) never
 * appearing as a call-site argument in a production file, so the shipped
 * adaptive, gap-clipped behaviour cannot be silently bypassed (T-26-06).
 *
 * What this deliberately does NOT guard: metadata/aggregate-derived pace,
 * a structurally different computation (whole-activity or per-gear
 * `movingTimeSec / (distanceM / 1000)`, not a per-sample stream average).
 * Four sites compute it and must NOT be flagged — they are PACE-07's and
 * other features' subject, not PACE-01's:
 *   - `src/analytics/compute-dashboard-index.ts`
 *   - `src/dashboard/views/detail.ts`
 *   - `src/widgets/shared/route-utils.ts`
 *   - `src/analytics/gear-aggregate-logic.ts`
 *
 * Self-hygiene: this docblock itself quotes both banned literals, and the
 * scanner strips comments (via `row-semantics.test.ts`'s `stripComments`,
 * the in-repo precedent) before counting occurrences — otherwise this
 * explanatory header would flag itself. Comment-stripping alone is not
 * enough, though: this file's own `BANNED_LITERALS` array and its planted
 * synthetic fixtures below hold the same two strings as STRING LITERALS
 * (test data, not comments), which `stripComments` cannot and must not
 * touch. `findStreamPaceViolations` therefore also allow-lists this file
 * itself (`ALLOWED_SELF_SUFFIX`) — the audit's own source is unavoidably
 * exempt from its own scan, exactly as `curation-guard.mjs`'s own
 * docblock quoting `CURATE_MARKER` is exempt from `findCurationArtifacts`.
 * See `curation-seam.test.ts` for the same
 * `readFileSync`/`stripComments`/`countOccurrences` idiom this file
 * mirrors, and `scripts/lib/curation-guard.mjs` for the never-throwing
 * recursive-walk shape `readSourceTree` below borrows.
 *
 * Demonstrated catching a reintroduced second implementation (Criterion 4's
 * mandate) is proven two ways: the permanent in-suite "planted" describe
 * block below (a synthetic file list, so this proof cannot rot even if the
 * real tree never again holds a violation), and a one-off run against the
 * real source tree recorded verbatim in this plan's SUMMARY.md — a probe
 * file was planted under `src/dashboard/views/`, the audit was run and its
 * failure output captured, then the probe was deleted and `git status
 * --porcelain src` was confirmed clean.
 *
 * KNOWN, DOCUMENTED BLIND SPOTS AND THEIR TARGETED CLOSURE — this audit has
 * now had TWO historically-real blind spots found and closed against it,
 * neither hypothetical:
 *
 * (1) This phase's cross-plan violation (`26-INTEGRATION-FIX.md`, commit
 * `f32dddd8`) was NOT a `dt/dd`-shaped division at all — `detail-zones.ts`'s
 * `maskedPaceSeries` reconstructed `paceHistogramSamples`'s own gap-interval
 * MEMBERSHIP TEST
 * (`gapIntervals.some((g) => segStart >= g.startSec && segStart < g.endSec)`)
 * with no arithmetic in sight, so the two `BANNED_LITERALS` above would have
 * passed it clean. `GAP_MEMBERSHIP_LITERALS` below closes that specific,
 * historically-real blind spot by confining `gapIntervals.some(` /
 * `gapIntervals.find(` call sites the same way `OVERRIDE_LITERALS` are
 * confined.
 *
 * (2) CR-03 (`26-VERIFICATION.md`, 2026-09-09, closed by plan 26-14): the
 * `OVERRIDE_LITERALS` scan's `windowSec:` literal missed the ES2015
 * object-shorthand form (`{ windowSec, gapIntervals }`) that
 * `detail-charts-logic.ts`'s deleted `derivePaceSeries` wrapper actually
 * used, AND this docblock previously excused that exact file/shape by name
 * — reasoning that is what let the defect through review. The excused
 * wrapper was DELETED in plan 26-14 rather than re-excused; the scan is
 * extended below (three new `OVERRIDE_LITERALS` entries) to catch the shape
 * structurally, regardless of which file it might reappear in.
 *
 * An audit whose header claims completeness it has not demonstrated is the
 * same false-invariant failure class this phase keeps re-encountering — this
 * closes the TWO blind spots this plan has direct evidence of; it is not a
 * claim that every conceivable second-locus SHAPE (e.g. a hand-rolled loop
 * with no method call at all) is caught — see this plan's SUMMARY.md for the
 * honest scope statement.
 *
 * SEG-05a (Phase 32) — the unreliable-segment detector
 *
 * Extends this audit to `src/analytics/unreliable-segments.ts` (plan 32-02),
 * per D-14 and SEG-05a. Confines: the two core arithmetic expressions
 * (`isFastStep`'s `metres > speedLimitMps * seconds` and `excessMetres`'s
 * `metres - speedLimitMps * seconds`, both sharing the substring
 * `speedLimitMps * seconds`); the structural call site `advanceSteps(`; the
 * three `DetectorParams` keys (`speedLimitMps`, `excessFloorMetres`,
 * `hiddenPauseMinMetres`) in their colon, comma and object-shorthand-close
 * forms; and any importer of the module (a static import, `export … from`,
 * `import type`, or dynamic `import(`) whose specifier ends in
 * `unreliable-segments.js` or `unreliable-segments'`.
 *
 * Maps to the audit's two historically-real blind spots (both closed for
 * this detector from day one rather than retrofitted): blind spot (1),
 * non-arithmetic re-implementation (`f32dddd8`), is closed here by the
 * importer confinement and the `advanceSteps(` structural check — neither
 * needs a division or comparison to exist to be flagged. Blind spot (2),
 * formatting-variant misses (CR-03), is closed by the colon/comma/
 * shorthand-close param-key forms, mirroring `OVERRIDE_LITERALS`'s own
 * `windowSec,` / `windowSec }` closure.
 *
 * The audit bans a second IMPLEMENTATION of the detector's arithmetic or a
 * second IMPORTER of its exports — it does NOT ban a second CALLER of
 * `detectUnreliableSegments` reached through its one allowed importer.
 * `pace-derivation.ts` is allow-listed for import because Phase 33 folds
 * this detector into `classifyGaps` there (this module's own docblock,
 * lines 10-16); today it imports nothing from this module. Widening this
 * allowlist in a later phase needs its own recorded reason, the same
 * discipline `ALLOWED_FILE_SUFFIX` already holds this file to.
 *
 * The one-off planted probe against the real source tree (this docblock's
 * own "demonstrated catching" paragraph above, applied to this detector) was
 * run, watched failing, deleted, and confirmed leaving `src/` clean; the
 * verbatim failing output is recorded in `32-04-SUMMARY.md`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { stripComments } from '../dashboard/row-semantics.test.js';

const SRC_ROOT = new URL('../../src/', import.meta.url);

/**
 * The two exact literal expressions that constituted the phase's two
 * pre-fix divergent stream-derived pace implementations. Deliberately NOT
 * a broad `movingTime.*distance` shape (26-RESEARCH.md Pitfall 5) — that
 * shape false-positives on the four legitimate metadata/aggregate sites.
 */
const BANNED_LITERALS = ['dt / (dd / 1000)', 'elapsed / (metres / 1000)'] as const;

/** The one file allowed to contain the banned literals — where the arithmetic actually lives. */
const ALLOWED_FILE_SUFFIX = 'analytics/pace-derivation.ts';

/**
 * This audit file's own path. It necessarily holds both banned literals as
 * STRING LITERALS — inside `BANNED_LITERALS` itself and inside the planted
 * synthetic fixtures in the "demonstrated catching" describe block below —
 * which are test DATA, not stream-derived pace arithmetic. `stripComments`
 * cannot distinguish "a string containing the banned text" from "the banned
 * text as executable arithmetic", so this file is allow-listed by path
 * alongside `pace-derivation.ts` rather than by content shape.
 */
const ALLOWED_SELF_SUFFIX = 'analytics/pace-single-source.test.ts';

export interface SourceFile {
  path: string;
  source: string;
}

export interface StreamPaceViolation {
  path: string;
  needle: string;
  count: number;
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Pure scanner (curation-guard.mjs's shape: takes data in, returns
 * violations, never throws, never reads the disk itself). Taking the file
 * list as an argument rather than reading the disk inside the scanner is
 * what makes the planted-violation test below a permanent in-suite test
 * rather than a one-off.
 */
export function findStreamPaceViolations(files: readonly SourceFile[]): StreamPaceViolation[] {
  const violations: StreamPaceViolation[] = [];
  for (const file of files) {
    if (file.path.endsWith(ALLOWED_FILE_SUFFIX) || file.path.endsWith(ALLOWED_SELF_SUFFIX)) continue;
    const stripped = stripComments(file.source);
    for (const needle of BANNED_LITERALS) {
      const count = countOccurrences(stripped, needle);
      if (count > 0) {
        violations.push({ path: file.path, needle, count });
      }
    }
  }
  return violations;
}

/**
 * Recursive `.ts`-file walk over `src/` (curation-guard.mjs's fail-closed
 * shape). `readdirSync`/`readFileSync` failures are recorded as their own
 * violation-shaped entries rather than thrown — an unreadable directory or
 * file must not silently pass the audit by being invisible to it.
 */
export function readSourceTree(rootUrl: URL): {
  files: SourceFile[];
  failures: StreamPaceViolation[];
} {
  const files: SourceFile[] = [];
  const failures: StreamPaceViolation[] = [];

  function walk(dirUrl: URL, label: string): void {
    let entries: import('node:fs').Dirent<string>[];
    try {
      entries = readdirSync(dirUrl, { withFileTypes: true, encoding: 'utf8' });
    } catch (error) {
      failures.push({
        path: label,
        needle: `<unreadable directory: ${(error as NodeJS.ErrnoException).code ?? String(error)}>`,
        count: 1,
      });
      return;
    }

    for (const entry of entries) {
      const isDir = entry.isDirectory();
      const entryUrl = new URL(entry.name + (isDir ? '/' : ''), dirUrl);
      const entryLabel = `${label}${entry.name}`;

      if (isDir) {
        walk(entryUrl, `${entryLabel}/`);
        continue;
      }

      if (!entry.name.endsWith('.ts')) continue;

      try {
        const source = readFileSync(entryUrl, 'utf8');
        files.push({ path: entryLabel, source });
      } catch (error) {
        failures.push({
          path: entryLabel,
          needle: `<unreadable file: ${(error as NodeJS.ErrnoException).code ?? String(error)}>`,
          count: 1,
        });
      }
    }
  }

  walk(rootUrl, 'src/');
  return { files, failures };
}

/**
 * The derivation's test-only override surface: `clipAtGaps`, an explicit
 * window-width argument (colon, comma or shorthand-close form), `pauseRule:`,
 * and any direct call to the gap-aware primitive itself.
 *
 * `windowSec:` and `pauseRule:` are also valid TypeScript TYPE-annotation
 * syntax (e.g. a function parameter `windowSec: number = ...` or an
 * interface member `windowSec: number;`) — textually indistinguishable from
 * an object literal's property key by plain substring search. `number` /
 * `string` / `boolean` immediately after the colon is TypeScript's own type
 * grammar, never a legitimate call-site value in this codebase — that is
 * the sole, narrow exclusion applied below, via `isTypeAnnotationSuffix`.
 *
 * CORRECTED 2026-09-09 (CR-03, `26-VERIFICATION.md`, closed by plan 26-14):
 * this docblock previously reasoned that a bare literal scan "would
 * false-positive on `detail-charts-logic.ts`'s `derivePaceSeries` wrapper …
 * and is not an override of `derivePaceWithCoverage`'s adaptive resolution."
 * That reasoning was wrong — passing a fixed window in place of the adaptive
 * resolution IS the override, and it is exactly what that wrapper did,
 * called with the fixed 20s floor from `buildChannelSeries`. The wrapper is
 * DELETED in plan 26-14 rather than re-excused. Three literals were added to
 * close the gap:
 *   - `'windowSec,'` and `'windowSec }'` catch the ES2015 object-shorthand
 *     form (`{ windowSec, gapIntervals }` / `{ windowSec }`) that
 *     `'windowSec:'` cannot see — the exact shape the deleted wrapper used.
 *     They are formatting-sensitive heuristics (a call written `{windowSec}`
 *     with no spaces would slip past `'windowSec }'`) — belt-and-braces, not
 *     load-bearing on their own.
 *   - `'derivePaceSeriesGapAware('` is the load-bearing check: it catches
 *     ANY direct call to the gap-aware primitive outside `pace-derivation.ts`
 *     regardless of how the options object is written — a structural
 *     property, not a formatting one.
 */
const OVERRIDE_LITERALS = [
  'clipAtGaps',
  'windowSec:',
  'windowSec,',
  'windowSec }',
  'pauseRule:',
  'derivePaceSeriesGapAware(',
] as const;

/**
 * The gap-interval MEMBERSHIP-TEST call sites — `gapIntervals.some(` /
 * `gapIntervals.find(` — that `paceHistogramSamples` and
 * `derivePaceSeriesGapAware` use internally to decide whether a sample or
 * segment falls inside a gap. This is the shape the real
 * `detail-zones.ts` `maskedPaceSeries` violation actually took (commit
 * `f32dddd8`): a local re-implementation of gap-membership testing with NO
 * `dt/dd` division anywhere in it, so `BANNED_LITERALS` alone would have
 * missed it. Confining these call sites the same way as `OVERRIDE_LITERALS`
 * closes that specific, historically-demonstrated blind spot.
 */
const GAP_MEMBERSHIP_LITERALS = ['gapIntervals.some(', 'gapIntervals.find('] as const;

export interface OverrideMatch {
  path: string;
  literal: string;
}

function isTypeAnnotationSuffix(afterColon: string): boolean {
  return /^\s*(number|string|boolean)\b/.test(afterColon);
}

function findConfinedCallSites(
  files: readonly SourceFile[],
  literals: readonly string[]
): OverrideMatch[] {
  const matches: OverrideMatch[] = [];
  for (const file of files) {
    const stripped = stripComments(file.source);
    for (const literal of literals) {
      let searchFrom = 0;
      for (;;) {
        const idx = stripped.indexOf(literal, searchFrom);
        if (idx === -1) break;
        searchFrom = idx + literal.length;
        if (literal.endsWith(':') && isTypeAnnotationSuffix(stripped.slice(searchFrom, searchFrom + 24))) {
          continue;
        }
        matches.push({ path: file.path, literal });
      }
    }
  }
  return matches;
}

// ---------------------------------------------------------------------------
// SEG-05a — the unreliable-segment detector containment (see this file's
// docblock, "SEG-05a (Phase 32)" section, for the full rationale)
// ---------------------------------------------------------------------------

/** The one file allowed to contain the detector's own arithmetic/structural literals. */
const DETECTOR_FILE_SUFFIX = 'analytics/unreliable-segments.ts';

/**
 * Both of the detector's core arithmetic expressions share this exact
 * substring — `isFastStep`'s `metres > speedLimitMps * seconds` and
 * `excessMetres`'s `metres - speedLimitMps * seconds` — so one needle covers
 * both without a broader shape that would false-positive elsewhere.
 */
const DETECTOR_ARITHMETIC_LITERALS = ['speedLimitMps * seconds'] as const;

/** The detector's structural call site — non-arithmetic, closes blind spot (1). */
const DETECTOR_STRUCTURAL_LITERALS = ['advanceSteps('] as const;

/**
 * Any module specifier ending in `unreliable-segments.js` (explicit `.js`
 * extension) or a bare `unreliable-segments` (no extension) closing quote —
 * covers a static import, `export … from`, `import type`, or a dynamic
 * `import(` call, since all four spell the specifier text identically.
 * Non-arithmetic, closes blind spot (1)'s importer half.
 *
 * A JavaScript module specifier can be written with any of the three quote
 * characters (`'`, `"`, or `` ` `` for a dynamic `import(...)`), and there is
 * no `.prettierrc`, `package.json` prettier key, `.editorconfig` or eslint
 * `quotes` rule in this repo enforcing one — quote style here is convention,
 * not a structural property this scan can lean on. The scan must therefore be
 * blind to which quote character closes the specifier
 * (32-VERIFICATION.md 2026-09-20, Anti-Patterns: "Detector-importer
 * confinement needles are single-quote-only"). This is a third instance of
 * blind spot (1) — the first two being the arithmetic literal and the
 * structural call site above — after (2)'s formatting-variant miss (CR-03)
 * for param keys below. The closing quote stays part of every needle: a bare
 * `unreliable-segments` with no closing quote would false-positive on prose
 * and comments naming the module, which is exactly why the quote is part of
 * the needle rather than a separately-matched boundary.
 */
const DETECTOR_IMPORTER_NEEDLES = [
  "unreliable-segments.js'",
  "unreliable-segments'",
  'unreliable-segments.js"',
  'unreliable-segments"',
  'unreliable-segments.js`',
  'unreliable-segments`',
] as const;

/**
 * The three `DetectorParams` keys in their colon, comma and
 * object-shorthand-close forms — closes blind spot (2) (CR-03's
 * formatting-variant miss) for this detector from day one. Confined via
 * `findConfinedCallSites`, which already skips a `key:` match followed by a
 * `number`/`string`/`boolean` type annotation.
 */
const DETECTOR_PARAM_LITERALS = [
  'speedLimitMps:',
  'speedLimitMps,',
  'speedLimitMps }',
  'excessFloorMetres:',
  'excessFloorMetres,',
  'excessFloorMetres }',
  'hiddenPauseMinMetres:',
  'hiddenPauseMinMetres,',
  'hiddenPauseMinMetres }',
] as const;

/** True iff `path` is the detector itself or any test file (including this audit's own file). */
function isDetectorOrTestFile(path: string): boolean {
  return path.endsWith(DETECTOR_FILE_SUFFIX) || path.endsWith('.test.ts');
}

/** True iff `path` is the detector, its one allowed future importer, or any test file. */
function isDetectorOrImporterOrTestFile(path: string): boolean {
  return (
    path.endsWith(DETECTOR_FILE_SUFFIX) || path.endsWith(ALLOWED_FILE_SUFFIX) || path.endsWith('.test.ts')
  );
}

/**
 * Pure scanner (same shape as `findStreamPaceViolations`): data in,
 * violations out, never throws, never reads the disk. Covers the detector's
 * arithmetic literal, its structural call-site literal, and its importer
 * confinement. Param-key confinement is asserted separately via
 * `findConfinedCallSites(files, DETECTOR_PARAM_LITERALS)` — a different
 * result shape (`OverrideMatch`, not `StreamPaceViolation`) — mirroring how
 * `OVERRIDE_LITERALS`/`GAP_MEMBERSHIP_LITERALS` are asserted separately from
 * `findStreamPaceViolations` above.
 */
export function findUnreliableSegmentViolations(files: readonly SourceFile[]): StreamPaceViolation[] {
  const violations: StreamPaceViolation[] = [];

  for (const file of files) {
    const stripped = stripComments(file.source);

    if (!isDetectorOrTestFile(file.path)) {
      for (const needle of DETECTOR_ARITHMETIC_LITERALS) {
        const count = countOccurrences(stripped, needle);
        if (count > 0) violations.push({ path: file.path, needle, count });
      }
      for (const needle of DETECTOR_STRUCTURAL_LITERALS) {
        const count = countOccurrences(stripped, needle);
        if (count > 0) violations.push({ path: file.path, needle, count });
      }
    }

    if (!isDetectorOrImporterOrTestFile(file.path)) {
      for (const needle of DETECTOR_IMPORTER_NEEDLES) {
        const count = countOccurrences(stripped, needle);
        if (count > 0) violations.push({ path: file.path, needle, count });
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Phase 34 — pause-classification.ts: D-05 no-literal guard and confinement
// (see the "pause-classification reads the detector (SEG-05b, Phase 34
// half)" describe block far below for the load-bearing proof itself)
// ---------------------------------------------------------------------------

/**
 * The transport-speed literal (D-05). This needle is deliberately the exact
 * numeric string, never a broader "any float near it" shape — mirroring
 * `BANNED_LITERALS`'s own narrow-literal discipline above. The ONE file
 * allowed to hold it is the detector itself; every `.test.ts` file is also
 * excluded (this audit file's own docblocks/planted fixtures, and
 * `pause-classification.test.ts`'s own probe-construction constant, both
 * legitimately hold the literal as documentation/test data, not production
 * arithmetic — the same self-exemption reasoning `ALLOWED_SELF_SUFFIX`
 * already applies to `BANNED_LITERALS` above).
 */
const TRANSPORT_SPEED_LITERAL = '7.35';
const TRANSPORT_LITERAL_ALLOWED_FILE_SUFFIX = 'analytics/unreliable-segments.ts';

/**
 * Pure scanner (same `{ path, needle, count }` shape as
 * `findStreamPaceViolations`): flags any non-test `.ts` file other than the
 * detector itself that holds the transport-speed literal as executable
 * source (comment-stripped first, so a docblock merely naming the number is
 * never flagged — only a literal reachable at runtime is).
 */
function findTransportLiteralViolations(files: readonly SourceFile[]): StreamPaceViolation[] {
  const violations: StreamPaceViolation[] = [];
  for (const file of files) {
    if (file.path.endsWith('.test.ts')) continue;
    if (file.path.endsWith(TRANSPORT_LITERAL_ALLOWED_FILE_SUFFIX)) continue;
    const stripped = stripComments(file.source);
    const count = countOccurrences(stripped, TRANSPORT_SPEED_LITERAL);
    if (count > 0) violations.push({ path: file.path, needle: TRANSPORT_SPEED_LITERAL, count });
  }
  return violations;
}

/**
 * The classifier's own call-site confinement (D-01, D-15's per-phase
 * "reads the detector, never re-derives it" discipline extended to THIS
 * module's own consumers). `pace-quality.ts` is pre-allowed because plan
 * 34-08 wires the classifier into it — recorded here so a future reader
 * does not mistake the allowance for an oversight.
 */
const PAUSE_CLASSIFICATION_CALL_SITE_LITERALS = [
  'classifyPauses(',
  'collectPauseIntervals(',
  'classifyForgottenStop(',
  'findCreepStretches(',
] as const;

function isPauseClassificationCallSiteAllowed(path: string): boolean {
  return (
    path.endsWith('analytics/pause-classification.ts') ||
    path.endsWith('analytics/pace-quality.ts') || // pre-allowed: plan 34-08 wires the classifier here
    path.endsWith('.test.ts')
  );
}

/** Pure scanner, same `OverrideMatch` shape as `findConfinedCallSites`'s callers use directly. */
function findPauseClassificationConfinementViolations(files: readonly SourceFile[]): OverrideMatch[] {
  const matches: OverrideMatch[] = [];
  for (const file of files) {
    if (isPauseClassificationCallSiteAllowed(file.path)) continue;
    const stripped = stripComments(file.source);
    for (const literal of PAUSE_CLASSIFICATION_CALL_SITE_LITERALS) {
      if (stripped.includes(literal)) {
        matches.push({ path: file.path, literal });
      }
    }
  }
  return matches;
}

describe('PACE-01 Criterion 4 / D-18 — single-source stream-pace audit', () => {
  const { files, failures } = readSourceTree(SRC_ROOT);

  it(`scanned more than 100 .ts files under src/ (proof the walk reached the tree, not an empty directory) — scanned ${files.length}`, () => {
    // eslint-disable-next-line no-console
    console.log(`[pace-single-source] scanned ${files.length} .ts files under src/`);
    expect(files.length).toBeGreaterThan(100);
  });

  it('the directory walk itself produced zero read failures', () => {
    expect(failures, `unreadable paths: ${JSON.stringify(failures)}`).toEqual([]);
  });

  it('zero stream-derived per-sample pace arithmetic exists outside pace-derivation.ts', () => {
    const violations = findStreamPaceViolations(files);
    const message = violations
      .map((v) => `${v.path}: contains "${v.needle}" (${v.count}x)`)
      .join('\n');
    expect(violations, `violations found:\n${message}`).toEqual([]);
  });

  it('the false-positive guard is non-vacuous: the four metadata/aggregate sites are present in the scanned tree AND are not flagged', () => {
    const falsePositiveSites = [
      'analytics/compute-dashboard-index.ts',
      'dashboard/views/detail.ts',
      'widgets/shared/route-utils.ts',
      'analytics/gear-aggregate-logic.ts',
    ];

    for (const suffix of falsePositiveSites) {
      const present = files.some((f) => f.path.endsWith(suffix));
      expect(present, `expected ${suffix} to be present in the scanned file list — a guard that never scanned it proves nothing`).toBe(true);
    }

    const violations = findStreamPaceViolations(files);
    const violatingPaths = violations.map((v) => v.path);
    for (const suffix of falsePositiveSites) {
      const flagged = violatingPaths.some((p) => p.endsWith(suffix));
      expect(flagged, `${suffix} must never be flagged by the stream-pace audit — it computes metadata/aggregate pace, not per-sample stream pace`).toBe(false);
    }
  });

  it('override containment: clipAtGaps / windowSec (colon, comma and shorthand-close forms) / pauseRule / any derivePaceSeriesGapAware( call site appear only in pace-derivation.ts or *.test.ts files', () => {
    const matches = findConfinedCallSites(files, OVERRIDE_LITERALS);
    // Non-vacuous: the scan must actually have found the real, legitimate
    // usages inside pace-derivation.ts / pace-derivation.test.ts.
    expect(matches.length).toBeGreaterThan(0);

    const offenders = matches.filter(
      (m) => !m.path.endsWith(ALLOWED_FILE_SUFFIX) && !m.path.endsWith('.test.ts')
    );
    expect(
      offenders,
      `override literals found outside pace-derivation.ts/*.test.ts: ${JSON.stringify(offenders)}`
    ).toEqual([]);
  });

  it('gap-membership containment: gapIntervals.some(/.find( call sites appear only in pace-derivation.ts or *.test.ts files — this is the check that would have caught the real f32dddd8 detail-zones.ts violation, which contained no dt/dd division at all', () => {
    const matches = findConfinedCallSites(files, GAP_MEMBERSHIP_LITERALS);
    // Non-vacuous: pace-derivation.ts's own classifyGaps/paceHistogramSamples
    // internals must have produced at least one match.
    expect(matches.length).toBeGreaterThan(0);

    const offenders = matches.filter(
      (m) => !m.path.endsWith(ALLOWED_FILE_SUFFIX) && !m.path.endsWith('.test.ts')
    );
    expect(
      offenders,
      `gap-membership re-implementation found outside pace-derivation.ts/*.test.ts: ${JSON.stringify(offenders)}`
    ).toEqual([]);
  });

  it('pace-derivation.ts itself contains at least one banned literal — the arithmetic did not vanish, it moved here', () => {
    const derivationFile = files.find((f) => f.path.endsWith(ALLOWED_FILE_SUFFIX));
    expect(derivationFile, 'expected to find pace-derivation.ts in the scanned file list').toBeTruthy();
    const stripped = stripComments(derivationFile!.source);
    const containsAtLeastOne = BANNED_LITERALS.some((needle) => countOccurrences(stripped, needle) > 0);
    expect(containsAtLeastOne, 'expected pace-derivation.ts to contain at least one of the banned literals').toBe(true);
  });
});

describe('PACE-01 Criterion 4 — the audit is demonstrated catching a reintroduced second implementation (planted, permanent)', () => {
  it('names the exact planted file path and the exact planted literal', () => {
    const plantedFiles: SourceFile[] = [
      {
        path: 'src/dashboard/views/planted-second-impl.ts',
        source: [
          '// A deliberately reintroduced second stream-derived pace implementation.',
          'export function computeLeakyPace(dt: number, dd: number): number {',
          '  return dt / (dd / 1000);',
          '}',
        ].join('\n'),
      },
      {
        path: 'src/analytics/pace-derivation.ts',
        source: 'export const elapsed = 1, metres = 1; const x = elapsed / (metres / 1000);',
      },
    ];

    const violations = findStreamPaceViolations(plantedFiles);
    expect(violations).toEqual([
      { path: 'src/dashboard/views/planted-second-impl.ts', needle: 'dt / (dd / 1000)', count: 1 },
    ]);
  });

  it('with the literal removed, the same planted file produces no violation (fails in both directions)', () => {
    const cleanedFiles: SourceFile[] = [
      {
        path: 'src/dashboard/views/planted-second-impl.ts',
        source: [
          'export function computeSafePace(paceSecPerKm: number): number {',
          '  return paceSecPerKm;',
          '}',
        ].join('\n'),
      },
    ];

    const violations = findStreamPaceViolations(cleanedFiles);
    expect(violations).toEqual([]);
  });

  it('CR-03 shape (permanent, planted): a synthetic file carrying the exact defect shape (a named window-width constant plus an object-shorthand derivePaceSeriesGapAware( call) is flagged for BOTH windowSec, and derivePaceSeriesGapAware(; the derivePaceWithCoverage-based rewrite of the same file is flagged for neither', () => {
    const plantedFixedWindowFile: SourceFile = {
      path: 'src/dashboard/views/planted-fixed-window.ts',
      source: [
        "import { derivePaceSeriesGapAware } from '../../analytics/pace-derivation.js';",
        '',
        'const PLANTED_WINDOW_SEC = 20;',
        '',
        'export function plantedDerivePace(t: number[], d: number[], gapIntervals: unknown[]) {',
        '  const windowSec = PLANTED_WINDOW_SEC;',
        '  return derivePaceSeriesGapAware(t, d, { windowSec, gapIntervals } as never);',
        '}',
      ].join('\n'),
    };

    const matches = findConfinedCallSites([plantedFixedWindowFile], OVERRIDE_LITERALS);
    const literalsMatched = new Set(matches.map((m) => m.literal));
    expect(literalsMatched.has('windowSec,')).toBe(true);
    expect(literalsMatched.has('derivePaceSeriesGapAware(')).toBe(true);
    expect(matches.every((m) => m.path === plantedFixedWindowFile.path)).toBe(true);

    // Negative direction: the same file, rewritten to call the coverage-aware
    // entry point instead, produces zero matches for either literal.
    const rewrittenFile: SourceFile = {
      path: 'src/dashboard/views/planted-fixed-window.ts',
      source: [
        "import { derivePaceWithCoverage } from '../../analytics/pace-derivation.js';",
        "import type { CanonicalStream } from '../../streams/stream.types.js';",
        '',
        'export function plantedDerivePace(stream: CanonicalStream) {',
        '  return derivePaceWithCoverage(stream).paceSeries;',
        '}',
      ].join('\n'),
    };
    const cleanMatches = findConfinedCallSites([rewrittenFile], OVERRIDE_LITERALS);
    expect(cleanMatches).toEqual([]);
  });
});

describe('SEG-05a — single-source audit extended to the unreliable-segment detector', () => {
  const { files } = readSourceTree(SRC_ROOT);

  it('non-vacuous: unreliable-segments.ts itself carries the arithmetic and structural literals, and the param-literal scan finds real matches', () => {
    const detectorFile = files.find((f) => f.path.endsWith(DETECTOR_FILE_SUFFIX));
    expect(detectorFile, 'expected to find unreliable-segments.ts in the scanned file list').toBeTruthy();
    const stripped = stripComments(detectorFile!.source);

    expect(countOccurrences(stripped, 'speedLimitMps * seconds')).toBeGreaterThanOrEqual(2);
    expect(countOccurrences(stripped, 'advanceSteps(')).toBeGreaterThanOrEqual(1);

    const paramMatches = findConfinedCallSites(files, DETECTOR_PARAM_LITERALS);
    expect(
      paramMatches.length,
      'expected at least one real DetectorParams object literal (from unreliable-segments.test.ts) — a check that finds nothing would be unpassable, the mirror of vacuous'
    ).toBeGreaterThan(0);
  });

  it('zero arithmetic, structural or importer violations exist outside unreliable-segments.ts, its one allowed importer, and *.test.ts files', () => {
    const violations = findUnreliableSegmentViolations(files);
    const message = violations.map((v) => `${v.path}: contains "${v.needle}" (${v.count}x)`).join('\n');
    expect(violations, `violations found:\n${message}`).toEqual([]);
  });

  it('zero DetectorParams param-key (colon/comma/shorthand-close) offenders exist outside unreliable-segments.ts and *.test.ts files', () => {
    const matches = findConfinedCallSites(files, DETECTOR_PARAM_LITERALS);
    const offenders = matches.filter((m) => !isDetectorOrTestFile(m.path));
    expect(
      offenders,
      `param-literal offenders found outside unreliable-segments.ts/*.test.ts: ${JSON.stringify(offenders)}`
    ).toEqual([]);
  });
});

describe('SEG-05a — the audit is demonstrated catching a reintroduced second unreliable-segment implementation (planted, permanent)', () => {
  it('(1) an inline re-implementation of the fast-step arithmetic is flagged with the exact { path, needle }, and produces zero violations once the literal is removed', () => {
    const plantedPath = 'src/dashboard/views/planted-second-unreliable-impl.ts';
    const plantedFile: SourceFile = {
      path: plantedPath,
      source: [
        '// A deliberately reintroduced second unreliable-segment-detector implementation.',
        'export function leakyIsFast(metres: number, speedLimitMps: number, seconds: number): boolean {',
        '  return metres > speedLimitMps * seconds;',
        '}',
      ].join('\n'),
    };

    const violations = findUnreliableSegmentViolations([plantedFile]);
    expect(violations).toEqual([{ path: plantedPath, needle: 'speedLimitMps * seconds', count: 1 }]);

    const cleanedFile: SourceFile = {
      path: plantedPath,
      source: 'export function safeIsFast(): boolean {\n  return false;\n}',
    };
    expect(findUnreliableSegmentViolations([cleanedFile])).toEqual([]);
  });

  it('(2) a non-arithmetic second importer of the detector module is flagged, and is not flagged when the same file imports a different module', () => {
    const plantedPath = 'src/analytics/planted-second-importer.ts';
    const plantedFile: SourceFile = {
      path: plantedPath,
      source: "import { detectUnreliableSegments } from './unreliable-segments.js';\n",
    };

    const violations = findUnreliableSegmentViolations([plantedFile]);
    expect(violations).toEqual([{ path: plantedPath, needle: "unreliable-segments.js'", count: 1 }]);

    const differentImportFile: SourceFile = {
      path: plantedPath,
      source: "import { validateStreamSeries } from './best-effort-utils.js';\n",
    };
    expect(findUnreliableSegmentViolations([differentImportFile])).toEqual([]);
  });

  it('(2a) quote-variant proof: a double-quoted and a backtick dynamic-import specifier are each flagged exactly like the single-quoted form — the pre-change 2-needle array (this test\'s watched-failing baseline, quoted in 32-15-SUMMARY.md) let both evade the scan', () => {
    const doubleQuotedPath = 'src/analytics/planted-second-importer-double-quoted.ts';
    const doubleQuotedFile: SourceFile = {
      path: doubleQuotedPath,
      source: 'import { detectUnreliableSegments } from "./unreliable-segments.js";\n',
    };
    const doubleQuotedViolations = findUnreliableSegmentViolations([doubleQuotedFile]);
    expect(doubleQuotedViolations).toEqual([
      { path: doubleQuotedPath, needle: 'unreliable-segments.js"', count: 1 },
    ]);

    const backtickPath = 'src/analytics/planted-second-importer-backtick.ts';
    const backtickFile: SourceFile = {
      path: backtickPath,
      source: 'export async function loadDetector() {\n  return import(`./unreliable-segments.js`);\n}\n',
    };
    const backtickViolations = findUnreliableSegmentViolations([backtickFile]);
    expect(backtickViolations).toEqual([{ path: backtickPath, needle: 'unreliable-segments.js`', count: 1 }]);

    // Extensionless form, same two new quote styles.
    const doubleQuotedExtensionlessFile: SourceFile = {
      path: doubleQuotedPath,
      source: 'import type { DetectorParams } from "./unreliable-segments";\n',
    };
    expect(findUnreliableSegmentViolations([doubleQuotedExtensionlessFile])).toEqual([
      { path: doubleQuotedPath, needle: 'unreliable-segments"', count: 1 },
    ]);

    const backtickExtensionlessFile: SourceFile = {
      path: backtickPath,
      source: 'export async function loadDetector() {\n  return import(`./unreliable-segments`);\n}\n',
    };
    expect(findUnreliableSegmentViolations([backtickExtensionlessFile])).toEqual([
      { path: backtickPath, needle: 'unreliable-segments`', count: 1 },
    ]);

    // Cleaned versions of each planted file produce zero violations (fails in both directions).
    const differentImportFile: SourceFile = {
      path: doubleQuotedPath,
      source: 'import { validateStreamSeries } from "./best-effort-utils.js";\n',
    };
    expect(findUnreliableSegmentViolations([differentImportFile])).toEqual([]);
  });

  it('(2b) the allowance predicate is exercised for all three quote styles: a planted file at an ALLOWED path (the detector itself, its one allowed importer, or a *.test.ts file) is never reported', () => {
    const quoteStyles = [
      { label: 'single', source: "import { detectUnreliableSegments } from './unreliable-segments.js';\n" },
      { label: 'double', source: 'import { detectUnreliableSegments } from "./unreliable-segments.js";\n' },
      { label: 'backtick', source: 'const mod = await import(`./unreliable-segments.js`);\n' },
    ] as const;

    for (const { source } of quoteStyles) {
      const atDetectorItself: SourceFile = { path: 'src/analytics/unreliable-segments.ts', source };
      const atAllowedImporter: SourceFile = { path: 'src/analytics/pace-derivation.ts', source };
      const atTestFile: SourceFile = { path: 'src/analytics/planted-second-importer.test.ts', source };

      expect(findUnreliableSegmentViolations([atDetectorItself])).toEqual([]);
      expect(findUnreliableSegmentViolations([atAllowedImporter])).toEqual([]);
      expect(findUnreliableSegmentViolations([atTestFile])).toEqual([]);
    }
  });

  it('(3) a formatting-variant object-shorthand call site is flagged for the comma and shorthand-close param forms, and produces zero matches once removed', () => {
    const plantedPath = 'src/dashboard/views/planted-shorthand.ts';
    const plantedFile: SourceFile = {
      path: plantedPath,
      source: [
        'const speedLimitMps = 5;',
        'const excessFloorMetres = 2;',
        'const opts = { speedLimitMps, excessFloorMetres };',
      ].join('\n'),
    };

    const matches = findConfinedCallSites([plantedFile], DETECTOR_PARAM_LITERALS);
    const offenders = matches.filter((m) => !isDetectorOrTestFile(m.path));
    const literalsMatched = new Set(offenders.map((m) => m.literal));
    expect(literalsMatched.has('speedLimitMps,')).toBe(true);
    expect(literalsMatched.has('excessFloorMetres }')).toBe(true);
    expect(offenders.every((m) => m.path === plantedPath)).toBe(true);

    const cleanedFile: SourceFile = {
      path: plantedPath,
      source: 'const opts = { limit: 5, floor: 2 };',
    };
    const cleanMatches = findConfinedCallSites([cleanedFile], DETECTOR_PARAM_LITERALS);
    expect(cleanMatches).toEqual([]);
  });

  it('(4) a planted call to advanceSteps( outside the detector/test files is flagged, and produces zero violations once removed', () => {
    const plantedPath = 'src/dashboard/views/planted-steps.ts';
    const plantedFile: SourceFile = {
      path: plantedPath,
      source: 'export const steps = advanceSteps(t, d, gaps);\n',
    };

    const violations = findUnreliableSegmentViolations([plantedFile]);
    expect(violations).toEqual([{ path: plantedPath, needle: 'advanceSteps(', count: 1 }]);

    const cleanedFile: SourceFile = {
      path: plantedPath,
      source: 'export const steps = computeSteps(t, d, gaps);\n',
    };
    expect(findUnreliableSegmentViolations([cleanedFile])).toEqual([]);
  });
});

/**
 * pace-derivation.ts's detector import is load-bearing (SEG-05b, D-15)
 *
 * The allowlist above (and `SEG-05a`'s importer-confinement scan) already
 * proves `pace-derivation.ts` is the detector's ONE permitted importer —
 * but an import that exists textually and an import that actually DRIVES
 * behaviour are different claims. SEG-05b's own text requires the LATTER:
 * a consuming phase must show its consumer READING the detector, not merely
 * importing it. This describe block is Phase 33's half of that proof
 * (D-15) — `detectUnreliableSegments` is stubbed to return `[]` via
 * `vi.doMock` + a dynamic re-`import()` (this file has no existing static
 * import of `pace-derivation.ts` to fight with `vi.mock`'s hoisting), and
 * BOTH directions are asserted inside one test: with the stub, the
 * previously-clipped window opens back up; with the real module, it clips.
 * A one-direction assertion would pass against a build where the chart
 * never renders at all (33-PLAN.md's own stated risk).
 *
 * `ALLOWED_FILE_SUFFIX`/`DETECTOR_ARITHMETIC_LITERALS` above are NOT
 * widened by this block — the allowlist already names
 * `analytics/pace-derivation.ts` (this module's own docblock, lines
 * 109-113: "Phase 33 folds this detector into `classifyGaps` there"), and
 * Phase 33 is exactly the wiring that docblock anticipates.
 */
describe('pace-derivation.ts\'s detector import is load-bearing (SEG-05b, D-15)', () => {
  it('stubbing detectUnreliableSegments to return [] on real 3475734189 both zeroes unreliableSec AND un-clips the previously-clipped window; the real module does the opposite in both respects', async () => {
    const stream = JSON.parse(
      readFileSync(path.join('data', 'streams', '3475734189.json'), 'utf-8')
    ) as import('../streams/stream.types.js').CanonicalStream;

    // Real direction first, from a clean module registry — no mock active yet.
    vi.resetModules();
    const real = await import('./pace-derivation.js');
    const realCoverage = real.classifyGaps(stream.t, stream.d);
    const realDerived = real.derivePaceWithCoverage(stream);

    expect(realCoverage.unreliableSec).toBeGreaterThan(0);
    // The detected hidden-pause segment on this stream spans sample indices
    // [1352, 1360) / t=1352-1360 (reconciles against PROJECT.md's measured
    // t=1353-1360 — that figure names the BURST's own start, one sample
    // after this segment's start, which additionally absorbs the touching
    // gap-classified pair at t=1352-1353). "Strictly inside" (t strictly
    // between the segment's own startSec/endSec, matching
    // derivePaceSeriesGapAware's own open-interval clip rule) is t=1353
    // through t=1359 — indices 1353..1359.
    const strictlyInsideIndices = [1353, 1354, 1355, 1356, 1357, 1358, 1359];
    for (const i of strictlyInsideIndices) {
      expect(stream.t[i]).toBe(i); // reachability: this stream's t[i] === i in this window
      expect(realDerived.paceSeries[i]).toBeNull();
    }

    // Stubbed direction: detectUnreliableSegments always returns [], every
    // other export (including DEFAULT_DETECTOR_PARAMS) passes through
    // untouched via vi.importActual.
    vi.doMock('./unreliable-segments.js', async () => {
      const actual =
        await vi.importActual<typeof import('./unreliable-segments.js')>('./unreliable-segments.js');
      return { ...actual, detectUnreliableSegments: () => [] };
    });
    vi.resetModules();
    const stubbed = await import('./pace-derivation.js');
    const stubbedCoverage = stubbed.classifyGaps(stream.t, stream.d);
    const stubbedDerived = stubbed.derivePaceWithCoverage(stream);

    expect(stubbedCoverage.unreliableSec).toBe(0);
    // At least one previously-clipped index now yields a non-null pace —
    // both directions asserted in the SAME test, so this cannot pass
    // against a build where the chart never renders at all.
    const anyNonNullInStubbedWindow = strictlyInsideIndices.some(
      (i) => stubbedDerived.paceSeries[i] !== null
    );
    expect(anyNonNullInStubbedWindow).toBe(true);

    vi.doUnmock('./unreliable-segments.js');
    vi.resetModules();
  });
});

/**
 * pause-classification reads the detector (SEG-05b, Phase 34 half)
 *
 * The Phase 34 twin of the `pace-derivation.ts's detector import is
 * load-bearing (SEG-05b, D-15)` block above. `pause-classification.ts`
 * imports ONLY from `pace-derivation.ts` (never `unreliable-segments.ts`
 * directly, per `DETECTOR_IMPORTER_NEEDLES` above and this module's own
 * docblock) — but an import chain that exists textually and one that
 * actually DRIVES this module's output are different claims. This block
 * proves the LATTER by stubbing `detectUnreliableSegments` to return `[]`
 * two modules downstream: `pause-classification.js` re-imports
 * `pace-derivation.js`, which re-imports `unreliable-segments.js` — the
 * stub therefore has to survive TWO hops to reach `classifyPauses`' output.
 * Both directions are asserted in the SAME test (real: at least one
 * `merged-segment` interval; stub: zero `merged-segment` intervals, and at
 * least one stubbed `recording-gap` interval that lies inside a REAL
 * merged interval's own `[startSec, endSec]` carries a different class
 * under `TEST_BANDS`) — a one-direction assertion would pass against a
 * build where the classifier never actually reads its `coverage`/`segments`
 * arguments at all (this plan's own T-34-10 threat).
 */
describe('pause-classification reads the detector (SEG-05b, Phase 34 half)', () => {
  /** Deliberately round synthetic bands for this mechanism proof — NOT calibrated (plans 34-04/34-06 calibrate the real values). */
  const TEST_BANDS = { stationaryMaxMps: 0.5, walkRunMps: 2.0 };

  it("stubbing detectUnreliableSegments to [] on real 3475724402 zeroes merged-segment intervals and changes at least one recording-gap interval's class inside a real merged interval's bounds; the real module gives at least one merged-segment interval", async () => {
    const stream = JSON.parse(
      readFileSync(path.join('data', 'streams', '3475724402.json'), 'utf-8')
    ) as import('../streams/stream.types.js').CanonicalStream;

    // Real direction first, from a clean module registry — no mock active yet.
    vi.resetModules();
    const realPaceDerivation = await import('./pace-derivation.js');
    const realPauseClassification = await import('./pause-classification.js');
    const { coverage: realCoverage, segments: realSegments } = realPaceDerivation.classifyGapsWithSegments(
      stream.t,
      stream.d
    );
    const realResult = realPauseClassification.classifyPauses(
      stream.t,
      stream.d,
      realCoverage,
      realSegments,
      TEST_BANDS
    );
    const realMergedIntervals = realResult.intervals.filter((iv) => iv.source === 'merged-segment');
    expect(realMergedIntervals.length).toBeGreaterThan(0); // reachability — real direction

    // Stubbed direction: detectUnreliableSegments always returns [], every
    // other export (including DEFAULT_DETECTOR_PARAMS) passes through
    // untouched via vi.importActual. The stub is declared at the DETECTOR
    // level — pause-classification.js never imports unreliable-segments.js
    // itself, so this proves the stub's effect propagates through
    // pace-derivation.js's own re-export chain.
    vi.doMock('./unreliable-segments.js', async () => {
      const actual =
        await vi.importActual<typeof import('./unreliable-segments.js')>('./unreliable-segments.js');
      return { ...actual, detectUnreliableSegments: () => [] };
    });
    vi.resetModules();
    const stubbedPaceDerivation = await import('./pace-derivation.js');
    const stubbedPauseClassification = await import('./pause-classification.js');
    const { coverage: stubbedCoverage, segments: stubbedSegments } =
      stubbedPaceDerivation.classifyGapsWithSegments(stream.t, stream.d);
    expect(stubbedSegments).toEqual([]); // reachability — the stub actually took

    const stubbedResult = stubbedPauseClassification.classifyPauses(
      stream.t,
      stream.d,
      stubbedCoverage,
      stubbedSegments,
      TEST_BANDS
    );
    const stubbedMergedIntervals = stubbedResult.intervals.filter((iv) => iv.source === 'merged-segment');
    expect(stubbedMergedIntervals).toEqual([]);

    // At least one stubbed 'recording-gap' interval lies inside a real
    // merged interval's own [startSec, endSec] and carries a different
    // class than that real merged interval did.
    const stubbedRecordingGapIntervals = stubbedResult.intervals.filter((iv) => iv.source === 'recording-gap');
    let foundDifferingClass = false;
    for (const stubbedGap of stubbedRecordingGapIntervals) {
      const containingRealMerged = realMergedIntervals.find(
        (real) => stubbedGap.startSec >= real.startSec && stubbedGap.endSec <= real.endSec
      );
      if (containingRealMerged !== undefined && containingRealMerged.pauseClass !== stubbedGap.pauseClass) {
        foundDifferingClass = true;
        break;
      }
    }
    expect(foundDifferingClass).toBe(true);

    vi.doUnmock('./unreliable-segments.js');
    vi.resetModules();
  });
});

/**
 * pause-classification D-05: no transport-speed literal outside the
 * detector
 *
 * D-05 (34-CONTEXT.md): the transported boundary is
 * `UNRELIABLE_SPEED_LIMIT_MPS`, imported through `pace-derivation.ts`,
 * never a literal. This guard is watched failing first against a planted
 * `7.35` inside `pause-classification.ts` (recorded verbatim in this
 * plan's SUMMARY.md), then reverted — the standing "watch it fail first"
 * convention this project applies to every guard.
 */
describe('pause-classification D-05: no transport-speed literal outside the detector', () => {
  const { files } = readSourceTree(SRC_ROOT);

  it('non-vacuous: unreliable-segments.ts itself carries the literal, and pause-classification.ts imports UNRELIABLE_SPEED_LIMIT_MPS rather than copying it', () => {
    const detectorFile = files.find((f) => f.path.endsWith('analytics/unreliable-segments.ts'));
    expect(detectorFile, 'expected to find unreliable-segments.ts in the scanned file list').toBeTruthy();
    expect(countOccurrences(stripComments(detectorFile!.source), TRANSPORT_SPEED_LITERAL)).toBeGreaterThanOrEqual(1);

    const classifierFile = files.find((f) => f.path.endsWith('analytics/pause-classification.ts'));
    expect(classifierFile, 'expected to find pause-classification.ts in the scanned file list').toBeTruthy();
    expect(countOccurrences(stripComments(classifierFile!.source), 'UNRELIABLE_SPEED_LIMIT_MPS')).toBeGreaterThan(0);
  });

  it('zero transport-speed-literal offenders exist outside unreliable-segments.ts and *.test.ts files', () => {
    const violations = findTransportLiteralViolations(files);
    const message = violations.map((v) => `${v.path}: contains "${v.needle}" (${v.count}x)`).join('\n');
    expect(violations, `violations found:\n${message}`).toEqual([]);
  });

  it('is demonstrated catching a planted literal: a synthetic analytics/planted-transport.ts with a bare 7.35 is flagged with its path, and the same file with the literal removed is not flagged', () => {
    const plantedPath = 'src/analytics/planted-transport.ts';
    const plantedFile: SourceFile = {
      path: plantedPath,
      source: 'export const LIMIT = 7.35;\n',
    };
    const violations = findTransportLiteralViolations([plantedFile]);
    expect(violations).toEqual([{ path: plantedPath, needle: TRANSPORT_SPEED_LITERAL, count: 1 }]);

    const cleanedFile: SourceFile = {
      path: plantedPath,
      source: 'export const LIMIT = UNRELIABLE_SPEED_LIMIT_MPS;\n',
    };
    expect(findTransportLiteralViolations([cleanedFile])).toEqual([]);
  });
});

/**
 * pause-classification D-07/WR-08: no declared band literal outside
 * pause-classification.ts
 *
 * D-05's `findTransportLiteralViolations` above bans `7.35` everywhere
 * outside the detector — but until now, nothing scanned `src/` for the TWO
 * developer-declared pause-classification band literals
 * (`STATIONARY_MAX_SPEED_MPS` = `0.5` m/s, D-20; `WALK_RUN_BOUNDARY_MPS` =
 * `2.2` m/s, D-21). The only claimed protection was a one-off prose grep
 * recorded as a comment inside `pause-classification.ts` itself
 * (`grep -cE "stationaryMaxMps: [0-9]"`), scoped to a single file and never
 * re-run by any test (34-REVIEW.md WR-08). Given D-20/D-21's values are
 * developer-declared — the most likely kind of constant to be re-typed from
 * memory into a future consumer — the asymmetry against `7.35` was
 * backwards. This extends the SAME proven scanner shape
 * (`findTransportLiteralViolations`'s own `{ path, needle, count }`
 * contract) to these two literals, watched failing first against a planted
 * violation (recorded verbatim in this plan's SUMMARY.md), then reverted —
 * the standing "watch it fail first" convention this project applies to
 * every guard.
 *
 * The needles are the exact OBJECT-LITERAL-PROPERTY shapes
 * `SHIPPED_PAUSE_BANDS`/`SHIPPED_STOP_PARAMS` would take if a consumer
 * re-typed the value directly (`stationaryMaxMps: 0.5`, `walkRunMps: 2.2`)
 * rather than the bare numbers `0.5`/`2.2` — a bare-number scan would
 * false-positive on countless unrelated numeric literals across `src/`
 * (durations, indices, other constants). `pause-classification.ts` itself
 * is allow-listed: it legitimately builds `SHIPPED_PAUSE_BANDS` from the
 * imported CONSTANTS (`stationaryMaxMps: STATIONARY_MAX_SPEED_MPS`), never
 * a repeated literal, so it does not (and must not) trip this scanner even
 * though it is where the constants are declared — mirroring
 * `TRANSPORT_LITERAL_ALLOWED_FILE_SUFFIX`'s own allow-one-file shape above.
 */
const DECLARED_BAND_LITERALS = ['stationaryMaxMps: 0.5', 'walkRunMps: 2.2'] as const;
const DECLARED_BAND_LITERAL_ALLOWED_FILE_SUFFIX = 'analytics/pause-classification.ts';

/** Pure scanner, same `{ path, needle, count }` shape as `findTransportLiteralViolations`. */
function findDeclaredBandLiteralViolations(files: readonly SourceFile[]): StreamPaceViolation[] {
  const violations: StreamPaceViolation[] = [];
  for (const file of files) {
    if (file.path.endsWith('.test.ts')) continue;
    if (file.path.endsWith(DECLARED_BAND_LITERAL_ALLOWED_FILE_SUFFIX)) continue;
    const stripped = stripComments(file.source);
    for (const needle of DECLARED_BAND_LITERALS) {
      const count = countOccurrences(stripped, needle);
      if (count > 0) violations.push({ path: file.path, needle, count });
    }
  }
  return violations;
}

describe('pause-classification D-07/WR-08: no declared band literal outside pause-classification.ts', () => {
  const { files } = readSourceTree(SRC_ROOT);

  it('non-vacuous: pause-classification.ts itself declares both constants as bare numeric literals (its own source of truth), never in the object-literal-property shape this scanner bans', () => {
    const classifierFile = files.find((f) => f.path.endsWith('analytics/pause-classification.ts'));
    expect(classifierFile, 'expected to find pause-classification.ts in the scanned file list').toBeTruthy();
    const stripped = stripComments(classifierFile!.source);
    expect(stripped).toContain('export const STATIONARY_MAX_SPEED_MPS = 0.5;');
    expect(stripped).toContain('export const WALK_RUN_BOUNDARY_MPS = 2.2;');
    // SHIPPED_PAUSE_BANDS builds the object-literal shape from the CONSTANTS, never a repeated
    // literal — zero occurrences of the banned needles, even in the allow-listed file itself.
    expect(findDeclaredBandLiteralViolations([classifierFile!])).toEqual([]);
  });

  it('zero declared-band-literal offenders exist under src/ outside pause-classification.ts and *.test.ts files', () => {
    const violations = findDeclaredBandLiteralViolations(files);
    const message = violations.map((v) => `${v.path}: contains "${v.needle}" (${v.count}x)`).join('\n');
    expect(violations, `violations found:\n${message}`).toEqual([]);
  });

  it('is demonstrated catching a planted stationaryMaxMps literal: a synthetic analytics/planted-band.ts is flagged with its path, and the same file with the literal replaced by the imported constant is not flagged', () => {
    const plantedPath = 'src/analytics/planted-band.ts';
    const plantedFile: SourceFile = {
      path: plantedPath,
      source: 'export const BANDS = { stationaryMaxMps: 0.5, walkRunMps: 2.0 };\n',
    };
    const violations = findDeclaredBandLiteralViolations([plantedFile]);
    expect(violations).toEqual([{ path: plantedPath, needle: 'stationaryMaxMps: 0.5', count: 1 }]);

    const cleanedFile: SourceFile = {
      path: plantedPath,
      source: 'export const BANDS = { stationaryMaxMps: STATIONARY_MAX_SPEED_MPS, walkRunMps: 2.0 };\n',
    };
    expect(findDeclaredBandLiteralViolations([cleanedFile])).toEqual([]);
  });

  it('is demonstrated catching a planted walkRunMps literal: a synthetic analytics/planted-boundary.ts is flagged with its path, and the same file with the literal replaced by the imported constant is not flagged', () => {
    const plantedPath = 'src/analytics/planted-boundary.ts';
    const plantedFile: SourceFile = {
      path: plantedPath,
      source: 'export const BOUNDARY = { walkRunMps: 2.2 };\n',
    };
    const violations = findDeclaredBandLiteralViolations([plantedFile]);
    expect(violations).toEqual([{ path: plantedPath, needle: 'walkRunMps: 2.2', count: 1 }]);

    const cleanedFile: SourceFile = {
      path: plantedPath,
      source: 'export const BOUNDARY = { walkRunMps: WALK_RUN_BOUNDARY_MPS };\n',
    };
    expect(findDeclaredBandLiteralViolations([cleanedFile])).toEqual([]);
  });
});

/**
 * pause-classification confinement
 *
 * Confines the classifier's own call sites (`classifyPauses(`,
 * `collectPauseIntervals(`, `classifyForgottenStop(`, `findCreepStretches(`)
 * to `pause-classification.ts` itself, `pace-quality.ts` (pre-allowed —
 * plan 34-08 wires the classifier there), and `*.test.ts` files. A caller
 * appearing anywhere else would be a second, undisclosed consumption path
 * this audit exists to catch.
 */
describe('pause-classification confinement', () => {
  const { files } = readSourceTree(SRC_ROOT);

  it('non-vacuous: pause-classification.ts itself carries all four call-site literals (its own exported definitions), and pause-classification.test.ts carries real call sites', () => {
    const classifierFile = files.find((f) => f.path.endsWith('analytics/pause-classification.ts'));
    expect(classifierFile, 'expected to find pause-classification.ts in the scanned file list').toBeTruthy();
    const stripped = stripComments(classifierFile!.source);
    for (const literal of PAUSE_CLASSIFICATION_CALL_SITE_LITERALS) {
      expect(stripped.includes(literal), `expected pause-classification.ts to contain "${literal}"`).toBe(true);
    }

    const testFile = files.find((f) => f.path.endsWith('analytics/pause-classification.test.ts'));
    expect(testFile, 'expected to find pause-classification.test.ts in the scanned file list').toBeTruthy();
    expect(stripComments(testFile!.source).includes('classifyPauses(')).toBe(true);
  });

  it('zero call-site offenders exist outside pause-classification.ts, pace-quality.ts and *.test.ts files', () => {
    const violations = findPauseClassificationConfinementViolations(files);
    const message = violations.map((v) => `${v.path}: contains "${v.literal}"`).join('\n');
    expect(violations, `violations found:\n${message}`).toEqual([]);
  });

  it('is demonstrated catching a planted call site: a synthetic dashboard file calling classifyPauses( is flagged, and the same file with the call removed is not flagged', () => {
    const plantedPath = 'src/dashboard/views/planted-pause-classification-caller.ts';
    const plantedFile: SourceFile = {
      path: plantedPath,
      source: "import { classifyPauses } from '../../analytics/pause-classification.js';\nexport const result = classifyPauses(t, d, coverage, segments, bands);\n",
    };
    const violations = findPauseClassificationConfinementViolations([plantedFile]);
    expect(violations).toEqual([{ path: plantedPath, literal: 'classifyPauses(' }]);

    const cleanedFile: SourceFile = {
      path: plantedPath,
      source: "export const result = null;\n",
    };
    expect(findPauseClassificationConfinementViolations([cleanedFile])).toEqual([]);
  });
});
