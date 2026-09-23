---
phase: 34-pause-classification-forgotten-stop
reviewed: 2026-09-23T10:40:00Z
depth: standard
diff_base: dd2d7819
files_reviewed: 30
files_reviewed_list:
  - scripts/compute-pause-classification-calibration.mjs
  - scripts/compute-pause-classification-calibration.test.mjs
  - scripts/compute-pause-classification-recount.mjs
  - scripts/compute-pause-classification-recount.test.mjs
  - scripts/compute-pause-transport-remeasurement.mjs
  - scripts/compute-pause-transport-remeasurement.test.mjs
  - scripts/compute-walking-break-evidence.mjs
  - scripts/compute-walking-break-evidence.test.mjs
  - src/analytics/compute-dashboard-index.test.ts
  - src/analytics/gear-aggregate-logic.test.ts
  - src/analytics/pace-derivation.test.ts
  - src/analytics/pace-derivation.ts
  - src/analytics/pace-quality.test.ts
  - src/analytics/pace-quality.ts
  - src/analytics/pace-single-source.test.ts
  - src/analytics/pause-classification.test.ts
  - src/analytics/pause-classification.ts
  - src/dashboard/data/index-client.test.ts
  - src/dashboard/data/pace-quality-client.test.ts
  - src/dashboard/data/pace-quality-client.ts
  - src/dashboard/views/calendar-logic.test.ts
  - src/dashboard/views/detail-sections.test.ts
  - src/dashboard/views/detail-sections.ts
  - src/dashboard/views/detail.ts
  - src/dashboard/views/list-logic.test.ts
  - src/dashboard/views/list.test.ts
  - src/dashboard/views/overview.test.ts
  - src/dashboard/views/trends-cadence-hr-logic.test.ts
  - src/dashboard/views/trends-logic.test.ts
  - src/dashboard/views/trends-volume-logic.test.ts
findings:
  critical: 2
  warning: 8
  info: 8
  total: 18
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-09-23T10:40:00Z
**Depth:** standard
**Files Reviewed:** 30 (`git diff dd2d7819..HEAD -- src scripts`)
**Status:** issues_found

## Summary

Reviewed the phase's production surface (`pause-classification.ts`, `pace-derivation.ts`,
`pace-quality.ts`, `pace-quality-client.ts`, `detail-sections.ts`, `detail.ts`), the four new
zero-import generators, and the accompanying test files.

Two findings are reproduced defects, not hypotheses — both were executed against the compiled
`dist/` build and their outputs are quoted verbatim below:

- **CR-01** — a partially-malformed `forgottenStop` object survives the "all-or-nothing" parser
  and renders **"possible forgotten stop: none found"** in the UI *while the same object carries
  `creepCount: 3` and `pauseCount: 1`*. This is a fabricated negative claim, which is exactly what
  D-10 / T-26-02 forbid, arriving through the CR-01 tolerant-read path the phase built to prevent it.
- **CR-02** — `findCreepStretches` ignores a `t` / `d` length mismatch (the one malformed-input class
  `pause-classification.ts`'s own module docblock names explicitly) and fabricates a 179-second
  `covered-creep` stretch with `metres: NaN`, which `classifyForgottenStop` then reports as
  `computable: true` with a positive count.

Beyond those, the `findCreepStretches` union-merge itself (the function that has now had two bugs)
**holds up** under scrutiny: `qualifying` really is monotone in both `startIdx` and `endIdx`
(`minSec > 0` forces `j > i`), the merge condition `w.startIdx <= last.endIdx` cannot produce
overlapping merged stretches, `mergedStretches` entries are fresh objects so the `last.endIdx`
mutation cannot alias `w`, and covered runs never share a sample index, so `totalSec` / `longestSec`
/ `count` cannot double-count in any path I could construct. The `<` vs `<=` question also comes out
clean: production (`metres / seconds > maxSpeedMps → reject`), the oracle
(`speed <= maxMps → accept`), `classifyPauseSpeed` and `localClassify` are all consistently inclusive
at the lower rungs and strict at the transport rung.

Where the creep work *does* go wrong is in its documentation and its projection: `pace-quality.ts`
still asserts the claim D-22 explicitly retired, and hard-codes `pauseClass: 'stationary'` on unions
whose own aggregate speed may exceed the stationary bound (WR-01).

The most acute developer-facing hazard is WR-03: `compute-pause-classification-calibration.test.mjs`
writes to two **real, tracked** repo files and reverts them with `git checkout --` during
`npm test`. That destroys uncommitted work with no warning and no recovery, which the phase record
already confirms happened once.

## Critical Issues

### CR-01: A partially-malformed `forgottenStop` renders a fabricated "none found"

**File:** `src/dashboard/data/pace-quality-client.ts:372-389`, `src/dashboard/views/detail-sections.ts:1584-1591`

**Issue:** `parseForgottenStopSignal`'s docblock claims an "all-or-nothing parse … never a
partially-trusted shape", but it only validates `computable` and `reason`. Every numeric field
goes through `finiteNumberOrNull`, which silently degrades a malformed value to `null` while leaving
`computable: true` intact. `pausesSummaryRow` then reads `(fs.count ?? 0) === 0` and emits the
confident sentence `possible forgotten stop: none found`.

Reproduced against `dist/` (a shard whose `count` is a string and `totalSec` is `NaN`, with
`creepCount: 3`, `creepTotalSec: 180`, `pauseCount: 1` all well-formed):

```
forgottenStop: {"computable":true,"reason":null,"count":null,"totalSec":null,"longestSec":null,
                "creepCount":3,"creepTotalSec":180,"creepLongestSec":90,
                "pauseCount":1,"pauseTotalSec":60,"pauseLongestSec":60}

rendered row: 7 intervals: 0 stationary, 2 walked, 1 ran through, 0 transported
              · possible forgotten stop: none found
```

The row asserts "looked and found none" against a document that says the opposite one field over.
That is the precise failure mode `ForgottenStopSignal`'s own docblock (`pace-quality.ts:216-226`) and
`NOT_COMPUTABLE_FORGOTTEN_STOP_PARSED`'s comment promise cannot happen. Note also that
`count: null` alone is enough — a stale shard that simply omits `count` while carrying the itemised
fields produces the same sentence. No test in `pace-quality-client.test.ts`'s `forgottenStop parse`
block covers `computable: true` with a non-finite/absent numeric field; every case there sets
`computable: false` or breaks `computable`/`reason` themselves.

**Fix:** make the parser genuinely all-or-nothing on the computable branch, so the `??` fallback
fires (the fallback is already correct):

```ts
function parseForgottenStopSignal(raw: unknown): ForgottenStopSignal | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.computable !== 'boolean') return null;
  if (raw.reason !== null && typeof raw.reason !== 'string') return null;

  const NUMERIC_KEYS = [
    'count', 'totalSec', 'longestSec',
    'creepCount', 'creepTotalSec', 'creepLongestSec',
    'pauseCount', 'pauseTotalSec', 'pauseLongestSec',
  ] as const;

  const numbers: Record<string, number | null> = {};
  for (const key of NUMERIC_KEYS) {
    const value = finiteNumberOrNull(raw[key]);
    // `computable: true` means every figure was measured — a null here is a
    // malformed/stale document, never a measured absence. Invalidate the whole
    // signal so the caller's CR-01 fallback applies.
    if (raw.computable && value === null) return null;
    numbers[key] = value;
  }
  return { computable: raw.computable, reason: raw.reason, ...numbers } as ForgottenStopSignal;
}
```

Add a matching defence at the render boundary, so an index-row (not shard) path cannot regress:

```ts
// detail-sections.ts
if (!fs.computable || fs.count === null) {
  forgottenStopText = `possible forgotten stop: not computable — ${fs.reason ?? fallbackReason}`;
} else if (fs.count === 0) {
  forgottenStopText = 'possible forgotten stop: none found';
}
```

---

### CR-02: `findCreepStretches` ignores a `t`/`d` length mismatch and fabricates NaN-metres standstills

**File:** `src/analytics/pause-classification.ts:606-665` (guard at `:620`), reached via `:695`

**Issue:** The module docblock (`:36-40`) states: *"any malformed input (`null`/`undefined` arrays,
**length mismatch**, a boundary time absent from `t`) returns an empty/not-computable result … never
a plausible-looking computed zero."* `collectPauseIntervals` honours this (`:357-365` checks
`t.length !== d.length`). `findCreepStretches` does not — its only guard is
`if (t == null || d == null || coveredRuns == null) return []`, and its per-run bound check
(`:620`) validates `runEnd` against `t.length` only, never `d.length`.

With a short `d`, `metres = d[j] - d[i]` is `NaN`, the rejection test `metres / seconds > maxSpeedMps`
is `NaN > 0.5 === false`, so **every** window qualifies and merges into one maximal union.
`classifyForgottenStop` reaches this because `recordingMechanismSignature` uses
`Math.min(t.length, d.length)` and only needs 30 qualifying pairs.

Reproduced against `dist/` (`t.length === 200`, `d.length === 60`, one covered run):

```
findCreepStretches(t, dShort, runs, 0.5, 40)
  → [{"source":"covered-creep","startSec":0,"endSec":50,"seconds":50,"metres":null,...}]

classifyForgottenStop(t, dShort, {gapIntervals:[]}, runs, SHIPPED_STOP_PARAMS)
  → computable: true  creepCount: 1
     [{"source":"covered-creep","startSec":20,"endSec":199,"seconds":179,
       "metres":null,"startMetres":60}]
```

Downstream this becomes `creepCount: 1, creepTotalSec: 179, count: 1` in `ForgottenStopSignal`, i.e.
the summary row claims a 2:59 forgotten stop. Worse, the shard's own `pauseIntervals` entry carries
`metres: NaN`, which `JSON.stringify` writes as `null`, which `parsePauseInterval` correctly rejects
(`pace-quality-client.ts:572`) — so the Pauses **table** shows nothing while the Pauses **summary
row** claims a stretch. The two disclosures contradict each other with no error anywhere.

**Reachability, stated honestly:** neither production producer can hit this today —
`computePaceQualitySignals` (`pace-quality.ts:1816`) and `buildPaceQualityShard` (`:2151`) both call
`validateStreamSeries` first, which rejects length mismatch. This is a contract violation of an
exported function, not a live user-visible bug. It is ranked Critical because (a) the module's own
contract names this exact input class, (b) the sibling function in the same file guards it, (c) the
failure mode is a fabricated **positive** finding rather than a safe zero, and (d) `findCreepStretches`
and `classifyForgottenStop` are both exported and directly callable (the calibration generator calls
`pc.classifyForgottenStop` at `compute-pause-classification-calibration.mjs:1436`).

**Fix:** guard the length mismatch at the function head and bound both arrays per run:

```ts
export function findCreepStretches(
  t: readonly number[], d: readonly number[],
  coveredRuns: readonly CoveredRun[], maxSpeedMps: number, minSec: number
): PauseInterval[] {
  if (t == null || d == null || coveredRuns == null) return [];
  if (t.length !== d.length) return [];   // <-- the named malformed-input class
  ...
  for (const run of coveredRuns) {
    const runStart = run.startIndex;
    const runEnd = run.endIndex;
    if (runEnd <= runStart || runEnd >= t.length || runEnd >= d.length || runStart < 0) continue;
    ...
      const seconds = t[j] - t[i];
      const metres = d[j] - d[i];
      // Reject non-finite explicitly: `NaN > max` is false, so a bare `>` test
      // ACCEPTS a corrupted window rather than rejecting it.
      if (!Number.isFinite(seconds) || !Number.isFinite(metres)) continue;
      if (seconds <= 0 || metres / seconds > maxSpeedMps) continue;
```

The `Number.isFinite` pair is the load-bearing half: it also closes the same hole for a `NaN` inside
an otherwise length-matched `t` or `d`.

## Warnings

### WR-01: `projectPauseIntervals` hard-codes `pauseClass: 'stationary'` on a claim D-22 retired

**File:** `src/analytics/pace-quality.ts:2062-2064` (docblock), `:2090` (assignment), `:1939` (shard type docblock)

**Issue:** The docblock justifies the hard-coded class with *"creep is a near-zero-speed stretch BY
CONSTRUCTION — `findCreepStretches` only ever returns windows at or under the stationary bound"*.
That is verbatim the claim `pause-classification.ts:600-604` marks **RETIRED (plan 34-06, superseded
by D-22): "every RETURNED stretch's own `metres / seconds` is `<= maxSpeedMps`" — false in general**.
Two production files now state opposite things about the same function.

This is not only stale prose. Reproduced against `dist/` — a 1 Hz stream slow at 0.1 m/s, with a
10-second 5 m/s burst at t=60, `maxSpeedMps = 0.5`, `minSec = 40`:

```
[ { s: 0,  e: 63,  sec: 63, met: '21.0', mps: '0.333' },
  { s: 67, e: 145, sec: 78, met: '37.0', mps: '0.474' } ]
```

Both unions stay under the bound here, but D-22 explicitly states they need not — and when one does
not, the Pauses table renders `Stationary — possible forgotten stop (timer running)` beside its own
`Duration` and `Distance` cells, which the reader can divide to get a speed above 0.5 m/s. The class
label and the evidence on the same row contradict each other.

**Fix:** either classify creep unions honestly, or say so in the label. The cheap, D-22-faithful fix
is to classify from the union's own numbers with the same bands the classifier uses:

```ts
for (const iv of creep) {
  merged.push({
    source: 'covered-creep',
    // D-22: a union of individually-bounded windows is NOT itself bounded. Classify
    // from the union's OWN metres/seconds — the same disclosed numbers this row renders.
    pauseClass: classifyPauseSpeed(iv.metres, iv.seconds, SHIPPED_PAUSE_BANDS) ?? 'stationary',
    ...
  });
}
```

and rewrite `:2062-2064` and `:1939` to cite D-22's union semantics rather than the retired claim.
If a fixed `'stationary'` is genuinely wanted, the docblock must say *"assigned, not measured — see
D-22"* rather than asserting a false invariant.

---

### WR-02: `parsePauseClassificationSignal` is documented all-or-nothing but is per-field tolerant

**File:** `src/dashboard/data/pace-quality-client.ts:330-347`, rendered at `src/dashboard/views/detail-sections.ts:1578-1582`

**Issue:** The docblock says *"all-or-nothing parse of the ninth signal"*, but the body returns an
object for **any** plain object, degrading each bad field to `null` independently. `pausesSummaryRow`
then applies `?? 0` per field. The result is a row whose numbers do not add up, with fabricated zeros:

```
input : { intervalCount: 7, stationaryCount: 'x', walkedCount: 2, ranThroughCount: 1, ... }
parsed: { intervalCount: 7, stationaryCount: null, walkedCount: 2, ... }
row   : "7 intervals: 0 stationary, 2 walked, 1 ran through, 0 transported"
```

`0 + 2 + 1 + 0 = 3 ≠ 7`, and `0 stationary` is invented. Compare `parseElevationSignal`
(`:243-254`), which is genuinely all-or-nothing and is what this docblock claims to mirror.

**Fix:** reject the whole signal when any field fails, so the named `NOT_COMPUTABLE_PAUSE_CLASSIFICATION_PARSED`
fallback applies and the row reads "pause classification not computable — {reason}":

```ts
function parsePauseClassificationSignal(raw: unknown): PauseClassificationSignal | null {
  if (!isPlainObject(raw)) return null;
  const keys = ['intervalCount','stationaryCount','walkedCount',
                'ranThroughCount','transportedCount','notClassifiableCount'] as const;
  const out: Record<string, number | null> = {};
  for (const key of keys) {
    const value = finiteNumberOrNull(raw[key]);
    // A present-but-unparseable count is a malformed document, not a measured
    // absence — one bad field invalidates the signal (parseElevationSignal's rule).
    if (value === null && raw[key] !== null && raw[key] !== undefined) return null;
    out[key] = value;
  }
  return out as unknown as PauseClassificationSignal;
}
```

Then drop the `?? 0` fabrications at `detail-sections.ts:1581-1582` — with an all-or-nothing parse
they are unreachable, and leaving them in keeps the fabrication one regression away.

---

### WR-03: The calibration test writes to and `git checkout --`s REAL tracked repo files

**File:** `scripts/compute-pause-classification-calibration.test.mjs:2249/2261`, `:2278/2290`, `:2328/2347`, `:2387/2399`, `:2416/2429`, `:2466/2485`

**Issue:** Six tests in the `provenance chain` block call `writeFileSync` on two real, tracked files —
`.planning/phases/34-pause-classification-forgotten-stop/34-CONTEXT.md` and
`scripts/compute-pause-classification-calibration.mjs` — and then restore them with
`execSync('git checkout -- <path>')` in a `finally`.

Ranking the risk to a developer running `npm test` with a dirty tree: **high, silent, and
unrecoverable.**

1. `git checkout -- <path>` discards *unstaged* changes unconditionally. A developer mid-edit on
   either file loses that work the moment the suite reaches these tests. There is no prompt, no
   backup, and no reflog entry for unstaged content. The phase record confirms this already
   destroyed uncommitted work once.
2. `finally` does not run on `SIGINT` (Ctrl-C), `SIGTERM`, a vitest hard timeout, or a process crash.
   Any of those between `writeFileSync` and the revert leaves a **deliberately corrupted** generator
   on disk — the S3 seed even strips a load-bearing `assert` — which a subsequent `git add -A`
   would happily commit.
3. `git diff --exit-code` exits non-zero when a diff exists, so `execSync` *throws* rather than
   returning; the "reverted, the tree is clean" assertion at `:2266` etc. surfaces as a raw
   `ENOENT`/exit-status error, not a readable assertion failure.
4. `fileParallelism: false` (`vitest.config.ts:15`) prevents cross-file races, but nothing prevents
   a developer's editor or a watch task from reading the seeded file during the window.

**Fix:** never touch a tracked file. Copy to a scratch directory and operate there. Two of the three
seeded edits (S1, S2) need no filesystem write at all — they are pure string comparisons:

```js
// S1/S2: seed in memory, assert in memory. No write, no revert, no risk.
const originalContext = readFileSync(CONTEXT_PATH, 'utf8');           // read-only
const editedContext = originalContext.replace(CONTEXT_LINE_PATTERN,
                                              'DECLARED STATIONARY_MAX_SPEED_MPS = 0.7');
expect(editedContext).not.toBe(originalContext);
const seededValue = CONTEXT_LINE_PATTERN.exec(editedContext)[1];      // '0.7'
expect(readGeneratorTextValue()).not.toBe(seededValue);               // the RED
```

S3 genuinely needs an importable module, so give it a temp copy:

```js
import { mkdtempSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'pause-calib-s3-'));
try {
  // the generator is zero-import w.r.t. src/, but copy sibling deps it does import
  const tmpGen = join(dir, 'gen.mjs');
  writeFileSync(tmpGen, edited, 'utf8');
  const mod = await import(pathToFileURL(tmpGen).href);
  ...
} finally {
  rmSync(dir, { recursive: true, force: true });   // deleting a temp dir is safe on any path
}
```

If the temp-copy route is blocked by the generator's relative sibling imports
(`./lib/stream-files.mjs`, `./compute-walking-break-evidence.mjs`), copy `scripts/` wholesale into
the temp dir with `cpSync(SCRIPTS_DIR, join(dir, 'scripts'), { recursive: true })` and seed the copy.
Either way the invariant is: **no test ever writes to, or runs `git checkout` against, a path inside
the working tree.**

---

### WR-04: "mirrors the oracle exactly" is false — the two creep finders use different window-admissibility rules

**File:** `src/analytics/pause-classification.ts:595-598` vs `scripts/compute-walking-break-evidence.mjs:206-228`

**Issue:** `findCreepStretches`'s docblock claims *"This shape mirrors
`scripts/compute-walking-break-evidence.mjs`'s independent `localCreepWindows` oracle exactly"*.
The **merge** step does mirror it exactly (I checked: same `w.startIdx <= last.endIdx` condition, same
one-pass fold, same monotone ordering assumption). The **window-admissibility** step does not:

| | production `findCreepStretches` | oracle `localCreepWindows` |
|---|---|---|
| window scope | inside one `CoveredRun` (`:617-620`) | whole stream (`:206`) |
| what blocks a window | the covered-run boundary — i.e. any recording-gap, **pause**, or unreliable pair | only `dt > LOCAL_GAP_THRESHOLD_SEC` (10 s) (`:214`) |
| zero-advance pause pairs | excluded (never `'covered'`) | **included** — a 1 Hz pause has `dt = 1`, not a local gap |

So a zero-advance pause run longer than `minSec` is a qualifying creep window in the oracle and not
in production, and the two can legitimately disagree on the same stream. The oracle is quoted as the
*independent second opinion* for checkpoint expected values (`compute-walking-break-evidence.mjs:7-14`,
D-18) — a disagreement there would be read as a production bug when it is a definitional difference.
This is exactly the "a convenient look-alike fixture inverted a severity call" hazard.

**Fix:** correct the claim and name the divergence, so a future reader does not treat a disagreement
as a defect:

```
 * This shape mirrors `scripts/compute-walking-break-evidence.mjs`'s independent
 * `localCreepWindows` oracle in its MERGE step exactly (collect, then union by
 * index overlap in one pass). Its ADMISSIBILITY step differs by construction and
 * must: production runs inside each `CoveredRun`, so a zero-advance pause pair
 * always breaks a window; the oracle, which may not import the detector (D-18),
 * approximates that with a local `dt > 10 s` gap test and therefore ADMITS
 * pause-interior samples production excludes. On a stream with a pause run longer
 * than `minSec`, the oracle reports a creep window production does not — a known
 * definitional gap, never a production defect. Quote the oracle only on
 * pause-free windows.
```

and add an assertion to the checkpoint procedure that the quoted window contains no `'pause'`-kind
`gapIntervals` entry before the oracle's figure is accepted as an expected value.

---

### WR-05: `collectPauseIntervals` reads `d[seg.startIndex]` unbounded, producing `startMetres: undefined`

**File:** `src/analytics/pause-classification.ts:387-396` (`:394`)

**Issue:** Every other boundary lookup in this file routes through `intervalFromGapInterval`, which
resolves via the `indexByTime` map and returns `null` (counted as a `joinViolation`) when the lookup
fails. The merged-segment branch bypasses that and indexes `d` directly with an unvalidated
`seg.startIndex`. An out-of-range index yields `undefined`, which TypeScript types as `number`.

The consequence chain is silent: `JSON.stringify` **drops** an `undefined` property, so the shard is
written without `startMetres`; `parsePauseInterval` (`pace-quality-client.ts:571`) then rejects the
entry as non-numeric and the tolerant loop drops it. The Pauses table loses the row while
`pauseClassification.intervalCount` — computed from the un-projected list — still counts it. The
two disclosures disagree with no error.

**Fix:** validate the index and count the failure the same way every sibling path does:

```ts
for (const seg of gapAdjacent) {
  const startMetres = d[seg.startIndex];
  if (!Number.isFinite(startMetres)) {
    joinViolations++;   // a segment whose startIndex does not address this stream
    continue;
  }
  intervals.push({ source: 'merged-segment', startSec: seg.startSec, endSec: seg.endSec,
                   seconds: seg.seconds, metres: seg.metres, startMetres });
}
```

---

### WR-06: `remeasureActivity` substitutes `metres: 0` for an unresolvable gap boundary

**File:** `scripts/compute-pause-transport-remeasurement.mjs:117-124` (`:122`), and `:81-83`

**Issue:**

```js
const metres = startIdx !== undefined && endIdx !== undefined ? d[endIdx] - d[startIdx] : 0;
```

A gap boundary absent from the `t`-to-index map becomes a measured `0 m` advance rather than an
excluded or violation-counted interval. `v22Qualifies` then tests `metres > 100` against a
fabricated zero, so the interval silently fails the old rule. This is a **figure-of-record**
artifact (`34-PAUSE03-REMEASUREMENT.md`), and the direction of the error is systematic: it can only
**understate** `oldRuleActivities` / `oldQualifyingIntervalCount`, i.e. it can only inflate the
"newly caught" delta the artifact exists to measure.

`withKmh` at `:81-83` has the same shape (`interval.seconds > 0 ? ... : 0`) — a zero-duration
interval reports `0 km/h` as a measurement.

**Fix:** carry the unresolvable interval as an explicit null and count it, mirroring the production
classifier's `joinViolations`:

```js
let unresolvedBoundaries = 0;
const oldIntervals = (threeWay.gapIntervals ?? [])
  .filter((gi) => gi.kind === 'recording-gap')
  .map((gi) => {
    const startIdx = indexByTime.get(gi.startSec);
    const endIdx = indexByTime.get(gi.endSec);
    if (startIdx === undefined || endIdx === undefined) { unresolvedBoundaries++; return null; }
    return withKmh({ startSec: gi.startSec, endSec: gi.endSec,
                     seconds: gi.endSec - gi.startSec, metres: d[endIdx] - d[startIdx] });
  })
  .filter((iv) => iv !== null);
```

and render `unresolvedBoundaries` in the artifact so a non-zero value is visible rather than
absorbed into the measured counts. For `withKmh`, return `kmh: null` on `seconds <= 0` and have the
renderer print `—`.

---

### WR-07: the 100-entry cap is enforced on write only, and lives as three unlinked literals

**File:** `src/analytics/pace-quality.ts:2100`; `src/dashboard/data/pace-quality-client.ts:680-685`; `src/dashboard/views/detail-sections.ts:2004`

**Issue:** Answering the scoping question directly — **the cap is write-side only.**
`projectPauseIntervals` caps at 100 (`pace-quality.ts:2100`), but `parsePaceQualityShard`'s
`pauseIntervals` loop (`:680-685`) is uncapped, and `pausesSectionPlan`
(`detail-sections.ts:1990`) maps **every** parsed entry to a DOM row with no ceiling. A shard with
10 000 valid entries — a hand-edited file, a stale artifact from a future schema, or a
partially-written file served mid-deploy — builds 10 000 `<tr>` elements. (The existing
`unreliableSegments`/`impossibleSamples` loops share this shape, so this is consistent with
convention rather than a new hole, but the phase added a third instance of it.)

Separately, the number `100` appears three times with no shared constant:
`merged.length > 100` / `merged.slice(0, 100)` (`pace-quality.ts:2100`) and the user-facing
`'Showing the first 100 intervals.'` (`detail-sections.ts:2004`). Changing the projection cap
silently makes the disclosure text a lie.

**Fix:** export one constant and enforce it on both sides:

```ts
// pace-quality.ts
export const SHARD_LIST_CAP = 100;
const entries = merged.length > SHARD_LIST_CAP ? merged.slice(0, SHARD_LIST_CAP) : merged;

// pace-quality-client.ts
if (Array.isArray(raw.pauseIntervals)) {
  for (const item of raw.pauseIntervals) {
    if (pauseIntervals.length >= SHARD_LIST_CAP) break;   // read side honours the same cap
    const parsed = parsePauseInterval(item);
    if (parsed) pauseIntervals.push(parsed);
  }
}

// detail-sections.ts
const PAUSES_TRUNCATION_TEXT = `Showing the first ${SHARD_LIST_CAP} intervals.`;
```

---

### WR-08: no structural guard bans duplicating `0.5` / `2.2` / `40` anywhere in `src/`

**File:** `src/analytics/pace-single-source.test.ts:467`, `:1051-1085`; `src/analytics/pause-classification.ts:199-204`

**Issue:** The D-05 audit (`pace-single-source.test.ts:1051-1085`) bans the literal `7.35` everywhere
under `src/` outside `unreliable-segments.ts`. The M7 guard
(`compute-pause-classification-calibration.test.mjs:2197-2239`) bans stray `0.5` / `2.2` — but only
inside the **generator** and its own **test file**. Nothing scans `src/` for the two
developer-declared constants or for `40`.

The only claimed protection is a comment at `pause-classification.ts:199-204`: *"never a repeated
`0.5`/`2.2` literal anywhere else in this module or its consumers (D-07's one-definition rule,
verified by `grep -cE "stationaryMaxMps: [0-9]"` finding zero matches in this file)"*. That is a
one-off grep recorded in prose, scoped to a single file, that no test re-runs. The cross-file half of
the claim ("or its consumers") is unverified. I confirmed the tree is clean today — the only
`stationaryMaxMps:` numeric literal under `src/` is the disclosed `TEST_BANDS` at
`pace-single-source.test.ts:966` — so this is a missing guard, not a live drift.

Given D-20/D-21 values are *developer-declared* and therefore the most likely to be re-typed from
memory into a future consumer, the asymmetry against `7.35` is backwards.

**Fix:** extend the existing, already-proven scanner rather than writing a new one. `findTransportLiteralViolations`
is already parameterised by a needle:

```ts
const DECLARED_BAND_LITERALS = ['stationaryMaxMps: 0', 'walkRunMps: 2', 'minSec: 4'] as const;

describe('pause-classification D-07: no band literal outside pause-classification.ts', () => {
  const { files } = readSourceTree(SRC_ROOT);
  it('zero offenders outside analytics/pause-classification.ts and *.test.ts', () => {
    const violations = files
      .filter((f) => !f.path.endsWith('analytics/pause-classification.ts') && !f.path.endsWith('.test.ts'))
      .flatMap((f) => DECLARED_BAND_LITERALS
        .filter((needle) => stripComments(f.source).includes(needle))
        .map((needle) => ({ path: f.path, needle })));
    expect(violations).toEqual([]);
  });
  // plus the planted-fixture demonstration every sibling guard in this file already has
});
```

and replace the prose grep claim at `:199-204` with a pointer to that test.

## Info

### IN-01: `pausesSectionPlan`'s `quality` parameter is dead

**File:** `src/dashboard/views/detail-sections.ts:1979-1983`

`void quality;` at `:1983` discards the only use. The docblock explains it is accepted "for call-site
symmetry" but "is not currently consulted". A parameter that exists to be discarded is a maintenance
trap — the next reader may believe the two empty-list causes *are* distinguished. Either drop the
parameter (and the argument at `detail.ts:611`), or actually use it to separate
`'empty'` from a new `'not-computable'` kind, which is the distinction the docblock says is missing.

### IN-02: `'3475724402'` duplicated as a bare literal at four sites

**File:** `scripts/compute-pause-classification-calibration.mjs:1164`, `:1513`, `:2149`; `scripts/compute-unreliable-segment-recount.mjs:59`

`INSENSITIVITY_SOURCE_ACTIVITY_ID` is exported at `:89` and used at `:1633`, but three other sites
retype the id. `:2149` renders the class-table heading as a literal while
`compute-pause-classification-recount.mjs:92` builds the heading it searches for from
`RECOUNT_ACTIVITY_ID` — a second independent copy. Changing the anchor activity in one place makes
the recount throw `missing "## Per-interval class table — …" heading`. It fails loudly rather than
silently, which is why this is Info. Fix: use `INSENSITIVITY_SOURCE_ACTIVITY_ID` at `:1164`, `:1513`
and `:2149`, and have the recount import it rather than aliasing `RECOUNT_ACTIVITY_ID`.

### IN-03: `evaluatePauseRecount`'s "never throws" contract is not met

**File:** `scripts/compute-pause-classification-recount.mjs:96-98`, `:353-354`

The docblock at `:317` states *"Never throws — every disagreement is appended to `problems`"*. The
function guards `Array.isArray(recountRows)` at `:331` but then calls `round1(r.metres)` at `:353`,
and `round1` is `x.toFixed(1)` — a `TypeError` on a row missing `metres`. Fix:
`function round1(x) { return Number.isFinite(x) ? Number(x.toFixed(1)) : null; }` and report a
`problems` entry when either side is null.

### IN-04: the `null`-safety fix landed at one of ten `validateStreamSeries` call sites

**File:** `src/analytics/pace-derivation.ts:332` (fixed); `:784`, `:937`; `src/analytics/pace-quality.ts:1013`, `:1342`, `:1433`, `:1576`, `:1816`, `:2151` (unfixed)

`classifyPairKinds` now checks `t == null || d == null` before calling `validateStreamSeries`, and the
comment at `:305-310` describes this as closing *"the one gap T-26-01's 'never throws' guarantee
had"*. `validateStreamSeries` reads `t.length` unconditionally
(`best-effort-utils.ts:73`), so the other nine call sites retain the identical gap. No Phase 34 entry
point reaches them with `null` (the new classifier functions guard their own inputs), so this is
documentation overreach rather than a live defect. Fix: either add the same two-token guard at the
remaining sites, or narrow the comment to "this call site".

### IN-05: plausible-looking zeros where the value is unknown

**File:** `scripts/compute-pause-classification-calibration.mjs:204`; `scripts/compute-pause-transport-remeasurement.mjs:161-162`, `:82`

`finalizeEpisode` returns `rateMps: seconds > 0 ? metres / seconds : 0` — a zero-duration episode
reports a measured drift rate of 0. `remeasureArchive` initialises `maxKmhOld`/`maxKmhMerged` to `0`,
so an archive with no qualifying interval renders "max 0 km/h" as if measured. Both are the
`null`-not-zero discipline this phase applies rigorously elsewhere. Neither is reachable on the
current archive (a chained episode always has `seconds > 0`; `maxKmh` is only rendered alongside a
non-zero count). Fix: return `null` and render `—`.

### IN-06: the `d20-basis` gate passes vacuously when `g4Base === null`

**File:** `scripts/compute-pause-classification-calibration.mjs:1463-1475`

`basisPass = g4Base === null || ...` means an archive with no chained standstill anywhere passes the
declaration check with no evidence behind it. The `reason` field discloses this, and the current
archive has `chained = 6` so the gate is live today. Worth recording because this is the
"unfailable in one direction" shape that has bitten this project before: if the archive ever drifts
to zero chained episodes, D-20's only live check goes silently vacuous. Fix: emit a distinct
`Verdict` token (e.g. `VACUOUS`) rather than `PASS` when `g4Base === null`, so a reader of
`34-CALIBRATION.md` can tell a measured pass from an unmeasured one.

### IN-07: `buildBaseViews` computes `J` speeds with no zero-duration guard

**File:** `scripts/compute-pause-classification-calibration.mjs:258-260`

`speedMps: iv.metres / iv.seconds` yields `Infinity`/`NaN` for a zero-duration interval, which
`collectPauseIntervals` can emit when `gi.startSec === gi.endSec`. The value feeds `jShapesForActivity`
and the plant population. Downstream histogram filters (`value >= lo && value < hi`) reject `NaN`, so
this currently self-heals. Fix: mirror `classifyPauseSpeed`'s guard and skip or null the interval.

### IN-08: zero-advance pauses are counted in both new signals, contradicting the "never double-counted" note

**File:** `src/analytics/pace-quality.ts:205-208`

The `PauseClassificationSignal` docblock says *"Covered-creep stretches are NOT counted here — they
belong to `ForgottenStopSignal` below (D-09's own itemisation), **never double-counted between the
two signals**."* The claim is true for creep, but zero-advance pauses *are* in both:
`pauseClassification.stationaryCount` (via `classifyPauses`) and `forgottenStop.pauseCount` (via
`classifyForgottenStop`). That overlap is intended by D-09's itemisation, but the sentence as written
reads as a guarantee about the pair of signals, not about creep alone. Fix: scope the sentence —
*"never double-counted between the two signals **for the covered-creep source**; zero-advance pauses
deliberately appear in both, as `stationaryCount` here and `pauseCount` there."*

---

_Reviewed: 2026-09-23T10:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
