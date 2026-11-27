---
phase: 35-stream-derived-running-pace
plan: 03
subsystem: analytics
tags: [running-pace, pace-derivation, coveredRuns, single-source-audit, SEG-05b, D-08, D-11]

# Dependency graph
requires:
  - phase: 35-stream-derived-running-pace (plan 35-02)
    provides: a total validateStreamSeries (never throws on null/undefined/non-array t/d) — deriveRunningPace's null-input totality leans on classifyGapsWithSegments's own pass-1 guard, which now inherits this at source
provides:
  - "RunningPace interface + deriveRunningPace in pace-derivation.ts: covered metres over coverage.coveredSec, both read off classifyGapsWithSegments's own final pairKinds partition (D-08 Reading A) — the ONE running-pace implementation the rest of the phase builds on"
  - "NOT_COMPUTABLE_NO_COVERED_DISTANCE, the third member of the not-computable reason set, declared in pace-derivation.ts (not pace-quality.ts) because the reverse import edge would cycle"
  - "hand-computed boundary-rule fixtures (clean stream, near-zero-metres/large-seconds gap, the mirror large-metres/small-seconds slew-burst, two runs split by one non-covered pair, five totality cases) plus structural conservation on all four named real activities"
  - "D-11's Phase 35 half of SEG-05b: a stub-the-detector proof on real 3475724402 showing deriveRunningPace's output moves when the detector is stubbed to []"
  - "pace-single-source.test.ts's BANNED_LITERALS extended to deriveRunningPace's own division shape, watched RED on a planted drifted copy"
affects: [35-04, 35-05, 35-07, 35-08, 35-09, 35-10, 35-12, 35-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "zeroRunningPace(reason) helper mirrors zeroCoverage()'s never-a-shared-mutable-constant discipline — every not-computable path returns a fresh object"
    - "a not-computable reason closed set split across two files (pace-quality.ts's two original reasons reused verbatim BY STRING VALUE, pace-derivation.ts's one new reason exported as a real constant) because the import direction (pace-quality.ts -> pace-derivation.ts) forbids the reverse edge"
    - "numerator (coveredM, summed over coveredRuns) and denominator (coveredSec, read from coverage.coveredSec) are two views of the SAME final pairKinds partition — reconciliation by construction, not by agreement"

key-files:
  created: []
  modified:
    - src/analytics/pace-derivation.ts
    - src/analytics/pace-derivation.test.ts
    - src/analytics/pace-single-source.test.ts

key-decisions:
  - "D-08 Reading A implemented exactly as bound: coveredM = sum of d[run.endIndex]-d[run.startIndex] over classifyGapsWithSegments's coveredRuns; coveredSec = coverage.coveredSec; excludedM/excludedSec are the complements. No startSec/endSec, no gapIntervals re-scan, no rounding inside the pure function."
  - "The two pre-existing not-computable reasons (NOT_COMPUTABLE_NO_STREAM / NOT_COMPUTABLE_UNUSABLE_STREAM, both declared in pace-quality.ts) are reused in deriveRunningPace by LITERAL STRING VALUE, not by import — pace-quality.ts imports FROM pace-derivation.ts (confirmed live: `import { adaptiveWindowSec, classifyGapsWithSegments, quantile } from './pace-derivation.js'` at pace-quality.ts:23), so the reverse edge would be a circular module dependency. Only the one genuinely NEW reason (NOT_COMPUTABLE_NO_COVERED_DISTANCE) is declared as an exported constant, in pace-derivation.ts."
  - "The pass-1-failed detection (`coveredRuns.length === 0 && coverage.spanSec === 0`) is taken verbatim from the plan's own action text. This can, in a rare synthetic edge case (every pair non-covered AND spanSec genuinely 0), misclassify a technically-valid-but-fully-excluded stream as NOT_COMPUTABLE_UNUSABLE_STREAM rather than NOT_COMPUTABLE_NO_COVERED_DISTANCE — not something this plan was asked to improve on, and not reachable by any of this plan's own fixtures or the four named real activities (all of which have coveredRuns.length > 0)."

patterns-established:
  - "A not-computable reason set can be intentionally SPLIT across two files that cannot import each other, provided the split is documented with the exact import-direction evidence (grep output/line numbers) rather than asserted — the docblock above NOT_COMPUTABLE_NO_COVERED_DISTANCE is the template for the next such split."

requirements-completed: []  # Requirement-tick safety (plan's own Objective): this plan ticks nothing — RPACE-01 stays open until later plans (rendering/calibration) land; SEG-05b's row is Phase 35's half, recorded by plan 35-12, not here.

# Metrics
duration: ~30min
completed: 2026-09-24
---

# Phase 35 Plan 03: Stream-Derived Running Pace — The One Implementation Summary

**Added `deriveRunningPace` (covered metres over `coverage.coveredSec`, off `classifyGapsWithSegments`'s own `coveredRuns`) to `pace-derivation.ts`, pinned its per-pair boundary rule with five hand-computed synthetic fixtures plus structural conservation on all four named real activities, and proved the unreliable-segment detector is load-bearing to its output (SEG-05b, Phase 35's half) via a stub-the-detector test on real activity 3475724402.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-09-24
- **Tasks:** 3/3
- **Files modified:** 3

## Accomplishments

- `RunningPace` interface (7 fields, exact order per plan) and `export function deriveRunningPace(stream, options?)` added to `pace-derivation.ts`. Total: never throws on `null`/`undefined`/non-array `t`/`d`, a pass-1-invalid stream, or a stream whose `d` never advances — each returns the neutral result with a stated reason and `runningPaceSecPerKm: null`, never a computed zero.
- The boundary rule is per PAIR, stated explicitly in the function's own docblock: `classifyGapsWithSegments`'s final `pairKinds` partition is read exactly once; `coveredM` is the sum of `d[run.endIndex] - d[run.startIndex]` over `coveredRuns`; `coveredSec` is `coverage.coveredSec` itself (the same number the coverage caption discloses); `excludedM`/`excludedSec` are the complements. No `startSec`/`endSec`, no `gapIntervals` re-scan, no `Math.round` — verified structurally by the plan's own Task 1 Python check.
- `NOT_COMPUTABLE_NO_COVERED_DISTANCE` — the third member of the not-computable reason set — is declared in `pace-derivation.ts`, not beside `pace-quality.ts`'s `NOT_COMPUTABLE_NO_STREAM`/`NOT_COMPUTABLE_UNUSABLE_STREAM`, because `pace-quality.ts` imports FROM `pace-derivation.ts` (confirmed live: `pace-quality.ts:23` — `import { adaptiveWindowSec, classifyGapsWithSegments, quantile } from './pace-derivation.js'`) — the reverse edge would be a cycle. The two pre-existing reasons are reused inside `deriveRunningPace` by literal string value (with a docblock note explaining why), not by import.
- Five Group A hand-computed synthetic fixtures pin the boundary rule, each with its expected value derived by hand in a comment above the assertion:
  - (a) clean stream, no exclusions: `excludedM===0`, `excludedSec===0`.
  - (b) THE BOUNDARY CASE — a 500 s mid-stream recording gap with zero distance advance: `excludedM===0` (exact), `excludedSec===500` (exactly the gap's own duration), `coveredM===2000` (sum of both runs' hand-computed advances).
  - (c) the mirror case — a single-pair 60 m / 2 s isolated-jump slew burst (30 m/s, no adjacent gap, reachability-confirmed via `segments[0].mechanism === 'isolated-jump'`): `excludedM===60`, `excludedSec===2`, both exactly the burst pair's own advance/duration.
  - (d) two covered runs split by one non-covered pair carrying its own nonzero advance (dt=15s recording-gap, dd=5m): `coveredM === 30 + 40` (both terms literal), `excludedM===5` — exactly the one non-covered pair's own `dd` and nowhere else.
  - (e) five totality cases, each asserting the EXACT reason constant: `null`/`undefined`/null-channelled streams all return `'no stream committed for this activity'`; a 1-sample stream returns `'stream failed validateStreamSeries'`; a never-advancing stream returns `NOT_COMPUTABLE_NO_COVERED_DISTANCE` (measured live: since `d` never advances, `advanceIntervals` returns `[]`, the pause threshold resolves to `Infinity`, every pair classifies `covered`, `coveredSec>0` but `coveredM===0` — exactly the third reason's own shape).
  - `-t "deriveRunningPace"` matched 13 tests (5 Group A + 4 totality sub-cases counted individually + 4 Group B real-activity cases), all pass — not a vacuous filter.
- Group B: structural conservation asserted on all four named real activities (3475724402, 3475734189, 3475740390, 5059204779) — `coveredSec+excludedSec===spanSec`, `excludedSec===recordingGapSec+pauseSec+unreliableSec`, `coveredM+excludedM===`total distance, `computable===true` and `runningPaceSecPerKm>0` — labelled STRUCTURAL CONSERVATION, explicitly NOT evidence of correct classification (that is plan 35-04's zero-import recount).
- D-11's Phase 35 half of SEG-05b: a new `describe('deriveRunningPace reads the detector (SEG-05b, Phase 35 half)', ...)` block in `pace-single-source.test.ts`, single-hop shape (copying the Phase 33 SEG-05b block's template — `deriveRunningPace` lives directly inside `pace-derivation.ts`, one hop from `unreliable-segments.js`). Real direction: `data/streams/3475724402.json`, `classifyGapsWithSegments(t,d).segments.length>0` and `.coverage.unreliableSec>0` (reachability). Stubbed direction: `vi.doMock('./unreliable-segments.js', ...)` returning `detectUnreliableSegments: () => []`, `vi.resetModules()`, re-import — `segments===[]` and `unreliableSec===0` confirm the stub took, then `stubbedRunningPace.runningPaceSecPerKm !== realRunningPace.runningPaceSecPerKm` AND at least one of `excludedM`/`excludedSec` strictly decreased. Both directions asserted in the same test.
- `pace-single-source.test.ts`'s `BANNED_LITERALS` extended with `'coveredSec / (coveredM / 1000)'` (the exact text at `deriveRunningPace`'s own call site) and `'/ (coveredMetres / 1000)'` (the alternate-variable-name shape). Watched catching a planted drifted copy (`findStreamPaceViolations` on a synthetic `dashboard/views/` file reporting `{ path, needle: 'coveredSec / (coveredM / 1000)', count: 1 }`) and confirmed silent on the identical literal presented as living inside `pace-derivation.ts` — both directions, for both the `coveredM` and `coveredMetres` forms.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RunningPace and deriveRunningPace to pace-derivation.ts (D-08, Reading A)** - `41882146` (feat)
2. **Task 2: Pin the boundary rule with hand-computed fixtures and assert conservation on the four named activities** - `0ee46414` (test)
3. **Task 3: D-11's stub-the-detector proof on 3475724402 and the extended single-source literal scanner** - `a5dd8498` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/analytics/pace-derivation.ts` — `RunningPace` interface, `deriveRunningPace`, `NOT_COMPUTABLE_NO_COVERED_DISTANCE`, `zeroRunningPace` helper. No existing exported signature touched (`detectPaceDisagreement`, `streamPaceSecPerKm`, `PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM`, `PACE_DISAGREEMENT_RATIO` byte-identical per `git diff`).
- `src/analytics/pace-derivation.test.ts` — `deriveRunningPace — boundary rule pinned by hand-computed fixtures (RPACE-01, D-08)` describe block: Group A (5 hand-computed synthetic cases, one containing 5 totality sub-cases) and Group B (structural conservation on the 4 named real activities).
- `src/analytics/pace-single-source.test.ts` — `BANNED_LITERALS` extended (2 new entries); one new planted-violation `it` inside the existing "demonstrated catching" describe block; new `deriveRunningPace reads the detector (SEG-05b, Phase 35 half)` describe block. Phase 33 (`SEG-05b, D-15`) and Phase 34 (`SEG-05b, Phase 34 half`) blocks untouched per `git diff`.

## Decisions Made

- **Not-computable reason reuse without import (D-08's "computable stream" definition):** `pace-quality.ts`'s `NOT_COMPUTABLE_NO_STREAM`/`NOT_COMPUTABLE_UNUSABLE_STREAM` are reused inside `deriveRunningPace` by their literal string value, with an inline comment at each use site explaining why (the import direction forbids importing them). Only the genuinely new third reason, `NOT_COMPUTABLE_NO_COVERED_DISTANCE`, is a real exported constant — declared in `pace-derivation.ts` with a docblock quoting the other two verbatim and citing the exact import-block evidence (`pace-quality.ts:23`) that the reverse edge would cycle. This reading was chosen over declaring local duplicate-named constants for all three, because the plan's own action text says explicitly "Export one interface and one function" plus exactly one new constant — declaring two more exported symbols with the same names as `pace-quality.ts`'s constants (even though technically non-conflicting across modules) would have been an unrequested surface addition.
- **Isolated-jump synthetic fixture design (Group A case c):** built a single non-gap-adjacent 60 m / 2 s burst (30 m/s, well above `UNRELIABLE_SPEED_LIMIT_MPS=7.35`, excess 45.3 m clearing `UNRELIABLE_EXCESS_FLOOR_M=3`, 60 m below `HIDDEN_PAUSE_MIN_METRES=116.95`) after reading `unreliable-segments.ts`'s full detection algorithm (`advanceSteps`/`groupFastRuns`/chaining) to confirm the fixture would genuinely produce a single isolated-jump segment with no gap merging — verified live via the test's own reachability assertions (`segments` length 1, `mechanism === 'isolated-jump'`) rather than assumed.

## Deviations from Plan

**1. [Rule 1 - Bug] Removed literal probe-table figures from a Task 2 doc comment that tripped the plan's own no-pinning grep check**
- **Found during:** Task 2, running the plan's acceptance-criteria grep (`grep -c "2,253\|2253\|797\|5:18\|1,873\|1873"` must print 0)
- **Issue:** An explanatory comment stating the fixtures deliberately avoid the probe's own numbers *quoted those numbers verbatim* ("2,253 m / 797 s / 5:18/km") to say they weren't used — ironic self-defeat: the grep cannot distinguish "these numbers are cited as excluded" from "these numbers are pinned as fixture data."
- **Fix:** Reworded the comment to state the same fact (fixtures use fresh, invented numbers, not the probe's) without quoting any of the probe's own figures.
- **Files modified:** `src/analytics/pace-derivation.test.ts`
- **Verification:** Re-ran the grep; prints `0`. Re-ran `-t "deriveRunningPace"`; still 13/13 pass.
- **Committed in:** `0ee46414` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Cosmetic — no fixture numbers changed, only a comment's wording. No scope creep.

## Issues Encountered

None beyond the auto-fix above. The isolated-jump fixture (Group A case c) required reading `unreliable-segments.ts` in full before writing the fixture, since a plausible-looking burst shape could easily have been merged into an unintended gap-adjacent segment or failed the excess floor — confirmed correct via the test's own live reachability assertions rather than assumed from the docblock alone, per this project's "convenient look-alike fixture" hazard.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `deriveRunningPace` is exported, total, pinned by hand-computed fixtures, and proven to genuinely consume the unreliable-segment detector — the one function the rest of the phase's plans (35-04's independent recount, 35-05's rendering, 35-07's `detectPaceDisagreement` retarget, 35-08's CI write path, 35-09/35-10's dashboard integration) build on.
- Plan 35-04's zero-import recount can now cross-check `deriveRunningPace`'s output on any named activity — this plan deliberately left that independent verification for 35-04, per Group B's own "NOT evidence of correct classification" framing.
- SEG-05b's row in `REQUIREMENTS.md` was NOT ticked or amended here, per the plan's own Requirement-tick safety instruction — plan 35-12 records Phase 35's half. `requirements-completed` in this SUMMARY's frontmatter is empty by design.
- No blockers for plan 35-04.

---
*Phase: 35-stream-derived-running-pace*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 4 files confirmed present via `[ -f ... ]`: this summary,
`src/analytics/pace-derivation.ts`, `src/analytics/pace-derivation.test.ts`,
`src/analytics/pace-single-source.test.ts`. All four commit hashes
(`41882146`, `0ee46414`, `a5dd8498`, `3ec5dd0e`) confirmed present via
`git log --oneline --all`.
