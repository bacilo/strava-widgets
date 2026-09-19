# Phase 32: Unreliable-Segment Detection & Calibration - Pattern Map

**Mapped:** 2026-09-19
**Files analyzed:** 9 (2 source pairs, 3 script pairs, 1 local-only script, 1 test extension, 1 committed artifact) + 1 stream-checksum manifest/gate
**Analogs found:** 9 / 9 (every file has a strong, named analog; nothing falls to "No Analog Found")

No `./CLAUDE.md` and no `.claude/skills/`/`.agents/skills/` directory exist in this repo (confirmed this session) — nothing project-specific to load beyond REQUIREMENTS.md/PROJECT.md conventions, which CONTEXT.md and RESEARCH.md already carry forward.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/analytics/unreliable-segments.ts` | service (pure compute module) | transform (batch, run-grouping over `t`/`d`) | `src/analytics/pace-derivation.ts` (`classifyGaps`, `computeFlatRunDurations`, `quantile`, `advanceIntervals`) | exact — same file family, same stream shape, same total/never-throw discipline |
| `src/analytics/unreliable-segments.test.ts` | test (unit) | — | `src/analytics/pace-derivation.ts`'s own paired test file conventions + `best-effort-ceiling.ts`'s `deriveCeiling`/`percentileNearestRank` test style (`scripts/compute-pr-ceiling-calibration.test.mjs` for fixture-builder idiom) | role-match |
| `src/analytics/pace-single-source.test.ts` (EXTENDED, not new) | test (structural/source-tree audit) | event-driven (static scan) | itself — precedent is its own two documented blind-spot closures (commit `f32dddd8`, CR-03) | exact — same file, additive |
| `scripts/compute-unreliable-segment-calibration.mjs` | utility (calibration generator, CLI script) | batch (reads committed streams, derives constants, writes markdown) | `scripts/compute-pr-ceiling-calibration.mjs` (`deriveCeilingMultiplier`, `deriveMinimumPopulation`, `buildCalibrationReport`, `renderCalibrationMarkdown`, `main()`) | exact |
| `scripts/compute-unreliable-segment-calibration.test.mjs` | test (unit, script-level) | — | `scripts/compute-pr-ceiling-calibration.test.mjs` | exact |
| `scripts/compute-unreliable-segment-recount.mjs` | utility (independent verifier, CLI script) | batch, fails-closed | `scripts/compute-pr-ceiling-recount.mjs` (zero-import discipline, `readShippedJson`, `evaluateReport`, guarded `main()`) — secondary: `scripts/compute-elevation-recount.mjs` (never-throw `evaluateReport` shape) | exact |
| `scripts/compute-unreliable-segment-recount.test.mjs` | test (unit + structural guard) | — | `scripts/compute-pr-ceiling-recount.test.mjs` lines 1-90 (zero-import guard, verbatim shape) | exact |
| `scripts/validate-unreliable-segments-1hz.mjs` (no `.test.mjs`) | utility (local-only, gitignored-input script) | batch, file I/O (reads `export_data/*.fit.gz`) | `src/exports/consolidate.ts` (`consolidateExports`, `existsSync` graceful-absence guard) for the absence pattern; `@garmin/fitsdk` `Decoder`/`Stream.fromBuffer` usage already proven this session against `export_data/strava/activities/4868274524.fit.gz` — no committed analog script decodes FIT yet, so `geometry-readers.ts` is the nearest in-repo FIT/GPX reader | role-match (no prior local-only-1Hz-validation script exists; nearest is the export-consolidation family) |
| Streams-immutability manifest + vitest gate (D-17) | config/utility + test | integrity/batch (sha256 per file) | `scripts/lib/stream-files.mjs` (`isStreamFile`, `idFromFilename` — the manifest.json-exclusion precedent) for the glob; `scripts/compute-pace-quality-calibration.mjs`'s `isStreamFile` import usage for the read-loop shape; no direct sha256-manifest analog exists yet in this repo (Node's built-in `crypto.createHash('sha256')`, no new dependency) | role-match |
| `.planning/phases/32-.../32-CALIBRATION.md` | committed artifact (generated doc) | — | `.planning/milestones/v2.2-phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md` (primary shape); `.planning/milestones/v2.2-phases/30-elevation-quality-signal/30-CALIBRATION.md` (secondary) | exact |
| REQUIREMENTS.md / ROADMAP.md amendments (D-03, D-14) | config (planning doc edit) | — | Prior dated-amendment precedents inside REQUIREMENTS.md/ROADMAP.md itself (e.g. Phase 26/27 wording corrections) — read the live files directly when planning the amendment task; not a code file, no code excerpt needed | n/a (doc edit, not code pattern) |

## Pattern Assignments

### `src/analytics/unreliable-segments.ts` (service, transform/batch)

**Analog:** `src/analytics/pace-derivation.ts` (read in full, 664 lines)

**Imports pattern** (lines 31-32):
```typescript
import { validateStreamSeries } from './best-effort-utils.js';
import type { CanonicalStream } from '../streams/stream.types.js';
```
Mirror this exactly — `.js` extension on relative imports (ESM/TS convention this whole codebase uses), `validateStreamSeries` imported from `best-effort-utils.js`, not reimplemented. The detector should NOT import from `pace-derivation.ts` (per ARCHITECTURE.md's corrected scope — it is a standalone leaf module this phase) and should NOT import from `pace-quality.ts` either (per Don't-Hand-Roll: `countImpossibleSamples` answers a different question at a different denominator).

**Docblock convention to copy verbatim in shape** (lines 1-29): a top-of-file docblock stating (a) what requirement(s) it satisfies, (b) the purity contract ("Pure, client-safe module — no `fs`, no `fetch`, no DOM" — the detector is Node/CI-only per ARCHITECTURE.md so state the equivalent: no `fs`, computed from `t`/`d` alone, no lat/lng), (c) the exact-Δt-integration discipline, (d) the total-function guarantee: "any array-shaped input, including a malformed or adversarial stream, returns a zeroed result rather than throwing (T-26-01)."

**Guard-on-entry pattern (T-26-01 discipline)** — `classifyGaps` (lines 195-201):
```typescript
export function classifyGaps(
  t: readonly number[],
  d: readonly number[],
  options?: { pauseRule?: PauseRule }
): PaceCoverage {
  if (!validateStreamSeries(t as number[], d as number[]).ok) return zeroCoverage();
  ...
```
Copy this shape exactly for `detectUnreliableSegments(t, d, calibration?)`: guard first, return a fresh empty-array/zeroed result (never a shared mutable module-level constant — see `zeroCoverage()` at line 86-89, "Returns a fresh zeroed result — never a shared/mutable module-level constant") on any non-`ok` input.

**Maximal-run grouping idiom to MIRROR, not import** — `computeFlatRunDurations` (lines 151-166, private/unexported):
```typescript
function computeFlatRunDurations(t: readonly number[], d: readonly number[], n: number): number[] {
  const flatRunDuration: number[] = new Array(n - 1).fill(-1);
  let i = 0;
  while (i < n - 1) {
    if (d[i + 1] - d[i] <= 0) {
      let j = i;
      while (j < n - 1 && d[j + 1] - d[j] <= 0) j++;
      const duration = t[j] - t[i];
      for (let k = i; k < j; k++) flatRunDuration[k] = duration;
      i = j;
    } else {
      i++;
    }
  }
  return flatRunDuration;
}
```
This groups **flat** runs; SEG-01 needs the mirror-image — group **advancing** runs and score by aggregate `Σd/Σt`, not per-sample. RESEARCH.md is explicit: do not import this function (it's unexported) and do not export it for reuse — the detector's own run-walk belongs entirely inside `unreliable-segments.ts` (containment discipline `pace-single-source.test.ts`'s docblock states twice). Write a new, analogous `while`-based grouping walk.

**Percentile to reuse, not reinvent** — `quantile` (lines 100-112), R-7 linear-interpolation:
```typescript
export function quantile(sortedAsc: readonly number[], q: number): number {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedAsc[0];
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  const frac = pos - lo;
  return sortedAsc[lo] + frac * (sortedAsc[hi] - sortedAsc[lo]);
}
```
The project deliberately maintains exactly two percentile implementations by name (R-7 interpolation here, nearest-rank in `best-effort-ceiling.ts`'s `percentileNearestRank`, shown below) — "Don't Hand-Roll" in RESEARCH.md forbids a third. Since D-10's candidate statistic needs a "bulk of the bulk" (percentile of per-activity percentiles), decide which of the two existing definitions to cite and import it (from `pace-derivation.ts` if `quantile`, from `best-effort-ceiling.ts` if nearest-rank) rather than copy-pasting either body into the new module.

**Constant docblock convention** (lines 34-41, 43-50) — every calibrated constant carries a docblock stating the exact measurement it came from and forbidding tuning toward a count:
```typescript
/**
 * Absolute-time threshold above which a `[t[i], t[i+1]]` segment is a
 * `recording-gap` rather than a `pause` or `covered` segment. Unchanged from
 * PROJECT.md's existing 1,233-activity cohort (a gap >10s with no samples
 * recorded across it) — 26-RESEARCH.md found no evidence this constant needs
 * to move.
 */
export const RECORDING_GAP_ABS_THRESHOLD_SEC = 10;
```
Copy this exact convention for the detector's own constants (speed limit, D-08's metres boundary, D-09's excess-metres floor): name the constant, state the measured derivation, cite the calibration artifact by filename, and state Phase 27 D-02's anti-quota rule explicitly (see `CEILING_K`'s docblock below for the fullest example of this).

**Total-function / never-throw discipline** — restated at the top of every export in this file (e.g. lines 445-446): "On an invalid stream (T-26-01) this never throws — it returns an empty series with the zeroed [...] result." Apply identically to `detectUnreliableSegments`.

**Output-shape discretion note (from CONTEXT.md/RESEARCH.md):** shape the segment record so it carries `start`/`end` time, metres, seconds, mechanism (`'gap-adjacent' | 'hidden-pause' | 'isolated-jump'` — NO fourth member per D-03), and itemised burst-vs-gap contribution (for D-15's recount table to diff against). Mirror `GapInterval`'s shape (lines 55-60: `{ startSec, endSec, kind }`) for the basic interval fields, extended with mechanism + metres itemisation.

---

### `src/analytics/best-effort-utils.ts` — supporting analog for `validateStreamSeries`

**Analog:** `src/analytics/best-effort-utils.ts` (read in full, 232 lines) — this file is REUSED, not modified. Only its exported `validateStreamSeries` is imported.

**The guard itself** (lines 72-113):
```typescript
export function validateStreamSeries(t: number[], d: number[]): PlausibilityResult {
  if (t.length !== d.length) {
    return { ok: false, reason: `t and d length mismatch: t has ${t.length} samples, d has ${d.length} samples` };
  }
  const n = t.length;
  if (n < 2) {
    return { ok: false, reason: `series has ${n} sample(s), at least 2 are required` };
  }
  // finiteness checks, then non-decreasing checks on both t and d
  ...
  return { ok: true };
}
```
This is the ONE entry guard every stream function in this codebase uses (CONTEXT.md's canonical_refs explicitly names it as the reuse target). Do not reimplement any part of this validation inside `unreliable-segments.ts`.

**Constant-naming precedent for a shared, cross-module constant** (lines 44-64) — `WORLD_RECORD_100M_SPEED_MPS`'s docblock is the best in-repo model for how to declare and justify a constant that a DIFFERENT module (there: `pace-quality.ts`) consumes for a different purpose than the file's own primary job: "Exported (not inlined) because [X] already circulates in this repository as an undocumented literal [...]. A third, private copy declared inside `pace-quality.ts` would be a second undocumented literal masquerading as a third; this is the one place it is declared and named." If the detector's speed-limit constant needs to be visible to Phase 33/36 later (it will, per D-04/Claude's Discretion), declare it once in `unreliable-segments.ts` with this exact justification style — never duplicate it.

---

### `src/analytics/pace-single-source.test.ts` (EXTENDED — test, structural audit)

**Analog:** itself (read in full, 452 lines) — this file already IS the audit to extend; the "pattern" here is precedent for HOW to extend it, since D-14/SEG-05a asks for new banned-literal/structural-pattern coverage for the detector.

**Banned literal + confined-call-site scan shape** (lines 99-150, 240-292):
```typescript
const BANNED_LITERALS = ['dt / (dd / 1000)', 'elapsed / (metres / 1000)'] as const;
const ALLOWED_FILE_SUFFIX = 'analytics/pace-derivation.ts';
const ALLOWED_SELF_SUFFIX = 'analytics/pace-single-source.test.ts';

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

export function findStreamPaceViolations(files: readonly SourceFile[]): StreamPaceViolation[] {
  const violations: StreamPaceViolation[] = [];
  for (const file of files) {
    if (file.path.endsWith(ALLOWED_FILE_SUFFIX) || file.path.endsWith(ALLOWED_SELF_SUFFIX)) continue;
    const stripped = stripComments(file.source);
    for (const needle of BANNED_LITERALS) {
      const count = countOccurrences(stripped, needle);
      if (count > 0) violations.push({ path: file.path, needle, count });
    }
  }
  return violations;
}
```
For the detector's extension, per RESEARCH.md's "D-14 / SEG-05a" section: add (a) the detector's own core arithmetic literal(s) (e.g. whatever exact `Σd / Σt` expression is chosen), confined to `unreliable-segments.ts` + `*.test.ts`, and (b) a structural non-arithmetic re-implementation shape analogous to the real `gapIntervals.some(`/`gapIntervals.find(` blind spot closure (lines 250-260, `GAP_MEMBERSHIP_LITERALS`) — e.g. banning a second place that re-implements "is this run's aggregate speed above the calibrated limit" via ad hoc inline logic. Since there are zero real callers this phase, the practical proof is a **planted probe file**, not a historical incident.

**Pure-scanner discipline (curation-guard.mjs's shape)** (lines 130-150 docblock, restated at 158): "takes data in, returns violations, never throws, never reads the disk itself" — the file-list is passed as an argument, not read inside the scanner, which is what makes the planted-violation test a permanent in-suite test rather than a one-off.

**Planted-violation proof shape to copy verbatim** (lines 375-452):
```typescript
describe('PACE-01 Criterion 4 — the audit is demonstrated catching a reintroduced second implementation (planted, permanent)', () => {
  it('names the exact planted file path and the exact planted literal', () => {
    const plantedFiles: SourceFile[] = [
      { path: 'src/dashboard/views/planted-second-impl.ts', source: [
        '// A deliberately reintroduced second stream-derived pace implementation.',
        'export function computeLeakyPace(dt: number, dd: number): number {',
        '  return dt / (dd / 1000);',
        '}',
      ].join('\n') },
      ...
    ];
    const violations = findStreamPaceViolations(plantedFiles);
    expect(violations).toEqual([
      { path: 'src/dashboard/views/planted-second-impl.ts', needle: 'dt / (dd / 1000)', count: 1 },
    ]);
  });

  it('with the literal removed, the same planted file produces no violation (fails in both directions)', () => { /* ... */ });
});
```
Per D-14, this in-suite permanent describe block AND a one-off planted probe file against the REAL tree (captured verbatim in the plan's SUMMARY.md, then deleted, `git status --porcelain src` confirmed clean afterward) are both required — mirror this file's own docblock (lines 43-50) which distinguishes the two proof types explicitly.

**Non-vacuous-scan self-check pattern** (lines 294-301, 336-340): every scan test asserts its own match count is `toBeGreaterThan(0)` BEFORE asserting the offender list is empty — "a filter string that matches zero tests exits 0 and looks identical to a passing run" (the project's own vacuous-`-t`-filter lesson, generalized to structural scans too). Apply this same non-vacuous assertion to any new scan added for the detector.

---

### `scripts/compute-unreliable-segment-calibration.mjs` (utility, calibration generator)

**Analog:** `scripts/compute-pr-ceiling-calibration.mjs` (963 lines; key sections read) and `.planning/milestones/v2.2-phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md` (the artifact it writes) plus `30-CALIBRATION.md` as a secondary shape reference.

**Imports pattern** (lines 23-28):
```javascript
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { TARGET_ORDER, TARGET_METERS } from '../dist/analytics/best-effort.types.js';
import { riegelPredict } from '../dist/analytics/riegel.js';
```
Note: a CALIBRATION generator is PERMITTED to import the module it calibrates (unlike a recount script) — it imports from `../dist/analytics/...` (compiled output), consistent with this repo's convention that scripts run post-build. The new script should import `detectUnreliableSegments` (and any exported constants) from `../dist/analytics/unreliable-segments.js`.

**Anti-circularity / non-tail-percentile derivation shape** — `deriveCeilingMultiplier` (lines 224-259):
```javascript
export function deriveCeilingMultiplier(populations) {
  const { n: minPopulation } = deriveMinimumPopulation();
  const { mechanismClean } = partitionMechanismClean(populations);
  const mechanismCleanSet = new Set(mechanismClean);
  const perDistance = {};
  for (const key of TARGET_ORDER) {
    const population = populations.get(key) ?? [];
    const dist = describeDistribution(population);
    perDistance[key] = { n: dist.n, max: dist.max, p90: dist.p90, ratio: dist.maxOverP90,
      mechanismClean: mechanismCleanSet.has(key), floorEligible: dist.n >= minPopulation };
  }
  let k = null, argmaxDistance = null;
  for (const key of mechanismClean) {
    const entry = perDistance[key];
    if (!entry.floorEligible || entry.ratio === null) continue;
    if (k === null || entry.ratio > k) { k = entry.ratio; argmaxDistance = key; }
  }
  return { k: k === null ? null : Math.ceil(k * 100) / 100, argmaxDistance, perDistance };
}
```
This is the DIRECT template for D-10's "structural, not tail-percentile" constraint: derive a "mechanism-clean" cohort first (the analog to D-11's decimation-disjointness requirement), take a bulk statistic (p90) of ONLY that cohort, then round up (direction-safe — never demotes a borderline case). Structurally single-parameter (no demotion-count argument) — the anti-quota guarantee (Phase 27 D-02) is enforced by the function signature, not a promise. Mirror this shape exactly for whatever `K x p90(...)` statistic the detector's speed limit ends up using, and equally for D-08's metres boundary and D-09's excess-metres floor.

**Idempotent artifact-write shape** — `main()` (lines 888-957, tail excerpted):
```javascript
function main() {
  // ... reads shipped documents, builds the report, renders markdown ...
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');
}

// main() runs only under direct invocation, so [...] can import the pure functions
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
```
Run twice to prove idempotence (per the project's established convention — "Every calibration generator has a `.test.mjs`, is run twice to prove idempotence, and its prose is generated"). The ONLY field allowed to differ between two consecutive runs is the `**Generated:** <timestamp>` line (see `28-CEILING-CALIBRATION.md:5`) — everything else must byte-match unless the live archive itself changed between runs.

**Artifact document shape to copy** — `28-CEILING-CALIBRATION.md` (full structure read):

~~~markdown
# Phase 28 — PR Plausibility Ceiling Calibration

This file is machine-written and regenerated by `npm run compute-pr-ceiling-calibration`. It records...

**Generated:** 2026-09-19T12:44:36.122Z

## Chosen constants
| Constant | Value |
...

## Per-distance distributions
...

## Why not a percentile
...

## Resulting coverage and demotions (reported, not targeted)
...

## Sensitivity (reported, not used to choose K)
`CEILING_K` was fixed by `deriveCeilingMultiplier` BEFORE this table was computed. Phase 27's D-02 forbids moving it to change the counts below; this table exists to disclose sensitivity, never to select a different value.
| K | 400m | 1k | ... |
| 1.23 | 11 | 12 | ... |
| 1.28 (chosen) | 8 | 7 | ... |
| 1.33 | 5 | 4 | ... |

## Inputs
- `data/stats/best-efforts.json` — generatedAt: ...
- Live archive denominator: 1874 activities considered ..., 1899 activities indexed ...

Regenerate this report against the live committed archive with:
```
npm run compute-pr-ceiling-calibration
```
~~~

The new `32-CALIBRATION.md` needs the equivalent sections: chosen constants (speed limit, metres boundary, excess-metres floor) with their derivations; per-mechanism headline in three units over a LIVE denominator (D-16); a "why not a [circular alternative]" section (D-13's watched-failing-first proof, mirroring "Why not a percentile" above); a sensitivity/insensitivity table (D-13, mirroring the "Sensitivity" section's "reported, not used to choose K" framing verbatim); the Suunto disposition note (D-01/D-03); D-05's negative-control fixtures with headroom; D-11's decimation-overlap measurement; D-06's near-miss sweep finding; the reconciliation table against the scoping probe's 259/1,873, 121/1,873, and 30/18/1,694m/106s/707s figures (D-16); and the same `## Inputs` + regenerate-command footer.

---

### `scripts/compute-unreliable-segment-recount.mjs` (utility, independent verifier)

**Analog:** `scripts/compute-pr-ceiling-recount.mjs` (865 lines; key sections read) — the PRIMARY analog for D-15's zero-import discipline; `scripts/compute-elevation-recount.mjs` (never-throw `evaluateReport` shape) as secondary.

**Zero-import docblock convention** (lines 1-58, full docblock read):
```javascript
/**
 * D-15's classifier-independent recount — the standalone verifier ROADMAP Criterion 5 requires:
 * it opens the SHIPPED `data/stats/best-efforts.json` and `data/dashboard/index.json` off disk
 * with `readFileSync` + `JSON.parse` and counts demoted efforts... with its OWN arithmetic.
 *
 * FORBIDDEN, DELIBERATELY: this file has zero `import`/`require`/dynamic-`import()` statements
 * naming the ceiling module ... The reason: a verifier that pulls in the classifier that produced
 * the numbers it is checking agrees with itself by construction — the exact failure mode D-15
 * exists to rule out...
 *
 * Distance keys come from the documents themselves ... never from `best-effort.types.js`, so this
 * recount shares no vocabulary module with the code it checks.
 *
 * Shape follows `scripts/compute-pace-quality-recount.mjs` (Phase 27, D-03): pure exported
 * functions, a guarded `main()` behind the self-execution check...
 */
```
For `compute-unreliable-segment-recount.mjs`, name `unreliable-segments` (any spelling, any path — `src/` or `dist/`) as the forbidden module in this docblock, state the same self-agreement rationale, and declare any shared vocabulary (e.g. mechanism labels, distance/threshold constants) as LOCAL duplicated constants rather than imports — mirroring `TARGET_METERS_LOCAL` (lines 83-91): "Distance meters, declared LOCALLY on purpose (D-15): this file must not import [...] for these numbers, even though that module defines the same mapping. Duplicating this tiny constant table is the price of staying a genuinely independent recount."

**Pinned-fixture-by-name pattern** (lines 72-75):
```javascript
/** The pinned regression activity (D-04): its 400m effort is 45.2s / 8.85 m/s. */
const PINNED_ACTIVITY_ID = '4556693525';
const PINNED_DISTANCE = '400m';
const PINNED_DURATION_SEC = 45.2;
```
Mirror this for `3475724402` (the gap-first table's target activity, D-15) and D-05's negative-control IDs.

**Self-execution guard** (lines 863-865, mirrored also in `compute-pr-ceiling-calibration.mjs`):
```javascript
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
```

**Gap-first algorithm design note (from RESEARCH.md, not copied code — the detector itself is run-first):** walk backward/forward from each `classifyGaps`-identified gap boundary, accumulating consecutive "fast" samples on each side with an independently-derived simple per-sample or per-short-window speed test, then sum burst+gap distance/time — a structurally different traversal order from the detector's own run-first walk, breaking the "two artifacts sharing a blind spot" failure Pitfall 11 describes.

**Never-throw, always-explain verdict shape** — `evaluateReport` in `scripts/compute-elevation-recount.mjs` (lines 274, 312, structure paraphrased from research and confirmed via grep):
```javascript
export function evaluateReport(report, expected) {
  const problems = [...report.schemaFindings];
  if (report.missingElevationIds.length > 0) { problems.push(`...`); }
  // ... every failure mode appended as a human-readable string, never thrown
  return { pass: problems.length === 0, problems };
}
```
D-15's "fails closed on malformed input" requirement mirrors this exactly — never throw, return `{ ok: false, reason }` or push into a `problems`/`findings` array, exit non-zero on any problem, always print WHY.

---

### `scripts/compute-unreliable-segment-recount.test.mjs` (test, zero-import structural guard)

**Analog:** `scripts/compute-pr-ceiling-recount.test.mjs` lines 1-90 (read in full) — this is a VERIFIED WORKING precedent, copy this shape near-verbatim.

```javascript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = fileURLToPath(new URL('./compute-unreliable-segment-recount.mjs', import.meta.url));
const FORBIDDEN_MODULE_NAMES = ['unreliable-segments'];

/**
 * Strips comments BEFORE searching for forbidden module names. The comment-stripping order is
 * load-bearing: the script's own header comment legitimately NAMES the forbidden module in its
 * docblock explaining why it is forbidden, so a naive raw-source grep would fail on the script's
 * own prose — the exact self-invalidating-grep trap this project has hit before.
 */
function stripComments(source) {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

describe('zero-import guard (D-15)', () => {
  it('the stripper actually removes a line naming a forbidden module — proving it works rather than assuming it', () => {
    const fixture = [
      'const ok = 1;',
      "// imports dist/analytics/unreliable-segments.js, forbidden",
      'const alsoOk = 2;',
    ].join('\n');
    const stripped = stripComments(fixture);
    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(fixture).toContain(forbidden); // sanity: raw fixture DOES name the module
      expect(stripped).not.toContain(forbidden); // the stripper removed it
    }
  });

  it('compute-unreliable-segment-recount.mjs contains none of the forbidden module names once comments are stripped', () => {
    const raw = readFileSync(SCRIPT_PATH, 'utf8');
    const stripped = stripComments(raw);
    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(raw).toContain(forbidden); // sanity: raw source legitimately names it (docblock)
    }
    for (const forbidden of FORBIDDEN_MODULE_NAMES) {
      expect(stripped).not.toContain(forbidden);
    }
  });
});
```
D-15 additionally requires the recount be "shown FAILING against a deliberately-broken detector before passing" — add a describe block that feeds the recount's pure functions a deliberately wrong/broken detector-shaped input and asserts the comparison fails, mirroring `compute-pr-ceiling-recount.test.mjs`'s `CR-01 regression shape` describe block (around line 849: "fails on the CR-01 shape").

---

### `scripts/validate-unreliable-segments-1hz.mjs` (D-12, local-only, no `.test.mjs`)

**Analog:** `src/exports/consolidate.ts` (`consolidateExports`, lines 137-146) for graceful `export_data/`-absence handling:
```typescript
export async function consolidateExports(): Promise<void> {
  const exportRoot = 'export_data';
  const sources = fs.existsSync(exportRoot)
    ? fs.readdirSync(exportRoot).filter(d => fs.statSync(path.join(exportRoot, d)).isDirectory())
    : [];

  if (sources.length === 0) {
    console.log('Nothing to consolidate: no directories under export_data/.');
    return;
  }
  ...
```
Copy this `existsSync` guard + informative log line + clean early-return shape exactly — the script must degrade gracefully (never throw) if `export_data/` is absent, so even an accidental CI invocation is a no-op, not a pipeline failure.

**Critical constraint (confirmed this session, `vitest.config.ts:16`):** `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']` — ANY `.test.mjs` colocated under `scripts/` is auto-collected by `npm test`. D-12 requires this script to NEVER run under CI/`npm test` — do **not** create a `.test.mjs` sibling for it (unlike every other `compute-*.mjs`, which does have one). If pure-logic unit coverage is wanted (e.g. a haversine cross-check helper), extract that logic into a separate, `export_data/`-independent pure function/file that a `.test.mjs` CAN exercise with synthetic fixtures — the file that actually calls `readFileSync('export_data/...')` stays untested-by-vitest, with a comment explaining why.

**FIT-decode pattern (already run successfully this session against this exact repo's `@garmin/fitsdk`):** `Decoder`/`Stream.fromBuffer`, same pattern already documented in `src/exports/geometry-readers.ts` (per RESEARCH.md's Standard Stack section) — read `geometry-readers.ts`'s existing FIT-decode call sites directly when implementing this script, rather than re-deriving the API from the SDK's own docs.

**Join-key pattern:** `export_data/strava/activities.csv` maps canonical activity IDs to FIT filenames (column `Filename`) — this is the ONLY committed source with a complete per-activity FIT filename map (`data/provenance.json` is a summary/counts document, not a per-activity index). Use `src/exports/csv.js`'s `columnIndices`/`parseCsv` helpers (already imported by `consolidate.ts` line 8) to read it, rather than hand-rolling CSV parsing.

---

### Streams-immutability manifest + vitest gate (D-17)

**Analog:** `scripts/lib/stream-files.mjs` (read in full, 42 lines) — the EXACT precedent for excluding `manifest.json` from a `data/streams/` glob, already fixed twice in this codebase (Phase 27 G-01, G-03):
```javascript
/** Strips the trailing `.json` from a `data/activities|streams` filename. */
export function idFromFilename(filename) {
  return filename.endsWith('.json') ? filename.slice(0, -'.json'.length) : filename;
}

/**
 * True for a `data/streams/` entry that is a genuine per-activity stream
 * file — false for `manifest.json`, the stream-AVAILABILITY INDEX...
 */
export function isStreamFile(filename) {
  return filename.endsWith('.json') && filename !== 'manifest.json';
}
```
Import `isStreamFile`/`idFromFilename` from this shared module for BOTH (a) generating the new checksum manifest's file list and (b) the vitest gate's own re-hash loop — do not re-glob `data/streams/*.json` naively anywhere in this phase's new code. This directly prevents the D-17 collision risk RESEARCH.md flags (`data/streams/manifest.json` already exists as a stream-availability index with a different, legitimately-changing purpose).

**Recommended location (Claude's Discretion per CONTEXT.md, RESEARCH.md's recommendation):** a NEW sibling file, e.g. `data/streams-checksum-manifest.json`, NOT inside `data/streams/` — avoids the manifest hashing itself and avoids glob confusion entirely.

**Read-loop shape to mirror** — `scripts/compute-pace-quality-calibration.mjs` (lines 43-49, 482-487):
```javascript
// isStreamFile/idFromFilename moved to the shared lib module (31-06, D-11)
import { idFromFilename, isStreamFile } from './lib/stream-files.mjs';
export { idFromFilename, isStreamFile };
...
// isStreamFile excludes `manifest.json` (see its own doc comment) — this
streamFiles = readdirSync(STREAMS_DIR).filter(isStreamFile);
```

**sha256 primitive:** Node's built-in `crypto.createHash('sha256')` — no new dependency (confirmed via RESEARCH.md's Standard Stack / Package Legitimacy Audit: zero new `package.json` entries this phase).

**Gate design (D-17, from RESEARCH.md):** the vitest gate iterates the manifest's OWN `files` keys and re-hashes each, comparing digest — it does NOT iterate the live `data/streams/` directory, so a brand-new stream file invisible to the manifest is not a violation (tolerates new files, per the daily sync). Watched-failing-first proof: plant a one-byte edit to a listed stream file, run the gate, confirm it reports the specific file + digest mismatch, then `git checkout -- data/streams/{id}.json` and confirm `git status --porcelain data/streams` is clean and the gate passes again.

---

## Shared Patterns

### `validateStreamSeries` entry guard
**Source:** `src/analytics/best-effort-utils.ts:72-113`
**Apply to:** `unreliable-segments.ts`'s `detectUnreliableSegments` (and any other exported function taking `t`/`d`) — call it first, return a zeroed/empty result on any non-`ok` input, never throw.

### Total-function / never-throw discipline (T-26-01)
**Source:** `pace-derivation.ts` (restated at nearly every export, e.g. lines 445-446, 173-176) and `scripts/compute-elevation-recount.mjs`'s `evaluateReport` (never-throw, `problems` array)
**Apply to:** every new TS export AND every new script's public functions. "No `?? 0` / `|| 0` coercion anywhere — 'insufficient data' is always a zeroed/neutral result, never a plausible-looking computed zero" (T-26-02, `pace-derivation.ts:26-28`).

### Constant docblock convention (measured, not chosen; anti-quota)
**Source:** `best-effort-ceiling.ts:28-47` (`CEILING_K`'s docblock is the fullest example) and `pace-derivation.ts:34-41,43-50`
**Apply to:** every new calibrated constant in `unreliable-segments.ts` (speed limit, D-08's metres boundary, D-09's floor) — name it, state the exact measurement/derivation, cite `32-CALIBRATION.md` by name, and state the Phase 27 D-02 anti-quota rule explicitly ("takes no demotion-count argument, structurally, not by promise").

### Calibration-generator idempotence + artifact shape
**Source:** `scripts/compute-pr-ceiling-calibration.mjs` (`main()`, lines 888-957) + `.planning/milestones/v2.2-phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md`
**Apply to:** `scripts/compute-unreliable-segment-calibration.mjs` + `32-CALIBRATION.md`. Run twice, diff — only the `**Generated:**` timestamp may differ.

### Zero-import recount discipline
**Source:** `scripts/compute-pr-ceiling-recount.mjs:1-58` (docblock) + `scripts/compute-pr-ceiling-recount.test.mjs:1-90` (structural guard, VERIFIED WORKING)
**Apply to:** `scripts/compute-unreliable-segment-recount.mjs` / `.test.mjs` — copy the `stripComments` + `FORBIDDEN_MODULE_NAMES` + raw-source-sanity-check pattern verbatim; never import anything named `unreliable-segments`.

### Self-execution guard for dual-purpose scripts
**Source:** `scripts/compute-pr-ceiling-recount.mjs:860-865`, `scripts/compute-pr-ceiling-calibration.mjs:957-962`
```javascript
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
```
**Apply to:** both new `.mjs` scripts, so their pure functions are importable by sibling `.test.mjs` files without triggering a real file read/write as an import-time side effect.

### `isStreamFile` / `idFromFilename` — the ONE owner of the `data/streams/` glob
**Source:** `scripts/lib/stream-files.mjs` (full file, 42 lines)
**Apply to:** the D-17 checksum manifest generator AND its vitest gate — never re-glob `data/streams/*.json` with a naive `.endsWith('.json')` filter anywhere in this phase's new code (this exact mistake is a real, twice-fixed defect in this repo).

### `export_data/`-absence graceful degradation
**Source:** `src/exports/consolidate.ts:137-146`
**Apply to:** `scripts/validate-unreliable-segments-1hz.mjs` — `existsSync` guard, informative log line, clean return, never throw.

### Non-vacuous scan/filter assertions
**Source:** `pace-single-source.test.ts:294-301,336-340` (scan match-count `toBeGreaterThan(0)` before asserting empty offender list) and the project's own "vitest `-t` filter can be vacuous" lesson
**Apply to:** every new structural scan test (SEG-05a extension, D-17's gate, D-15's zero-import guard) and every `VALIDATION.md` row using a `-t` filter — record the matched test count.

## No Analog Found

None. Every file in scope has at least a role-match analog; the weakest match (`scripts/validate-unreliable-segments-1hz.mjs`, role-match only) still has two concrete, already-proven-working precedents to compose from (`consolidate.ts`'s absence-guard + this session's own successful `@garmin/fitsdk` decode of the exact target file).

## Metadata

**Analog search scope:** `src/analytics/`, `scripts/`, `scripts/lib/`, `src/exports/`, `.planning/milestones/v2.2-phases/{27,28,30}-*/`
**Files read in full or by targeted section this session:** `pace-derivation.ts` (664 lines, full), `best-effort-utils.ts` (232 lines, full), `pace-single-source.test.ts` (452 lines, full), `best-effort-ceiling.ts` (225 lines, full), `vitest.config.ts` (18 lines, full), `scripts/lib/stream-files.mjs` (42 lines, full), `pace-quality.ts` (2 targeted 75-line sections: `decimationSignal`, `countImpossibleSamples`), `consolidate.ts` (2 targeted sections: header + `consolidateExports`), `scripts/compute-pr-ceiling-recount.mjs` (docblock + first 110 lines targeted), `scripts/compute-pr-ceiling-recount.test.mjs` (first 92 lines targeted, plus a full `describe`/`it` grep pass), `scripts/compute-elevation-recount.mjs` (docblock + function-signature grep pass), `scripts/compute-pr-ceiling-calibration.mjs` (structure grep pass + one 80-line targeted section, `deriveMinimumPopulation`/`deriveCeilingMultiplier`/`applyCeiling`), `scripts/compute-pr-ceiling-calibration.test.mjs` (describe/it grep pass), `28-CEILING-CALIBRATION.md` (125 lines, full).
**Pattern extraction date:** 2026-09-19
