---
phase: 32-unreliable-segment-detection-calibration
reviewed: 2026-09-20T22:45:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/analytics/unreliable-segments.ts
  - src/analytics/unreliable-segments.test.ts
  - src/analytics/pace-single-source.test.ts
  - scripts/compute-unreliable-segment-calibration.mjs
  - scripts/compute-unreliable-segment-calibration.test.mjs
  - scripts/compute-unreliable-segment-recount.test.mjs
  - scripts/unreliable-segment-import-guards.test.mjs
  - scripts/lib/import-time-read-probe-named.mjs
  - scripts/lib/import-time-read-probe-default.mjs
  - scripts/validate-unreliable-segments-1hz.mjs
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 32: Code Review Report (Round 2 — Gap-Closure Re-Review)

**Reviewed:** 2026-09-20T22:45:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This is a re-review of the gap-closure wave (plans 32-10 through 32-16) against the three
2026-09-20 verifier-scored gaps and the round-1 review (`32-REVIEW-round1.md`, CR-01..CR-06).

**All three verifier-scored gaps are genuinely closed, and closed well:**

- **GAP 1 (total-function contract)** — `gapListIsWellShaped`, the `Array.isArray(t)/Array.isArray(d)`
  guards, and the `paramsAreValid`/`mapGapToIndices` null checks in `unreliable-segments.ts` correctly
  intercept every one of the five verifier-reproduced throw inputs before they reach a dereference.
  Confirmed directly: all five inputs return a fresh `[]` on the current `dist/` build.
- **GAP 2 (vacuous fs-spy guards)** — the replacement `vi.mock('fs')`/`vi.mock('node:fs')` recorder in
  `scripts/unreliable-segment-import-guards.test.mjs` is a real fix, not a relabelled vacuity. `vi.mock`
  substitutes the module in the resolution graph (unlike the old `vi.spyOn` property replacement on an
  already-bound namespace), so it observes reads through **both** the named-import and default-import
  idioms. Independently re-ran the suite and the watched-failing direction (temporarily pointing the
  recount guard's assertion at the reading probe) — both directions hold as claimed.
- **GAP 3 (mapGapToIndices/isGapPair boundary convention)** — `mapGapToIndices` now picks the FIRST
  index at `startSec` and the LAST index at `endSec`, matching `isGapPair`'s own inclusive bounds.
  Both verifier fixtures (single duplicate-timestamp gap) now classify `gap-adjacent` consistently.

CR-04 (`findValley` manufacturing a valley from out-of-interval mass), CR-06 (`parseDecisionText`
accepting a silent-NaN span), and WR-07 (`namedItemSegmentMetres` silently tie-breaking an ambiguous
overlap) are also genuinely fixed, each with a real both-directions reachability proof matching this
phase's own discipline.

**However, the GAP 3 fix itself introduces a new, unguarded correctness defect** that was not covered
by any of this round's new tests (all of which exercise exactly one `GapSpan` per fixture): when
**two externally-supplied, adjacent** gap spans share a boundary value that is a **duplicate timestamp**
in `t`, the widened `[FIRST-at-start, LAST-at-end]` index ranges the fix computes for each gap
independently **overlap**, and the chain-building loop emits two segments that both include the
overlapping index range — double-counting real distance. This is exactly the same "boundary
convention" defect class the phase has now hit three times (round-1 CR-01, gap #3, and this), just one
combinatorial step further than what 32-13's own regression block tests. Reproduced below against the
live `dist/` build. This is the headline finding of this round.

A secondary, narrower residual of CR-03 remains: `buildActivityFinding` still throws (rather than
returning a skipped finding) if the committed `data/activities/{id}.json` parses to `null` — the fix
only closed the read/parse/shape paths the verifier reproduced against the *stream* file, not the
adjacent, structurally identical dereference against the *activity* doc three lines later in the same
function. Local-only script, same lower-blast-radius profile round 1 assigned CR-03.

## Critical Issues

### CR-01: `mapGapToIndices`'s duplicate-timestamp widening fix creates overlapping gap blocks — and double-counted distance — when two adjacent externally-supplied gap spans share a duplicated boundary sample

**File:** `src/analytics/unreliable-segments.ts:396-425` (`mapGapToIndices`), interacting with the
chain-building loop at `520-527` and `isGapPair` at `207-214`

**Issue:** 32-13's fix (closing 32-VERIFICATION.md gap #3) makes `mapGapToIndices` return
`gi = FIRST index at span.startSec`, `gj = LAST index at span.endSec` — correct and sufficient for a
**single** gap span considered in isolation, and proven so by the new `D-06/D-07 gap boundary
convention` describe block. That block's four fixtures, and its own "conservation holds for every
fixture" sweep (`unreliable-segments.test.ts:722-745`), all pass exactly **one** `GapSpan` to
`detectUnreliableSegments`. None of them exercises **two** gap spans that are themselves adjacent
(`gapA.endSec === gapB.startSec`) at a sample where `t` carries a duplicate value.

When that combination occurs, the FIRST-at-start search for the second gap and the LAST-at-end search
for the first gap resolve to **different indices** (the first duplicate occurrence vs. the last), so
the two gaps' mapped index ranges **overlap**. The chain-building loop (`blocks[j+1].startIndex ===
blocks[j].endIndex`) does not merge overlapping-but-not-equal ranges, so the two gaps end up in
**separate segments**, each of which independently spans through the shared, duplicated-timestamp
interval — and that interval's own real (non-zero) distance/time is counted in **both** segments'
`metres`/`seconds` totals.

This falsifies the module's own documented invariant that a segment is "a **maximal contiguous chain**"
(`unreliable-segments.ts:175`) and the phase goal's explicit requirement of "segments that **conserve**
real distance/time" — two returned segments together now claim more distance than the stream actually
covers.

This input shape is not contrived: `classifyGaps` (`pace-derivation.ts:242-256`, the function this
module's own docblock says `gaps` is "typically" populated from) emits **exactly** this
back-to-back-with-shared-boundary shape whenever a `recording-gap` run is immediately followed by a
different-kind (`pause`) run with no covered sample between them — the shared boundary is `t[i]` at
the exact transition sample. Combined with a duplicate timestamp at that sample (72 of 1,874 committed
streams already carry duplicate timestamps per round-1's CR-01 finding), this is a realistic future
input once Phase 33 wires `classifyGaps`'s output directly into this detector, as this module's own
docblock (lines 10-16) says is the intended integration.

Reproduced directly against the compiled `dist/analytics/unreliable-segments.js`:

```js
const t = [0, 1, 5, 5, 10, 11];
const d = [0, 20, 25, 45, 50, 140];               // duplicate sample at t=5 advances 20 m over 0 s
const gaps = [{ startSec: 1, endSec: 5 }, { startSec: 5, endSec: 10 }];   // adjacent, shared boundary t=5

detectUnreliableSegments(t, d, gaps, { speedLimitMps: 7.35, excessFloorMetres: 3, hiddenPauseMinMetres: 1e9 });
// -> segment 1: startIndex 0, endIndex 3, metres 45   (covers indices [0,3])
// -> segment 2: startIndex 2, endIndex 5, metres 115  (covers indices [2,5], OVERLAPS segment 1 at [2,3])
//
// stream's actual total distance:            d[5] - d[0] = 140
// sum of the two segments' own metres:        45 + 115   = 160   <- 20 m double-counted
```

Both segments individually pass their own internal conservation check
(`metres === burstMetres + gapMetres`, the exact assertion 32-13's "conservation holds" sweep makes)
— this is precisely the class of defect the phase's own conventions warn about: two internally
self-consistent computations that are jointly wrong. The bug is invisible to any test that only
checks one segment's own arithmetic, or that only ever supplies one gap per fixture.

**Fix:** Detect and merge/reject overlapping mapped gap blocks before chaining, e.g. sort the mapped
gap blocks by `startIndex` and fail closed (return `[]`, consistent with this module's own "malformed
gap span" fail-closed discipline) or merge on any `gapBlocks[k].startIndex < gapBlocks[k-1].endIndex`:

```ts
const sortedGapBlocks = [...gapBlocks].sort((a, b) => a.startIndex - b.startIndex);
for (let k = 1; k < sortedGapBlocks.length; k++) {
  if (sortedGapBlocks[k].startIndex < sortedGapBlocks[k - 1].endIndex) {
    // Two caller-supplied gaps map to overlapping index ranges — a duplicate timestamp sits
    // exactly on their shared boundary. Fail closed rather than double-count distance.
    return [];
  }
}
```
Add the reproduced fixture above (two adjacent gaps sharing a duplicated boundary sample) as a
permanent regression case in the `D-06/D-07 gap boundary convention` describe block — the existing
block's fixtures are all single-gap and cannot catch this.

## Warnings

### WR-01: `buildActivityFinding`'s "never throws" contract still has one unguarded dereference, immediately adjacent to the field CR-03 fixed

**File:** `scripts/validate-unreliable-segments-1hz.mjs:305-311`

**Issue:** 32-15 closed CR-03 by wrapping the committed-stream (`data/streams/{id}.json`) read in
try/catch and adding an `Array.isArray(t) && Array.isArray(d)` guard. Three lines later, the same
function reads and dereferences the committed **activity** doc the same way, but without an equivalent
shape guard on the parsed result:

```js
let activityDoc;
try {
  activityDoc = JSON.parse(readFileSync(join(activitiesDir, `${id}.json`), 'utf8'));
} catch {
  return { id, skipped: 'data/activities/{id}.json missing or unreadable' };
}
const startEpoch = Math.floor(Date.parse(activityDoc.start_date) / 1000);   // throws if activityDoc is null
```

If `data/activities/{id}.json` parses successfully to the JSON value `null` (a corrupted or
truncated-but-still-valid-JSON file), `activityDoc.start_date` throws `TypeError: Cannot read
properties of null (reading 'start_date')`, uncaught — the exact same class of defect CR-03 was meant
to close for the sibling stream read, in the same function, still present. `main()`'s per-activity
loop (`validate-unreliable-segments-1hz.mjs:527-533`) has no try/catch around the
`await buildActivityFinding(...)` call, so this still aborts the whole run and writes no report,
exactly CR-03's original failure mode.

Confirmed reachable:
```
$ node -e "const activityDoc = null; Date.parse(activityDoc.start_date)"
TypeError: Cannot read properties of null (reading 'start_date')
```

Same lower-blast-radius profile as CR-03 was assigned in `32-VERIFICATION.md` (local-only script, not
wired into CI/`npm test`), so this is a Warning rather than a Blocker, but the module's own docblock
(`validate-unreliable-segments-1hz.mjs:262-268`) still claims "never throws" and this is not quite
true.

**Fix:**
```js
const startEpoch = Number.isFinite(Math.floor(Date.parse(activityDoc?.start_date) / 1000))
  ? Math.floor(Date.parse(activityDoc.start_date) / 1000)
  : null;
if (startEpoch === null) {
  return { id, skipped: 'activity doc start_date unparseable' };
}
```
or simply guard `typeof activityDoc !== 'object' || activityDoc === null` before the `Date.parse` call.

## Info

### IN-01: The replacement fs import-time guard only observes three named functions — a future fs call outside that set would silently evade it again

**File:** `scripts/unreliable-segment-import-guards.test.mjs:41-59`

**Issue:** `wrapFsModule` records calls to `readFileSync`, `readdirSync`, and `writeFileSync` only —
exactly the three functions the two production scripts currently import. This is not vacuous today
(verified: both production scripts import only these three names), but the guard's own describe-block
titles claim a broader property ("performs no disk read... at import"), and a future edit to either
generator that adds, say, `existsSync` or `statSync` at import time would not be recorded by this
mechanism and would pass silently — the same shape of gap this whole plan exists to close, just moved
one function-name away. Low severity since it requires a future code change to manifest, and the
mechanism itself (unlike the old `vi.spyOn`) is capable of being extended trivially.

**Fix:** Wrap every function `wrapFsModule` re-exports from `actual` generically (`for (const key of
Object.keys(actual)) { if (typeof actual[key] === 'function') wrapped[key] = (...args) => {
record(key, args[0]); return actual[key](...args); }; }`) so the guard covers the whole `fs` surface
rather than an enumerated subset that must be kept in sync with the two scripts' import lists by hand.

---

_Reviewed: 2026-09-20T22:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
