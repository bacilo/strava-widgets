---
phase: 34-pause-classification-forgotten-stop
plan: 09
subsystem: ui
tags: [pace-quality, detail-view, pause-classification, forgotten-stop, quality-signals, vitest]

# Dependency graph
requires:
  - phase: 34-pause-classification-forgotten-stop
    provides: "src/analytics/pace-quality.ts: PauseClassificationSignal/ForgottenStopSignal, the two new ActivityQualitySignals keys, PaceQualityShard.pauseIntervals(+Truncated), projectPauseIntervals() (plan 34-08); src/dashboard/data/pace-quality-client.ts: parsePauseClassificationSignal/parseForgottenStopSignal with named CR-01 fallbacks, and the intentional pauseIntervals-parse stub this plan replaces (plan 34-08)"
provides:
  - "src/dashboard/data/pace-quality-client.ts: VALID_PAUSE_CLASSES/VALID_PAUSE_SOURCES (deliberately separate Sets, D-15), parsePauseInterval — the shard's per-entry pauseIntervals parse, replacing plan 34-08's always-empty stub"
  - "src/dashboard/views/detail-sections.ts: pausesSummaryRow (10th, untiered Quality Signals row), NOT_COMPUTABLE_PAUSE_CLASSIFICATION / NOT_COMPUTABLE_FORGOTTEN_STOP (CR-01 fallbacks), PAUSES_SUMMARY_EXPLANATION, pausesSectionPlan / buildPausesSection (the new Pauses section, D-14/D-15)"
  - "src/dashboard/views/detail.ts: pausesContainer mounted at first paint beside qualitySignalsContainer, filled in the same mountBestEffortsAndBadges Promise.all callback — no new fetch"
  - "D-17 guard (list.test.ts): pauseClassification/forgottenStop provably never produce a qualityBadgeSpecs entry, watched failing under a planted spec push then reverted"
affects: [37-review-queue]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-clause combined summary row (D-14): pausesSummaryRow renders pauseClassification's counts and forgottenStop's D-09-itemised totals as two independently-worded clauses joined by ' · ', each degrading to its own not-computable wording rather than collapsing the whole row to one fallback string — mirrors elevationBadgeContent's own multi-clause join in list.ts."
    - "kind union section plan with an accepted-but-unconsulted second parameter: pausesSectionPlan(shard, quality) matches the sibling qualitySignalsSectionPlan(quality, shard) call site's argument pair for symmetry, but only shard.pauseIntervals currently determines the plan's kind — documented explicitly in the function's own doc comment rather than silently dropped."
    - "Reuse .splits-scroll/.splits-table for a second unrelated table (Pauses) rather than inventing new CSS — zero stylesheet diff, matching D-16's 'no chart module touched' constraint in spirit (no new visual language either)."

key-files:
  created: []
  modified:
    - src/dashboard/data/pace-quality-client.ts
    - src/dashboard/data/pace-quality-client.test.ts
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail-sections.test.ts
    - src/dashboard/views/detail.ts
    - src/dashboard/views/list.test.ts

key-decisions:
  - "pausesSummaryRow's not-computable classification-clause wording ('pause classification not computable — {reason}') is Claude's Discretion — the objective's own copy block only specifies the computable-branch template and the forgottenStop not-computable template verbatim; PauseClassificationSignal itself carries no reason field (unlike ForgottenStopSignal), so the row's own notComputableReason parameter (the same whole-signal reason every other row function already takes) is the only source of wording for that clause, with 'not computed for this activity' as the CR-01 fallback when even that is null."
  - "pausesSectionPlan accepts a quality parameter for call-site symmetry with detail.ts's actual call (pausesSectionPlan(paceQualityShard, quality)) but does not consult it — shard.pauseIntervals already degrades to an empty list for a not-computable activity (buildPaceQualityShard's own not-computable branches), so the two empty-list causes are not distinguished today. Documented in the function's own doc comment rather than silently unused."
  - "buildPausesSection reuses .splits-scroll/.splits-table rather than adding new CSS classes — the ui_notes instruction to match existing conventions and not invent a new visual language, applied literally: zero lines touched in styles.css."

patterns-established: []

requirements-completed: []  # Requirement-tick safety (plan's own instruction): requirements mark-complete and roadmap update-plan-progress were both deliberately NOT run this plan, matching 34-08's precedent. PAUSE-02/STOP-03's disposition is left to a later verification step.

# Metrics
duration: ~10min (commit span 00:47-00:56 local, 2026-09-23, plus pre-commit research/reading)
completed: 2026-09-23
---

# Phase 34 Plan 09: Pauses Disclosed on the Activity Detail View Summary

**A new Pauses section (per-interval table: position, class, duration, distance, fed from the lazy shard) plus a 10th untiered Quality Signals summary row, both reading the classifier/forgotten-stop facts plan 34-08 wired but nothing yet rendered — no list badge, no filter, no chart change, and the 34-08 pauseIntervals parse stub is now a real tolerant per-entry parser.**

## Performance

- **Duration:** ~10 min (commit span 00:47–00:56 local, 2026-09-23), plus pre-commit reading of `pace-quality.ts`, `pace-quality-client.ts`, `detail-sections.ts`, `detail.ts`, `list.ts` and their test files, plus `34-CONTEXT.md`/`34-PATTERNS.md`
- **Tasks:** 3 of 3
- **Files modified:** 6

## Accomplishments

- **Task 1 — the 34-08 shard-parse stub replaced with a real tolerant per-entry parser:** `VALID_PAUSE_CLASSES`/`VALID_PAUSE_SOURCES` (deliberately separate Sets, D-15, mirroring `VALID_ELEVATION_TIERS`'s own "why separate" discipline) and `parsePauseInterval` (mirroring `parseUnreliableSegment`'s drop-on-failure contract exactly) now parse `shard.pauseIntervals` for real — an entry with an unknown `pauseClass`, an unknown `source`, or a non-finite number is dropped alone, the rest of the shard survives, and a shard with no `pauseIntervals` key at all still yields `[]`/`false`. 11 new tests under `-t "pauseIntervals parse"` cover the absent-key default, both unknown-value drops, all five non-finite-field drops, and two exhaustive-union compile-time-locked probes for the two new Sets. `grep -c "VALID_GAP_KINDS"` unchanged.
- **Task 2 — the Quality Signals summary row and the Pauses section:** `pausesSummaryRow` is the 10th row, always `tier: 'untiered'`, combining `pauseClassification`'s per-class counts and `forgottenStop`'s D-09-itemised totals into one line (`"<n> intervals: <a> stationary, <b> walked, <c> ran through, <d> transported · possible forgotten stop: ..."`) — a genuine zero-stretch computable result reads "none found"; a `computable: false` result reads "not computable — {reason}" and never the bare word "none" (D-10). `NOT_COMPUTABLE_PAUSE_CLASSIFICATION`/`NOT_COMPUTABLE_FORGOTTEN_STOP` are the CR-01 `??` fallbacks for a stale `index.json` missing either key. `pausesSectionPlan`/`buildPausesSection` build the new Pauses section from `shard.pauseIntervals` only (D-15: `unreliableSegments` entries never leak in, proven by a dedicated test), with `'unavailable'`/`'empty'`/`'rows'` kinds, covered-creep rows marked "possible forgotten stop (timer running)", zero-advance-pause rows marked "paused (timer running)", the legend sentence and the truncation note. No diff to `detail-charts*` (D-16); no new CSS (reuses `.splits-scroll`/`.splits-table`). `buildPausesSection`'s `textContent`-only discipline is pinned by a source-text guard (no DOM harness exists in this tree, same as every other section builder here). 5 existing `toHaveLength(9)` assertions and the `EXPECTED_LABELS` array were updated for the 10th row.
- **Task 3 — mounted at first paint, and the D-17 no-badge guard watched failing:** `pausesContainer` is created beside `qualitySignalsContainer` in `detail.ts`, appended directly after it in both branches of the `detail.stream` conditional, and filled inside the SAME `Promise.all` callback `mountBestEffortsAndBadges` already resolves — `paceQualityClient.load(` still occurs exactly once (no new fetch, no new await point). The D-17 guard in `list.test.ts` — a row with `transportedCount: 5` and `forgottenStop.totalSec: 900` produces the identical `qualityBadgeSpecs` output as the same row with both keys at their not-computable literals — was watched FAILING first: a temporary planted `specs.push({ signal: 'forgottenStop' as QualityBadgeSpec['signal'], ... })` clause (fired when `forgottenStop.totalSec > 0`) was added to `list.ts`'s `qualityBadgeSpecs`, the guard failed with the planted spec surfacing in the diff (quoted below), then the exact clause was removed — `git diff --exit-code src/dashboard/views/list.ts` is clean.

## Watched-Failing Evidence (quoted verbatim, Task 3)

**D-17 guard under the temporary planted `qualityBadgeSpecs` clause:**
```
FAIL src/dashboard/views/list.test.ts > no pause badge (D-17) — pauseClassification/forgottenStop never produce a qualityBadgeSpecs entry > a row with transportedCount 5 and forgottenStop.totalSec 900 returns specs deep-equal to the same row with both keys at their not-computable literals; no spec names pauseClassification or forgottenStop
AssertionError: expected [ { signal: 'forgottenStop', …(3) } ] to deeply equal []

- Expected
+ Received

- []
+ [
+   {
+     "descriptionIdSuffix": "planted",
+     "explanation": "planted violation",
+     "signal": "forgottenStop",
+     "visibleText": "planted violation",
+   },
+ ]
```
Reverted immediately (the exact planted `if` block removed); re-run confirmed GREEN. `git diff --exit-code src/dashboard/views/list.ts` exits 0 — list.ts is byte-identical to HEAD.

## Matched `-t` Filter Counts (Rule 1 — every filter checked non-zero)

- `pace-quality-client.test.ts -t "pauseIntervals parse"` — 11 matched, passed
- `detail-sections.test.ts -t "Pauses summary row"` — 7 matched, passed
- `detail-sections.test.ts -t "pausesSectionPlan"` — 7 matched, passed
- `list.test.ts -t "no pause badge"` — 1 matched, passed (after the watched-failing round-trip above)

## Task Commits

1. **Task 1: Tolerant shard pauseIntervals parse** - `f6e7938e` (feat)
2. **Task 2: The Quality Signals summary row and the Pauses section plan and builder** - `a4aa5804` (feat)
3. **Task 3: Mount the Pauses section in the existing shard callback, and guard that no list badge appears (D-17)** - `5f5ca924` (feat)

**Plan metadata:** (this commit, next) `docs(34-09): complete plan`

## Files Created/Modified

- `src/dashboard/data/pace-quality-client.ts` — `VALID_PAUSE_CLASSES`/`VALID_PAUSE_SOURCES`; `parsePauseClass`/`parsePauseSource`/`parsePauseInterval`; `parsePaceQualityShard`'s `pauseIntervals` field now parsed for real (was `[]` stub).
- `src/dashboard/data/pace-quality-client.test.ts` — `validShard.pauseIntervals` gained two well-formed entries (previously `[]`, per 34-08's documented stub); new "pauseIntervals parse" describe (11 tests).
- `src/dashboard/views/detail-sections.ts` — `PAUSES_SUMMARY_EXPLANATION`; `forgottenStopStretchesText`/`pausesSummaryRow` (10th row); `notAvailableRows()` gains a 10th entry; `NOT_COMPUTABLE_PAUSE_CLASSIFICATION`/`NOT_COMPUTABLE_FORGOTTEN_STOP`; `qualitySignalsSectionPlan` wires the 10th row; `PausesSectionRow`/`PausesSectionPlan`/`pauseClassLabel`/`pausesSectionRowClassText`/`pausesSectionPlan`/`buildPausesSection` (the new Pauses section).
- `src/dashboard/views/detail-sections.test.ts` — 5 `toHaveLength(9)`→`10` updates, `EXPECTED_LABELS` gains `'Pauses'`; new "Pauses summary row" (7 tests), "pausesSectionPlan" (7 tests) and "buildPausesSection source guard" (2 tests) describe blocks.
- `src/dashboard/views/detail.ts` — `pausesContainer` created/appended/threaded/filled; `buildPausesSection`/`pausesSectionPlan` imported; `mountBestEffortsAndBadges` gains the `pausesContainer` parameter.
- `src/dashboard/views/list.test.ts` — new "no pause badge (D-17)" describe (1 test).

## Decisions Made

See `key-decisions` in the frontmatter above: the classification-clause not-computable wording (Claude's Discretion, since `PauseClassificationSignal` carries no `reason` field of its own), `pausesSectionPlan`'s accepted-but-currently-unconsulted `quality` parameter (kept for call-site symmetry, documented rather than silently dropped), and the `.splits-scroll`/`.splits-table` CSS reuse (zero stylesheet diff).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The 34-08 SUMMARY's own documented stub (`parsePaceQualityShard`'s `pauseIntervals` always returning `[]`) is fully resolved by this plan's Task 1 — no browser-facing stub remains that would make the Pauses section render vacuously.

## Threat Flags

None beyond the plan's own `<threat_model>` (T-34-30..T-34-33), all mitigated as specified: `buildPausesSection`/`pausesSummaryRow` reach the DOM through `textContent` only, pinned by a source-text guard forbidding `innerHTML`/`insertAdjacentHTML`/`outerHTML` (T-34-30); `qualitySignalsSectionPlan`/`pausesSectionPlan` both have named `??` fallbacks and an `'unavailable'` kind, tested against missing keys and a `null` shard (T-34-31); the D-17 guard test, watched failing under a planted spec push (T-34-32); no diff to `detail-charts*` (T-34-33).

## Next Phase Readiness

- The detail view now discloses every off-the-clock interval's class, position, duration and distance, marks possible forgotten stops, and summarises both facts in one untiered Quality Signals row — PAUSE-02 ("the detail view lists each pause with its class, duration and distance") and STOP-03 ("disclosed on the detail view") are now rendered claims, though `requirements mark-complete` was deliberately not run this plan (see `requirements-completed` above).
- Plan 37 (review-queue ordering) can still read the index-row summary (`quality.pauseClassification`/`quality.forgottenStop`) without a shard fetch, per D-17 — unaffected by this plan, which touches no list-row surface.
- `npm test`: 98 files / 3460 tests, all green (up from the 34-08 baseline of 98 files / 3432 tests, +28 new tests: 11 in `pace-quality-client.test.ts`, 16 in `detail-sections.test.ts`, 1 in `list.test.ts`). `npx tsc --noEmit`, `npm run build` and `npm run build-widgets` all exit 0. `git status --porcelain data/streams` empty throughout — no stream regeneration was needed for this plan.
- The on-disk `data/stats/pace-quality/*.json` archive predates plan 34-08's new signal/shard fields (a genuinely stale artifact, not regenerated by this plan or by 34-08) — real-activity end-to-end checks in this plan's own test suite (Task 2/`detail-sections.test.ts`'s existing "Task 3 (33-11)" describe) exercise the live `buildPaceQualityShard`/`parsePaceQualityShard`/`qualitySignalsSectionPlan` pipeline directly rather than the stale committed archive; archive regeneration (if ever needed) is out of this plan's declared scope.

---
*Phase: 34-pause-classification-forgotten-stop*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `src/dashboard/data/pace-quality-client.ts`
- FOUND: `src/dashboard/data/pace-quality-client.test.ts`
- FOUND: `src/dashboard/views/detail-sections.ts`
- FOUND: `src/dashboard/views/detail-sections.test.ts`
- FOUND: `src/dashboard/views/detail.ts`
- FOUND: `src/dashboard/views/list.test.ts`
- FOUND: `.planning/phases/34-pause-classification-forgotten-stop/34-09-SUMMARY.md` (this file)
- FOUND commits: `f6e7938e`, `a4aa5804`, `5f5ca924`
