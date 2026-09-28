---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 05
subsystem: testing
tags: [best-effort, clean-window-search, unreliable-segments, vitest, demonstration]

# Dependency graph
requires:
  - phase: 36-04
    provides: "The wired-in clean-window search (computeActivityEfforts three-branch partition, wholeSpanCuts/complementSubIntervals/segmentsIntersectingWindow, contaminationRecord/unreliableSegmentDemotion) that this plan demonstrates against real archive activities and hand-built fixtures"
  - phase: 36-02
    provides: "The three scoping activities' BEFORE reference table (durations, startOffsetSec, mm:ss) this plan's after-state assertions link against"
provides:
  - "D-02: proof, on the locked real fixture 3475740390, that a plausible-looking d-rebased splice fabricates a strictly faster window than the shipped partition — with reachability proven first and 3475724402 documented as deliberately unpaired"
  - "D-08: precedence demonstrated on two real activities (3475725842, 3475713251) whose raw window genuinely fails an absolute guard, proving the demoted-guard's structural precedence over isPlausible"
  - "Criterion 1/4: all three scoping activities' contaminated records proven to retain their pinned BEFORE window while the ranked figure moves strictly slower (and, for 3475740390, off every detected segment)"
  - "D-14: the derived 400m ceiling proven equal to a hand-built clean-population expectation and unequal to a hand-built raw-population one, with populationN itself testifying no contaminated activity was dropped"
  - "SEG-05b, Phase 36 half: the detector proven load-bearing through the production computeBestEfforts orchestrator (not only the pure seam), recorded so the row's final tick (plan 36-14) has its last supporting half"
affects: [36-06, 36-07, 36-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real-archive demonstration over synthetic look-alikes: D-02/D-08/scoping-activities read data/streams/<id>.json and data/activities/<id>.json directly via a local readRealStream/readRealActivity pair, never a hand-rolled substitute (Pitfall 12)"
    - "Reachability-before-comparison: every new row asserts its own discriminator (segments.length > 0, a non-empty intersection, isPlausible.ok === false, a detected segment) BEFORE the comparison it exists to prove, so a vacuous fixture fails loudly instead of passing silently"
    - "Two-hop detector stub through the production orchestrator (SEG-05b): vi.doMock('./unreliable-segments.js', ...) + vi.resetModules() + dynamic re-import, asserted in both directions in one test, with a post-vi.doUnmock re-assertion catching a leaked mock"

key-files:
  created: []
  modified:
    - src/analytics/compute-best-efforts.test.ts
    - src/analytics/pace-single-source.test.ts

key-decisions:
  - "D-02/D-08/PR-09 demonstrations read real committed archive fixtures directly (fs.readFile against data/streams/ and data/activities/), never synthetic look-alikes — the exact discipline 36-RESEARCH.md Pitfall 12 and this project's own history (Phase 23, Phase 32) require"
  - "The D-14 ceiling-population fixture's contaminated-activity streams are engineered so the UNBOUNDED sweep's fastest window blends a huge one-second burst (~259.6m) with a UNIFORM slow tail (2.5 m/s) — this is the specific construction that makes the bounded clean-window search land on exactly the slow pace (not a blend), because the entire complement region is uniformly paced; a burst immediately followed by a faster-than-final-pace tail was rejected in design because the bounded search would then find a hybrid duration, not the intended hand-computed clean figure"
  - "Contaminated-activity tail samples use dt=10s steps (never exceeding RECORDING_GAP_ABS_THRESHOLD_SEC) so the tail is classified 'covered', not 'recording-gap' — a >10s gap would merge into the detected segment via the gap-adjacent chaining rule and collapse the complement to nothing, discovered by direct calculation before writing the fixture"

patterns-established: []

requirements-completed: []

# Metrics
duration: ~65min
completed: 2026-09-28
---

# Phase 36 Plan 05: Real-Archive & Ceiling-Population Demonstrations Summary

**Four independent-value demonstrations added to `compute-best-efforts.test.ts` (D-02 splice fabrication on real activity 3475740390, D-08 precedence on two real activities whose raw window fails an absolute guard, the three scoping activities' after-state, and a D-14 hand-built ceiling-population proof) plus Phase 36's own SEG-05b half in `pace-single-source.test.ts`, proving the detector load-bearing through the production `computeBestEfforts` orchestrator.**

## Performance

- **Duration:** ~65 min (reading context + measurement scripts + implementation + verification)
- **Started:** 2026-09-28T16:50 (approx, first targeted test run)
- **Completed:** 2026-09-28T16:59:50+02:00 (Task 4 commit)
- **Tasks:** 4 completed
- **Files modified:** 2

## Accomplishments

- **Task 1 (D-02):** a local `dRebasedSplice` helper (test-only) reproduces the "wrong implementation a competent maintainer would actually write" on the real, committed `3475740390` stream. Reachability proven first (`segments.length` = 5, raw-window intersection length = 4). The splice (116.55s) is asserted strictly faster than the independently re-derived honest partition (119.6s) — the row's CAN-FAIL direction. Nothing is asserted against today's unconstrained figure (naive splice measured slower than today on this activity, matching 36-RESEARCH.md's own caution). `3475724402` is recorded, unpaired, with both re-measured d-rebased figures logged and reconciled.
- **Task 2 (D-08 + scoping activities after):** `3475725842` (raw fails `max-speed`, activity's own `max_speed` 6.08 m/s) and `3475713251` (raw fails `world-record`) both demonstrate `demotion === null`, `contaminated.guard === 'unreliable-segment'`, and the ranked figure independently plausible. All three scoping activities' `contaminated` records are shown reproducing the exact pinned BEFORE mm:ss and `startOffsetSec` from 36-02-SUMMARY.md, with the ranked figure strictly slower; `3475740390`'s ranked window is proven non-overlapping with every detected segment under a stated 0.6s tolerance.
- **Task 3 (D-14):** two hand-built `deriveCeilings` candidates (clean-only vs raw-included speeds) are shown diverging first, then the shipped 400m ceiling is shown close to the clean candidate and not close to the raw one, with `populationN === 120` testifying every one of 20 contaminated fixture activities contributed its clean figure. A second fixture shows 3 no-clean-window activities excluded entirely from `populationN` (100, not 103).
- **Task 4 (SEG-05b, Phase 36 half):** the Phase 34 TWO-HOP stub shape, copied for `compute-best-efforts.js -> pace-derivation.js -> unreliable-segments.js`, run through the real `computeBestEfforts` orchestrator against the real `3475740390` fixture copied into a throwaway directory. Both directions in one test: real carries a non-null `contaminated`; stubbed collapses to today's unconstrained figure (`contaminated: null`, `durationSec` matching the unbounded sweep, pace `3:20`).

## Task Commits

Each task was committed atomically:

1. **Task 1: D-02 — the d-rebased splice fabricates a faster window than the shipped partition on 3475740390** - `d5c47702` (test)
2. **Task 2: D-08's precedence on two real activities, and the three scoping activities' after-state** - `c918637b` (test)
3. **Task 3: D-14 — the derived ceiling provably reflects only clean speeds** - `c19a0a46` (test)
4. **Task 4: SEG-05b — Phase 36's half, proven load-bearing by stubbing the detector** - `29139309` (test)

**Plan metadata:** per the worktree-agent instructions, this agent does not update STATE.md/ROADMAP.md — the orchestrator does so centrally after merge.

## Files Created/Modified

- `src/analytics/compute-best-efforts.test.ts` — new top-level imports (`isPlausible`, `WORLD_RECORD_SPEED_MPS`, `segmentsIntersectingWindow`, `wholeSpanCuts`, `classifyGapsWithSegments`), three new helper functions (`paceMinSec`, `readRealStream`, `readRealActivity`), and four new describe blocks: `splice fabricates a faster window than the shipped partition (D-02, PR-06)`, `3475725842 & 3475713251 — D-08 precedence...`, `scoping activities after — ...`, and `ceiling population (D-14): ...` (the last nested inside the existing `computeBestEfforts — archive orchestration` describe, alongside `ceiling is non-circular`).
- `src/analytics/pace-single-source.test.ts` — new imports (`mkdtempSync`, `mkdirSync`, `writeFileSync`, `copyFileSync`, `rmSync` from `node:fs`; `os` from `node:os`; `findBestEffort` from `./best-effort-utils.js`) and one new describe block, `computeBestEfforts reads the detector (SEG-05b, Phase 36 half)`, inserted after the existing Phase 35 SEG-05b block and before the Phase 33 D-05 block — neither existing block touched.

## Verification Evidence

- `npx tsc --noEmit` exits 0 at every commit boundary.
- `npx vitest run src/analytics/compute-best-efforts.test.ts -t "splice fabricates"` — **2 tests matched, both pass** (not 0).
- `npx vitest run src/analytics/compute-best-efforts.test.ts -t "3475725842"` — **2 tests matched, both pass** (the describe title itself contains the filter string, so both the `3475725842` and `3475713251` cases match).
- `npx vitest run src/analytics/compute-best-efforts.test.ts -t "scoping activities after"` — **3 tests matched, all pass**.
- `npx vitest run src/analytics/compute-best-efforts.test.ts -t "ceiling population"` — **2 tests matched, both pass** (>= 2 required).
- `npx vitest run src/analytics/compute-best-efforts.test.ts -t "no iteration to convergence"` — **2/2 pass, unedited** (confirmed by `git diff` showing zero changes inside that describe's own text across all four commits).
- `npx vitest run src/analytics/compute-best-efforts.test.ts` (unfiltered) — **76/76 pass**.
- `npx vitest run src/analytics/pace-single-source.test.ts` (unfiltered) — **98/98 pass** (97 before this plan's Task 4, +1 new test).
- `npm test` (full suite, after `npm run build` + `npm run compute-best-efforts` + `npm run build-widgets` to satisfy this bare worktree's environment prerequisites — see Deviations) — **102/102 files, 3838/3838 tests pass**.
- `git status --porcelain data/` — empty at every commit boundary (the local `compute-best-efforts` run's rewrite of the tracked `data/best-effort-ceiling.json` was reverted via `git checkout -- data/best-effort-ceiling.json` **before** any commit).
- `git diff --stat 17b5a455... -- src/analytics/` touches exactly the two files in `files_modified`: `compute-best-efforts.test.ts` (610 lines added/changed) and `pace-single-source.test.ts` (139 lines added/changed).
- `git diff -- .planning/REQUIREMENTS.md` — empty (untouched, per this plan's own instruction to tick nothing).

## D-02 — Re-measured Variant Durations (Task 1, reconciled against 36-RESEARCH.md § Pitfall 7)

**`3475740390`@400m** (measured 2026-09-28 against the live archive, via a standalone Node script running the shipped `dist/` build directly):

| Variant | Duration | Pace (mm:ss/km) | 36-RESEARCH.md's figure | Reconciliation |
|---|---|---|---|---|
| Today (raw, unconstrained) | 79.907s | 3:20 | 79.9s / 3:20 | exact match |
| Honest partition | 119.594s | 4:59 | 119.6s / 4:59 | exact match |
| Naive splice (delete only) | 81.482s | 3:24 | 82.3s / 3:26 | ~1s / one mm:ss bucket off — not asserted anywhere in the test (per D-02's own bound), plausibly a boundary-convention difference between RESEARCH's own quick re-implementation and the shipped `wholeSpanCuts`/`complementSubIntervals` pair; does not affect the locked row |
| **D-rebased splice** | **116.554s** | **4:51** | 116.6s / 4:51 | near-exact match (within rounding) |

The locked row (splice STRICTLY faster than the honest partition) holds: 116.554s < 119.594s.

**`3475724402`@400m** (the deliberately-unpaired activity, re-measured this run):

| Variant | Duration | Pace |
|---|---|---|
| Honest partition | 116.115s | 4:50 |
| D-rebased splice | 118.836s | 4:57 |

This run's own measurement — splice (118.836s) SLOWER than partition (116.115s) — agrees with **36-CONTEXT.md finding 2** (splice slower than partition, 4:57 > 4:50), not with 36-RESEARCH.md's own re-implementation (which reported them identical at 4:50). Per the plan, this discrepancy is recorded, not resolved — the locked D-02 row pins `3475740390` only, and no ordering is asserted on `3475724402` in the test file.

## D-08 — Real-Activity Guard Names (Task 2)

| Activity | Raw duration | Raw implied speed | Guard tripped | Ranked (clean) duration | Ranked implied speed |
|---|---|---|---|---|---|
| `3475725842` | 14.191s | 28.186 m/s | `max-speed` (activity `max_speed` 6.08 m/s) | 122.933s | 3.254 m/s (plausible) |
| `3475713251` | 27.120s | 14.749 m/s | `world-record` (9.296 m/s) | 133.680s | 2.992 m/s (plausible) |

Both: `demotion === null`, `contaminated.guard === 'unreliable-segment'`, `contaminated.reason` names neither `max_speed` nor `world-record` (it names the detected segment instead) — the precedence rule holds: the absolute guard saw only the clean figure.

## Scoping Activities' After-State (Task 2, reconciled against 36-CONTEXT.md's AFTER table)

| Activity | Contaminated (BEFORE, pinned) | Contaminated `startOffsetSec` | Ranked (AFTER) mm:ss | 36-CONTEXT.md's reference |
|---|---|---|---|---|
| `3475740390` | 3:20/km | 2508 (matches 36-02-SUMMARY.md exactly) | 4:59/km | 4:59/km — exact match |
| `3475724402` | 3:21/km | 3061 (exact match) | 4:50/km | 4:50/km — exact match |
| `3475734189` | 3:22/km | 1285 (exact match) | 5:08/km | 5:08/km — exact match |

All three AFTER figures reconcile exactly against 36-CONTEXT.md's probe table. None of these AFTER figures is asserted as a literal string anywhere in `compute-best-efforts.test.ts` (only the BEFORE figures and `toBeGreaterThan` comparisons are asserted) — confirmed by `grep -c` returning 0 for `4:59`, `4:50` and `5:08` across the full file.

## D-14 — Ceiling Population (Task 3)

**Clean-window case:** `cleanCandidate['400m'].ceilingMps` = 4.4801, `rawCandidate['400m'].ceilingMps` = 8.9601 (divergent, as required). Shipped `doc.ceilings['400m'].ceilingMps` = 4.4795 — close to the clean candidate (`toBeCloseTo(..., 2)`), not close to the raw one (`not.toBeCloseTo(..., 0)`, difference ~4.48). `populationN` = **120** (100 clean + 20 contaminated, each contributing its own clean figure).

**No-clean-window case:** `populationN` = **100** — all three no-clean-window activities (raw 395m in 1s, remainder only 5m) are excluded entirely; each carries `demotion.guard === 'unreliable-segment'`.

## SEG-05b, Phase 36 Half (Task 4)

Real direction (`3475740390`@400m through `computeBestEfforts`): `contaminated` non-null (the detector is load-bearing).
Stubbed direction (`detectUnreliableSegments` -> `[]`, two hops through `pace-derivation.js`): `contaminated: null`, `durationSec` = 79.9s (matching `round1` of the unbounded `findBestEffort` duration exactly), pace converts to `3:20` — the pinned BEFORE figure, proving the stubbed build is provably today's build. Both directions in one test; a post-`vi.doUnmock` re-assertion (`segments.length > 0`) catches any leaked mock. Neither the Phase 33 nor the Phase 34 block was touched (`git diff` confirms).

## Decisions Made

- The D-14 contaminated-activity fixture's tail is engineered as a **uniform** slow pace from immediately after the burst onward (rather than a fast-then-slow two-phase tail), because a bounded clean-window search over a non-uniform complement would find a hybrid duration, not the intended hand-computed clean figure — discovered by direct calculation before writing the fixture (documented as a scratch measurement, not committed).
- Contaminated-activity tail steps use `dt = 10s` (the recording-gap threshold boundary, not exceeding it) — a `dt > 10s` step is reclassified as a `recording-gap` by `pace-derivation.ts`'s pass 1, which merges with a touching burst into one `gap-adjacent` segment and can collapse the complement to nothing; verified by direct calculation this fixture avoids that trap.
- All real-archive demonstrations (D-02, D-08, scoping activities) read `data/streams/`/`data/activities/` directly via `fs.readFile`, mirroring the existing `readStream` pattern in `pace-derivation.test.ts`/`best-effort-utils.test.ts`, rather than a synthetic look-alike — per 36-RESEARCH.md Pitfall 12 and this plan's own explicit instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan Task 2's own automated verify script hardcodes a whole-file substring check that the pre-existing file (from plan 36-04) already violates**
- **Found during:** Task 2 verification
- **Issue:** The plan's Task 2 `<verify>` script asserts `'52.4' not in s and '28.6' not in s` against the **entire file's** text (`s`), scanning for hardcoded segment-metre figures. But `src/analytics/compute-best-efforts.test.ts`'s pre-existing `contamination reason strings (PR-07, D-07)` describe block (committed by plan 36-04, Task 3, well before this plan started) already hardcodes these exact figures in synthetic `makeSegment({..., metres: 52.4, ...})` fixtures — an intentional and correct part of that earlier plan's own test design. The check as literally written is therefore unsatisfiable regardless of what this plan's own new code does.
- **Fix:** Ran a corrected, scoped version of the check — confirmed the full-file assertion fails for the reason above, then confirmed a scope-limited version (from this plan's own new `3475725842 & 3475713251` describe through the start of the pre-existing `computeBestEfforts — archive orchestration` describe) passes: neither `52.4` nor `28.6` appears anywhere in this plan's own newly-added text. Every segment metre/second figure this plan's own code asserts is derived from `segmentsIntersectingWindow(...)`'s own live output (`seg.metres.toFixed(1)`), never a literal.
- **Files modified:** none (verification-only)
- **Verification:** scoped Python check (documented above) confirms zero hardcoded segment-metre literals in this plan's own additions.
- **Committed in:** n/a (caught during verification, no source change needed)

**2. [Rule 1 - Bug] My own draft comments accidentally wrote out the banned AFTER figures as literal mm:ss substrings**
- **Found during:** Task 2's own automated verify script, first run
- **Issue:** The plan's Task 2 verify script asserts `'4:59' not in s and '5:08' not in s` (and the acceptance criteria additionally names `4:50`) — my own docblock comments (explaining what "today's" and "the naive splice's" pace was, and summarizing the after-state describe's purpose) had written these exact mm:ss substrings out in prose, even though no `expect()` assertion used them.
- **Fix:** Reworded all such comments to use seconds-only figures (e.g., "~119.6s" instead of "4:59") or to describe the figures without spelling their mm:ss form, preserving the same informational content.
- **Files modified:** `src/analytics/compute-best-efforts.test.ts`
- **Verification:** `grep -c "4:59\|5:08\|4:50"` returns 0 across the full file; the corrected verify script's `for after in ['4:59','5:08']: assert after not in s` passes cleanly.
- **Committed in:** `d5c47702` and `c918637b` (fixed before either commit, not a follow-up)

**3. [Rule 3 - Blocking] Worktree environment setup: build dist/, run compute-best-efforts, build-widgets to unblock the full `npm test` suite; the local run briefly dirtied a tracked file, reverted before any commit**
- **Found during:** first `npm test` run, before Task 1's commit
- **Issue:** This bare worktree had no `dist/` (built output) and no `data/stats/`/`dist/widgets/` (needed by `scripts/verify-dashboard-publish-stats.test.mjs`), matching the precedent already documented in plans 36-03's and 36-04's own SUMMARYs. Running `npm run compute-best-efforts` to generate the real stats file rewrote the TRACKED `data/best-effort-ceiling.json`.
- **Fix:** Ran `npm run build`, `npm run compute-best-efforts`, `npm run build-widgets`, then immediately reverted the rewritten `data/best-effort-ceiling.json` via `git checkout -- data/best-effort-ceiling.json` **before staging or committing anything**.
- **Files modified:** none tracked (the one tracked file touched was reverted)
- **Verification:** `git status --porcelain data/` empty before every commit in this plan.
- **Committed in:** n/a (environment setup only, no commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 — a plan verify-script bug against pre-existing 36-04 content, and my own draft comments briefly tripping the same AFTER-figure ban; 1 Rule 3 — standard bare-worktree environment setup).
**Impact on plan:** None touch this plan's own design or scope. #1 is a pre-existing-content/verify-script mismatch predating this plan, resolved by a scoped re-check rather than any source change. #2 was caught and corrected in prose only, before any commit — no assertion was ever affected. #3 is the same environment-bareness pattern already documented by two prior plans in this phase.

## Issues Encountered

None beyond the three deviations above, all resolved without any change to this plan's design or any weakening of an assertion.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All four demonstrations (D-02, D-08, D-14, SEG-05b Phase 36 half) are committed, green, and independently verified against real archive data and hand-built fixtures — the phase's own claims about itself are no longer asserted only in prose.
- SEG-05b's Phase 36 half is now recorded in `pace-single-source.test.ts`; per this plan's own instruction, the REQUIREMENTS.md row itself is deliberately NOT ticked here — that is plan 36-14's job, confirmed by `git diff -- .planning/REQUIREMENTS.md` being empty.
- No blockers for 36-06/36-07 (parallel plans in this wave) or 36-14 (the plan that records the SEG-05b tick).

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: src/analytics/compute-best-efforts.test.ts
- FOUND: src/analytics/pace-single-source.test.ts
- FOUND: commit d5c47702
- FOUND: commit c918637b
- FOUND: commit c19a0a46
- FOUND: commit 29139309

---
*Phase: 36-best-effort-clean-window-search-ceiling-recalibration*
*Completed: 2026-09-28*
