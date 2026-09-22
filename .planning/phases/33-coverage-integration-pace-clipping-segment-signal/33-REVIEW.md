---
phase: 33-coverage-integration-pace-clipping-segment-signal
reviewed: 2026-09-22T08:06:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/analytics/pace-derivation.ts
  - src/analytics/pace-quality.ts
  - src/analytics/unreliable-segments.ts
  - src/analytics/dashboard-index.types.ts
  - src/dashboard/data/pace-quality-client.ts
  - src/dashboard/views/detail-sections.ts
  - src/dashboard/views/list.ts
  - scripts/compute-coverage-identity-recount.mjs
  - scripts/compute-unreliable-segment-severity-calibration.mjs
  - scripts/compute-unreliable-segment-calibration.mjs
  - scripts/validate-unreliable-segments-1hz.mjs
  - package.json
findings:
  critical: 1
  warning: 1
  info: 4
  total: 6
status: resolved
---

# Phase 33: Code Review Report

**Reviewed:** 2026-09-22T08:06:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 33 wires `detectUnreliableSegments` into `classifyGaps` as a fourth, top-priority `GapKind`,
adds `excessMetres` to merged segments, ships `UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION`, adds
the seventh `quality.unreliableSegments` signal end to end (compute → wire → shard → client parse →
list badge → detail row), and updates the two `.mjs` generators that previously read
`classifyGaps(...).gapIntervals` to read `classifyGapsThreeWay(...).gapIntervals` instead (closing
a real circularity risk now that `classifyGaps` folds the detector's own output back in).

The core analytics (`pace-derivation.ts`, `unreliable-segments.ts`, `pace-quality.ts`) is careful
and internally consistent: the four-way coverage identity is structurally guaranteed by
`accumulateCoverage`'s exhaustive partition, strict priority (`unreliable` > `recording-gap` >
`pause`) is correctly implemented via index-based reclassification in pass 3, nothing feeds
post-detector output back into the detector, the `excessMetres` addition to `unreliable-segments.ts`
is a byte-for-byte additive field with no detection-outcome change, the severe composite `Pick<>`
in `hasAnySevereSignal` still names exactly three members, and every DOM string in
`detail-sections.ts`/`list.ts` reaches the page through `textContent`/`appendAccessibleBadge` — no
`innerHTML` anywhere in this signal's rendering path.

Two real defects were found, both outside the "hot" analytics path: a missing `npm run build &&`
prefix on the two new `package.json` scripts (both consume `../dist/...` and both scripts'
own printed/coded text assumes a build already ran), and a numeric-parsing regression in the new
`UnreliableSegmentsSignal` browser parser that accepts `NaN`/`Infinity`/negative values the Phase 30
elevation parser already learned to reject. The orchestrator's seven flagged items are each
addressed explicitly below, including the items that turned out fine.

## Critical Issues

### CR-01: New calibration/recount npm scripts omit the build step their own code assumes — **RESOLVED** in `fa8c6598`

**File:** `package.json:32-33`
**Issue:** The two new scripts added this phase both import from `../dist/...`, exactly like their
siblings, but unlike every sibling `dist`-consuming script in this file they are not prefixed with
`npm run build &&`:

```json
"compute-coverage-identity-recount": "node scripts/compute-coverage-identity-recount.mjs",
"compute-unreliable-segment-severity-calibration": "node scripts/compute-unreliable-segment-severity-calibration.mjs",
```
compare to the pre-existing, still-present siblings on the surrounding lines:
```json
"compute-unreliable-segment-calibration": "npm run build && node scripts/compute-unreliable-segment-calibration.mjs",
"validate-unreliable-segments-1hz": "npm run build && node scripts/validate-unreliable-segments-1hz.mjs",
```
Both new scripts open with top-level ES imports from `../dist/analytics/...`
(`scripts/compute-coverage-identity-recount.mjs:90-91`,
`scripts/compute-unreliable-segment-severity-calibration.mjs:70-81`), and each script's own text
documents that it expects a fresh build: `compute-unreliable-segment-severity-calibration.mjs:91`
defines `REGENERATE_COMMAND = 'npm run build && npm run compute-unreliable-segment-severity-calibration'`
and prints it in the rendered artifact (`:1186`), and its own `main()` catch block
(`:1473-1474`) tells the operator to "Run `npm run build` first" — advice the actual npm script
never follows. `compute-coverage-identity-recount.mjs`'s own printed regenerate instructions
(`:989-992`) similarly omit a build step while depending on `dist/`.

**Failure scenario:** A developer or CI agent runs `npm run compute-unreliable-segment-severity-calibration`
after editing `src/analytics/unreliable-segments.ts` but before `npm run build`. The script silently
imports the STALE `dist/analytics/unreliable-segments.js` (whatever was last compiled — from an
older commit, or absent entirely on a fresh checkout, which throws an unfriendly
`ERR_MODULE_NOT_FOUND` at import time, before the script's own try/catch in `main()` can produce its
friendly "Run `npm run build` first" message). If a stale-but-present `dist/` exists, the script
regenerates `33-CALIBRATION.md`/`33-COVERAGE-IDENTITY.md` against old compiled logic while reporting
byte-identical, "provenance is content-addressed" output — exactly the silent-stale-artifact failure
mode this repo's own history has hit before (`build-widgets` mtime-skip). These two artifacts exist
specifically to prove the shipped detector's correctness; regenerating them against non-shipped code
defeats their purpose without any visible symptom.
**Fix:**
```json
"compute-coverage-identity-recount": "npm run build && node scripts/compute-coverage-identity-recount.mjs",
"compute-unreliable-segment-severity-calibration": "npm run build && npm run compute-unreliable-segment-severity-calibration.mjs" /* or the equivalent node invocation */,
```
and update `compute-coverage-identity-recount.mjs`'s own printed regenerate line
(`:989-992`) to match, for the same reason `REGENERATE_COMMAND` was defined in the sibling file.

## Warnings

### WR-01: New `UnreliableSegmentsSignal` browser parser accepts NaN/Infinity/negative numeric fields — **RESOLVED** in `fa8c6598` (finite guard; negative values are still accepted, as they are for every sibling signal — noted, not changed)

**File:** `src/dashboard/data/pace-quality-client.ts:253-262` (`parseUnreliableSegmentsSignal`) and
`:396-406` (`parseUnreliableSegment`)
**Issue:** Both new Phase 33 parsers validate numeric fields with `nullableNumber` (`typeof raw ===
'number' ? raw : null`, line 110-112) rather than `finiteNumberOrNull` (`typeof raw === 'number' &&
Number.isFinite(raw) ? raw : null`, line 119-121). `finiteNumberOrNull` was introduced in Phase 30
specifically because `nullableNumber` "accept[s]... NaN and Infinity" (the function's own doc
comment at `:114-118`) and every elevation numeric field was deliberately hardened to use it
(`parseSubGroundSignal`, `parseClosureDriftSignal`, `parseVerticalRateSignal`, lines 167/176-177/
186-187). The new seventh signal's `count`, `totalMetres`, `totalExcessMetres`, `totalSeconds`,
`excessFraction` (`:255-259`) and the per-segment shard entries' `metres`/`excessMetres`/`seconds`
(`:401-402`) all revert to the pre-Phase-30, less strict convention this file otherwise moved away
from — a regression relative to the project's own established hardening precedent, not merely
"consistent with the older siblings" (decimation/gapProfile/impossibleSamples share the same
looseness, but those predate the Phase 30 fix and were not touched by this phase).

**Failure scenario:** A malformed or partially-written `pace-quality/{id}.json` shard (e.g. a
`JSON.stringify` of `NaN`/`Infinity` — which `JSON.stringify` actually serializes as the bare token
`null`, but a hand-edited, truncated, or differently-produced artifact could carry the literal
`"count": NaN` is invalid JSON and would fail parse entirely; a numeric string coerced upstream to
`Infinity`, or a negative `totalMetres` from a corrupted write, would not) reaches
`unreliableSegmentsBadgeContent` (`list.ts:631-651`) or `unreliableSegmentsRow`
(`detail-sections.ts:1225-1261`), both of which do `Math.round(signal.totalMetres)` /
`formatEffortDuration(signal.totalSeconds)` with no additional guard. `Math.round(NaN)` renders the
literal string `"NaN m"` into a live badge/row on the detail page; a negative `count`/`totalMetres`
renders a nonsensical "−5 unreliable segments, −12 m ...". This is a display-correctness defect, not
an XSS vector (the value is not markup), but it directly undermines this module's own stated
contract — "never... half-parse on malformed/partial/wrong-typed input" — for exactly the fields the
seventh signal introduces.
**Fix:** Use `finiteNumberOrNull` for the five fields in `parseUnreliableSegmentsSignal` and the
three fields in `parseUnreliableSegment`, matching the elevation precedent:
```ts
return {
  tier,
  count: finiteNumberOrNull(raw.count),
  totalMetres: finiteNumberOrNull(raw.totalMetres),
  totalExcessMetres: finiteNumberOrNull(raw.totalExcessMetres),
  totalSeconds: finiteNumberOrNull(raw.totalSeconds),
  excessFraction: finiteNumberOrNull(raw.excessFraction),
  mechanisms,
};
```
(Optionally also negative-guard `count`/`totalMetres`/`totalSeconds` specifically, since those are
physically non-negative quantities — but finiteness alone closes the NaN/Infinity display defect.)

## Info

### IN-01: Test re-pins (33-01) verified against the widened `classifyGaps` — all four are legitimate

Reported per the orchestrator's explicit request, even though no defect was found:

- `pace-derivation.test.ts` — `coveredFraction` floor lowered 98%→97% for `3647739864` and
  `4598855187` (`git diff` around line ~371-393): both streams now carry a genuinely detected
  unreliable segment that `paceHistogramSamples` correctly excludes exactly as it excludes a gap
  (the same clipping mechanism WR-01/PACE-08 already exercise for recording gaps). The lowered floor
  reflects a real, intended reduction in bucketed coverage, not a loosened assertion papering over a
  regression — the new `unreliable segment clipping reaches the chart band` describe block in
  `detail-charts-logic.test.ts` independently re-derives the same fastest-pace figure from raw `t`/`d`
  (never from `paceSeries`) and cross-checks it, which would fail if the exclusion were wrong.
- `pace-derivation.test.ts` — the absolute-pause-rule negative case (real activity `5059204779`) was
  rewritten from asserting `pauseSec/spanSec > 0.9` to asserting `pauseSec === 0` and
  `unreliableSec === spanSec`. This is a structurally correct consequence of `unreliable` outranking
  `pause` in the four-rung priority tree (`pace-derivation.ts:445-455`): the absolute 30s rule's own
  garbage pre-detector gap list (nearly the whole span reclassified `pause` in pass 1) is exactly what
  gets fed to `detectUnreliableSegments` as the `gaps` argument; the few short covered stretches that
  remain, if fast enough to qualify as bursts, chain with the surrounding gap blocks into one
  `gap-adjacent` segment spanning the activity. The demonstrated defect (the absolute rule produces a
  degenerate gap list) is preserved and, per the test's own comment, "demonstrated even more starkly"
  — not masked. This pause rule is explicitly documented as never reachable from a production call
  site (`pace-derivation.ts:134-142`).
- `detail-sections.test.ts` — the coverage caption pinned `99%→98%` for the same widened-numerator
  reason as the first bullet (measured against the real stream, with the new "1% unreliable" clause
  added rather than silently dropped).
- `detail-charts-logic.test.ts` — the synthetic Δt-weighting fixture's burst speed lowered
  `10 m/s→6 m/s`: 10 m/s exceeds the detector's own calibrated `UNRELIABLE_SPEED_LIMIT_MPS` (7.35
  m/s), so the original fixture's 60-second burst would now itself be detected and clipped out of the
  window entirely, inverting the test's own claim about Δt-weighting. 6 m/s stays under the detector's
  threshold, correctly isolating the thing this fixture is meant to test.

No masking found in any of the four; all four re-pins are explained by, and consistent with, the
documented widening.

### IN-02: `unreliableSegments.mechanisms` parse is all-or-nothing, not per-entry-drop — deliberate and safer, but diverges from plan text

**File:** `src/dashboard/data/pace-quality-client.ts:233-251` (`parseUnreliableSegmentsSignal`)
**Observation:** the orchestrator's brief notes that plan text described `mechanisms` as
per-entry-drop but the shipped code is all-or-nothing (one malformed `mechanisms[]` entry
invalidates the whole `UnreliableSegmentsSignal`, degrading the entire signal to
`not-computable` via the caller's `??` fallback). The function's own doc comment (`:221-232`)
states this is deliberate, mirroring `parseElevationSignal`'s established "all-or-nothing" shape
one level up. Between the two options, all-or-nothing is the safer choice here: `count`,
`totalMetres`, `totalExcessMetres`, `totalSeconds` and `mechanisms` are all written together,
server-side, from the same `UnreliableSegmentsSignal` object — a shard where one mechanism string is
corrupted is evidence the whole signal's provenance is suspect, and silently keeping a
partially-trusted `count`/`totalMetres` next to a truncated `mechanisms` list (the per-entry-drop
alternative) would let `unreliableSegmentsBadgeContent`'s mechanism-derived visible text
(`list.ts:645-647`) under-report a genuine mechanism while still showing a full, unrelated
`count`/`totalMetres`. The shipped behaviour is internally consistent with this file's own
established convention and is not a functional defect — recorded here only because the plan/ship
discrepancy was flagged for explicit confirmation.

### IN-03: Calibration script's `severityDistribution` disagrees with shipped code on a zero-distance activity's tier label (known, accepted, reporting-only)

**File:** `scripts/compute-unreliable-segment-severity-calibration.mjs:260-288` (`severityDistribution`)
vs. `src/analytics/pace-quality.ts:1209-1216` (`unreliableSegmentsSignal`)
**Observation:** confirmed present, exactly as the orchestrator's brief anticipated.
`unreliableSegmentsSignal` checks `totalDistanceM > 0` before ever looking at segment count
(`pace-quality.ts:1213-1216`), so a zero-total-distance stream is `not-computable` regardless of
whether the detector found zero or nonzero segments. `severityDistribution` checks
`segments.length === 0` first (`:273-276`) and only falls through to the `totalDistanceM`/`fraction`
check for activities with at least one detected segment — so a zero-distance activity with zero
detected segments (e.g. `11865310195`, the degenerate near-empty manual-entry stream named in
`26-RESIDUAL.md`) is counted `none` by the calibration artifact's distribution table, while the
shipped `quality.unreliableSegments.tier` for that same activity is `not-computable`. This is a
reporting-only blind spot confined to the `## Archive-wide severe/minor/none distribution` section
of the generated `33-CALIBRATION.md` artifact — it does not affect `data/dashboard/index.json`, the
shard files, or any rendered page, and the code does not contradict its own documented behaviour
(`severityDistribution`'s own doc comment at `:253-259` does not claim to reproduce
`unreliableSegmentsSignal`'s not-computable branch). No fix required; recorded per the orchestrator's
explicit request not to re-litigate but to confirm.

### IN-04: `excessMetres` clamp on gap-adjacent merged segments confirmed intentional and purely additive

**File:** `src/analytics/unreliable-segments.ts:198-211` (interface doc), `:623`, `:667`
**Observation:** confirmed via `git diff 6772dca5 HEAD -- src/analytics/unreliable-segments.ts` that
the only production change in this file is the new `excessMetres` field and its two assignment
sites (`Math.max(0, excessMetres(metres, seconds, params.speedLimitMps))`) — no existing line was
altered, so the addition cannot change any detection outcome (burst grouping, chaining, mechanism
labelling are all untouched). The `Math.max(0, ...)` clamp is documented on the field itself
(`:199-201`: "clamped at 0") and is the correct consequence of computing excess over the MERGED
segment's own `metres`/`seconds` (burst seconds plus any merged gap seconds) rather than over the
burst portion alone — a gap-adjacent segment's allowed distance budget (`speedLimitMps * seconds`)
grows with the gap's own seconds, so a segment whose burst alone exceeded the limit can legitimately
net to zero or negative raw excess once the gap's dilution is included; clamping to 0 avoids
reporting a nonsensical negative "excess". This matches the archive finding cited in
`pace-quality.ts:1192-1196` (activity `3475724402`, 16 segments, every one clamped to zero excess,
tiered `minor` rather than `severe` or `none`).

---

_Reviewed: 2026-09-22T08:06:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
