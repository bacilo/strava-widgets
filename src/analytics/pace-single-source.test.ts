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
 */

import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

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
