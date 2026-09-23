---
created: 2026-09-23T12:00:00.000Z
title: PAUSE-03 remeasurement and recount generators — fabricated zeros, duplicated anchor id, a throwing "never throws"
area: scripts
files:
  - scripts/compute-pause-transport-remeasurement.mjs
  - scripts/compute-pause-classification-recount.mjs
  - scripts/compute-pause-classification-calibration.mjs
---

## Problem

Four findings from the Phase 34 code review (`34-REVIEW.md`, 2026-09-23), deferred together by
plan 34-16 because they live in the same two generators, none is reachable on the current archive,
and fixing them in one pass regenerates the figure-of-record artifact once instead of four times.

**WR-06 — `metres: 0` substituted for an unresolvable gap boundary.**
`compute-pause-transport-remeasurement.mjs:117-124` (`:122`):

```js
const metres = startIdx !== undefined && endIdx !== undefined ? d[endIdx] - d[startIdx] : 0;
```

A gap boundary absent from the `t`-to-index map becomes a measured `0 m` advance rather than an
excluded or violation-counted interval. `v22Qualifies` then tests `metres > 100` against a
fabricated zero, so the interval silently fails the old rule. The error direction is **systematic**:
it can only understate `oldRuleActivities` / `oldQualifyingIntervalCount`, i.e. it can only inflate
the "newly caught" delta that `34-PAUSE03-REMEASUREMENT.md` exists to measure. `withKmh` (`:81-83`)
has the same shape — a zero-duration interval reports `0 km/h` as a measurement.

Fix: carry the unresolvable interval as an explicit null, count it as `unresolvedBoundaries`
(mirroring the production classifier's `joinViolations`), and RENDER that count in the artifact so a
non-zero value is visible rather than absorbed. Return `kmh: null` on `seconds <= 0` and render an
em dash.

**IN-02 — `'3475724402'` duplicated as a bare literal at four sites.**
`compute-pause-classification-calibration.mjs:1164`, `:1513`, `:2149`, and
`compute-unreliable-segment-recount.mjs:59`, while `INSENSITIVITY_SOURCE_ACTIVITY_ID` is exported at
`:89`. `:2149` renders the class-table heading from a literal while
`compute-pause-classification-recount.mjs:92` builds the heading it searches for from its own
`RECOUNT_ACTIVITY_ID` — a second independent copy. Changing the anchor activity in one place makes
the recount throw `missing "## Per-interval class table — …" heading`. It fails loudly, which is why
it is Info.

**IN-03 — `evaluatePauseRecount`'s "never throws" contract is not met.**
`compute-pause-classification-recount.mjs:96-98`, `:353-354`. The docblock at `:317` promises
"Never throws — every disagreement is appended to `problems`", but `round1(r.metres)` is
`x.toFixed(1)`, a `TypeError` on a row missing `metres`. Fix:
`Number.isFinite(x) ? Number(x.toFixed(1)) : null`, and report a `problems` entry when either side
is null.

**IN-05 (partial) — `maxKmhOld` / `maxKmhMerged` initialised to 0.**
`compute-pause-transport-remeasurement.mjs:161-162`. An archive with no qualifying interval renders
"max 0 km/h" as if measured. Return null and render an em dash. (IN-05's sibling — `finalizeEpisode`
returning `rateMps: 0` in the calibration generator — was fixed in plan 34-16 alongside IN-07.)

## Why deferred

None is reachable on the current archive. WR-06 needs a gap boundary missing from the index map,
which `classifyGapsWithSegments` does not produce; `maxKmh` is only rendered alongside a non-zero
count; the recount anchor is unchanged; `round1` only throws on a malformed row the recount itself
builds. Plan 34-16 already carried two Critical fixes, four Warnings and a regeneration, and the
developer has been to the browser three times this phase.

## Acceptance

- `34-PAUSE03-REMEASUREMENT.md` renders `unresolvedBoundaries` and regenerates byte-identically
  twice; the Figure-of-record sentence is re-verified afterwards (it feeds `34-VALIDATION.md` R8)
- No bare `'3475724402'` literal remains in either generator; the recount imports the exported id
- `evaluatePauseRecount` is shown not throwing on a row missing `metres`, with a `problems` entry
- No generator reports a zero where the value is unknown
