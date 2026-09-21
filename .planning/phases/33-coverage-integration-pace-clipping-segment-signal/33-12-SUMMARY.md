---
phase: 33-coverage-integration-pace-clipping-segment-signal
plan: 12
subsystem: testing
tags: [merge, calibration-artifacts, validation-contract, D-13, checkpoint-rows, vitest]

# Dependency graph
requires:
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "11"
    provides: "SEG-06 fully surfaced (badge + ninth detail row), the 'For the human checkpoint' table this plan's SEG-06 rows are drafted against"
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "14"
    provides: "UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = 0.00423, shipped from 33-CALIBRATION.md, re-confirmed unmoved on the merged tree"
provides:
  - "MERGE-01 discharged truthfully: origin/master confirmed an ancestor of HEAD (178 ahead / 0 behind), git merge origin/master run anyway per the 32-09 precedent, 'Already up to date.', no merge commit manufactured"
  - "All three regenerable artifacts (32-CALIBRATION.md, 33-COVERAGE-IDENTITY.md, 33-CALIBRATION.md) re-confirmed byte-identical on the merged tree, regenerated twice each with git diff --exit-code clean"
  - "The full closing gate green on the merged tree: tsc, npm run build, npm test (93 files / 3,102 tests), npm run build-widgets, npm run verify-dashboard (66/66 checks), compute-stream-checksums (added 0)"
  - "33-VALIDATION.md: zero TBDs, every -t row carries a non-zero matched count (two genuine contract-drift/partial-vacuity findings surfaced and documented, not silently passed), 15 individually numbered D-13 browser checkpoint rows (R1-R15) grouped per requirement with independently-derived expected values and bidirectional CAN FAIL/CAN PASS proofs"
affects: [33-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MERGE-01 honesty pattern (32-09 precedent, restated): run `git merge origin/master` even when a pre-fetch rev-list already shows 0 behind, so the attempt itself ('Already up to date.') is on record rather than inferred from the rev-list alone"
    - "Re-running a -t filter literally as a per-task-map row specifies it, rather than trusting a SUMMARY's prose count, surfaces genuine row/reality drift: T-33-09's glob pattern matches a different file than the one that actually discharged its behaviour, and T-33-16's filter text cannot reach assertions that live inside expect() strings rather than it() titles — both documented in place, neither silently smoothed over"
    - "A calibration artifact's own reported distribution function can carry a narrower not-computable guard than the shipped production signal it calibrates for (severityDistribution's segments.length===0 short-circuit vs unreliableSegmentsSignal's unconditional totalDistanceM>0 check) — a reporting-only blind spot, not a shipped-code defect, found by a cheap targeted probe rather than assumed benign"

key-files:
  created: []
  modified:
    - .planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-VALIDATION.md

key-decisions:
  - "MERGE-01 recorded as a truthful no-op, not a manufactured merge commit: git rev-list --left-right --count HEAD...origin/master reported '178 0' (178 ahead, 0 behind) both at orchestrator-dispatch time and re-verified fresh in this session; git merge origin/master was still run (per the 32-09 precedent) and reported 'Already up to date.' with zero commit created."
  - "All three artifacts regenerated twice each with npm run build already run, per the plan's own idempotence discipline — all three were already byte-identical to their committed state both before AND after MERGE-01 (since MERGE-01 changed nothing), so no artifact commit was needed in Task 2."
  - "Task 3's 'never re-run from memory' instruction was followed literally: every -t row's matched count in the per-task map was either quoted from its discharging plan's own SUMMARY or, where a SUMMARY didn't record one for the row's EXACT filter text, re-run fresh on 2026-09-21. Two re-runs surfaced genuine findings rather than a clean pass: T-33-09's row command (`scripts/*-recount-crosscheck.test.mjs`) glob-matches the pre-existing Phase-32-era file, not the file that actually proved the watched-failing behaviour (33-07's compute-coverage-identity-recount.mjs, whose own .test.mjs doesn't match this glob); T-33-16's row command matches only 1 test total (list.test.ts), 0 in detail-sections.test.ts, because that file's D-11 copy assertions live inside expect() argument strings, not it() titles. Both are documented in the per-task map as contract-drift/partial-vacuity findings, not fixed (out of this doc-only plan's declared file scope), and flagged for a future gap-closure round."
  - "The 33-VALIDATION.md/index.json none-vs-not-computable discrepancy the dispatch note asked about was traced to a specific activity, 11865310195 (totalDistanceM=0, 6 samples, 0 detected segments): scripts/compute-unreliable-segment-severity-calibration.mjs's own severityDistribution function classifies it 'none' because its segments.length===0 short-circuit never checks totalDistanceM, while the shipped src/analytics/pace-quality.ts's unreliableSegmentsSignal checks totalDistanceM>0 UNCONDITIONALLY before segment count, correctly returning 'not-computable'. This is a reporting-only blind spot in the calibration artifact's own distribution function, not a defect in the shipped signal — found via a one-off node probe against the real archive (data/streams), not fixed here (out of this plan's declared files_modified)."

patterns-established:
  - "Filling a validation contract's per-task map is itself a verification act, not a transcription act — literally re-running each row's stated command (rather than trusting a SUMMARY's prose) is what surfaced both genuine findings above; a plan whose own drafting merely copies SUMMARY prose without re-running would have shipped both defects silently."

requirements-completed: []  # This plan's requirements frontmatter [SEG-06, PACE-08, PACE-09, COV-03] is a MAPPING of which requirements its evidence serves, not an authority to tick them. Nothing is ticked by this plan — plan 33-13 alone sets their disposition under the all-rows-PASS rule, against rendered checkpoint evidence this plan's own R1-R15 rows exist to produce.

# Metrics
duration: ~90min
completed: 2026-09-21
---

# Phase 33 Plan 12: MERGE-01, post-merge artifact regeneration, and the D-13 checkpoint contract Summary

**MERGE-01 discharged as a truthful no-op (origin/master already an ancestor, merge run anyway per the 32-09 precedent), all three regenerable artifacts re-confirmed byte-identical on the merged tree, the full closing gate green (93 files / 3,102 tests), and `33-VALIDATION.md` filled with a fully-sourced per-task map plus 15 individually numbered D-13 browser checkpoint rows — two genuine row/reality drift findings surfaced and documented in the process rather than silently passed over.**

## Performance

- **Duration:** ~90 min
- **Tasks:** 3 (all executed as written)
- **Files modified:** 1 (`33-VALIDATION.md`; the three regenerable artifacts stayed byte-identical, nothing to commit for Task 2)

## Accomplishments

- **MERGE-01:** `git fetch origin` then `git rev-list --left-right --count HEAD...origin/master` → **`178 0`** (178 ahead, 0 behind) — origin/master is an ancestor of HEAD. `git merge origin/master` run anyway (per the `32-09-SUMMARY.md` precedent, so the attempt itself is on record rather than only inferred from the rev-list): **`Already up to date.`**, zero commit created, `git status --short` clean immediately after.
- `npm run compute-stream-checksums`: **`added 0`**, no digest mismatch, `git status --porcelain data/streams` empty throughout the whole session.
- Full closing gate on the merged tree, every command's exit code recorded: `npx tsc --noEmit` (0), `npm run build` (0), `npm test` (0, **93 files / 3,102 tests, all green**), `npm run build-widgets` (0), `npm run verify-dashboard` (0, **66/66 checks passed**).
- All three regenerable artifacts (`32-CALIBRATION.md`, `33-COVERAGE-IDENTITY.md`, `33-CALIBRATION.md`) regenerated **twice each** post-MERGE-01, `git diff --exit-code` clean both times on all three — none moved, because MERGE-01 brought in nothing. Phase 32's three constants confirmed unmoved (7.35 m/s, 3.0 m, 116.95 m); the D-07 constant confirmed still character-identical between `33-CALIBRATION.md` (`0.00423`) and `src/analytics/pace-quality.ts`'s shipped `UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION` ("Shipped value equal: yes").
- `33-VALIDATION.md`'s per-task verification map: every `TBD` replaced (Task ID + Plan columns) with the real discharging plan/task across all 16 `T-33-NN` rows; every `-t`-filtered row carries a recorded, non-zero matched test count — re-run fresh where a SUMMARY hadn't quoted one for the row's exact filter text. Two of those re-runs surfaced genuine findings rather than a clean pass (see Deviations/Findings below). `wave_0_complete: true` set in frontmatter, with all four Wave 0 items closed and cited to the plan that closed each.
- `33-VALIDATION.md`'s Manual-Only Verifications section expanded from a 6-row summary table into **15 individually numbered rows (R1-R15)**, grouped per requirement (PACE-08 x4, PACE-09 x1, COV-03 x4, SEG-06 x6), each carrying: the exact activity id and URL (`#/activity/:id`, `#/list`), the exact read-back, an independently-derived expected value cited to its source SUMMARY (and, for the four coverage-caption strings, independently re-derived a second time by this plan's own probe against the shipped `dist/` code), a stated **CAN FAIL** clause naming a concrete, reachable defect (citing the specific watched-failing/watched-RED demonstration in the discharging plan's own SUMMARY), a stated **CAN PASS** clause naming why the value is attainable on the current build, a non-empty `Requirement` cell, and a blank `Verdict` cell for plan 33-13.
- All three items `33-11-SUMMARY.md` flagged for the human checkpoint are now drafted as explicit rows: R14 (the minor-tier copy acceptability judgement on 3475724402, framed so the human judges the COPY not the TIER), R15 (the intentional gap-profile-row / unreliable-segments-row double-disclosure consistency check across all three named activities), and R13 (the clean control `10146303423`'s end-to-end SEG-06 path, which 33-11's own Task 3 did not drive).

## Task Commits

1. **Task 1: MERGE-01 — merge origin, full gate green on the merged tree** — no commit (no tracked file changed; a truthful no-op, matching the plan's own acceptance criterion)
2. **Task 2: Regenerate every artifact after the merge and reconcile what moved** — no commit (all three artifacts byte-identical after regeneration; nothing moved because MERGE-01 brought in nothing)
3. **Task 3: Fill `33-VALIDATION.md`'s task map and draft the D-13 checkpoint rows** — `6a491720` (docs)

_No separate plan-metadata commit — this is a sequential single-agent execution on the primary checkout per this session's explicit constraint; the orchestrator owns `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md`._

## Files Created/Modified

- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-VALIDATION.md` — per-task verification map fully filled (Task ID/Plan/matched counts/Status), Wave 0 Requirements all closed, Manual-Only Verifications rewritten as 15 numbered D-13 rows grouped per requirement, Validation Sign-Off checklist updated (all but `nyquist_compliant: true`, deliberately left for plan 33-13)

## Verification Evidence

**MERGE-01 (Task 1):**
```
git fetch origin
git rev-list --left-right --count HEAD...origin/master
178	0
git merge origin/master
Already up to date.
```
`git status --short` immediately after: empty. No merge commit exists in `git log`.

**Stream checksums:** `npm run compute-stream-checksums` → `added 0`. `git status --porcelain data/streams` empty throughout the session, including after every regeneration and the full-suite run.

**Full gate, every command's exit code:**
| Command | Exit | Headline |
|---|---|---|
| `npx tsc --noEmit` | 0 | clean |
| `npm run build` | 0 | clean |
| `NO_COLOR=1 npm test` | 0 | **93 files (93 passed), 3,102 tests (3,102 passed)**, 28.13s |
| `npm run build-widgets` | 0 | clean, incl. private-artifact scan (7,577 files, none contain identity/health fields) and curation-artifact scan (clean) |
| `npm run verify-dashboard` | 0 | **66/66 checks passed** |

**Test-count deltas:** vs. plan 33-11's recorded final count (93 files / 3,102 tests): **+0 files, +0 tests** — no code changed between 33-11 and this plan, and MERGE-01 was a no-op. vs. the 32-17 baseline (91 files / 2,848 tests, cited by the plan's own acceptance criteria): **+2 files, +254 tests** — the cumulative growth across Phase 33's own 11 prior execution plans.

**Artifact regeneration (Task 2), each run twice with `git diff --exit-code` between:**
- `npm run compute-unreliable-segment-calibration` (32-CALIBRATION.md): clean both times. Three shipped constants confirmed unmoved: `UNRELIABLE_SPEED_LIMIT_MPS = 7.35`, `UNRELIABLE_EXCESS_FLOOR_M = 3.0`, `HIDDEN_PAUSE_MIN_METRES = 116.95`.
- `npm run compute-coverage-identity-recount` (33-COVERAGE-IDENTITY.md): clean both times. `scanned=1874 skipped=0 identityViolations=0 recountMismatches=0`, `PASS`. Per-mechanism totals unmoved: gap-adjacent 63/85/12,730.8 m/11,574.0 s; hidden-pause 54/97/25,716.3 m/1,364.0 s; isolated-jump 645/1,162/39,468.3 m/3,082.0 s; total 699/1,344/77,915.4 m/16,020.0 s.
- `npm run compute-unreliable-segment-severity-calibration` (33-CALIBRATION.md): exit 0 both times, clean diff. Shape **R1** selected again (raw `0.004229423790775019` → rounded `0.00423`), `Shipped value equal: yes`. Archive-wide distribution unmoved: severe 136, minor 563, none 1175, not-computable 0, of 1874.
- `npm run compute-dashboard-index`, `npm run build-widgets`, `npm run verify-dashboard` re-run after all three artifact regenerations: all exit 0, 66/66 checks.
- `git status --short` at the end of Task 2: empty (all three artifacts already matched their committed state; nothing staged).

**Task 3 automated verify, run literally as the plan specifies:**
```
grep -c 'TBD' 33-VALIDATION.md          -> 0
grep -c 'CAN FAIL' 33-VALIDATION.md     -> 8   (>= 7 required)
grep -c 'CAN PASS' 33-VALIDATION.md     -> 8   (>= 7 required)
grep -c 'matched' 33-VALIDATION.md      -> 19  (>= 10 required)
grep -q 'nyquist_compliant: false'      -> present
=> OK
```
`git diff .planning/REQUIREMENTS.md` — empty (nothing ticked). `git diff .planning/STATE.md .planning/ROADMAP.md` — empty (untouched).

**Row/checkpoint counts:** 15 numbered rows total — **PACE-08: 4** (R1-R4, one is the clean-control activity `10146303423`), **PACE-09: 1** (R5), **COV-03: 4** (R6-R9, one is the clean-control activity), **SEG-06: 6** (R10-R15, one maps to both SEG-06 and COV-03: R15). Human-only marking: R1-R4 marked `HUMAN GESTURE` (hover required); R5-R13 marked `HUMAN READ-BACK` (no gesture, textual/visual confirmation); R14 marked `HUMAN JUDGEMENT` (subjective copy-quality call, no numeric discriminator); R15 combines `HUMAN READ-BACK + JUDGEMENT`.

**None vs. not-computable identity (dispatch note item i), found via a one-off `node` probe against the real archive:** activity **`11865310195`** — `totalDistanceM = 0` (`d[0] = d[last] = 0`), 6 samples, 0 detected segments. `scripts/compute-unreliable-segment-severity-calibration.mjs`'s own `severityDistribution` function classifies it `'none'` because its `segments.length === 0` branch short-circuits before ever checking `totalDistanceM`; the shipped `src/analytics/pace-quality.ts`'s `unreliableSegmentsSignal` checks `totalDistanceM > 0` **unconditionally, before segment count**, correctly returning `'not-computable'`. This is a reporting-only blind spot in the calibration artifact's own distribution function (never consulted by the D-07 constant's selection, which happens before this function runs) — not a defect in the shipped signal, and not fixed here (`scripts/compute-unreliable-segment-severity-calibration.mjs` is not among this plan's declared `files_modified`).

## Decisions Made

See `key-decisions` in the frontmatter for the full MERGE-01, artifact-regeneration, per-task-map-drift, and none-vs-not-computable rationale — restated briefly:

- **MERGE-01 is a truthful no-op**, recorded per the 32-09 precedent (run the merge anyway; state the no-op plainly).
- **Literal re-running, not prose-trusting**, when filling the per-task map — this is what surfaced the two genuine findings (T-33-09's glob drift, T-33-16's partial vacuity) rather than a clean pass.
- **Findings documented in place, not fixed** — both are outside this doc-only plan's declared file scope (`scripts/unreliable-segment-recount-crosscheck.test.mjs`'s naming and `detail-sections.test.ts`'s test titles are production/test files, not this plan's three declared artifacts), so they are flagged for a future gap-closure round rather than silently corrected under this plan's own authority.
- **The none/not-computable discrepancy was investigated cheaply** (a single targeted node probe, not a full re-scan script), per the dispatch note's own "if it is cheap" instruction, and traced to a specific, named, reasoned cause.

## Deviations from Plan

### Auto-fixed Issues

None — this plan touches no production or test code; every task was documentation/verification only, exactly as its own `<action>` text specifies ("Two edits to `33-VALIDATION.md`, no code" for Task 3; Tasks 1-2 are merge/regeneration only).

### Findings surfaced, investigated, and documented — not fixed (out of this plan's declared file scope)

**1. T-33-09's per-task-map row command drifts from the file that actually discharged its behaviour**
- **Found during:** Task 3, literally re-running every row's Automated Command rather than trusting SUMMARY prose
- **Issue:** The row's command `npx vitest run scripts/*-recount-crosscheck.test.mjs` glob-matches only the pre-existing `scripts/unreliable-segment-recount-crosscheck.test.mjs` (5/5 passed) — a different file from the one that actually proved T-33-09's watched-FAILING-against-a-broken-detector behaviour (`scripts/compute-coverage-identity-recount.mjs`, 699/1,874 mismatches, quoted verbatim in `33-07-SUMMARY.md`), whose own `.test.mjs` doesn't match this glob pattern.
- **Disposition:** Documented in the per-task map with both counts and the discrepancy explained. Not fixed — editing the row's Automated Command text is not clearly authorized by this plan's Task 3 instructions (which permit filling Task ID/Plan/Status/matched-count, not rewriting the command column), and `33-VALIDATION.md` is this plan's only declared file, so a broader rename/rewrite is deferred.
- **Files modified:** none (documentation only, inside the already-declared `33-VALIDATION.md`)

**2. T-33-16's row command is partially vacuous against `detail-sections.test.ts`**
- **Found during:** Task 3, same literal re-run discipline
- **Issue:** `-t "gaps, pauses or unreliable"` matches 1 test total (in `list.test.ts`) and **0** in `detail-sections.test.ts`, because that file's D-11 copy assertions (e.g. `expect(gapRow.valueText).toBe('27% of recorded time in gaps, pauses or unreliable segments')`) live inside `expect()` argument strings, never inside an `it(...)` title — a name-based `-t` filter structurally cannot reach them.
- **Disposition:** Documented in place; the underlying behaviour IS covered (by T-33-15's `-t "gapProfileRow"` row, 2/2, and T-33-04's `-t "coverageCaptionText"` row, 9/9) just not reachable by this specific filter text. Flagged for a future gap-closure round to either rename a test title or split the row's command. Not fixed here (production test file, out of scope).
- **Files modified:** none

**3. The `none`-vs-`not-computable` archive-wide discrepancy (investigated per the dispatch note, "if it is cheap")**
- **Found during:** compiling this SUMMARY's hand-off, following up on the dispatch note's open item
- **Issue:** `scripts/compute-unreliable-segment-severity-calibration.mjs`'s `severityDistribution` reports 0 `not-computable` (1175 `none`) where the shipped `unreliableSegmentsSignal` reports 1 `not-computable` fewer `none` among the same 1,874 streams, because the calibration script's distribution function short-circuits to `'none'` on zero detected segments without checking `totalDistanceM`, while the shipped signal checks `totalDistanceM > 0` unconditionally, first.
- **Disposition:** Traced to the single activity `11865310195` (0 m total distance, 6 samples) via a one-off node probe. Not fixed — `scripts/compute-unreliable-segment-severity-calibration.mjs` is not among this plan's declared files, and the shipped signal's behaviour (the one actually rendered) is correct; only the calibration artifact's OWN reported distribution has this narrow blind spot, which never affected the D-07 constant's selection (computed before this function runs).
- **Files modified:** none

---

**Total deviations:** 0 auto-fixed (this plan writes no code). 3 findings investigated and documented per the dispatch note's own instructions, none fixed (each is outside this plan's declared file scope, and each is a reporting-nuance/contract-drift finding rather than a shipped-code defect).

## Issues Encountered

None beyond the three findings above, all resolved by documentation rather than code change, per this plan's own doc-only scope.

## Next Phase Readiness

- The phase sits on a confirmed-merged, fully green tree: `tsc`, `npm run build`, `npm test` (93/3,102), `npm run build-widgets`, `npm run verify-dashboard` (66/66) all exit 0, and `data/streams/` is confirmed byte-identical throughout.
- All three regenerable artifacts reflect the (unchanged) post-merge archive and regenerate byte-identically twice each; every moved-or-not figure is attributed (nothing moved, since MERGE-01 was a no-op).
- `33-VALIDATION.md` is ready for plan 33-13: 15 numbered D-13 checkpoint rows, grouped per requirement, each with a sourced expected value and a bidirectional CAN FAIL/CAN PASS proof — plan 33-13's Task 1 can walk them directly. `nyquist_compliant` stays `false`, `Approval` stays `pending` — both are plan 33-13's to set, from real transcribed verdicts.
- **Hand-off for plan 33-13 / a future gap-closure round:** (i) the `11865310195` none-vs-not-computable reporting nuance, traced above, is informational only and does not block the checkpoint; (ii) T-33-09's per-task-map row command and (iii) T-33-16's row command both have documented drift from what they literally test — neither blocks the checkpoint (the underlying behaviours ARE covered elsewhere, cited in place), but both are candidates for a future plan to tighten; (iv) plan 33-10's investigated-but-not-changed finding (plan text vs. shipped all-or-nothing `mechanisms` array behaviour) and (v) 33-01's re-pinned pre-existing assertions (two `coveredFraction` floors 98%→97%, a pause→unreliable negative case, a caption 99%→98%) remain carried forward, unresolved by this plan, exactly as prior SUMMARYs left them.
- No requirement is ticked by this plan (`git diff .planning/REQUIREMENTS.md` empty); `STATE.md`/`ROADMAP.md` are untouched (`git diff` empty on both). Nothing pushed.

---
*Phase: 33-coverage-integration-pace-clipping-segment-signal*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-VALIDATION.md`
- FOUND: `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-12-SUMMARY.md`
- FOUND commit: `6a491720`
- FOUND commit: `aaf58c34`
- `git status --short`: clean
