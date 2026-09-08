---
phase: 24-local-curation-mode
plan: 14
subsystem: testing
tags: [checkpoint, curate-server, curation-guard, best-efforts, gap-closure]

# Dependency graph
requires:
  - phase: 24-local-curation-mode (24-11, 24-12, 24-13)
    provides: three gap-closure code fixes — the curation-guard skip-list inversion, the curate
      server's static-route Origin/Host gate and crash fix, and buildPrBadgeLabels' liveExclusions
      parameter
provides:
  - "Round 3 browser+command checkpoint (R24-R31), recorded in 24-VALIDATION.md, scoring 7/8"
  - "GAP-24-02 and GAP-24-03 CLOSED on observed evidence (R28/R29, R30)"
  - "GAP-24-04 (WR-05) proven PARTIALLY: forward direction (R24) closed, mirror direction (R26)
    FAILs on a vacuous discriminator"
  - "GAP-24-05 opened verbatim: R26 is an unsatisfiable checkpoint row; the live-document mirror
    direction of WR-05 is still unproven by any round to date"
  - "CUR-01 and the Phase 24 ROADMAP gate held Pending/open, per the plan's own all-rows-PASS rule"
affects: [any future 24.x gap-closure phase, which inherits GAP-24-05 as its brief]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Checkpoint rows must assert against an independently-derived discriminator, but a
      discriminator can itself be vacuous if an earlier mandated step (here, R25's Recompute)
      changes the very precondition the discriminator relies on — R26 is a worked example of a
      checkpoint-design defect that looks rigorous but cannot actually distinguish pass from fail."

key-files:
  created: []
  modified:
    - .planning/phases/24-local-curation-mode/24-VALIDATION.md
    - .planning/phases/24-local-curation-mode/24-VERIFICATION.md
    - .planning/phases/24-local-curation-mode/24-REVIEW.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "Provenance for R26 was recorded exactly as the developer directed: the untick, the dialog
    quote, the Cancel press and the OK press are [human]; the state readbacks around them are
    [browser]/[shell]. No human gesture is attributed to the agent and no orchestrator readback is
    attributed to the developer."
  - "R26 was recorded FAIL rather than reinterpreted as PASS-with-caveats, even though R27 shows
    the underlying 24-13 code is correct — the row's own literal assertion (header reads exactly
    PR — 400m again) was observed false, and per house rule 6 nothing found this round was fixed
    or the row's verdict softened to match the code's actual correctness."
  - "CUR-01's disposition and the ROADMAP gate were withheld rather than partially ticked, per this
    plan's own governing truth: both re-tick ONLY if every mapped row is PASS. 7/8 does not meet
    that bar, so both stay exactly where 24-VERIFICATION.md left them plus a new GAP-24-05."
  - "The origin todo (2026-08-12-exclusion-tickbox-local-curation-mode.md) was left in pending/ —
    it was not re-closed, because CUR-01 did not re-tick this round."

requirements-completed: []  # CUR-01 stays Pending — 7/8 rows, R26 FAIL. Not completed this round.

# Metrics
duration: ~63min
completed: 2026-09-02
---

# Phase 24 Plan 14: Round 3 checkpoint (R24-R31) — 7/8 PASS, disposition withheld, GAP-24-05 opened Summary

**Round 3 browser+command checkpoint scored 7 PASS / 1 FAIL across R24-R31: GAP-24-02 (curation-guard
allowlist) and GAP-24-03 (curate-server static-route Origin/Host gate) are cleanly closed, but
GAP-24-04's mirror direction (R26, human-hand) FAILs on a checkpoint-design defect — its own
discriminator goes vacuous once R25's mandatory Recompute clears `wasPRAtTheTime` — so CUR-01 and
the Phase 24 ROADMAP gate stay exactly where `24-VERIFICATION.md` left them, plus a newly opened
GAP-24-05.**

## Performance

- **Duration:** ~63 min (Task 1 commit `7e56789` at 2026-09-02T09:35:32Z through Task 3 commit
  `272fa0f` at 2026-09-02T10:38:06Z)
- **Started:** 2026-09-02T09:35:32Z
- **Completed:** 2026-09-02T10:38:16Z
- **Tasks:** 3 (Task 1 fresh gate + pinned values; Task 2 BLOCKING Round 3 checkpoint, R24-R31;
  Task 3 disposition)
- **Files modified:** 5 (`24-VALIDATION.md`, `24-VERIFICATION.md`, `24-REVIEW.md`,
  `REQUIREMENTS.md`, `ROADMAP.md`)

## Accomplishments

- Ran a fresh full gate (Task 1, already committed) against a build whose JS hash
  (`index-B1uN9-48.js`) was confirmed to differ from Round 2's (`index-UHckEgvm.js`), so this round
  is valid against bytes that include plan 24-13's fix.
- Recorded all eight Round 3 rows (R24-R31) in an APPENDED `## Round 3 Checkpoint (R24-R31)` section
  of `24-VALIDATION.md`, mirroring Round 2's evidence-provenance / row-verdicts / final-state-check
  structure, additions-only (`git diff --numstat` showed 111 additions, 0 deletions).
- **GAP-24-02 CLOSED** (criterion 3, the curation-guard `SCANNED_EXTENSIONS` allowlist): R28 observed
  the guard fail RED against a planted `.d.ts`, a planted `.mjs` and a planted extensionless file —
  the three classes the pre-24-11 allowlist could not see — then GREEN once removed, reproducing the
  pinned build identity; R29 confirmed no regression (`verify-dashboard` 40/40, public exclusions
  file still 200-and-parsing, `PINNED_DTS_COUNT` of 22 unaffected).
- **GAP-24-03 CLOSED** (CR-01, the curate server's static-route Origin/Host gate): R30 recorded the
  status-code sequence `200, 403, 200, 403, 403, 403, 403` and confirmed via `kill -0` that the
  server survives `GET /%` — pre-24-12 the same request was a fatal uncaught exception.
- **GAP-24-04 (WR-05) PARTIALLY closed**: R24 proved the forward direction cleanly, comparing the
  header badge text before and after Save in one paint and confirming the `PRExcluded` string Round
  2's R15 quoted (but never compared against anything) does not occur. R26, the mirror (untick)
  direction, is **FAIL** — see below.
- **GAP-24-05 opened verbatim** in `24-VALIDATION.md`: R26 is structurally unsatisfiable given its
  own mandated R25->R26 ordering. R25's Recompute sets both `excludedFromRecords: true` (R26's
  intended discriminator) AND `wasPRAtTheTime: false` for every distance, and both
  `buildPrBadgeLabels` (`detail-best-efforts-logic.ts:64`) and `BestEffortPanelRow.isPr` (`:162`)
  gate on `wasPRAtTheTime` before ever consulting the live document — so no PR badge can render at
  R26 time regardless of whether the live-exclusion suppression is correctly wired. R27's supporting
  evidence (the same restored state, `wasPRAtTheTime: true`, live document empty, renders
  `PR — 400m` correctly) isolates this to the checkpoint row's design, not the 24-13 implementation.
- Set the disposition (Task 3): CUR-01 stays **Pending** in `REQUIREMENTS.md` (line 51's prose
  extended with the Round 3 result; the traceability-table row extended and retains its
  `REOPENED 2026-09-02` history); the ROADMAP Phase 24 gate stays **open** (a Round 3 note appended
  to the milestone-checklist entry, the `- [ ]` box left unticked, the Wave 8 `24-14-PLAN.md`
  checklist box also left unticked since not every mapped row was PASS); `24-VERIFICATION.md` gained
  an appended `## Gap-Closure Record (Round 3, 2026-09-02)` section (frontmatter `status:`/`score:`
  untouched, additions-only per `git diff --numstat`: 66 additions, 0 deletions); `24-REVIEW.md`
  gained one dated note each at the end of CR-01 (CLOSED), CR-02 (CLOSED) and WR-05 (PARTIALLY
  CLOSED, GAP-24-05); the origin todo stayed in `pending/`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fresh gate, recorded build identity, pinned expected values** - `7e56789` (docs) —
   completed by the prior agent, not redone here.
2. **Task 2: BLOCKING Round 3 browser and command checkpoint (R24-R31)** - `b953e1b` (docs) —
   records the eight verdicts and evidence performed and returned by the checkpoint session.
3. **Task 3: Disposition** - `272fa0f` (docs) — withholds CUR-01/gate re-tick, closes GAP-24-02 and
   GAP-24-03, opens GAP-24-05.

_No plan-metadata commit is separate from Task 3's commit — Task 3 already covers all five
`files_modified` paths that changed._

## Files Created/Modified
- `.planning/phases/24-local-curation-mode/24-VALIDATION.md` - appended `## Round 3 Checkpoint
  (R24-R31)` (evidence provenance, row verdicts, final state check, observations, disposition,
  GAP-24-05) after the Task-1-appended `## Fresh Gate Run (plan 24-14, Round 3)` section.
- `.planning/phases/24-local-curation-mode/24-VERIFICATION.md` - appended `## Gap-Closure Record
  (Round 3, 2026-09-02)` naming the row that closed each of the report's three original gaps;
  frontmatter and existing prose untouched.
- `.planning/phases/24-local-curation-mode/24-REVIEW.md` - appended one dated note each to CR-01,
  CR-02 (CLOSED) and WR-05 (PARTIALLY CLOSED, GAP-24-05); the other 24 findings untouched.
- `.planning/REQUIREMENTS.md` - CUR-01's prose (line 51) and traceability-table row (line 95)
  extended with Round 3's 7/8 result and GAP-24-05; checkbox remains `- [ ]`.
- `.planning/ROADMAP.md` - Phase 24's milestone-checklist entry (line 74) extended with a Round 3
  gap-closure note; checklist box remains `- [ ]`, Wave 8's `24-14-PLAN.md` box remains unticked.

## Decisions Made

See `key-decisions` in frontmatter. In short: R26's provenance is recorded exactly as directed
(gestures [human], readbacks [browser]/[shell]); R26 is recorded FAIL on its literal assertion even
though R27 shows the code is correct; the disposition is withheld rather than partially applied,
because the plan's own rule requires every mapped row to PASS; and the origin todo stays in
`pending/` because CUR-01 did not re-tick.

## Deviations from Plan

None — plan executed exactly as written. The Task 2 checkpoint was performed and returned by the
orchestrator/developer per the plan's `<how-to-verify>` instructions; this agent recorded the
results verbatim into `24-VALIDATION.md` and executed Task 3's disposition logic exactly as the
plan's gate specifies (withhold on any non-PASS row).

## Issues Encountered

None beyond the R26 checkpoint-design defect itself, which is the round's own finding (GAP-24-05),
not an execution problem with this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GAP-24-02 and GAP-24-03 are closed and should not need to be re-litigated by a future round.
- GAP-24-05 is the sole remaining blocker for CUR-01/the Phase 24 gate: a future gap-closure plan
  needs a checkpoint row that holds `wasPRAtTheTime: true` while the precomputed
  `excludedFromRecords` is also `true` simultaneously — for example by editing
  `data/stats/best-efforts.json` directly for the target activity, without a Recompute — since the
  curate UI's own Save->Recompute->Untick sequence cannot itself produce that state (this is why
  both Round 2's R19 and this round's R26 failed to prove the live-document mirror direction).
- The two "recorded, not fixed" observations from R25 (the raw-epoch Trends tooltip title; the
  cross-month week rendered only as two partial cells) and R30's 403-vs-400 note remain open,
  low-severity items outside CUR-01's scope — not blockers for a future round.

---
*Phase: 24-local-curation-mode*
*Completed: 2026-09-02*
