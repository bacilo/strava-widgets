---
phase: 32-unreliable-segment-detection-calibration
plan: 07
subsystem: testing

# Dependency graph
requires:
  - phase: 32-unreliable-segment-detection-calibration
    provides: "32-03's gap-first recount (compute-unreliable-segment-recount.mjs, parses `## Chosen constants` and `## Per-segment table — 3475724402 (detector output)`) and 32-06's shipped constants (UNRELIABLE_SPEED_LIMIT_MPS=7.35, UNRELIABLE_EXCESS_FLOOR_M=3, HIDDEN_PAUSE_MIN_METRES=116.95, DEFAULT_DETECTOR_PARAMS) — the inputs this plan renders findings against and proves the recount against"
provides:
  - "scripts/compute-unreliable-segment-calibration.mjs's eight new findings functions (buildHeadline, buildReconciliationLadder, measureDecimationOverlap, nearMissSweep, fixtureHeadroom, suuntoDisclosure, d04Statement, renderPerSegmentTable) plus buildFindingsResults, gapSampleIndexList, perSampleFastRuns and renderFindingsSections wiring all of it into the artifact"
  - "32-CALIBRATION.md's eight new sections — Figures of record (D-16), Reconciliation against the scoping probe (D-16), Overlap with the decimation-severe cohort (D-11), Adjacency near-miss sweep (D-06), Negative-control headroom (D-05), Suunto over-measurement disposition (D-01/D-02/D-03), One downstream treatment (D-04), and the D-15 Per-segment table for 3475724402 that compute-unreliable-segment-recount.mjs now parses and PASSES against"
  - "A fixed, pre-existing 32-06 rendering bug: the '## Chosen constants' table's Value column carried a unit suffix ('7.35 m/s'), which made the recount's parseCalibrationArtifact fail closed on every run until this plan's Task 1 — now a bare number, matching the D-15 ARTIFACT CONTRACT"
  - "The recount watched FAILING against a deliberately broken detector (disabled leading-side touching, the Pitfall 4 one-sided shape) on the real tree, then restored byte-identically, with a second, unbroken generator run producing a zero diff"
affects: ["32-08 (pins SEG-02/SEG-03 as permanent npm-test regression fixtures on the now-complete artifact; depends on this plan for sequencing since Task 2 transiently broke the detector on the primary checkout)", "32-09 (re-runs this generator after the MERGE-01 origin merge; the figures of record must be regenerated against the merged archive)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-16 reconciliation ladder: exactly ONE factor changes per rung (archive growth -> per-sample-vs-run-level grouping -> speed-limit change -> floor change), each rung reporting the SAME two scoping-probe analogues so every delta is attributable to a single named cause, never asserted as a target"
    - "D-11 overlap ratio as a real stop condition: severeFlagRate/nonSevereFlagRate, reported with BOTH intersection denominators, computed and rendered even when the ratio would fail (>= 2), never rounded away or exempted"
    - "D-06 near-miss sweep walks an ordered per-activity 'timeline' (folded steps interleaved with gap spans, merged by sample index) outward from a no-gap segment's own boundary, counting intervening step entries before a gap entry appears — k in {1,2,3} is a reporting window, never a rule; touching (k=0) is correctly excluded by construction"
    - "Headroom and Suunto disclosure are measured at the SHIPPED constants (imported UNRELIABLE_SPEED_LIMIT_MPS/UNRELIABLE_EXCESS_FLOOR_M), never a re-derived live value — the artifact's own 'Chosen constants' section already carries that separate live-vs-shipped comparison"

key-files:
  created: []
  modified:
    - scripts/compute-unreliable-segment-calibration.mjs
    - scripts/compute-unreliable-segment-calibration.test.mjs
    - .planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md

key-decisions:
  - "Fixed a pre-existing 32-06 bug (Rule 1): the '## Chosen constants' table's Value column rendered '7.35 m/s' with a unit suffix, which compute-unreliable-segment-recount.mjs's parseCalibrationArtifact (Number(raw)) rejects as non-numeric. Changed ONLY that column to a bare number; the 'Live-derived value' column keeps its unit suffix since nothing parses it."
  - "fixtureHeadroom and suuntoDisclosure measure at the imported SHIPPED constants (UNRELIABLE_SPEED_LIMIT_MPS/UNRELIABLE_EXCESS_FLOOR_M), not a re-derived value from the Decision's statistic — avoids duplicating 'Chosen constants'' own live-derivation-vs-shipped comparison and keeps these two sections' numbers stable even if a future archive change moves the live-derived constants without a re-ship."
  - "D-16's reconciliation ladder's per-rung 'streams with >=100m excess' and 'streams with a burst touching a gap' counts are computed from a SHARED per-activity fast-run/floor computation (perSampleFastRuns for R0, fastRunsFromSteps for R1-R3) rather than four separately-coded sweeps, so the only thing that varies between rungs is the (mode, L, F) triple passed in — structurally enforcing the plan's own 'exactly one factor per rung' requirement rather than trusting four hand-written loops to agree."
  - "Did NOT mark SEG-02 or SEG-04 complete in REQUIREMENTS.md, despite both appearing in this plan's frontmatter requirements field — mirroring 32-05/32-06's own precedent. SEG-02 also needs 32-08's permanent npm-test-time regression pinning (not yet done); SEG-04 also needs 32-09's post-MERGE-01 re-validation of the figures of record against the merged archive (32-09's own frontmatter names SEG-04 as its requirement too, for exactly this reason)."

patterns-established:
  - "A STOP-condition section (D-11 ratio, D-15 per-segment mechanism purity) is rendered with its own pass/fail prose INSIDE the generated artifact, not just checked by the executor out-of-band — so a future regeneration against a grown archive re-states the finding automatically, and a genuine regression is visible in the artifact diff itself, not only in a build log."

requirements-completed: []  # Deliberate, see key-decisions: SEG-02 needs 32-08's pinned regression tests; SEG-04 needs 32-09's post-merge re-validation. Ticking either now would be premature (32-05/32-06's own precedent for this exact caution).

# Metrics
duration: ~2h
completed: 2026-09-20
---

# Phase 32 Plan 07: Figures of Record, Reconciliation, D-11/D-06/D-05/Suunto Findings, and the D-15 Per-Segment Table

**Completed the calibration artifact of record with eight generated findings sections (live-denominator per-mechanism headline, a one-factor-per-rung reconciliation ladder, measured D-11 decimation overlap at ratio 1.525, a D-06 near-miss sweep, D-05 fixture headroom, the honest Suunto disclosure, the D-04 one-treatment statement, and the D-15 per-segment table for 3475724402), fixed a pre-existing rendering bug that made the independent recount fail closed, and proved the recount both FAILING against a deliberately broken detector and PASSING against the restored one on the real tree.**

## Performance

- **Duration:** ~2h
- **Started:** 2026-09-20
- **Completed:** 2026-09-20
- **Tasks:** 2 of 2 completed
- **Files modified:** 3

## Accomplishments

- **Implemented all eight findings functions** with 22 new hand-built-fixture unit tests (57 total
  in the file, all passing on first run against the real archive): `buildHeadline`,
  `buildReconciliationLadder`, `measureDecimationOverlap`, `nearMissSweep`, `fixtureHeadroom`,
  `suuntoDisclosure`, `d04Statement`, `renderPerSegmentTable`, plus the shared
  `buildFindingsResults`/`gapSampleIndexList`/`perSampleFastRuns` helpers.
- **Fixed a pre-existing 32-06 bug that made the D-15 recount fail closed on every run**: the
  `## Chosen constants` table's Value column rendered `7.35 m/s` (with a unit suffix) instead of a
  bare number, which `compute-unreliable-segment-recount.mjs`'s `parseCalibrationArtifact` rejects
  via `Number(raw)`. Fixed by rendering only that column as a bare number.
- **Measured, on the live 1,874-stream archive**: the D-16 headline (699/1,874 activities carry at
  least one flagged segment — 63 gap-adjacent, 54 hidden-pause, 645 isolated-jump, never presented
  as one number); the D-11 decimation-severe overlap ratio is **1.525** (severe cohort flagged at
  54.5% vs non-severe at 35.8%) — below the plan's own STOP threshold of 2, disclosed rather than
  hidden; the D-06 near-miss sweep finds 25/25/18 no-gap segments at exactly 1/2/3 clean steps from
  a gap; D-05's two locked fixtures show 6.5 m / 81% headroom (`7409028052`) and an unbounded
  headroom (`3647739864`, spared by the speed limit alone, never even a candidate); and the Suunto
  sample (`4556693525`) IS detected (as `hidden-pause` and `isolated-jump` segments, never a fourth
  label), with its second, separate ~80s low-HR span also firing.
- **Rendered the D-15 per-segment table for `3475724402`** (16 segments, all `gap-adjacent` — no
  STOP condition (b) triggered) and **watched the independent recount FAIL non-vacuously** against
  a deliberately broken detector (disabled leading-side touching only — the Pitfall 4 one-sided
  shape), naming a row-count mismatch (16 vs 25 rows) and multiple field/mechanism mismatches, then
  **restored the tree byte-identically** and watched the recount PASS again, with a second
  generator run producing a zero diff on the artifact.

## Task Commits

1. **Task 1: Findings functions and sections** - `83b73026` (feat)
2. **Task 2: Recount watched FAILING then restored** - no commit (see below) — the task ends with a
   byte-identical, fully-restored tree; there is nothing to commit beyond what Task 1 already
   captured. Evidence is the verbatim console output recorded in this SUMMARY.

**Plan metadata:** this SUMMARY plus the final `docs(32-07)` metadata commit that follows it.

## Files Created/Modified

- `scripts/compute-unreliable-segment-calibration.mjs` - the eight findings functions, their
  shared helpers, `renderFindingsSections` wiring them into eight new generated `##` sections, and
  the one-line fix to `## Chosen constants`'s Value column format
- `scripts/compute-unreliable-segment-calibration.test.mjs` - 22 new hand-built-fixture tests (57
  total)
- `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` - the eight new
  sections, regenerated and idempotent (byte-identical on a second run)

## Task 2: Recount Watched FAILING, Then PASSING — Verbatim Output

Per D-15, the independent recount must be shown failing against a deliberately broken detector
before it is trusted. Performed in one shell sequence on the primary checkout (`src/` was clean
before and after; no other agent or worktree was involved):

**1. Deliberate break** (`src/analytics/unreliable-segments.ts`): disabled ONLY the leading-side
touching case in the block-chaining loop (`blocks[j].kind === 'burst' && blocks[j+1].kind ===
'gap'`, contiguous) — the Pitfall 4 one-sided shape (breaking one side of a gap's adjacency check
while leaving the other, trailing-burst side intact).

**2-3.** `npm run build` (clean `tsc` exit) then `node
scripts/compute-unreliable-segment-calibration.mjs` regenerated the artifact from the broken
detector.

**4. Recount against the broken artifact — exit 1, non-vacuous:**

```
FAIL:
  - row-count mismatch: recount has 16 row(s), detector has 25 row(s)
  - row 2 field "endIndex" mismatch: recount=533, detector=529
  - row 2 field "gaps" mismatch: recount=1, detector=0
  - row 2 field "bursts" mismatch: recount=2, detector=1
  - row 2 field "seconds" mismatch (rounded to 1dp): recount=71, detector=8
  - row 2 field "metres" mismatch (rounded to 1dp): recount=288.6, detector=158.5
  - row 2: burst labelled "hidden-pause" isolated/hidden-pause on 3475724402
  - row 4: burst labelled "isolated-jump" isolated/hidden-pause on 3475724402
  - row 6: burst labelled "isolated-jump" isolated/hidden-pause on 3475724402
  - row 8: burst labelled "isolated-jump" isolated/hidden-pause on 3475724402
  - row 9: burst labelled "isolated-jump" isolated/hidden-pause on 3475724402
  - row 11: burst labelled "isolated-jump" isolated/hidden-pause on 3475724402
  - row 14: burst labelled "hidden-pause" isolated/hidden-pause on 3475724402
  ... (73 total problems: row-count mismatch plus per-field mismatches on every one of the 16
      recount rows, and 7 detector rows carrying a mechanism other than `gap-adjacent`)
EXIT CODE: 1
```

This is exactly the expected failure shape: with leading-side touching disabled, 13 of
`3475724402`'s 30 bursts that previously merged into a gap-adjacent segment on their leading side
now stand alone as `isolated-jump`/`hidden-pause` segments instead, and the segment boundaries
shift, producing both a row-count mismatch and per-row field mismatches. The recount is not
vacuous — it names concrete, specific disagreements.

**5.** `git checkout -- src/analytics/unreliable-segments.ts
.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` restored both
files.

**6.** `npm run build` — clean `tsc` exit.

**7. Recount against the restored artifact — exit 0:**

```
PASS: recount agrees with the calibration artifact's detector table.
EXIT: 0
```

**8.** `node scripts/compute-unreliable-segment-calibration.mjs` then `git diff --exit-code
.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` — exit 0 (zero
diff; the restored detector regenerates byte-identically to what Task 1 committed).

**9.** `git status --porcelain src` — empty. The tree and artifact are restored byte-identically.

## Decisions Made

See the frontmatter `key-decisions` above: the Chosen-constants render fix (Rule 1 bug), measuring
headroom/Suunto at the shipped (not re-derived) constants, the shared fast-run/floor computation
underlying every reconciliation-ladder rung, and withholding SEG-02/SEG-04 completion pending
32-08/32-09.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `## Chosen constants`'s Value column was not machine-parseable**
- **Found during:** Task 1's own verify step, first `node
  scripts/compute-unreliable-segment-recount.mjs` run against the Task-1-regenerated artifact
- **Issue:** 32-06 rendered `| \`UNRELIABLE_SPEED_LIMIT_MPS\` | 7.35 m/s | ... |` — the Value cell
  carried a `" m/s"` unit suffix. `parseCalibrationArtifact`'s `extractConstant` reads that exact
  cell via `Number(raw)`, which returns `NaN` for `"7.35 m/s"`, so the recount failed closed with
  `UNRELIABLE_SPEED_LIMIT_MPS value is not numeric` on every run — this had been silently broken
  since 32-06, since 32-07 is the first plan to actually exercise the recount against a real
  `## Per-segment table` (it didn't exist before this plan).
- **Fix:** changed only the Value column (not the "Live-derived value" column, which nothing
  parses) to a bare number for all three constant rows.
- **Files modified:** `scripts/compute-unreliable-segment-calibration.mjs`
- **Commit:** `83b73026`

**2. [Rule 3 - Blocking] `renderFindingsSections`/test fixture needed explicit null-safe fields**
- **Found during:** the existing `renderCalibrationMarkdown` option-jitter test, which constructs a
  hand-built fake report without the new `headline`/`reconciliationLadder`/etc. fields
- **Issue:** `renderFindingsSections` iterated `report.headline` unconditionally in one branch;
  the pre-existing fixture left those fields `undefined` (not `null`), causing a `TypeError`.
- **Fix:** added the eight new null-guarded fields to the existing fixture (mirroring the
  `chosenConstants: null` convention `renderChosenConstantsSections` already used for
  `option-jitter`).
- **Files modified:** `scripts/compute-unreliable-segment-calibration.test.mjs`
- **Commit:** `83b73026`

---

**Total deviations:** 2 auto-fixed (Rule 1 bug fix, Rule 3 blocking test fixture fix). Neither was
tuning a constant or a threshold — both were necessary for the plan's own verification chain
(`node scripts/compute-unreliable-segment-recount.mjs` exiting 0) to run at all.
**Impact on plan:** No scope creep; both fixes were required to satisfy Task 1's own `<verify>`
command as written.

## STOP Conditions Checked (Not Triggered)

Per the plan's own explicit instruction, both STOP conditions were checked and NOT tuned around:

- **(a) D-11 ratio >= 2:** measured ratio is **1.525** (< 2). Disclosed in the artifact's own D-11
  section as "above 1, attributed, not hidden" rather than rounded away.
- **(b) Non-gap-adjacent mechanism on `3475724402`'s per-segment table:** all 16 rendered segments
  carry mechanism `gap-adjacent`. No STOP.

## Issues Encountered

None beyond the two auto-fixed deviations above. The 22 new hand-built-fixture tests all passed on
their first run against the real archive without requiring any adjustment to the implementation —
the reconciliation-ladder fixtures in particular (three sequential bursts at 8/7.1/7.45 m/s,
designed to isolate the speed-limit-change and floor-change factors one at a time) matched the
predicted arithmetic exactly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Unblocked.** `32-CALIBRATION.md` now carries the complete figures-of-record contract SEG-04's
  text requires (live-denominator headline, reconciliation, D-11 overlap, D-06 near-miss, D-05
  headroom, Suunto disclosure, D-04 statement) and the D-15 per-segment table plan 32-03's recount
  has been waiting on since it was written.
- 32-08 can now proceed: it depends on this plan strictly for SEQUENCING (Task 2's transient
  detector break happened and was fully reverted inside this plan's own single task, on the primary
  checkout, before 32-08's real-stream regression tests run).
- 32-09 can now proceed: after MERGE-01, it will re-run `compute-unreliable-segment-calibration.mjs`
  against the grown archive — every figure in this plan's new sections is LIVE-derived (never a
  hard-coded 1,873/1,874), so that re-run needs no code change here, only a regeneration.
- SEG-02/SEG-04 remain `Pending` in REQUIREMENTS.md, deliberately (see key-decisions) — 32-08 and
  32-09 respectively still owe their own halves.
- No blockers for 32-08.

---
*Phase: 32-unreliable-segment-detection-calibration*
*Completed: 2026-09-20*

## Self-Check: PASSED

- FOUND: `scripts/compute-unreliable-segment-calibration.mjs`
- FOUND: `scripts/compute-unreliable-segment-calibration.test.mjs`
- FOUND: `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md`
- FOUND: commit `83b73026` in `git log --oneline --all`
- CONFIRMED: `.planning/phases/32-unreliable-segment-detection-calibration/32-CALIBRATION.md` contains
  `## Figures of record (D-16)` and the measured `1.525` D-11 ratio
- CONFIRMED: `npx vitest run scripts/compute-unreliable-segment-calibration.test.mjs` — 57/57 passed
- CONFIRMED: `node scripts/compute-unreliable-segment-recount.mjs` — exit 0, PASS verdict
- CONFIRMED: second `node scripts/compute-unreliable-segment-calibration.mjs` run — `git diff
  --exit-code` on the artifact exits 0 (byte-identical)
- CONFIRMED: `git status --porcelain src` — empty (Task 2's deliberate break was fully reverted)
