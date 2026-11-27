---
phase: 35-stream-derived-running-pace
reviewed: 2026-09-28T08:55:53Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - scripts/compute-running-pace-dispute-calibration.mjs
  - scripts/compute-running-pace-dispute-calibration.test.mjs
  - scripts/compute-running-pace-recount-crosscheck.test.mjs
  - scripts/compute-running-pace-recount.mjs
  - scripts/compute-running-pace-recount.test.mjs
  - scripts/unreliable-segment-import-guards.test.mjs
  - scripts/verify-dashboard-publish.mjs
  - src/analytics/best-effort-utils.test.ts
  - src/analytics/best-effort-utils.ts
  - src/analytics/compute-dashboard-index.test.ts
  - src/analytics/compute-dashboard-index.ts
  - src/analytics/dashboard-index.types.ts
  - src/analytics/pace-derivation.test.ts
  - src/analytics/pace-derivation.ts
  - src/analytics/pace-quality.test.ts
  - src/analytics/pace-single-source.test.ts
  - src/dashboard/styles.css
  - src/dashboard/styles.test.ts
  - src/dashboard/views/detail-sections.test.ts
  - src/dashboard/views/detail-sections.ts
  - src/dashboard/views/detail.ts
  - src/dashboard/views/list.test.ts
  - src/dashboard/views/list.ts
  - src/analytics/gear-aggregate-logic.test.ts
  - src/dashboard/data/index-client.test.ts
  - src/dashboard/views/calendar-logic.test.ts
  - src/dashboard/views/list-logic.test.ts
  - src/dashboard/views/overview.test.ts
  - src/dashboard/views/trends-cadence-hr-logic.test.ts
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-09-28T08:55:53Z
**Depth:** standard
**Files Reviewed:** 29 (23 primary + 6 incidental fixture-default files spot-checked)
**Status:** issues_found

## Summary

This phase retargets the "Pace disputed" comparator onto a new gap-/pause-/unreliable-excluded
stream-derived running pace (`deriveRunningPace`/`detectPaceDisagreement` in
`pace-derivation.ts`), deletes the retired span-based rule and its 200 sec/km read gate, folds the
stream read into a single unconditional read per activity, ships an additive, REQUIRED
`runningPace` row field, and adds a fourth "Running Pace" detail-view stat tile.

The implementation is unusually disciplined: every exported arithmetic function is total (no
throws on malformed/adversarial input), the single-source-of-truth guard
(`pace-single-source.test.ts`) correctly extends its banned-literal list to the new
`coveredSec / (coveredM / 1000)` formula, the view layer (`detail.ts`, `detail-sections.ts`,
`list.ts`) consumes precomputed row fields rather than recomputing pace arithmetic, the retired
`streamPaceSecPerKm`/`PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM`/`PACE_DISAGREEMENT_RATIO`
identifiers are confirmed fully deleted from `src/`, the read-gate/duplicate-read deletion left
exactly one `readJson<CanonicalStream>` call site, and the new `fs`-wrapping import-time guard
(`unreliable-segment-import-guards.test.mjs`) correctly replaces the vacuous `vi.spyOn(fs, ...)`
pattern that cannot observe a named `import { readFileSync } from 'fs'`. The disclosed
sub-picometre-negative-`excludedM` artifact (7 archive activities) was traced through
`detectPaceDisagreement`'s `excludedM > 0` gate and `deriveRunningPace`'s totality branches; no
other instance of that floating-point class was found, and no other reachable input produces a
misleading "stream failed validateStreamSeries" not-computable reason on a stream that actually
passed validation (traced via `classifyPairKinds`/`accumulateCoverage`/`advanceSteps`, which
filters `seconds > 0` before a step can ever be flagged `unreliable`, closing the zero-duration
edge case that would otherwise reach that branch).

Two warnings were found, both message/coverage-accuracy defects rather than crashes or data-loss
risks — see below.

## Warnings

### WR-01: `runningPace.notComputableReason` reads "no stream committed for this activity" even when a stream genuinely was committed but failed to read or parse

**File:** `src/analytics/compute-dashboard-index.ts:250-263`, `src/analytics/pace-derivation.ts:698-707`

**Issue:** `compute-dashboard-index.ts` only ever calls `deriveRunningPace(streamForQuality)` from
inside the `entry.available` branch — the row's `runningPace` field is built as
`entry.available ? { ... } : null` (line 346), so `null` (the "no stream at all" state) is never
routed through `deriveRunningPace` at all. Consequently, the ONLY way
`deriveRunningPace`'s "no stream committed for this activity" branch (line 702-707) can appear in
the *published* `runningPace.notComputableReason` field is when `entry.available === true` and
either (a) the `try`/`catch` at line 253-263 caught a read/parse error and passed `null` through,
or (b) the read succeeded but produced a value whose `t`/`d` are not arrays (e.g. a malformed but
present JSON document). In both cases the manifest says a stream genuinely IS committed for this
activity — the reason string is factually wrong for every occurrence that can actually reach this
field. This is exactly the class of defect this codebase otherwise polices very strictly
(T-26-02, restated throughout `pace-derivation.ts`'s own docblocks: "never a fabricated/misleading
value"). `pace-quality.ts`'s pre-existing reuse of the same string for `quality.notComputableReason`
has the identical defect, but phase 35 is what newly surfaces this exact reason text to the user
via the new Running Pace tile (`runningPaceTilePlan` → `Not computable — no stream committed for
this activity`, `detail-sections.ts:876-907`), and no test in `compute-dashboard-index.test.ts`
asserts `row.runningPace.notComputableReason` for the existing "malformed stream JSON" test case
(`compute-dashboard-index.test.ts:1179-1202` only asserts `row.quality.notComputableReason`), so
this specific inaccuracy for the new field is unexercised.

**Reproduction:** Any manifest entry with `available: true` whose `data/streams/{id}.json` file
exists but fails `JSON.parse` (or fails to fetch) at compute time. `computeDashboardIndex` logs
`could not read stream (...); quality and running pace will be not-computable` and still writes a
`runningPace` object whose `notComputableReason` claims no stream was ever committed.

**Fix:** Distinguish "read/parse failed" from "no stream at all" with a dedicated reason, e.g.:
```ts
// pace-derivation.ts
export const NOT_COMPUTABLE_STREAM_READ_FAILED =
  'stream is committed but could not be read or parsed';
```
and in `compute-dashboard-index.ts`, construct the not-computable `RunningPaceRow` directly at the
catch site (or pass a `{ readFailed: boolean }` flag into `deriveRunningPace`) rather than routing
a read failure through the same `deriveRunningPace(null)` path used for a stream-less activity.

### WR-02: `verify-dashboard-publish.mjs`'s `runningPace` shape check never validates `excludedM`/`excludedSec`'s type, finiteness, or sign

**File:** `scripts/verify-dashboard-publish.mjs:375-395`

**Issue:** `malformedRunningPaceRow`'s predicate checks that all five `RUNNING_PACE_SUB_KEYS` are
present (`key in rp`) and cross-checks `computable`/`notComputableReason`/`runningPaceSecPerKm`
for internal consistency, but never inspects `excludedM` or `excludedSec` at all beyond their key
existing. A row shaped `{ runningPaceSecPerKm: 300, excludedM: "banana", excludedSec: -999,
computable: true, notComputableReason: null }` passes this check cleanly — `rp.computable === true`
branch only tests `notComputableReason`/`runningPaceSecPerKm`. This is the exact "verifier reports
all-green against a broken build because its own checks normalized the defect away" failure class
this same file's docblock explicitly calls out (line 300-304, citing STATE.md's 2026-08-11 lesson)
for the `quality` block, but the parallel discipline was not carried into the new `runningPace`
block. The SUMMARY's two demonstrated-failing injections (a deleted key, and a
`computable`/`notComputableReason` mismatch) do not cover a corrupted numeric sub-field, so the
"proven able to fail" claim does not extend to this dimension.

**Fix:** Extend the malformed predicate, e.g.:
```js
if (rp.computable === true) {
  return (
    rp.notComputableReason !== null ||
    typeof rp.runningPaceSecPerKm !== 'number' ||
    !(rp.runningPaceSecPerKm > 0) ||
    !Number.isFinite(rp.excludedM) ||
    !Number.isFinite(rp.excludedSec) ||
    rp.excludedM < 0 ||
    rp.excludedSec < 0
  );
}
```
(with an explicit, commented allowance if the disclosed sub-picometre-negative `excludedM` archive
activities are expected to still publish a tiny negative value).

---

_Reviewed: 2026-09-28T08:55:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
