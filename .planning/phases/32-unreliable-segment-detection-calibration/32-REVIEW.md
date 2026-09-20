---
phase: 32-unreliable-segment-detection-calibration
reviewed: 2026-09-20T13:00:19Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/analytics/unreliable-segments.ts
  - src/analytics/unreliable-segments.test.ts
  - src/analytics/pace-single-source.test.ts
  - scripts/compute-unreliable-segment-calibration.mjs
  - scripts/compute-unreliable-segment-calibration.test.mjs
  - scripts/compute-unreliable-segment-recount.mjs
  - scripts/compute-unreliable-segment-recount.test.mjs
  - scripts/unreliable-segment-recount-crosscheck.test.mjs
  - scripts/validate-unreliable-segments-1hz.mjs
  - scripts/compute-stream-checksums.mjs
  - scripts/compute-stream-checksums.test.mjs
findings:
  critical: 6
  warning: 14
  info: 5
  total: 25
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-09-20T13:00:19Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Eleven source files were reviewed: the detector (`unreliable-segments.ts`), its suite, the extended
single-source audit, four `.mjs` generators/validators and their three test siblings. Every finding
below was **executed and reproduced**, not inferred — repro scripts were run against the compiled
`dist/` detector and the live committed archive.

Three findings are of the exact class the phase context warned about ("three separate defects in this
phase already reported green while being broken"):

- **CR-05** — both `import-time side effects` guards are provably incapable of failing. A control
  probe (module that genuinely calls `readFileSync` via a named import, dynamic-imported behind
  `vi.spyOn(fs, 'readFileSync')`) recorded **0 spy calls**. The guards therefore test nothing.
- **CR-06** — a single en-dash typo in the hand-written 32-05 Decision block silently produces
  `startSec: NaN` fixture windows, which makes the D-05 negative-control rows render `spared: true`
  without ever measuring anything.
- **CR-04** — `findValley` counts histogram mass lying *entirely outside* the anchor interval, and
  the error direction is exclusively toward **manufacturing** a valley — precisely the outcome D-08
  forbids. Reproduced: a population whose only in-interval mass is 4 values flips from
  `valleyFound: false` to `valleyFound: true` purely because 50 out-of-interval values exist.

Two further criticals are contract violations in the detector itself: `mapGapToIndices`'s index
asymmetry silently converts a `gap-adjacent` segment into an `isolated-jump` whenever a duplicate
timestamp sits on a gap boundary (**CR-01** — 72 of 1,874 committed streams already carry duplicate
timestamps, and `validateStreamSeries` explicitly documents them as valid), and the module's
headline "never throws" discipline (T-26-01) is false for six distinct reachable input shapes
(**CR-02**).

What holds up well: the recount round-trips cleanly against the committed artifact
(`npm run compute-unreliable-segment-recount` → PASS, 16 rows); `compute-stream-checksums.mjs` and
its suite are sound (append-only refusal, `isStreamFile` ownership, tolerated-new-file behaviour all
verified); no script writes outside its declared single target; the recount takes no import edge on
the detector; and `advanceSteps`'s folding rule is correct on every non-degenerate stream shape
tested.

## Critical Issues

### CR-01: Duplicate timestamps at a gap boundary silently destroy gap adjacency and mislabel the mechanism

**File:** `src/analytics/unreliable-segments.ts:351-379` (with `199-206`, `246-250`)

**Issue:** `mapGapToIndices` picks `gi` = the **LAST** index whose `t` equals `span.startSec`, and
`gj` = the **FIRST** index whose `t` equals `span.endSec`. `isGapPair` (line 203) uses an inclusive
test `g.startSec <= t[i] && t[i+1] <= g.endSec`, which classifies the duplicate-timestamp pair
itself as a gap pair — so `advanceSteps` (line 248) resets `s` past it. The result is that no step
can ever *end* at `gi` or *start* at `gj` when a timestamp is duplicated on that boundary, and D-06's
zero-tolerance index-equality chain test (line 466) therefore never fires.

`validateStreamSeries` (`best-effort-utils.ts:66-70`) explicitly documents equal consecutive `t`
values as valid ("samples sharing a timestamp"), and **72 of the 1,874 committed streams already
contain them** — none currently sits on a gap boundary, so this is latent, not firing today. One
nightly `intervals.icu` sync is enough to land one.

Reproduced (leading side):
```
t = [0, 1, 1, 13], d = [0, 20, 20, 21], gaps = [{startSec: 1, endSec: 13}]
  WITH the duplicate sample -> [{si:0, ei:1, mech:"isolated-jump", gapCount:0}]
  WITHOUT it (t=[0,1,13])   -> [{si:0, ei:2, mech:"gap-adjacent",  gapCount:1}]
```
Reproduced (trailing side, duplicate on `endSec`):
```
t = [0, 12, 12, 13], d = [0, 1, 1, 21], gaps = [{startSec: 0, endSec: 12}]
  WITH    -> [{si:2, ei:3, mech:"isolated-jump", gapCount:0}]
  WITHOUT -> [{si:0, ei:2, mech:"gap-adjacent",  gapCount:1}]
```
The damage is not only the label: the gap span is dropped from the segment entirely, so
`metres`/`seconds` understate the span Phase 33 must clip and Phase 36 must bar.

**Fix:** Make the index mapping agree with `isGapPair`'s own inclusive definition — take the FIRST
index at `startSec` and the LAST index at `endSec`, the widest span consistent with which pairs are
actually excluded from `advanceSteps`:
```ts
let gi = -1;
for (let i = 0; i < t.length; i++) {
  if (t[i] === span.startSec) { gi = i; break; }   // FIRST, mirroring isGapPair's lower bound
}
if (gi === -1) return null;

let gj = -1;
for (let j = 0; j < t.length; j++) {
  if (t[j] === span.endSec) gj = j;                // LAST, mirroring isGapPair's upper bound
}
if (gj === -1 || gj <= gi) return null;
```
Add both repro fixtures above to `unreliable-segments.test.ts` as regression cases — the existing
suite has no duplicate-timestamp-at-a-gap-boundary fixture at all.

---

### CR-02: The documented total-function / never-throw contract (T-26-01) is false for six reachable input shapes

**File:** `src/analytics/unreliable-segments.ts:18-22, 240, 382-388, 415-437`

**Issue:** The module docblock states: *"every export here guards its input with `validateStreamSeries`
… and returns a FRESH empty array on any non-`ok` input — never a thrown exception"*, and
`detectUnreliableSegments`'s own docblock (lines 410-413) promises `[]` *"when any gap span is
malformed (fails `mapGapToIndices`)"*. Both claims are false. Executed against `dist/`:

```
THROWS  detectUnreliableSegments(t, d, null, P)      -> TypeError: gaps is not iterable
THROWS  detectUnreliableSegments(t, d, [], null)     -> TypeError: Cannot destructure property 'speedLimitMps' of 'params' as it is null
THROWS  detectUnreliableSegments(t, d, [null], P)    -> TypeError: Cannot read properties of null (reading 'startSec')
THROWS  detectUnreliableSegments(null, null, [], P)  -> TypeError: Cannot read properties of null (reading 'length')
THROWS  advanceSteps(t, d, null)                     -> TypeError: gaps is not iterable
THROWS  advanceSteps(null, null, [])                 -> TypeError: Cannot read properties of null (reading 'length')
```

A `null` gap span **is** "a malformed gap span" and it throws instead of failing closed. This is not
theoretical: the module is consumed by three untyped `.mjs` scripts
(`compute-unreliable-segment-calibration.mjs`, `validate-unreliable-segments-1hz.mjs`) where TypeScript
offers no protection and every input is derived from `JSON.parse` of on-disk files.

The `detectUnreliableSegments — total function` describe block
(`unreliable-segments.test.ts:373-416`) covers only *field-level* malformation (`NaN`,
`Infinity`, negative) — never a non-object `params`, a non-array `gaps`, a `null` gap entry, or
non-array `t`/`d`. That is why this passed review.

**Fix:** Guard the shapes before touching them, and cover them in the total-function block:
```ts
function paramsAreValid(params: DetectorParams): boolean {
  if (params === null || typeof params !== 'object') return false;
  const { speedLimitMps, excessFloorMetres, hiddenPauseMinMetres } = params;
  // ...existing checks
}

// in both advanceSteps and detectUnreliableSegments, before any iteration:
if (!Array.isArray(t) || !Array.isArray(d)) return [];
if (!Array.isArray(gaps)) return [];
// in mapGapToIndices:
if (span === null || typeof span !== 'object') return null;
```

---

### CR-03: `buildActivityFinding` throws on a missing/unparseable stream despite its "never throws" contract, aborting the whole 1 Hz run

**File:** `scripts/validate-unreliable-segments-1hz.mjs:262-264, 279-281, 513-526`

**Issue:** The docblock (line 264) states *"Returns `{ id, skipped: reason }` when the FIT original is
absent/unreadable or decode fails — **never throws**"*. Every other read in the function is wrapped
(`activityDoc` at 292-297, `readOriginal` at 303-308), but line 279 is not:

```js
const stream = JSON.parse(readFileSync(join(streamsDir, `${id}.json`), 'utf8'));
const t = stream.t;
const d = stream.d;
if (!validateStreamSeries(t, d).ok) { ... }
```

Three reachable throw paths, none caught by `main()` (lines 515-520 have no `try`):
1. `readFileSync` ENOENT — `buildSampleActivityIds` (line 170) prepends the **hard-coded**
   `NAMED_ACTIVITY_IDS` unconditionally, with no `existsSync` check. Unlike
   `findFlaggedActivitiesWithFitOriginal`, which does guard its reads (line 140-144), these four ids
   are read blind.
2. `JSON.parse` on a truncated file.
3. `validateStreamSeries(undefined, undefined)` when `t`/`d` are absent from the JSON —
   `TypeError: Cannot read properties of undefined (reading 'length')` (see CR-02).

Any of the three aborts the whole script with an unhandled rejection and **writes no report at all**,
which is the opposite of the file's stated "degrades gracefully" design (docblock lines 20-22).

**Fix:**
```js
let stream;
try {
  stream = JSON.parse(readFileSync(join(streamsDir, `${id}.json`), 'utf8'));
} catch (error) {
  return { id, skipped: `committed stream missing or unparseable (${error.message})` };
}
const t = Array.isArray(stream.t) ? stream.t : [];
const d = Array.isArray(stream.d) ? stream.d : [];
if (!validateStreamSeries(t, d).ok) {
  return { id, skipped: 'committed stream fails validateStreamSeries' };
}
```
Also wrap the `await buildActivityFinding(...)` call in `main()` so no single activity can take the
run down.

---

### CR-04: `findValley` counts histogram mass outside the anchor interval, and can only ever manufacture a valley

**File:** `scripts/compute-unreliable-segment-calibration.mjs:1070-1111` (bins at `1075-1081`,
side maxima at `1088-1101`)

**Issue:** The docblock claims the left/right maxima are *"both restricted to the interval"*. They are
not. `firstEdge = Math.floor(lowMetres / binWidth) * binWidth` and
`lastEdge = Math.floor(highMetres / binWidth) * binWidth` produce a bin array whose **first bin
straddles below `lowMetres`** and whose **last bin `[lastEdge, lastEdge + binWidth)` extends up to a
full `binWidth` above `highMetres`**. Values entirely outside the anchor interval are counted into
`maxLeft` / `maxRight`.

Because extra side mass only raises `maxLeft`/`maxRight`, and because the `maxLeft === 0 || maxRight === 0`
guard (line 1100) is the only thing rejecting empty sides, the error direction is **exclusively toward
declaring a valley that the in-interval data does not support**. That is the single outcome D-08
forbids ("no clean valley' is reported, never manufactured").

Reproduced:
```
findValley([32 x4, 110 x50], low=20, high=100)  ->  valleyFound=true,  B=40
findValley([32 x4],          low=20, high=100)  ->  valleyFound=false, B=null
   (all 50 values at 110 lie strictly above high=100; removing them flips the verdict)

findValley([22 x50, 65 x4, 95 x50], low=30, high=100)
   histogram = [{edge:20,count:50}, {edge:40,0}, {edge:60,4}, {edge:80,50}, {edge:100,0}]
   -> the 50 values at 22 are BELOW low=30 yet supply the entire left-side mass
```

`deriveHiddenPauseBoundary` (line 1190) feeds `findValley` directly, and its result decides whether
`HIDDEN_PAUSE_MIN_METRES` is a measured valley edge or the midpoint fallback. On today's archive the
outcome happened to be `valleyFound: false` (so the shipped 116.95 is the midpoint), which is exactly
why this was not caught — the derivation is unsound regardless.

**Fix:** Clamp the binned population and the side maxima to the anchor interval:
```js
const inInterval = values.filter((v) => v >= lowMetres && v < highMetres);
const counts = edges.map((edge) => {
  const lo = Math.max(edge, lowMetres);
  const hi = Math.min(edge + binWidth, highMetres);
  return hi <= lo ? 0 : inInterval.filter((v) => v >= lo && v < hi).length;
});
```
Add a regression test asserting `findValley([32,32,32,32, 110,110,...], 20, 100).valleyFound === false`.

---

### CR-05: Both "import-time side effects" guards are vacuous — `vi.spyOn(fs, ...)` cannot observe a named-import call

**File:** `scripts/compute-unreliable-segment-recount.test.mjs:525-534`, `scripts/compute-unreliable-segment-calibration.test.mjs:1232-1247`

**Issue:** Both guards do `vi.spyOn(fs, 'readFileSync')` on the **default `fs` namespace object**, then
dynamic-import a module that consumes `fs` via **named imports**
(`import { readFileSync } from 'fs'` — `compute-unreliable-segment-recount.mjs:52`;
`import { readFileSync, readdirSync, writeFileSync } from 'fs'` —
`compute-unreliable-segment-calibration.mjs:43`). Node's ESM/CJS builtin interop binds those names at
resolution, so replacing the property on the namespace object never intercepts them.

Proven with a control probe run under this repo's own vitest config — a module that *does* read a file
at import time via a named import, dynamic-imported behind the identical spy + cache-bust pattern:
```
PROBE module DID read a file, content= "##\n# "   spy calls = 0
```
`expect(spy).not.toHaveBeenCalled()` therefore **cannot fail**, no matter what either script does at
import time. Both generators happen to be correctly guarded today, so this reads green while proving
nothing — the self-execution discipline these two tests exist to protect is unprotected.

**Fix:** Assert the observable effect rather than an uninterceptable call. Either spy on the module
namespace the target actually uses:
```js
import * as nodeFs from 'node:fs';
const spy = vi.spyOn(nodeFs, 'readFileSync');   // still unreliable for builtins — prefer the below
```
or — more robustly, and proof against the interop question entirely — import the module in a clean
child process with `fs` access instrumented, or assert on `process.argv[1]`-driven behaviour:
```js
const { stdout } = await execFileAsync(process.execPath, ['-e', `
  const fs = require('fs');
  const orig = fs.readFileSync; let calls = 0;
  fs.readFileSync = (...a) => { calls++; return orig(...a); };
  import('${scriptUrl}').then(() => console.log(calls));
`]);
expect(Number(stdout.trim())).toBe(0);
```
Whatever shape is chosen, add a **watched-failing** companion case (a synthetic module that *does*
read at import time) so the guard is demonstrated capable of failing — the same discipline
`pace-single-source.test.ts`'s planted blocks already apply.

---

### CR-06: A malformed Decision fixture span silently becomes a `NaN` window, making the D-05 negative control pass vacuously

**File:** `scripts/compute-unreliable-segment-calibration.mjs:734-758` (span split at `751-755`)

**Issue:** `parseDecisionText` is documented to *"Throw on a missing line rather than silently
defaulting: a malformed or absent Decision block must fail loudly, not derive constants against an
empty fixture set."* It enforces that for the three *lines*, but performs **no validation of the parsed
span values**:
```js
const [startSec, endSec] = span.split('-').map((s) => Number(s.trim()));
return { id, startSec, endSec };          // NaN accepted silently
```

The Decision block is hand-written markdown in `32-05-SUMMARY.md`, and this codebase uses en-dashes
and em-dashes pervasively in prose. One en-dash in a span is enough. Reproduced end-to-end:
```
fixtures: 7409028052:586–624          (EN-DASH, not hyphen)
  -> parsed  { id: '7409028052', startSec: NaN, endSec: undefined }
  -> mustSpareItems window { startSec: NaN, endSec: undefined }
  -> checkFeasibility row  { excess: null, spared: true, mechanism: 'speed limit' }
     ...against an activity carrying a deliberate 5 km burst inside the intended window.
```
A `NaN`/`undefined` window can never overlap anything, so `runExcessAt` returns `null`, the row renders
**"spared — speed limit"**, `checkFeasibility(...).pass` stays `true`, and `fixtureHeadroom` prints
*"not a candidate at L, spared by the speed limit alone"*. The entire D-05 negative-control gate — the
blocking-checkpoint artefact the constants' feasibility rests on — reports green while measuring
nothing.

**Fix:** Validate in the parser and fail loudly, consistent with its stated contract:
```js
.map((entry) => {
  const [id, span] = entry.split(':').map((s) => s.trim());
  if (!id || !span) {
    throw new Error(`32-05 Decision fixtures entry is malformed (expected "id:startSec-endSec"): ${JSON.stringify(entry)}`);
  }
  const [startSec, endSec] = span.split('-').map((s) => Number(s.trim()));
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || !(endSec > startSec)) {
    throw new Error(`32-05 Decision fixture "${entry}" has a non-numeric or inverted span — refusing to derive constants against an unmeasurable window.`);
  }
  return { id, startSec, endSec };
});
```
Separately, `checkFeasibility` should treat a must-spare row whose item resolves to no activity, or
whose window matches no sample, as a **failure** rather than as "spared" — a negative control that
cannot fire is not evidence.

## Warnings

### WR-01: The D-05 negative-control fixtures have no reachability assertion — the control can silently become vacuous

**File:** `src/analytics/unreliable-segments.test.ts:603-622`

**Issue:** The test asserts only `expect(overlapping).toEqual([])`. There is no assertion that the
detector produces *anything* on those two streams. If `detectUnreliableSegments` returned `[]` for an
unrelated reason (a malformed gap span triggers the whole-activity fail-closed `return []` at line
427; a stream failing `validateStreamSeries`; the throw paths in CR-02), the negative control would
pass while proving nothing. Measured today:
```
7409028052: samples=1794 gaps=7 segments=1     <-- ONE segment separates this control from vacuity
3647739864: samples=2406 gaps=1 segments=10
```
`7409028052` is one segment away from being a test that cannot fail. Neither id appears in any other
test, so nothing else pins their reachability.

**Fix:** Add an in-test reachability row before the extent assertion, mirroring the
`fastPairStartIndices.length` precedent at line 538:
```ts
expect(segments.length, `${id}: a negative control on a stream with zero segments is vacuous`).toBeGreaterThan(0);
// and independently derive that the locked window DOES contain fast pairs at the shipped limit,
// so "does not fire" is a real judgement rather than "nothing to judge":
let fastPairsInWindow = 0;
for (let i = 0; i < t.length - 1; i++) {
  if (t[i] >= startSec && t[i] <= endSec && d[i + 1] - d[i] > UNRELIABLE_SPEED_LIMIT_MPS * (t[i + 1] - t[i])) fastPairsInWindow++;
}
expect(fastPairsInWindow).toBeGreaterThan(0);
```

---

### WR-02: The detector's importer confinement is single-quote-only, and quote style is not machine-enforced in this repo

**File:** `src/analytics/pace-single-source.test.ts:349-356`

**Issue:**
```ts
const DETECTOR_IMPORTER_NEEDLES = ["unreliable-segments.js'", "unreliable-segments'"] as const;
```
Both needles require a closing **single quote**. A double-quoted specifier
(`import { detectUnreliableSegments } from "./unreliable-segments.js"`) or a backtick dynamic import
(``import(`./unreliable-segments.js`)``) evades the scan entirely. The docblock (lines 96-104)
explicitly claims this closes blind spot (2) — *"formatting-variant misses (CR-03) … from day one"* —
which is precisely the class this reopens.

There is **no `.prettierrc`, `prettier` package.json key, `.editorconfig` or eslint `quotes` rule** in
the repo, so quote style is convention, not a structural property the audit can lean on. The audit's
own stated purpose is to be structural, not formatting-dependent.

**Fix:** Match the module name independent of quoting:
```ts
const DETECTOR_IMPORTER_PATTERN = /unreliable-segments(\.js)?["'`]/;
// and in findUnreliableSegmentViolations, count regex matches rather than substrings:
const count = (stripped.match(new RegExp(DETECTOR_IMPORTER_PATTERN, 'g')) ?? []).length;
```
Extend planted test (2) (lines 644-659) with a double-quoted and a backtick variant so the widening
is demonstrated catching, not asserted.

---

### WR-03: The recount's zero-import guard is quote-sensitive and blind to transitive imports

**File:** `scripts/compute-unreliable-segment-recount.test.mjs:32, 64-79`

**Issue:** Two gaps in the D-15 discipline's only enforcement:
1. `expect(stripped).not.toContain("from '../dist/")` — single-quote only. `from "../dist/..."`
   passes clean.
2. `FORBIDDEN_MODULE_NAMES = ['unreliable-segments']` catches only a **direct** textual reference.
   `import { helper } from './lib/some-helper.mjs'` where that helper imports the detector is
   completely invisible. The recount imports nothing local today, so this is latent — but the guard
   is stated as the proof of "zero `import`/`require`/dynamic-`import()` statements naming
   `unreliable-segments` … **in any spelling**" (script docblock, lines 6-9), which it is not.

**Fix:** Use a quote-agnostic regex for the `../dist/` check, and close the transitive hole by
resolving the module graph rather than grepping text:
```js
// quote-agnostic
expect(stripped).not.toMatch(/from\s*["'`]\.\.\/dist\//);

// transitive: walk every local specifier the script imports, recursively
function localImportClosure(entryPath, seen = new Set()) { /* parse ./ and ../ specifiers, recurse */ }
for (const file of localImportClosure(SCRIPT_PATH)) {
  expect(stripComments(readFileSync(file, 'utf8'))).not.toContain('unreliable-segments');
}
```

---

### WR-04: `advanceSteps` silently discards positive metres across a zero-duration span

**File:** `src/analytics/unreliable-segments.ts:246-265`

**Issue:** The emit bar is `metres > 0 && seconds > 0`. When a run of samples shares a timestamp, the
`seconds > 0` half never clears, and if the stream ends (or a gap begins) before a differing timestamp
arrives, the accumulated **distance is dropped entirely**. The docblock (lines 227-228) justifies this
as *"clean non-advancing time never becomes a step"* — but distance that genuinely advanced is not
"clean non-advancing time". Reproduced:
```
t = [0, 5, 5, 5], d = [0, 10, 30, 50]
  steps = [{startIndex:0, endIndex:1, metres:10, seconds:5}]
  -> 40 metres of real advance (indices 1..3) vanish; segments = []
```
This compounds CR-01: the same duplicate-timestamp shape that breaks gap adjacency also silently
loses distance at the gap boundary.

**Fix:** At minimum, document this as a known loss and surface it (a counter on the return, or a
`droppedMetres` field) so a caller can tell "nothing happened" from "we discarded 40 m". If the intent
really is to never emit a zero-seconds step, fold the pending span **forward across the gap boundary
into the next advancing step** rather than discarding it, or emit it with the gap's own seconds.

---

### WR-05: The Suunto disclosure sentence hard-codes its "measured" figures while claiming they were measured

**File:** `scripts/compute-unreliable-segment-calibration.mjs:1814-1826`

**Issue:** The generated sentence asserts:
> *"the committed stream carries 18.0 m/s (36 m/2s, t=271-273) and 21.0 m/s (42 m/2s, t=273-275)"*
> … *"the numbers stated above are what this artifact actually measured."*

Every one of those figures is a **string literal**. `samples` is computed immediately above (lines
1795-1802) and carries exactly these values, but the sentence never reads it. They agree today —
verified against the committed stream:
```
136 t=273 d=998.0  dt=2 dd=36.0 v=18.00
137 t=275 d=1040.0 dt=2 dd=42.0 v=21.00
```
— but the artifact is machine-written and regenerated against a live archive. The moment the stream
changes, a generated file will make a false claim of measurement, silently.

**Fix:** Derive the figures from `samples`:
```js
const fastest = [...samples].filter((s) => s.impliedSpeed !== null)
  .sort((a, b) => b.impliedSpeed - a.impliedSpeed).slice(0, 2)
  .sort((a, b) => a.t - b.t);
const measured = fastest.map((s) => `${s.impliedSpeed.toFixed(1)} m/s (${s.dd.toFixed(0)} m/${s.dt} s, t=${s.t - s.dt}-${s.t})`).join(' and ');
```

---

### WR-06: A test assertion with no connection to the code under test, which can never fail

**File:** `src/analytics/unreliable-segments.test.ts:350-356`

**Issue:**
```ts
it('each individual 1s pair of the diluted slew is itself under 10.44 m/s (context, not a rule)', () => {
  const perPairSpeedMps = 9;
  expect(perPairSpeedMps).toBeLessThan(10.44);
});
```
Both operands are literals declared in the test body. Nothing in `unreliable-segments.ts` is executed.
This asserts `9 < 10.44` and can never fail, yet it reports as a passing test of the detector.
The `10.44` is also a duplicated magic number — `WORLD_RECORD_100M_SPEED_MPS` is exported from
`best-effort-utils.ts` precisely so this literal is not re-declared (see that constant's docblock,
which names this exact anti-pattern).

**Fix:** Either delete it (the comment on lines 351-353 already carries the explanatory value), or make
it exercise the real relationship:
```ts
import { WORLD_RECORD_100M_SPEED_MPS } from './best-effort-utils.js';
// the slew fires at run level even though NO single pair crosses the physical ceiling
const t = [0, 1, 2, 3, 4, 5], d = [0, 9, 18, 27, 36, 45];
for (let i = 0; i < t.length - 1; i++) {
  expect((d[i + 1] - d[i]) / (t[i + 1] - t[i])).toBeLessThan(WORLD_RECORD_100M_SPEED_MPS);
}
expect(detectUnreliableSegments(t, d, [], { speedLimitMps: 6, excessFloorMetres: 5, hiddenPauseMinMetres: 1000 })).toHaveLength(1);
```

---

### WR-07: `namedItemSegmentMetres` takes the first overlapping segment and never detects an ambiguous overlap

**File:** `scripts/compute-unreliable-segment-calibration.mjs:1131-1144`

**Issue:** The function returns the metres of whichever segment **first** satisfies a loose overlap test
(`segment.startSec <= window.endSec && segment.endSec >= window.startSec`) — and segments are ordered
by `startIndex`, so it is the earliest, not the tightest or the containing one. Multiple overlaps are
never detected or reported.

This matters because `deriveHiddenPauseBoundary` (lines 1170-1174) builds the **anchor interval** from
these values, and the anchor interval's midpoint is the shipped `HIDDEN_PAUSE_MIN_METRES = 116.95`.
`runExcessAt`'s own docblock (lines 176-178) goes out of its way to warn about exactly this hazard —
*"at a low speed limit a segment can chain far beyond one named window (D-07 chaining), and scoring by
the segment's own (much larger) metres … would attribute a distant burst's excess to this item"* — and
then the sibling function does the segment-scoped thing anyway, with no ambiguity guard.

**Fix:** Prefer the segment that *contains* the window, and surface ambiguity instead of hiding it:
```js
const overlaps = segments.filter((s) => s.startSec <= item.window.endSec && s.endSec >= item.window.startSec);
if (overlaps.length === 0) return null;
const containing = overlaps.filter((s) => s.startSec <= item.window.startSec && s.endSec >= item.window.endSec);
const chosen = containing.length > 0 ? containing[0] : overlaps[0];
return { metres: chosen.metres, overlapCount: overlaps.length };  // render overlapCount > 1 in the artifact
```

---

### WR-08: Unvalidated CSV-supplied path joined onto the export root, and a cwd-relative export root

**File:** `scripts/validate-unreliable-segments-1hz.mjs:274, 505-510`

**Issue:** Two problems in the same area:
1. `const fitPath = join(exportRoot, csvFile);` — `csvFile` comes straight from the `Filename` column
   of `activities.csv` with no validation (`loadCsvFilenameMap`, lines 112-118 accepts any non-empty
   string). `join` normalises `..` segments, so a `Filename` value of
   `../../../../etc/passwd.fit.gz` resolves outside `export_data/`. This is a local-only dev script
   reading a file the developer downloaded, so the practical risk is low — but it is an unguarded
   path join on file-supplied data, and the file is a third-party export.
2. `const exportRoot = process.env.UNRELIABLE_1HZ_EXPORT_ROOT ?? 'export_data/strava';` is
   **cwd-relative**, while `STREAMS_DIR`, `ACTIVITIES_DIR` and `OUTPUT_PATH` are all `ROOT_DIR`-joined
   absolutes (lines 70-76). Run from any subdirectory, `existsSync(exportRoot)` fails and the script
   prints *"Nothing to validate"* and exits 0 — a graceful-absence path masquerading as a real
   absence. `npm run` happens to set cwd to the package root, so this reads correct today.

**Fix:**
```js
const exportRoot = process.env.UNRELIABLE_1HZ_EXPORT_ROOT
  ? resolve(process.env.UNRELIABLE_1HZ_EXPORT_ROOT)
  : join(ROOT_DIR, 'export_data/strava');

// and confine the CSV-supplied path:
const fitPath = resolve(exportRoot, csvFile);
if (!fitPath.startsWith(resolve(exportRoot) + sep)) {
  return { id, skipped: `Filename escapes the export root (${csvFile})` };
}
```

---

### WR-09: `insensitivityCheck` coerces a `null` derived value into a fabricated 100% delta

**File:** `scripts/compute-unreliable-segment-calibration.mjs:700-702`

**Issue:** Every `deriveFn` in this file can return `null` on an empty population
(`statisticSA` line 530, `excessFloorDeriveFn` line 1275, `strawmanTailPercentile` line 609,
`speedLimitMultiplierAt` line 840). When `removed` is `null`:
```js
Math.abs(removed - base) / Math.abs(base)   // null - base  ===  -base   =>   delta exactly 1.0
```
The artifact then renders `removedDelta 100.00%` as if it were a measurement, when the truth is
"the statistic was not computable after removal". `base === null` is explicitly special-cased on the
same line; `removed`/`planted` are not.

It fails safe (the check fails rather than passes), but it prints a manufactured number into a
committed artifact of record — the same class of problem `measureDecimationOverlap`'s docblock
(lines 1615-1617) takes care to avoid for its own `ratio`.

**Fix:**
```js
const notComputable = base === null || base === 0 || removed === null || planted === null;
const removedDelta = notComputable ? null : Math.abs(removed - base) / Math.abs(base);
const plantedDelta = notComputable ? null : Math.abs(planted - base) / Math.abs(base);
```
`pass` already requires both deltas non-null, so the failure behaviour is unchanged — only the
rendered number becomes honest (`—` instead of `100.00%`).

---

### WR-10: A test assertion pinned to a hard-coded literal inside the generator it is testing

**File:** `scripts/compute-unreliable-segment-calibration.test.mjs:1157`

**Issue:** `expect(result.sentence).toContain('17 m/s')` — `'17 m/s'` is a fixed substring of the
template at `compute-unreliable-segment-calibration.mjs:1823-1824`. The fixture stream built for this
test (`t = [0, 253, 263, 293, ...]`) contains nothing at 17 m/s. The assertion holds for every possible
input and cannot fail; it tests string concatenation, not the disclosure.

Note this couples the test to WR-05: once the hard-coded figures are derived from `samples`, this
assertion must change too.

**Fix:** Assert the derived, input-dependent parts instead — the test already does this correctly at
lines 1150-1155 (`samples`, `overlapping`, `secondSpanSegments`). Drop the literal-substring check, or
replace it with one that varies with the fixture, e.g.
`expect(result.sentence).toContain('20.0 m/s')` against the fixture's actual 20 m/s pairs.

---

### WR-11: `deriveReachabilityGrid` hangs on a non-positive `step`

**File:** `scripts/compute-unreliable-segment-calibration.mjs:268, 282-292`

**Issue:** `step` is an exported, caller-configurable option with no validation:
```js
while (L <= maxScanMps + 1e-9) { ... L = Math.round((L + step) * 100) / 100; }
```
With `step === 0` (or negative), `L` never advances and the loop never terminates — an infinite loop
that also calls `runExcessAt` (a full detector run over every must-flag item) on every iteration. The
default `0.05` is safe, and `buildCalibrationReport` uses the default, so this is reachable only via a
direct call — but the function is exported and unit-tested from outside.

**Fix:**
```js
export function deriveReachabilityGrid(archive, mustFlagItems, { step = 0.05, maxScanMps = 40 } = {}) {
  if (!Number.isFinite(step) || step <= 0) {
    throw new Error(`deriveReachabilityGrid: step must be a finite positive number, got ${step}`);
  }
  ...
```

---

### WR-12: The recount rejects `excessFloorMetres: 0`, which the detector accepts — a silent divergence in the D-15 gate

**File:** `scripts/compute-unreliable-segment-recount.mjs:272-281`

**Issue:** `recountGapFirst` requires `excessFloorMetres > 0`:
```js
if (typeof excessFloorMetres !== 'number' || !Number.isFinite(excessFloorMetres) || excessFloorMetres <= 0) {
```
The detector's own `paramsAreValid` (`unreliable-segments.ts:385`) accepts `excessFloorMetres >= 0`,
and the calibration script uses `PROBE_EXCESS_FLOOR_METRES = 0` throughout (line 75) as its standard
probe. If `deriveExcessFloor` ever floors to `0.0` (it returns `0` for an empty pooled population at
line 1011, and `Math.floor(raw * 10) / 10` reaches 0 for any raw below 0.1), the artifact renders
`0.0`, `parseCalibrationArtifact` parses `0`, and the D-15 gate dies with
*"FAILED: recount could not run: excessFloorMetres must be a finite positive number"* — a confusing
message for what is actually a legitimate constant value the detector supports.

**Fix:** Align the recount's guard with the detector's documented range and keep the rejection for
genuinely invalid values:
```js
if (typeof excessFloorMetres !== 'number' || !Number.isFinite(excessFloorMetres) || excessFloorMetres < 0) {
  return { ok: false, reason: `excessFloorMetres must be a finite non-negative number, got ${JSON.stringify(excessFloorMetres)}` };
}
```
and update `compute-unreliable-segment-recount.test.mjs:279-283` accordingly (it currently pins the
`-5`/`NaN`/missing cases, so only the `0` boundary needs changing).

---

### WR-13: The SEG-05a describe block re-walks the whole tree and discards the walk's `failures`

**File:** `src/analytics/pace-single-source.test.ts:588`

**Issue:**
```ts
describe('SEG-05a — single-source audit extended to the unreliable-segment detector', () => {
  const { files } = readSourceTree(SRC_ROOT);
```
`failures` is destructured away. `readSourceTree`'s docblock (lines 190-192) states the fail-closed
rationale explicitly: *"an unreadable directory or file must not silently pass the audit by being
invisible to it."* The first describe block (line 436) asserts `failures` is empty; this one does not.
If the two walks ever diverge (a permissions change, a file removed mid-run), the SEG-05a checks would
scan a silently truncated tree and pass. It is also a second full recursive read of `src/` per run.

**Fix:** Hoist one walk to module scope and assert `failures` once, then share `files`:
```ts
const TREE = readSourceTree(SRC_ROOT);
// in both describe blocks:
expect(TREE.failures, `unreadable paths: ${JSON.stringify(TREE.failures)}`).toEqual([]);
```

---

### WR-14: `parseDecisionText` throws a bare `TypeError` for a fixtures entry with no colon

**File:** `scripts/compute-unreliable-segment-calibration.mjs:751-755`

**Issue:** `const [id, span] = entry.split(':')...` leaves `span` `undefined` for an entry like
`fixtures: 7409028052`, and the next line calls `span.split('-')`:
```
TypeError: Cannot read properties of undefined (reading 'split')
```
The function throws a named, actionable `Error` for a missing Decision *line* (lines 738-743) but an
opaque `TypeError` for a malformed *entry*. A developer hitting this sees a stack trace, not the
"your Decision block is malformed" message the surrounding design intends.

**Fix:** Covered by the CR-06 fix above — validate `id` and `span` and throw a named `Error`.

## Info

### IN-01: `deriveExcessFloor`'s `_L` parameter is dead

**File:** `scripts/compute-unreliable-segment-calibration.mjs:1009`
**Issue:** `_L` is never read. The docblock (lines 987-990) explains the signature is kept "only so
callers and the STOP-condition ordering … read the same way for all three constants" — a legitimate
rationale, but the parameter still invites a reader to believe the floor depends on `L`.
**Fix:** Keep it if the symmetry is load-bearing, but consider a runtime assertion documenting the
independence: `void _L; // intentionally unused — F's rule takes the archive alone (D-10(e))`.

---

### IN-02: `findGridRowForL` returns the nearest row with no distance bound

**File:** `scripts/compute-unreliable-segment-calibration.mjs:1313-1320`
**Issue:** When a candidate statistic's value falls outside the scanned grid, the nearest row can be
arbitrarily far away, and its `feasibleFloor` is then reported as if it were that candidate's own
feasibility. Benign on today's archive (grid `[1.1, 10]`, S-B at 8.157 → nearest row 8.15), but
nothing enforces it.
**Fix:** Return `null` when `Math.abs(closest.L - value) > step`, and render `—` for that candidate.

---

### IN-03: `buildArchiveFromBursts` is copy-pasted three times in the calibration test

**File:** `scripts/compute-unreliable-segment-calibration.test.mjs:391-412, 714-735, 1079-1100`
**Issue:** Three byte-identical 22-line copies of the same helper, each with its own copy of the
explanatory comment. Two of the three call sites pass a bare `L` as the second options argument
(lines 424, 435, 439) where the signature expects `{ padSpeed }` — harmless because `padSpeed`
defaults, but it silently ignores what the caller appears to be configuring.
**Fix:** Hoist one copy to module scope, and drop the stray `L` arguments at lines 424/435/439.

---

### IN-04: `console.log` inside a test body

**File:** `src/analytics/pace-single-source.test.ts:431-432`
**Issue:** An `eslint-disable`d `console.log` prints the scanned file count on every `npm test` run.
The count is already interpolated into the test *title* on line 430, which vitest displays.
**Fix:** Drop the `console.log` and its disable comment; the title already carries the evidence.

---

### IN-05: Report writes omit a trailing newline

**File:** `scripts/validate-unreliable-segments-1hz.mjs:523`, `scripts/compute-unreliable-segment-calibration.mjs:2902`
**Issue:** `writeFileSync(OUTPUT_PATH, report)` / `writeFileSync(OUTPUT_PATH, markdown, 'utf8')` —
neither ends with `\n`, unlike `compute-stream-checksums.mjs:140,156` which correctly appends one.
Produces a "\ No newline at end of file" marker in every diff of these committed artifacts.
**Fix:** `writeFileSync(OUTPUT_PATH, report + '\n')`. Note this changes the artifacts' bytes once, so
regenerate and commit in the same change to keep the idempotence proof intact.

---

_Reviewed: 2026-09-20T13:00:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
