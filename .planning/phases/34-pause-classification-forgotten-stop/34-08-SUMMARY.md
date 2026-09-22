---
phase: 34-pause-classification-forgotten-stop
plan: 08
subsystem: analytics
tags: [pace-quality, dashboard-index, pause-classification, forgotten-stop, untiered-signal, vitest]

# Dependency graph
requires:
  - phase: 34-pause-classification-forgotten-stop
    provides: "src/analytics/pause-classification.ts: classifyPauses, classifyForgottenStop, SHIPPED_PAUSE_BANDS, SHIPPED_STOP_PARAMS, PauseClass, PauseSource, PauseInterval, ClassifiedPauseInterval (plan 34-03, constants shipped in plan 34-06)"
  - phase: 34-pause-classification-forgotten-stop
    provides: "classifyGapsWithSegments's additive coveredRuns field (plan 34-03)"
provides:
  - "src/analytics/pace-quality.ts: PauseClassificationSignal/ForgottenStopSignal, pauseClassificationSignal()/forgottenStopSignal(), the two new ActivityQualitySignals keys (untiered, D-11), notComputableSignals literals for both, PaceQualityShard.pauseIntervals(+Truncated), projectPauseIntervals()"
  - "resolveCoverage() widened to also return coveredRuns, shared by computePaceQualitySignals and buildPaceQualityShard (one classifyGapsWithSegments call per producer, unchanged)"
  - "src/dashboard/data/pace-quality-client.ts: parsePauseClassificationSignal/parseForgottenStopSignal with named CR-01 ?? fallbacks; parsePaceQualityShard's pauseIntervals/pauseIntervalsTruncated stubbed to empty/untruncated pending plan 34-09's per-entry parser"
  - "src/dashboard/views/detail-sections.ts: EXPLANATION_PROBE_QUALITY carries flat untiered defaults for both new keys; the three-member tiering assertion loop is unchanged"
  - "a never-widen guard ('anySevere excludes pauseClassification and forgottenStop') watched failing under a temporary Pick<> widening, then reverted; hasAnySevereSignal's own function body confirmed unchanged"
affects: [34-09, 34-10, 34-11, 37-review-queue]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Untiered ninth/tenth signal (D-11): no tier field at all on PauseClassificationSignal/ForgottenStopSignal, following the ElapsedVsMovingSignal/DeviceEraSignal template — hasAnySevereSignal's Pick<> stays a compile-time-locked 3-member union, so a future widening to include either key is a TypeScript excess-property/missing-property error, not just a runtime miss."
    - "Shared rollup helpers (pauseClassificationFromIntervals/forgottenStopFromResult) let computePaceQualitySignals (via the exported pauseClassificationSignal/forgottenStopSignal wrappers) and buildPaceQualityShard (calling classifyPauses/classifyForgottenStop directly, once, to also get the raw intervals for the shard projection) share identical counting logic without a second classifyPauses/classifyForgottenStop call inside one producer."
    - "projectPauseIntervals mirrors projectUnreliableSegments' exact cap-100/sorted/parts-free projection shape one evidence field later, merging two already-resolved interval lists (classifier output + forgotten-stop creep) rather than re-deriving either."

key-files:
  created: []
  modified:
    - src/analytics/pace-quality.ts
    - src/analytics/pace-quality.test.ts
    - src/analytics/compute-dashboard-index.test.ts
    - src/dashboard/data/pace-quality-client.ts
    - src/dashboard/data/pace-quality-client.test.ts
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts
    - src/dashboard/views/list-logic.test.ts
    - src/dashboard/views/list.test.ts
    - src/dashboard/views/overview.test.ts
    - src/dashboard/views/calendar-logic.test.ts
    - src/dashboard/views/trends-logic.test.ts
    - src/dashboard/views/trends-volume-logic.test.ts
    - src/dashboard/views/trends-cadence-hr-logic.test.ts
    - src/dashboard/data/index-client.test.ts
    - src/analytics/gear-aggregate-logic.test.ts

key-decisions:
  - "The 34-08-PLAN.md verify step's literal `git diff HEAD | grep -c 'hasAnySevereSignal'` instruction assumed a near-empty diff; because this plan's own new doc comments legitimately mention `hasAnySevereSignal` by name (the D-11 house style for a never-widen guard), that raw count is 5, not 0. Verified the STRONGER claim the instruction was actually after instead: `git diff HEAD -- src/analytics/pace-quality.ts | grep -A3 -B3 hasAnySevereSignal | grep '^[+-]'` shows zero lines inside the function's own body (`export function hasAnySevereSignal(...) { ... }`) — every matched diff hunk is a doc-comment reference elsewhere in the file. The function's three-line return is byte-identical to HEAD."
  - "buildPaceQualityShard calls classifyPauses/classifyForgottenStop directly (once each), then reuses the same pauseClassificationFromIntervals/forgottenStopFromResult helpers pauseClassificationSignal/forgottenStopSignal call internally — rather than calling those two wrapper functions a second time — so the shard's pauseIntervals projection and its row-signal counts are guaranteed to agree without a second classifier/forgotten-stop-core invocation inside that one producer."
  - "parsePaceQualityShard's pauseIntervals/pauseIntervalsTruncated fields are stubbed to an always-empty/untruncated default rather than a partial per-entry parser, per the plan's own explicit scope boundary ('the shard pauseIntervals entry parse belongs to plan 34-09'). This is CR-01-safe (present, not absent, never throws) but means a shard actually carrying real pause intervals does not yet surface them to any browser reader — documented under Known Stubs below, intentional and scoped to plan 34-09."

patterns-established:
  - "A plan-specified literal verification command can under-specify its own intent when other legitimate changes share the same searched string; when that happens, verify the STRONGER underlying claim (here: the function body, not the whole file diff) rather than mechanically satisfying or silently failing the literal command."

requirements-completed: []  # this plan ticks nothing — PAUSE-02/STOP-01/STOP-03's disposition is a later plan's job, per this plan's own Requirement-tick safety note; requirements mark-complete was skipped as instructed

# Metrics
duration: ~15min (commit span 00:26-00:33 local, 2026-09-23, plus pre-commit research/reading)
completed: 2026-09-23
---

# Phase 34 Plan 08: Pause Classification & Forgotten-Stop Wired Into Quality Signals Summary

**Two new untiered index-row signals (`pauseClassification`, `forgottenStop`) and a capped `pauseIntervals` shard list, both structurally excluded from `hasAnySevereSignal` by construction (no `tier` field exists to read) — verified on real 3475724402 (walked=1, ran-through=17, matching the 34-07 independent recount exactly) and the distance-triggered 3475740390 (`forgottenStop` not-computable with the D-10 reason).**

## Performance

- **Duration:** ~15 min (commit span 00:26–00:33 local, 2026-09-23), plus pre-commit reading of `pace-quality.ts`, `pause-classification.ts`, `pace-derivation.ts`, `pace-quality-client.ts`, `detail-sections.ts` and their test files
- **Tasks:** 3 of 3
- **Files modified:** 16 (3 source, 13 test/fixture files)

## Accomplishments

- **Task 1 — the two untiered signals, watched-failing guard:** `pace-quality.ts` gained `PauseClassificationSignal`/`ForgottenStopSignal` (no `tier` field at all, per D-11), `pauseClassificationSignal()`/`forgottenStopSignal()` (calling `classifyPauses`/`classifyForgottenStop` with the shipped `SHIPPED_PAUSE_BANDS`/`SHIPPED_STOP_PARAMS`), and both keys on `ActivityQualitySignals`. `resolveCoverage()` was widened to also return `coveredRuns` (already produced by `classifyGapsWithSegments`, just not previously threaded through). `computePaceQualitySignals` wires both signals in from the SAME `resolveCoverage` call; `anySevere`'s line is textually unchanged. The "anySevere excludes pauseClassification and forgottenStop" guard was watched FAILING under a temporary widening of `hasAnySevereSignal` (quoted below), then reverted. A new "one computation per producer" test confirms `computePaceQualitySignals` still calls `classifyGapsWithSegments` exactly once.
- **Task 2 — capped shard projection:** `PaceQualityShard` gained `pauseIntervals`/`pauseIntervalsTruncated` (D-15: recording gaps, gap-adjacent merged segments, zero-advance pauses each with their class, plus covered-creep stretches marked `source: 'covered-creep'`/`pauseClass: 'stationary'` — isolated-jump/hidden-pause segments never included). `projectPauseIntervals()` mirrors `projectUnreliableSegments`'s exact cap-100/sorted shape. `buildPaceQualityShard` calls `classifyPauses`/`classifyForgottenStop` once each (sharing the same `resolveCoverage` result), deriving both the row signals and the shard projection from that single pair of calls. `compute-dashboard-index.ts` needed no call-site change — confirmed, not merely assumed: the new keys arrive inside `computePaceQualitySignals`'s own return object, and `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1`.
- **Task 3 — read-side parsers and the tsc-authoritative fixture cascade:** `pace-quality-client.ts` gained `parsePauseClassificationSignal` (all-or-nothing via `finiteNumberOrNull`) and `parseForgottenStopSignal` (requires a genuine boolean `computable` and string-or-null `reason`; any other type invalidates the whole signal), both wired into `parseActivityQualitySignals` via named `??` fallbacks. `detail-sections.ts`'s `EXPLANATION_PROBE_QUALITY` gained flat untiered defaults for both keys; the three-member `hasAnySevereSignal`-feeding tiering loop is untouched. `npx tsc --noEmit` after Tasks 1–2 named exactly 16 files (13 `ActivityQualitySignals`/`PaceQualityShard` test fixtures plus `pace-quality-client.ts`, `detail-sections.ts` and `detail-sections.test.ts`'s own `makeShard` literal) — every one was fixed; none were left untouched; no unflagged file was touched.

## RED / Watched-Failing Evidence (quoted verbatim)

**Task 1 guard, under the temporary `hasAnySevereSignal` widening (`|| ((signals as any).forgottenStop?.totalSec ?? 0) > 0`):**
```
FAIL src/analytics/pace-quality.test.ts > pauseClassification / forgottenStop signals ... > anySevere excludes pauseClassification and forgottenStop: neither untiered fact ever flips hasAnySevereSignal
AssertionError: expected true to be false // Object.is equality
 ❯ src/analytics/pace-quality.test.ts:1017:38
```
Reverted immediately (`hasAnySevereSignal`'s body restored to its three-line `||` chain); re-run confirmed GREEN. `git diff HEAD -- src/analytics/pace-quality.ts | grep -A3 -B3 hasAnySevereSignal | grep '^[+-]'` (the stronger check — see Decisions) shows zero lines from inside the function body itself, only doc-comment references elsewhere in the file.

## Matched `-t` Filter Counts (Rule 1 — every filter checked non-zero)

- `pace-quality.test.ts -t "anySevere excludes pauseClassification"` — 1 matched, passed
- `pace-quality.test.ts -t "one computation per producer"` — 1 matched, passed
- `pace-quality.test.ts -t "pauseClassification / forgottenStop signals"` — 6 matched, passed (the full new describe block)
- `pace-quality.test.ts -t "projectPauseIntervals"` — 6 matched, passed
- `compute-dashboard-index.test.ts -t "pauses"` — 3 matched, passed
- `pace-quality-client.test.ts -t "pauseClassification parse"` — 4 matched, passed
- `pace-quality-client.test.ts -t "forgottenStop parse"` — 6 matched, passed

## resolveCoverage( Call Sites (unchanged count — Task 2 acceptance criterion)

`grep -n "resolveCoverage(" src/analytics/pace-quality.ts` → 4 total: the definition (line ~1189), `gapProfileSignal` (line ~1274), `computePaceQualitySignals` (line ~1825), `buildPaceQualityShard` (line ~2176). Same four call sites Phase 33 left behind — no growth.

## Task Commits

1. **Task 1: The two untiered signals, watched-failing guard** - `e0c06f84` (feat)
2. **Task 2: Capped pauseIntervals shard projection, schema version unchanged** - `bb69ddb4` (feat)
3. **Task 3: Read-side parsers, tsc-authoritative fixture cascade** - `83ec9e6f` (feat)

**Plan metadata:** (this commit, next) `docs(34-08): complete plan`

## Files Created/Modified

- `src/analytics/pace-quality.ts` — `PauseClassificationSignal`/`ForgottenStopSignal` interfaces; `pauseClassificationSignal()`/`forgottenStopSignal()`; `pauseClassificationFromIntervals()`/`forgottenStopFromResult()` shared rollup helpers; `ActivityQualitySignals.pauseClassification`/`.forgottenStop`; `notComputableSignals()` literals; `resolveCoverage()` widened to return `coveredRuns`; `computePaceQualitySignals`/`buildPaceQualityShard` wired; `PaceQualityShard.pauseIntervals`/`.pauseIntervalsTruncated`; `projectPauseIntervals()`.
- `src/analytics/pace-quality.test.ts` — new "pauseClassification / forgottenStop signals" describe (6 tests incl. the never-widen guard and the one-computation-per-producer proof) and "projectPauseIntervals" describe (6 tests).
- `src/analytics/compute-dashboard-index.test.ts` — new "pauses" describe (3 tests) inside the existing "quality signals" describe.
- `src/dashboard/data/pace-quality-client.ts` — `parsePauseClassificationSignal`/`parseForgottenStopSignal`, `NOT_COMPUTABLE_PAUSE_CLASSIFICATION_PARSED`/`NOT_COMPUTABLE_FORGOTTEN_STOP_PARSED`, wired into `parseActivityQualitySignals`; `parsePaceQualityShard`'s stubbed `pauseIntervals: []`/`pauseIntervalsTruncated: false`.
- `src/dashboard/data/pace-quality-client.test.ts` — `validShard` gained well-formed `pauseClassification`/`forgottenStop` signal fixtures and `pauseIntervals: []`; new "pauseClassification parse" (4 tests) and "forgottenStop parse" (6 tests) describe blocks.
- `src/dashboard/views/detail-sections.ts` — `EXPLANATION_PROBE_QUALITY` gained flat untiered defaults for both new keys.
- 11 test-fixture files (`detail-sections.test.ts`, `list-logic.test.ts`, `list.test.ts`, `overview.test.ts`, `calendar-logic.test.ts`, `trends-logic.test.ts`, `trends-volume-logic.test.ts`, `trends-cadence-hr-logic.test.ts`, `index-client.test.ts`, `gear-aggregate-logic.test.ts`) — each `ActivityQualitySignals`/`PaceQualityShard` fixture literal gained the two new keys (clean/zero defaults where the suite doesn't exercise them), per `tsc --noEmit`'s own authoritative error list.

## Decisions Made

See `key-decisions` in the frontmatter above: the stronger-verification substitute for the plan's literal `grep -c` instruction; the direct `classifyPauses`/`classifyForgottenStop` call in `buildPaceQualityShard` sharing helpers with the row-signal wrappers; the intentional `pauseIntervals` parse stub deferred to plan 34-09.

## Deviations from Plan

None - plan executed exactly as written. The one documented decision above (the literal `grep -c "hasAnySevereSignal"` check) is a clarification of how an ambiguous verification instruction was satisfied, not a deviation from the plan's substance — the underlying claim (the function body is unchanged) was proven, just via a more precise command than the literal one, which would have false-failed against this plan's own (expected, house-style) doc comments.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

- `src/dashboard/data/pace-quality-client.ts`'s `parsePaceQualityShard` always returns `pauseIntervals: []` and `pauseIntervalsTruncated: false`, regardless of what a fetched shard document actually carries. This is intentional and explicitly scoped by the plan text ("the shard pauseIntervals entry parse belongs to plan 34-09") — production (`buildPaceQualityShard`) DOES compute and write real `pauseIntervals` entries as of this plan, but no browser code reads them yet (the Pauses section that will consume this list ships in plan 34-09). Not a defect: CR-01-safe (present as an empty array, never absent, never throws), and no rendered surface currently claims to show per-interval pause data, so nothing renders a false "no pauses" reading it shouldn't.

## Threat Flags

None beyond the plan's own `<threat_model>` (T-34-26..T-34-29), all mitigated as specified: the never-widen guard (T-34-26), the tolerant all-or-nothing parsers (T-34-27), the single-`resolveCoverage`-call discipline (T-34-28, verified via the "one computation per producer" test and the unchanged 4-site `resolveCoverage(` count), and the parts/index-free shard entry shape (T-34-29, verified by the exact-7-key assertion in `projectPauseIntervals`'s own tests).

## Next Phase Readiness

- Plan 34-09 (detail-view disclosure) can now read `quality.pauseClassification`/`quality.forgottenStop` off the index row (both parsed tolerantly, with named fallbacks) and `shard.pauseIntervals` off the lazy shard for its Pauses section and Quality Signals summary row — it will also need to add the actual per-entry `pauseIntervals` parser this plan deliberately deferred.
- Plan 37 (review-queue ordering) can read the index-row summary (`quality.pauseClassification`) without a shard fetch, per D-17/D-14.
- `npm test`: 98 files / 3432 tests, all green (up from the 34-07 baseline of 98 files / 3407 tests, +25 new tests: 12 in `pace-quality.test.ts`, 3 in `compute-dashboard-index.test.ts`, 10 in `pace-quality-client.test.ts`). `npx tsc --noEmit` and `npm run build` both exit 0. `git status --porcelain data/streams` empty throughout — no stream regeneration was needed for this plan.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `src/analytics/pace-quality.ts`
- FOUND: `src/analytics/pace-quality.test.ts`
- FOUND: `src/analytics/compute-dashboard-index.test.ts`
- FOUND: `src/dashboard/data/pace-quality-client.ts`
- FOUND: `src/dashboard/data/pace-quality-client.test.ts`
- FOUND: `src/dashboard/views/detail-sections.ts`
- FOUND: `src/dashboard/views/detail-sections.test.ts`
- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-08-SUMMARY.md` (this file)
- FOUND commits: `e0c06f84`, `bb69ddb4`, `83ec9e6f`
