---
phase: 28-pr-plausibility-ceiling
plan: 09
subsystem: verification
tags: [best-efforts, pr-ceiling, browser-checkpoint, sign-off, served-digest]

# Dependency graph
requires:
  - phase: 28-pr-plausibility-ceiling
    plan: "04"
    provides: "The rendered demotion badge on the detail view and the Records demotion note / empty-state copy the browser rows read"
  - phase: 28-pr-plausibility-ceiling
    plan: "06"
    provides: "The committed ceiling state the served build is built from"
  - phase: 28-pr-plausibility-ceiling
    plan: "08"
    provides: "The classifier-independent recount every count-bearing row compares against"
provides:
  - "28-VALIDATION.md Round 1 Checkpoint (R1-R7): drafted rows with CAN PASS / CAN FAIL lines, a Reachability Audit, a 2026-09-16 pre-run re-verification, recorded verdicts, and the Round 1 Outcome"
  - "The PR-04 Sign-off (D-14), bound to 28-DIFF.md sha256 08e93d5adec6ee3de886ab8b47ac0d4a48e001847e331c18830a812f546f77c6"
  - "PR-03, PR-04, PR-05 ticked in REQUIREMENTS.md with verdict notes; D-04 resolved note on PR-02 and PR-05"
affects: [phase-28-verification]

tech-stack:
  added: []
  patterns:
    - "Expected values corrected to the rendered format BEFORE the row runs (71s renders as 1:11), so a row is not unpassable on formatting"
    - "A blanket approval is recorded as blanket; it does not convert a NOT EXERCISABLE row to PASS nor silently resolve a flagged sub-finding"

key-files:
  created:
    - .planning/phases/28-pr-plausibility-ceiling/28-09-SUMMARY.md
  modified:
    - .planning/phases/28-pr-plausibility-ceiling/28-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "R2 substituted activity 3475712118 for 4556693525, whose live 400m effort carries demotion: null (kept off rankings by manual exclusion, not the ceiling); 4556693525 is still exercised by R3."
  - "R4 recorded NOT EXERCISABLE: no live distance has zero ranked rows and a positive demoted count — every ceiling-affected distance backfills to 10 ranked."
  - "Local master was 9 nightly data commits behind origin/master and was NOT pulled, so the checkpoint ran against the archive its figures were derived from."
  - "PR-01 and PR-02 were not ticked here — not in this plan's requirement set; left to phase verification."

requirements-completed: []  # PR-03/PR-04/PR-05 ticked at checkpoint, reopened same day after verification gaps_found

# Metrics
duration: ~1 day elapsed (Task 1 2026-09-11, checkpoint 2026-09-16)
completed: 2026-09-16
---

# Phase 28 Plan 09: Round 1 browser checkpoint and PR-04 sign-off Summary

**Phase 28 closed with a human check of the served build: the developer approved all rows as a batch ("approved"), and the diff sign-off is tied to 28-DIFF.md's sha256.**

## Accomplishments

- **Task 1** (`3c990ec6`): served a build and recorded the hash of the bytes the server sent, gathered the figures produced without the browser (recount stdout, diff sha256, the data-file state of the pinned activity), and drafted R1-R7 with CAN PASS / CAN FAIL lines and a Reachability Audit.
- **Task 2** (checkpoint, 2026-09-16): re-ran every gate, re-verified the served digest, corrected two expected values to their rendered form, presented the rows, and recorded the developer's verdict.

## Served build

- Asset: `assets/index-vmd1d_n_.js` (referenced by `dist/widgets/index.html`), served from `http://127.0.0.1:8917`.
- Served digest (hash of the fetched bytes): `affdf2f9e9aa7261368a4981323376cb159a3b30e1e881c107605329627b810a`, identical on 2026-09-11 and 2026-09-16.
- `dashboard/index.json`, `stats/best-efforts.json` and the shards for `4556693525`, `3475712118` and `3475725513`: served bytes identical to local.
- Gates on 2026-09-16:
  - `npm test`: 2286 tests, exit 0.
  - `tsc`, `build` and `build-widgets`: exit 0.
  - `verify-dashboard`: 64/0.
  - Recount: exit 0 (52 demoted in total; by guard 19 world-record / 15 max-speed / 18 ceiling; 400m 36).

## Verdicts (developer, verbatim: "approved")

| Row | Verdict |
|-----|---------|
| R1 served digest | PASS (blanket) |
| R2 demoted effort visible with reason | PASS (blanket) |
| R3 absent from ranking, excluded badge on detail | PASS (blanket) |
| R4 empty table explains itself | NOT EXERCISABLE |
| R5 two separable badges | PASS (blanket) |
| R6 non-empty table carries demotion note | PASS (blanket); wording sub-finding carried forward |
| R7 diff reviewed, 18 = 18 | PASS (blanket) |

**Sign-off (D-14):**
- sha256 `08e93d5adec6ee3de886ab8b47ac0d4a48e001847e331c18830a812f546f77c6`, dated 2026-09-16.
- Re-hashed after the checkpoint: identical.

## Deviations from Plan

- **R2 expected duration:** stated as `71.0s` in the draft. The detail view renders `m:ss`, so the expectation was corrected to `1:11` before the row ran. Without the correction, the row could never pass.
- **R3 expected badge:** stated exactly as `Excluded — bad measurement`, taken from `data/best-effort-exclusions.json`.

## Open observations (not gaps; no fix applied)

1. **R6 note wording:** the note says "N 400m efforts were demoted by the plausibility ceiling" using the count from all three guards (36). Only 8 of those 36 are ceiling demotions. The blanket approval did not address this claim individually.
2. **R4:** the ceiling-emptied empty-state branch is covered by unit tests only. No live end-to-end state reaches it.
3. **Real activity 4556693525:** in the shipped document its 400m effort carries `demotion: null` and is kept out by the manual exclusion list, not by a guard. PR-05's guard rejection of this activity is shown only by the synthetic unit fixture `src/analytics/compute-best-efforts.test.ts:687` (passing on 2026-09-16). This caveat is recorded on the PR-05 line.

## Gaps

None opened. No row was FAIL or BLOCKED.

## Self-Check: PASSED

- `28-VALIDATION.md` has no `pending` verdicts.
- The sign-off section is present.
- `28-DIFF.md` is byte-unchanged.
- `git status --porcelain src scripts` is empty.
- `grep -c '45.2' .planning/REQUIREMENTS.md` returns 2, and both the PR-02 and PR-05 lines still contain `44.0`.

## AMENDED 2026-09-16: requirement ticks reopened

After this summary was written, the phase code review (`28-REVIEW.md`, CR-01) and verification
(`28-VERIFICATION.md`, `gaps_found`, 2/5) showed the ceiling check never runs on owner-excluded
efforts. At the developer's direction, PR-03, PR-04 and PR-05 were reopened. The verdicts above are
retained as recorded; they were earned but are no longer sufficient. Open observation 3 above is
CR-01.
