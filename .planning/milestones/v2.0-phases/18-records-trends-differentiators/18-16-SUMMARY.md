---
phase: 18-records-trends-differentiators
plan: 16
subsystem: testing
tags: [validation, manual-checkpoint, age-grading, wma, vitest, dashboard]

# Dependency graph
requires:
  - phase: 18-records-trends-differentiators
    provides: "Plans 18-01 through 18-15's records/trends/differentiators implementation, ready for phase-close validation"
provides:
  - "Completed 18-VALIDATION.md with full per-task verification map, reconciled Wave 0 checklist, and a verbatim-recorded, approved human checkpoint"
  - "Approved phase gate: nyquist_compliant true, status approved, all 20 manual-only checklist items observed and recorded"
  - "Documentation-defect finding: 18-UI-SPEC.md §19 checklist wording (line 843) contradicts the authoritative chart spec (line 319) — code is correct, checklist text is wrong"
affects: [19, verification, records, trends]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/18-records-trends-differentiators/18-16-SUMMARY.md
  modified:
    - .planning/phases/18-records-trends-differentiators/18-VALIDATION.md

key-decisions:
  - "Approved the phase gate on the developer's verbatim 'it's all good' verdict, with three coverage gaps recorded honestly rather than silently assumed passing (640px resize sub-check, evolution-chart PR-number-matches-low-point sub-check, and a second age-grade cross-check distance)"
  - "Recorded the item-3 evolution-chart 'ascending not descending' observation as a documentation defect, not a code defect: src/dashboard/views/records-charts.ts:97 correctly implements 18-UI-SPEC.md:319's reverse:true requirement; the §19 checklist wording at line 843 is the thing that is wrong"
  - "Did not assert a cause for item 20's 0.51-point delta after the orchestrator's correction retracted the original age-mismatch explanation (developer used the same age, 40, for both the dashboard's effort-date resolution and the external calculator) — recorded as an unexplained-but-in-tolerance residual with only an explicitly unverified WMA-edition/rounding hypothesis noted"

requirements-completed: [REC-02, REC-03, REC-04, REC-05, REC-06, REC-07, TREND-01, TREND-02, TREND-03, TREND-04, TREND-05]

# Metrics
duration: (Task 1 + Task 2 checkpoint, spanning a human-verification pause)
completed: 2026-08-12
---

# Phase 18 Plan 16: Real-Browser Validation Checkpoint Summary

**Phase 18 gate approved after a human walked all 20 items of 18-UI-SPEC.md §19 against a production-shaped `/strava-widgets` URL, surfacing one real documentation defect (chart-checklist wording, not code) and three honestly-recorded coverage gaps, none of which blocked approval.**

## Performance

- **Tasks:** 2 (1 automated gate-and-reconcile, 1 human-verify checkpoint)
- **Files modified:** 1 (`18-VALIDATION.md`), plus this summary

## Accomplishments

- Ran the full automated gate from a clean state: `npm run build` (0), `npm test` (884/884 passing across 46 files), `node dist/index.js compute-all-stats` (0), `npm run build-widgets` (0), `npm run verify-dashboard` (37/37 publish checks).
- Reconciled `18-VALIDATION.md`'s Per-Task Verification Map: replaced every `TBD` with real plan numbers, waves, and commands; marked the `athlete-config-client.test.ts` Wave 0 item `SUPERSEDED` by plan 18-01's locked deviation (birthDate/sex/restingHr moved to the gitignored `data/private/athlete-private.json`) rather than silently ticking it.
- Recorded live-archive measurements at phase close (Riegel fit, training-load spine, gear coverage, WMA editions, per-distance PR-evolution step counts) for future-phase reference.
- Ran a full real-browser verification session against `http://localhost:8099/strava-widgets/` (production-shaped path, console visible throughout) and recorded a verbatim observation for all 20 items in 18-UI-SPEC.md §19.
- Approved the phase: `nyquist_compliant: true`, `status: approved`, `Approval: approved 2026-08-12`.

## Task Commits

1. **Task 1: Run the full gate and reconcile the validation record** - `cac50ae` (docs) — build/test/compute-all-stats/build-widgets/verify-dashboard all exit 0, 884/884 tests, 37/37 publish checks; every `TBD` replaced, one Wave 0 item marked `SUPERSEDED` rather than ticked.
2. **Task 2: Real-browser verification checkpoint** - recorded in this commit (docs) — 20/20 checklist items observed verbatim, checkpoint approved.

**Plan metadata:** this commit (docs: complete plan)

## Checkpoint Verdict

**Approved.** All 20 items of 18-UI-SPEC.md §19 were walked by the developer against `http://localhost:8099/strava-widgets/` with the browser console visible for the entire session. Developer's overall verdict, verbatim: **"it's all good"**.

**Confirmed requirement IDs:** REC-02, REC-03, REC-04, REC-05, REC-06, REC-07, TREND-01, TREND-02, TREND-03, TREND-04, TREND-05.

## Task 1 Gate Results

| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm test` | 884/884 tests passing, 46 files |
| `node dist/index.js compute-all-stats` | exit 0 |
| `npm run build-widgets` | exit 0 |
| `npm run verify-dashboard` | 37/37 publish checks passing |

## Independent Age-Grade Cross-Check (Item 20 — REC-06's only correctness check)

- Distance: 5k. Time: 21:26 (4:17/km). Effort date: May 29, 2022. Age at effort: 40 (male).
- Dashboard: **62.6%**. External calculator, entered at the same age (40): **63.11%**. Delta: **0.51 points** — inside the plan's ~1-point tolerance. **PASSES.**
- Calculator source: **unspecified** by the developer — recorded as unspecified rather than guessed.
- Both figures used the **same age (40)**. An earlier explanation involving age-resolution semantics (dashboard resolving age at the effort's date vs. a present-day age entered into the calculator) was floated and then explicitly retracted by the orchestrator after the developer clarified, verbatim: *"no. i am 44 i put 40 because it was the age i had at the time."* That explanation has been removed from the validation record and does **not** appear anywhere in `18-VALIDATION.md`.
- **No cause is asserted for the 0.51-point delta.** As an explicitly unverified, uninvestigated hypothesis only, the record notes that the repo bundles the WMA road 2025 edition while public calculators often use an earlier edition — edition differences or rounding are candidate explanations, but this was not checked.
- **Limitation:** the plan asked for two PR rows at two different distances to be cross-checked; only one distance (5k) was actually checked. REC-06's external evidence is therefore one data point with a small, unresolved residual, not a fully independent two-point confirmation.

## Recorded Limitations (honesty over a clean-looking gate)

1. **§ 19 checklist wording defect, not a code defect (item 3).** `18-UI-SPEC.md:843` reads "each renders a visibly descending step", contradicting `18-UI-SPEC.md:319`'s mandatory `reverse: true` y-scale requirement. `src/dashboard/views/records-charts.ts:97` correctly implements line 319. The checklist wording at line 843 needs correction in a future documentation pass; approval was not blocked by this because the code matches the authoritative chart spec.
2. **Item 3's second sub-check** — that the big `.text-display` current-PR number matches the chart's lowest/best point — was not separately confirmed by the developer.
3. **Item 2's 640px resize gap/overlap sub-check** was not separately confirmed, and **item 20 cross-checked one distance (5k) rather than the two the plan asked for.**
4. **Item 20's 0.51-point delta** between the bundled WMA tables and an independent calculator, evaluated at the same age, is within tolerance but unexplained; only an unverified WMA-edition/rounding hypothesis is noted, and a second distance was never cross-checked.

None of these four items were treated as failures — each is recorded as an honest coverage gap per the checkpoint's Repudiation threat (T-18-VERIFY-03), which requires verbatim, unsmoothed recording rather than upgrading hedged observations into confident ones.

## Decisions Made

- Approved the phase gate on the developer's verbatim overall verdict, while recording every coverage gap and hedge honestly rather than rounding them up to full confirmation.
- Classified the item-3 evolution-chart observation as a documentation defect in 18-UI-SPEC.md's §19 checklist wording, not a code defect — the shipped chart code correctly follows the spec's own §3 requirement.
- Removed and did not record an initially-proposed explanation for item 20's delta (age-resolution mismatch) after the orchestrator retracted it based on the developer's direct clarification; recorded the residual as unexplained instead of asserting an unverified cause as fact.

## Deviations from Plan

None beyond what the plan's Task 2 anticipated (recording an honest, possibly-partial verbatim outcome). No source files under `src/` or `scripts/` were touched; only `18-VALIDATION.md` and this summary were modified/created.

## Issues Encountered

Mid-recording, the orchestrator issued a correction retracting an initial (incorrect) explanation for item 20's delta, after the developer clarified that both the dashboard and the external calculator used the same age (40), not different ages as first assumed. The validation record was corrected before commit so the incorrect rationale never persisted to disk in a committed state — the record now states the delta is unexplained, with only an explicitly unverified hypothesis noted.

## User Setup Required

None - no external service configuration required. The temporary `data/private/athlete-private.json` used for item 20 remained untracked (`git status --porcelain data/private/` empty) and gitignored per `.gitignore:22`.

## Next Phase Readiness

Phase 18 is approved and closed. Two follow-up items are recorded for future work, not blockers:
- Correct `18-UI-SPEC.md:843`'s checklist wording to match the reversed y-scale mandated at line 319.
- If a future phase revisits REC-06/age-grading, consider investigating the unexplained 0.51-point WMA-edition delta and cross-checking a second distance.

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-12*
