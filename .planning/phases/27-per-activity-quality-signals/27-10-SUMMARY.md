---
phase: 27-per-activity-quality-signals
plan: 10
subsystem: testing
tags: [checkpoint, browser-verification, calibration, requirements-tracing]

# Dependency graph
requires:
  - phase: 27-per-activity-quality-signals
    provides: "27-05's independent recount script, 27-08's severe filter, 27-09's shard client + detail section, 27-03's calibration report and split Criterion 4a/4b"
provides:
  - "27-VALIDATION.md § Round 1 Checkpoint: eight transcribed PASS verdicts (R1-R8), each with agent-performed/countersigned provenance and quoted evidence"
  - "A Gap-Closure Record documenting two open, unpatched gaps (G-01, G-02)"
  - "REQUIREMENTS.md: QUAL-01 through QUAL-05, ERA-01, ERA-02 all ticked, each citing its evidence"
affects: [28]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Agent-performed-browser-automation-countersigned-by-developer provenance line, used when a developer delegates checkpoint execution but retains sign-off"

key-files:
  created: []
  modified:
    - ".planning/phases/27-per-activity-quality-signals/27-VALIDATION.md"
    - ".planning/REQUIREMENTS.md"

key-decisions:
  - "Provenance decision (developer): 'Agent-performed, you countersign' — every row recorded as agent-performed browser automation (Claude in Chrome), countersigned by the developer 2026-09-10, never as developer-observed"
  - "QUAL-05 ticked with a stated caveat rather than left un-ticked or ticked silently: the measured composite (299) and the bidirectional Threshold Sensitivity table both reproduced independently and are unaffected by G-01, but the tick does not claim 27-CALIBRATION.md's generator script is currently self-regenerable at its own corrected denominator values"
  - "ERA-02 ticked without contingency on G-02: G-02 itself states the behavioral requirement (explicit no-device-name category, never a fabricated device name) HOLDS per R8 — only the cited cohort size (716 vs. the live 663) is stale, which is a documentation reconciliation, not a behavioral gap"
  - "27-CALIBRATION.md left untouched: the calibration script was not re-run in this plan, per explicit instruction, to avoid reverting the live-denominator correction it would silently overwrite (this is exactly the mechanism of G-01)"

patterns-established:
  - "Requirement->row disposition table: explicit per-requirement tick/no-tick decision with gap-contingency stated inline, rather than a bare checkbox flip"

requirements-completed: [QUAL-03, QUAL-04, QUAL-05, ERA-01, ERA-02]

# Metrics
duration: 25min
completed: 2026-09-10
---

# Phase 27 Plan 10: Round 1 Browser Checkpoint — Verdicts, Requirement Ticks, Gap Log Summary

**All eight Round 1 checkpoint rows (R1-R8) recorded PASS via agent-performed browser automation countersigned by the developer; five requirements ticked against the plan's own row map plus two prior requirements ticked on existing automated evidence; two open gaps (a non-regenerable calibration artifact, a stale cohort-size citation) logged unpatched.**

## Performance

- **Duration:** 25 min (this continuation — Task 2 only; Task 1 was completed and committed in a prior session, commit `d16e9952`)
- **Tasks:** 1 (Task 2 — transcribing the already-run checkpoint's verdicts; Task 1 was already complete on entry)
- **Files modified:** 2 (`27-VALIDATION.md`, `.planning/REQUIREMENTS.md`)

## Accomplishments

- Transcribed all eight Round 1 checkpoint verdicts (R1-R8) into `27-VALIDATION.md` verbatim, each carrying the developer-chosen provenance line (`agent-performed browser automation (Claude in Chrome), countersigned by developer 2026-09-10`) and the quoted observation supplied, with no observation invented beyond what was given.
- Applied the plan's own requirement->row map (QUAL-03 ← R2/R3/R6; QUAL-04 ← R4/R5; QUAL-05 ← R6/R7; ERA-01/ERA-02 ← R8) and ticked all five requirements in `.planning/REQUIREMENTS.md`, each citing the mapped rows.
- Also ticked QUAL-01 and QUAL-02 in `.planning/REQUIREMENTS.md`, per the checkpoint task's own acceptance criteria, on the automated-artifact-inspection evidence already recorded in `27-04-SUMMARY.md` and `27-02-SUMMARY.md`.
- Recorded a `## Gap-Closure Record` in `27-VALIDATION.md` documenting G-01 (the calibration report's generator script reverts its own live-denominator correction on re-run) and G-02 (ERA-02's cited no-device-name cohort figure, 716, is stale against the live 663) — both left OPEN and unpatched, per house rule.
- Updated `27-VALIDATION.md` frontmatter from `status: draft` / `nyquist_compliant: false` to `status: partial` / `nyquist_compliant: true`, honestly reflecting all-PASS rows with two gaps still open (not a claim of a clean bill).
- Left `27-CALIBRATION.md` byte-identical to its committed state — the calibration script was not re-run in this plan.

## Task Commits

Task 1 (completed in a prior session, already merged before this continuation started):

1. **Task 1: Serve a digest-verified build and draft the checkpoint rows** - `d16e9952` (docs)

This continuation (Task 2):

2. **Task 2: Round 1 browser verification (R1-R8) — transcribe verdicts, tick requirements, log gaps** - `52200c46` (docs)

## Files Created/Modified

- `.planning/phases/27-per-activity-quality-signals/27-VALIDATION.md` - Eight verdicts transcribed as PASS with provenance and quoted evidence; `## Gap-Closure Record` (G-01, G-02) added; `## Requirement -> Row Disposition` table added; frontmatter updated to `status: partial` / `nyquist_compliant: true`.
- `.planning/REQUIREMENTS.md` - QUAL-01 through QUAL-05, ERA-01, ERA-02 all ticked `[x]`, each with an inline citation of its discharging evidence; traceability table rows for the same seven requirements updated from `Pending` to `Complete`.

## The Eight Verdicts (all PASS)

| Row | Criterion | Verdict | Key observed evidence |
|---|---|---|---|
| R1 | served digest | PASS | Network panel loaded asset `assets/index-BHpzXFXA.js`; 5-request initial load (`index.html`, JS, CSS, `index.json`, 404 favicon) |
| R2 | zero fetches on list | PASS | 0 `pace-quality` requests after hard-reload + scroll on `#/list` |
| R3 | exactly one fetch on open | PASS | 1 / 1 (memoized re-open) / 2 (different activity) sequence exact |
| R4 | badge read-back, severe | PASS | "27% of recorded time in gaps or pauses"; "11 gap intervals; longest 16:43" — matches shard `i183546832.json` on every figure |
| R5 | healthy disclosure | PASS | Five non-blank rows, none undefined/null/NaN; matches shard `i183856843.json` |
| R6 | filtered cohort vs. two independent figures | PASS | `#/list?severe=1` = 299 activities; matches `27-CALIBRATION.md` §4 and the recount script's stdout exactly; unticking restores 1890 |
| R7 | threshold moved, both directions | PASS (stronger than drafted) | Independent re-run of the sweep reproduced all six rows identically; this re-run is the discovery event for G-01 |
| R8 | device family / no-device-name | PASS | fēnix 6 Pro → "Garmin fēnix 6 Pro"; Suunto 9 → "Suunto 9"; `18702664326` → "No device name recorded" |

## Requirement -> Row Disposition

| Requirement | Mapped rows | Tick | Contingency |
|---|---|---|---|
| QUAL-01 | (automated, 27-02/27-04) | Ticked | Not a browser row; discharged by `27-04-SUMMARY.md` + `pace-quality.test.ts` |
| QUAL-02 | (automated, 27-02) | Ticked | Not a browser row; discharged by `27-02-SUMMARY.md` + `pace-quality.test.ts`/`best-effort-utils.test.ts` |
| QUAL-03 | R2, R3, R6 | Ticked | None |
| QUAL-04 | R4, R5 | Ticked | None |
| QUAL-05 | R6, R7 | Ticked, with a stated caveat | G-01 open (calibration generator not self-regenerable at 1865/25); tick reflects the measured composite/sensitivity behavior, which G-01 does not affect |
| ERA-01 | R8 | Ticked | None |
| ERA-02 | R8 | Ticked | G-02 open (stale 716-vs-663 cohort citation); not contingent — G-02 itself confirms the behavioral requirement holds |

## Decisions Made

- Recorded every verdict with the developer's chosen provenance ("Agent-performed, you countersign") rather than as developer-observed, per explicit instruction — this closes the blocking checkpoint gate while making clear a human did not personally walk each row.
- Ticked QUAL-05 and ERA-02 rather than leaving them un-ticked because of G-01/G-02, but stated each gap's contingency (or lack of one) explicitly in both `27-VALIDATION.md` and `REQUIREMENTS.md`, rather than ticking silently or blocking the tick on an unrelated documentation staleness.
- Did not run `npm run compute-pace-quality-calibration` in this plan, preserving `27-CALIBRATION.md` byte-identical to its committed (corrected) state — running it would reproduce exactly the G-01 defect (reverting the 1865/25 correction back to 1866/24).

## Deviations from Plan

None - plan executed exactly as written. Task 2 was a pure transcription task (already-run checkpoint results provided verbatim); no code was touched, no browser row was re-run, and no calibration script was executed.

## Issues Encountered

None. The one operational hazard flagged by the task (accidentally running the calibration script and reverting G-01's correction) was avoided by not running it; `27-CALIBRATION.md` was confirmed unmodified via `git status`/`git diff --stat` before and after this plan's edits.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm test` — 73/73 test files passed, 2066/2066 tests passed.
- `npx tsc --noEmit` — 0 errors.
- `git diff --stat .planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md` — empty (file untouched).
- `git status --short` — clean after this plan's commit, only the two intended files modified.

## Next Phase Readiness

- Phase 27 requirements QUAL-01 through QUAL-05, ERA-01, ERA-02 are all ticked in `REQUIREMENTS.md`. QUAL-01/QUAL-02 were already substantively complete via prior plans; this plan's contribution was the browser-checkpoint-gated set (QUAL-03/04/05, ERA-01/02).
- Two open items remain for a follow-on gap-closure round, both explicitly out of scope for this plan:
  - **G-01** (code defect, gap-closure plan authorized by the developer): fix `scripts/compute-pace-quality-calibration.mjs`'s stream-file glob to exclude `data/streams/manifest.json`, add a regression test asserting a regenerated report reproduces 1865/25, then regenerate and commit `27-CALIBRATION.md`.
  - **G-02** (documentation-only, disposition left to verification): reconcile ROADMAP Phase 27 Criterion 5 and REQUIREMENTS ERA-02's cited "716 of 1,864 (38%)" no-device-name figure against the live "663 of 1,890" figure.
- Phase 28 (PR Plausibility Ceiling) is unaffected by either open gap; no functional coupling.

## Self-Check: PASSED

- `.planning/phases/27-per-activity-quality-signals/27-VALIDATION.md` — FOUND, contains `## Round 1 Checkpoint`, `## Gap-Closure Record`, `## Requirement -> Row Disposition`.
- `.planning/REQUIREMENTS.md` — FOUND, QUAL-01 through QUAL-05/ERA-01/ERA-02 all `[x]`.
- Commit `d16e9952` — FOUND in `git log --oneline --all`.
- Commit `52200c46` — FOUND in `git log --oneline --all`.
- `npm test` — 73/73 test files, 2066/2066 tests passed.
- `npx tsc --noEmit` — 0 errors.
- `27-CALIBRATION.md` — confirmed byte-identical to its committed state (no diff).

---
*Phase: 27-per-activity-quality-signals*
*Completed: 2026-09-10*
