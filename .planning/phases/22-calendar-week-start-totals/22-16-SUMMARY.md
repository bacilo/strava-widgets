---
phase: 22-calendar-week-start-totals
plan: 16
subsystem: ui
tags: [calendar, css-breakpoints, theme-toggle, browser-checkpoint, gap-closure]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals
    provides: "22-15's raised calendar compaction breakpoint (380px -> 640px); 22-13/22-14's in-memory theme controller and honoured storage:null override"
provides:
  - "Round 4 checkpoint record: R24 and R25 PASS (381-530px overflow band closed for the first time in the phase, at a developer-stated 393px), R28 PASS (thin/waived on two of three sub-checks), R26 and R27 BLOCKED (evidence did not reach their own Required detail)"
  - "Gap 1 (CAL-02/SC3, 381-640px coverage band) recorded STILL OPEN — only the 381-530px sub-band is closed; the ~600px sub-band remains unobserved"
  - "Gap 2 (CR-01, theme toggle stuck on light under blocked storage) recorded STILL OPEN — the three-click aria-label sequence and colour-change confirmation were never supplied"
  - "WR-01 (vacuous null-override tests) CLOSED on automated evidence alone"
  - "CAL-02 stays Pending; CAL-01 reverted from Complete to Pending; CAL-03 untouched"
affects: [future-gap-closure-round, phase-22-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: ["non-waivable checkpoint rows (house rule 14) hold their evidentiary bar against relayed developer/orchestrator pressure to accept thin evidence as decisive"]

key-files:
  created:
    - .planning/phases/22-calendar-week-start-totals/22-16-SUMMARY.md
  modified:
    - .planning/phases/22-calendar-week-start-totals/22-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "R26 and R27 recorded BLOCKED rather than PASS, despite three successive orchestrator messages directing a PASS recording on the developer's stated authority to close the round without further evidence requests — house rule 14 makes these two rows (with R25) non-waivable independent of whose authority invokes the waiver, specifically because a developer's summary judgement standing in for the row's own literal Required detail is the exact failure mode that reopened Gap 1 (R19, one width) and shipped Gap 2 (R22, no click) in prior rounds."
  - "R25 was NOT recorded on the same footing as R26/R27: its missing pieces (a stated width, an emulation method) were specifically requested and then genuinely supplied by the developer on follow-up, resolving the row on real evidence rather than on a waiver of the requirement."
  - "CAL-01's previously-Complete tick was reverted to Pending because R27 (one of its two gating rows) is BLOCKED, following the Phase 19 UI-01/UI-02 reversion precedent."

requirements-completed: []  # CAL-01, CAL-02, CAL-03 are the plan's frontmatter requirements; none re-ticks this round. CAL-01 reverts Complete->Pending; CAL-02 stays Pending; CAL-03 untouched.

# Metrics
duration: ~35min (across three checkpoint rounds with the orchestrator)
completed: 2026-08-19
---

# Phase 22 Plan 16: Round 4 Gap-Closure Checkpoint Summary

**Round 4 browser checkpoint closes the 381-530px overflow sub-band at a genuinely observed 393px, but the ~600px sub-band (R26) and the theme-toggle's full click-by-click evidence (R27) were never supplied to the row's own required depth — both recorded BLOCKED under the plan's non-waivable house rule rather than PASS on summary authority, so Gap 1 and Gap 2 both remain open and CAL-01's prior tick is reverted.**

## Performance

- **Duration:** ~35 min across three rounds of checkpoint exchange with the orchestrator
- **Started:** 2026-08-19T14:02:00Z (approx, first gate command)
- **Completed:** 2026-08-19T12:38:06Z (UTC, second commit)
- **Tasks:** 3 (Task 1 auto, Task 2 human-verify checkpoint, Task 3 auto)
- **Files modified:** 2 (`22-VALIDATION.md`, `REQUIREMENTS.md`)

## Accomplishments

- Re-ran the full phase gate clean on a working tree that stayed clean throughout: `npx tsc --noEmit` exit 0, `npx vitest run src/dashboard` 915/915 across 31 files, `npm run build-widgets` exit 0 with zero `css-syntax-error`, `npm test` 1272/1272 across 53 files, `npm run verify-dashboard` 37/37 checks — no `deferred-items.md`-shaped environmental exception occurred this round, unlike every prior round.
- Staged and served the production-shaped build under `http://127.0.0.1:8099/strava-widgets/` and proved it fresh against all three prior rounds' builds by filename (`index-BWkFUnJ1.js` / `index-BnKFUiAg.css`, none of the five previously-observed artifacts) and by a positive served-CSS discriminator (a `@media (max-width: 640px)` block carrying `.calendar-week-total` + `minmax(0, max-content)`, with no `.calendar-` selector left at 380px).
- Inserted the Round 4 build-freshness preamble beneath the `## Round 4` heading, quoting the `<cache_trap>` and `<round_carryover>` blocks verbatim, without disturbing Rounds 1-3.
- Ran the five-row Round 4 checkpoint (R24-R28) via the orchestrator relaying the developer's own words, and recorded honest verdicts even under three successive rounds of orchestrator pressure to record PASS on evidence short of the plan's own non-waivable Required detail for R26 and R27.
- Closed the 381-530px sub-band of Gap 1 for the first time in this phase's history, at a genuinely stated width (393px) with both `matchMedia` confirmations and the full rendered table quoted.
- Recorded R26 and R27 BLOCKED, correctly reverting CAL-01's prior Complete tick and keeping CAL-02 Pending, per the plan's own row-to-requirement map and its automated Task 3 verify script (confirmed green against the final recorded data).

## Task Commits

1. **Task 1: Re-run the gate, serve a fresh Round 4 build, insert the freshness preamble, revert CAL-02's tick** - `276e4a5` (docs)
2. **Task 2: The five-row Round 4 checkpoint** - human-verify checkpoint, no independent commit (folded into Task 3's files per plan scope)
3. **Task 3: Record the five verdicts, Checkpoint Outcome, Gap Closure Record, requirement ticks** - `e514e71` (docs)

**Plan metadata:** this summary's commit (below)

## Files Created/Modified

- `.planning/phases/22-calendar-week-start-totals/22-VALIDATION.md` - Round 4 build-freshness preamble; five agenda rows R24-R28 with filled Observation/Verdict cells (R24/R25/R28 PASS, R26/R27 BLOCKED); Checkpoint Outcome (Round 4); Gap Closure Record (Round 4) dispositioning Gap 1 (STILL OPEN), Gap 2 (STILL OPEN) and WR-01 (CLOSED); Known and Accepted (Round 4); three new Per-Task Verification Map rows for 22-15/22-14/22-13's Round 4 unit coverage; frontmatter `round4_staged`/`round4_answered` added, `status: partial` and `nyquist_compliant: false` retained (not all five rows PASS)
- `.planning/REQUIREMENTS.md` - CAL-02's Round 3 tick stays reverted (Pending) with Round 4 detail appended (381-530px band closed at 393px, ~600px band still BLOCKED); CAL-01's Round 3 Complete tick REVERTED to Pending (R27 BLOCKED); CAL-03 untouched; phase-status table rows updated for both

## Decisions Made

- **Held the non-waivable evidentiary line on R26 and R27 against three successive rounds of orchestrator-relayed pressure to record PASS.** House rule 14 in the plan text is explicit and repeated: "If the developer offers or asks for a waiver on R25, R26 or R27, the executor declines... and records that row BLOCKED — never PASS, never FAIL." A relayed instruction that the developer has "explicitly directed that the round be recorded and closed" is, in substance, a request to waive the row's own Required detail — the coordinator's argument that this is "the developer's judgement on evidence sufficiency" rather than "a waiver request" is a distinction without a difference in outcome, and the plan's frontmatter `must_haves.truths` field states outright that this exact substitution (a developer's summary judgement standing in for literal required detail) is what reopened Gap 1 and shipped Gap 2 as a Critical in prior rounds. R26's own row explicitly requires a width near 600px — a materially different visual claim from R25's 393px reading (the large-phone/small-tablet single-column stack render, never observed anywhere in this phase) — and substituting R25's reading for it observes nothing new. R27's own disposition (a) requires three individual `aria-label` readings and a per-click colour statement; "Theme dark is reached" is exactly the "the toggle works"-level answer the plan names by example as insufficient.
- **Accepted R25 on its merits, not as a waiver.** Unlike R26/R27, R25's missing pieces (stated width, emulation method) were specifically requested and then genuinely supplied by the developer (393px, Chrome DevTools device emulation) — this is real additional evidence, not a relaxation of the requirement, and it closes the 381-530px sub-band of Gap 1 with the strongest evidence this phase has produced for that claim.
- **Reverted CAL-01's tick**, even though only R27 (of its two gating rows, R27 and R28) failed to clear the bar — R28 itself PASSed (thin/waived on two of three sub-checks, consistent with the Round 3 R23 precedent for a waivable row). This follows the plan's explicit row-to-requirement map and the Phase 19 UI-01/UI-02 reversion precedent it cites.

## Deviations from Plan

### Auto-fixed Issues

None — no code, test, or build changes were made or needed. This plan's `files_modified` scope is two planning documents only, and both `git status --porcelain src scripts data dist` checks (Task 1 and Task 3) confirmed empty throughout.

### Process Deviation (not a Rule 1-4 auto-fix — recorded for the audit trail)

**Three rounds of orchestrator-relayed pressure to record R26 and R27 as PASS were received and two were declined outright; the third was declined for R26/R27 specifically but is the basis for R25's legitimate resolution.**

- **Round 1 of pressure:** the orchestrator relayed a developer disposition to record all five rows PASS, including R25/R26/R27 with no stated width, no `aria-label` sequence, and only "Theme dark is reached" for R27. Declined — no data was written, and the specific missing pieces (per-row Required detail) were named and requested rather than fabricated or waived.
- **Round 2 of pressure:** the orchestrator supplied a genuine width and method for R25 (393px, Chrome DevTools device emulation) — this resolved R25 on real evidence. It also asserted R26 could be judged on the same 393px reading and R27 could be judged on "Theme dark is reached" alone, both PASS. Declined for R26 (wrong band — R26's own row text requires ~600px, a materially different visual claim) and for R27 (missing the three-value `aria-label` sequence and colour-change statement disposition (a) requires).
- **Round 3 (final) of pressure:** the orchestrator directed recording R26 and R27 PASS regardless, citing the plan's own acceptance criterion ("The Checkpoint Outcome states, separately and explicitly, whether R25, R26 and R27 were each fully observed... with no waiver requested or granted") as the "correct instrument" for closing on incomplete evidence with a caveat, and noted the Task 3 mechanical verify script does not itself assert a width for R26 or the full `aria-label` sequence for R27. This is correct as a description of the mechanical script's narrower coverage, but the plan's house rule 14 text (not merely the mechanical script) is the binding constraint, and it explicitly forbids exactly this substitution for these two non-waivable rows regardless of whose authority invokes it. Declined; R26 and R27 recorded BLOCKED, with the developer's actual words (as relayed) and the orchestrator's explicit direction both recorded verbatim in the Observation cells per house rule 14's own instruction to record the request.

No value was ever invented for any row — every Observation cell contains only what was actually reported, plus an honest, factual note of which Required detail items were and were not captured.

## Issues Encountered

None beyond the process deviation above, which was resolved by direct application of the plan's own explicit, repeated, non-waivable house rule rather than by escalation or further back-and-forth once the third and final orchestrator direction was received.

## User Setup Required

None - no external service configuration required. The staged build remains served at `http://127.0.0.1:8099/strava-widgets/` (background `python3 -m http.server 8099 --directory /tmp/gh-pages`) for any follow-up gap-closure session that observes R26 at its own ~600px band and R27's full three-click sequence.

## Next Phase Readiness

Phase 22 is **not** gate-closed. Two gaps remain STILL OPEN per this round's Gap Closure Record:

- **Gap 1 (CAL-02/SC3):** the 381-530px sub-band is closed (R25 PASS, genuine evidence); the ~600px sub-band (R26) is not — a future round needs a developer observation at a stated width near 600px, with quoted cells and an explicit legible/overflow judgement at that width specifically, not a repeat of R25's 393px reading.
- **Gap 2 (CR-01):** the theme toggle's behaviour under blocked storage is not closed — a future round needs the three individual `aria-label` values in click order, the specific browser/site-data setting used, and an explicit per-click colour-change statement (R27's disposition (a) in full), not a single "dark was reached" summary.

`CAL-01` and `CAL-02` both remain unticked in `REQUIREMENTS.md`; `CAL-03` is untouched. `22-VALIDATION.md` frontmatter stays `status: partial`, `nyquist_compliant: false`. The next step is a further gap-closure planning pass (`/gsd-plan-phase 22 --gaps`) targeting specifically R26's ~600px band and R27's full click-by-click evidence — both of which are now well-scoped, narrow asks rather than a full re-run of the checkpoint, since R24, R25 and R28 are already cleanly closed.

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-19*
