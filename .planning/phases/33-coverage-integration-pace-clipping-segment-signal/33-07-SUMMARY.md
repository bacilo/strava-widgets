---
phase: 33-coverage-integration-pace-clipping-segment-signal
plan: 07
subsystem: analytics
tags: [unreliable-segments, coverage, gap-classification, recount, vitest, calibration-artifact]

# Dependency graph
requires:
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "01"
    provides: "classifyGaps widened to four-way GapKind, classifyGapsThreeWay's pre-detector seam — the shipped totals this recount reads and reconciles against"
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "03"
    provides: "GAP_PROFILE_SEVERE_FRACTION/GAP_PROFILE_MINOR_FRACTION frozen thresholds — reused verbatim for the D-05 tier-migration matrix"
  - phase: 33-coverage-integration-pace-clipping-segment-signal
    plan: "06"
    provides: "real-stream extent proofs this artifact's archive-wide identity check complements"
provides:
  - "scripts/compute-coverage-identity-recount.mjs: a second, independent gap-first recount extending the Phase 32 single-activity analog to all three mechanisms (gap-adjacent/hidden-pause/isolated-jump), archive-wide"
  - "33-COVERAGE-IDENTITY.md: the regenerable artifact discharging COV-03 — zero identity violations, zero recount mismatches over 1874 streams, D-01 time-movement and D-05 tier-migration findings"
  - "A proven-failable recount (watched FAILING against a deliberately broken shipped detector, 699/1874 mismatching activities, then reverted and re-confirmed PASS)"
affects: [33-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gap-first, per-segment-run enumeration extending the Phase 32 single-activity recount's computeRunsInSegment to emit a row for EVERY kept run (not only boundary-touching ones), classified hidden-pause/isolated-jump by the detector's own metres boundary rule"
    - "Scoped-import guard with word-boundary counting (\\bclassifyGaps\\b) to confine a necessarily-imported shipped function to one call site while a sibling function sharing its name as a substring (classifyGapsThreeWay) is imported and used freely elsewhere"
    - "Independent reimplementation of a TRUSTED (not under test) pre-detector input — localNonCoveredSpans reproduces pace-derivation.ts's own recording-gap+pause classification fresh, because the recount's gap-first walk needs to know every boundary the shipped detector treats as a gap, not because that classification is itself the subject of this recount's independence claim"

key-files:
  created:
    - scripts/compute-coverage-identity-recount.mjs
    - scripts/compute-coverage-identity-recount.test.mjs
    - .planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-COVERAGE-IDENTITY.md
  modified:
    - package.json

key-decisions:
  - "The recount's local gap definition covers BOTH recording gaps and pause spans (localNonCoveredSpans), not recording gaps alone — the Phase 32 single-activity analog's narrower scope is safe only for its one pinned activity; running the archive-wide comparison first with recording-gap-only surfaced 10 genuine mismatches, all burst chains touching a pause span directly adjacent to a recording gap, which the shipped detector's own isGapPair treats identically to a recording gap. Fixed by reimplementing pace-derivation.ts's own pre-detector classification fresh (never calling classifyGapsThreeWay for this purpose) rather than narrowing the claim."
  - "classifyGapsThreeWay and the two GAP_PROFILE_* constants are imported unscoped (only classifyGaps itself is confined to readShippedCoverage) — neither touches the detector; classifyGapsThreeWay is the pre-detector split D-01's finding measures FROM, and the two constants are plain numeric thresholds needed to reproduce the shipped D-05 tiering rule."
  - "The scoped-import guard test counts classifyGaps occurrences via a \\bclassifyGaps\\b word-boundary regex, not a plain substring search — a substring search would miscount every classifyGapsThreeWay call (imported and used freely) as an illegitimate classifyGaps occurrence, since \"classifyGaps\" is a literal substring of \"classifyGapsThreeWay\"."
  - "No vi.spyOn(fs, ...)/vi.mock('fs') import-time no-side-effect guard was written for this file, per the plan's own instruction — its control probe was never independently demonstrated OBSERVED, and this repo's own recorded memory (fs spy cannot observe named imports) already disqualifies that guard shape for a module consuming fs via named imports. The self-execution guard (import.meta.url === pathToFileURL(...)) is what actually prevents a real file read as an import-time side effect, and every test in the guard file confirms this by importing the module without triggering data/streams or 32-CALIBRATION.md reads."

patterns-established:
  - "A second-traversal recount need not re-verify every upstream input from scratch — it must independently re-derive the ALGORITHM under test (the detector's own burst/excess/chaining bookkeeping), but may treat an already-canonical, separately-tested INPUT (D-14's pre-detector gap definition) as trusted and reproduce it fresh rather than importing it, when reproducing it independently both preserves the 'structurally distinct traversal' property and is necessary for correctness."

requirements-completed: []  # This plan's own text (requirement-tick safety) forbids ticking COV-03 here; plan 33-13 alone sets its disposition against rendered checkpoint evidence.

# Metrics
duration: ~30min
completed: 2026-09-21
---

# Phase 33 Plan 7: Detector-free archive-wide coverage identity recount (COV-03 evidence) Summary

**Built a second, independent gap-first recount extending Phase 32's single-activity analog to all three unreliable-segment mechanisms, ran it archive-wide against all 1,874 committed streams (zero identity violations, zero recount mismatches), and proved it able to fail against a deliberately broken shipped detector (699/1,874 mismatching activities) before trusting the PASS.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2
- **Files modified:** 4 (2 created scripts, 1 generated artifact, 1 package.json entry)

## Accomplishments

- `scripts/compute-coverage-identity-recount.mjs`: zero imports of `unreliable-segments` (the detector) in any spelling; `classifyGaps` (the shipped, wired classifier) confined to the single `readShippedCoverage` function, structurally guarded by a word-boundary-counted scoped-import test that correctly distinguishes it from `classifyGapsThreeWay`
- `recountActivity(t, d, params)` walks every inter-gap segment and emits a row for EVERY kept fast run (not only the two boundary-touching ones the Phase 32 analog emits) — new logic classifying non-gap-touching runs `hidden-pause`/`isolated-jump` by the same `metres >= hiddenPauseMinMetres` boundary rule the detector itself uses, both directions exercised in the guard test (150 m / 50 m synthetic cases)
- 35 pure-function tests, all green; `npm test` clean at 92 files / 2,935 tests (delta vs the 33-06 baseline: +1 file, +35 tests, exactly this plan's own new file)
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-COVERAGE-IDENTITY.md`: 1,874 streams scanned, 0 skipped, 0 identity violations, **0 recount mismatches** — the load-bearing check. Regenerated twice, byte-identical (`diff` on the raw file content, since the artifact was untracked on the first two runs — git diff on an untracked path is meaningless; the third run's `git diff --exit-code` against the now-staged file also confirmed clean)
- D-01 time movement: 10,665.0 s moved out of `recordingGapSec`, 587.0 s out of `pauseSec`, 4,768.0 s out of `coveredSec`, archive-wide. Gap-adjacent mechanism total (11,574.0 s, 63 activities, 85 segments, 12,730.8 m) reconciles EXACTLY against `32-CALIBRATION.md`'s own Figures-of-record reference (recorded 2026-09-21, same day — archive unchanged between the two artifacts)
- D-05 tier migration: 3 of 1,874 activities changed tier (all `none` → `minor`), reported as a genuine non-zero finding; both `GAP_PROFILE_SEVERE_FRACTION` (0.2) and `GAP_PROFILE_MINOR_FRACTION` (0.05) confirmed unmoved (imported verbatim from the shipped module, never re-derived)
- **Watched-failing proof (T-33-09):** deliberately changed `classifyGaps`' pass-3 containment in `src/analytics/pace-derivation.ts` from `i < seg.endIndex` to `i < seg.endIndex - 1`, rebuilt, re-ran the recount — **699 mismatching activities, exit 1**, identity violations still 0 (confirming the identity alone would NOT have caught this). Reverted, rebuilt, re-ran — PASS restored, `git diff --exit-code` clean on `src/analytics/pace-derivation.ts` and on the artifact

## Task Commits

1. **Task 1: The detector-free archive-wide recount script and its structural guards** - `adb5e665` (feat)
2. **Task 2: Generate the artifact, watch the recount fail against a broken detector, report D-01/D-05** - `e3dc25b4` (feat)

_No separate plan-metadata commit — this is a sequential single-agent execution on the primary checkout; the orchestrator handles STATE.md/ROADMAP.md centrally per this plan's own instructions._

## Files Created/Modified

- `scripts/compute-coverage-identity-recount.mjs` — the recount script: `parseChosenConstants`, `checkStream`, `localGapSpans`, `localNonCoveredSpans` (private), `recountActivity`, `readShippedCoverage`, `evaluateArchive`, `computeArchiveWideFindings`, `main()`
- `scripts/compute-coverage-identity-recount.test.mjs` — zero-import guard, scoped-import guard (word-boundary counted), `parseChosenConstants` fail-closed cases, and pure-function cases for every `<behavior>` bullet (35 tests)
- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-COVERAGE-IDENTITY.md` — the generated artifact (6 sections: Method, Archive-wide identity, Recount agreement, Time movement (D-01), Tier migration (D-05), Inputs)
- `package.json` — new `compute-coverage-identity-recount` script entry

## Verification Evidence

**Recount PASS line (final, post-revert):**
```
scanned=1874 skipped=0 identityViolations=0 recountMismatches=0
PASS: archive-wide identity holds and the recount agrees with the shipped classifier on every computable stream.
```

**Idempotence:** ran twice consecutively; the artifact's raw content was byte-identical both by direct file diff (first two runs, file untracked) and by `git diff --exit-code` (third run, file staged) — exit 0 both ways.

**Guard test counts:** `npx vitest run scripts/compute-coverage-identity-recount.test.mjs` → `Tests 35 passed (35)`, 0 failed. Zero-import guard's stripper-sanity case: `'the stripper actually removes a line naming a forbidden module — proving it works rather than assuming it'`, passing. Scoped-import guard's slicer-sanity case: `'slicer sanity: the readShippedCoverage function slice is non-empty and contains its own classifyGaps call'`, passing. Measured `classifyGaps` whole-word occurrence counts (stripped source): whole file 2, inside `readShippedCoverage`'s own body 1, arithmetic balances (`1 slice + 1 import line = 2 total`).

**`grep -c 'unreliable-segments' scripts/compute-coverage-identity-recount.mjs` (stripped-source count, verified programmatically):** `0`. Raw file still names it in the docblock (comments only) — the guard's own sanity case confirms the raw source legitimately contains the string before asserting the stripped source does not.

**`grep -c "compute-unreliable-segment-recount" scripts/compute-coverage-identity-recount.mjs` outside comments:** `0` (the script is a fresh reimplementation, never imports the Phase 32 analog).

**Watched-failing FAIL output (verbatim head, deliberately broken `i < seg.endIndex - 1` build):**
```
D-03 archive-wide coverage identity recount: scanning 1874 stream file(s) from /Users/pedf/workspace/strava-widgets/data/streams, comparing against dist/analytics/pace-derivation.js's shipped classifier (no detector import)...

Wrote /Users/pedf/workspace/strava-widgets/.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-COVERAGE-IDENTITY.md
scanned=1874 skipped=0 identityViolations=0 recountMismatches=699
FAIL:
  - recount mismatch: 10232917652 shipped=2 recount=10
  - recount mismatch: 10238432339 shipped=0 recount=1
  - recount mismatch: 10255309106 shipped=0 recount=2
  ... (696 more lines, one per mismatching activity)
```
Exit code: `1`. Mismatching-activity count: **699** (of 1,874 scanned; identity violations stayed 0, confirming the four-way identity alone would not have caught this off-by-one).

**Watched-failing PASS output (verbatim, after revert + rebuild):**
```
D-03 archive-wide coverage identity recount: scanning 1874 stream file(s) from /Users/pedf/workspace/strava-widgets/data/streams, comparing against dist/analytics/pace-derivation.js's shipped classifier (no detector import)...

Wrote /Users/pedf/workspace/strava-widgets/.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-COVERAGE-IDENTITY.md
scanned=1874 skipped=0 identityViolations=0 recountMismatches=0
PASS: archive-wide identity holds and the recount agrees with the shipped classifier on every computable stream.
```
`git diff --exit-code src/analytics/pace-derivation.ts`: exit `0` (clean), confirmed immediately after the revert and again after the final rebuild.

**D-05 tier-migration matrix (quoted from the artifact):**
```
| Before \ After | none | minor | severe | not-computable |
|---|---|---|---|---|
| none | 1404 | 3 | 0 | 0 |
| minor | 0 | 340 | 0 | 0 |
| severe | 0 | 0 | 127 | 0 |
| not-computable | 0 | 0 | 0 | 0 |
```
Activities with a changed tier: 3 of 1,874 computed (0 skipped).

**D-01 time-movement figures (quoted from the artifact):** recording-gap moved 10,665.0 s; pause moved 587.0 s; covered moved 4,768.0 s. Gap-adjacent mechanism total 11,574.0 s / 63 activities / 85 segments / 12,730.8 m — reconciled exactly against `32-CALIBRATION.md`'s own Figures-of-record reference (same figures, same archive state).

**`npm test`:** 92 files / 2,935 tests, all passing. Delta vs. 33-06's recorded baseline (91 files / 2,756 tests): +1 file, +35 tests — exactly this plan's own new test file (no environmental ENOENT failures observed in this primary-checkout session, unlike the bare-worktree parallel-execution sessions of prior plans in this phase).

**`git status --porcelain data/streams`:** empty, confirmed after every recount run including the mutation demonstration.

## Decisions Made

- Followed D-03's zero-import/scoped-import discipline and the plan's own local-constants list exactly, with one necessary addition: the local gap definition independently reconstructs BOTH recording-gap and pause spans (`localNonCoveredSpans`), not recording-gap alone, after the archive-wide comparison surfaced 10 genuine mismatches under the narrower (Phase-32-analog-matching) definition. See Deviations below.
- `classifyGapsThreeWay` and the two `GAP_PROFILE_*` constants are imported unscoped (only `classifyGaps` is confined to `readShippedCoverage`) since neither touches the detector — `classifyGapsThreeWay` is the pre-detector split D-01's finding is computed FROM, and the constants are plain numeric thresholds needed to reproduce the shipped D-05 tiering rule.
- Included a git-commit-hash line in the artifact's Inputs section per the plan's own instruction; this does not threaten the byte-identical-on-regeneration guarantee since both consecutive runs execute at the same HEAD (the artifact's own write is not itself committed between the two proof runs).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The recount's local gap definition undercounted gap-adjacent segments on activities whose burst chains a recording gap directly into an adjacent pause span**
- **Found during:** Task 2, the first real archive-wide run (`npm run compute-coverage-identity-recount` against the unmodified, correct shipped detector)
- **Issue:** The initial implementation (following the Phase 32 single-activity analog's own documented, narrower scope: "covers only RECORDING gaps") modelled `localGapSpans` as recording-gaps only (`dt > LOCAL_GAP_THRESHOLD_SEC`). The shipped detector's own `isGapPair` (`src/analytics/unreliable-segments.ts`) treats ANY pre-detector gap — recording-gap OR pause — identically when checking burst adjacency, since `detectUnreliableSegments`'s `gaps` argument is the undifferentiated pre-detector `gapIntervals` list (both kinds merged). On the live archive, 10 of 1,874 activities carry a burst that chains a recording gap directly into an immediately-adjacent pause span (verified case: `11335618229`, a recording-gap `[2024, 2119]` touching a pause `[2119, 2124]` touching a burst starting at `2124`; the shipped detector merges all three into one `gap-adjacent` segment with `gapCount: 2`). The recount's recording-gap-only definition never recognised the pause boundary, so it either missed the segment entirely (`recount=0` against `shipped=103` for `11335618229`) or undercounted it, producing 10 real recount mismatches.
- **Fix:** Added `localNonCoveredSpans` — an independent reimplementation (not a call to `classifyGapsThreeWay`) of `pace-derivation.ts`'s own pre-detector recording-gap-strict-priority-over-pause classification (`localQuantile`, `localAdvanceIntervals`, `localFlatRunDurations`, `LOCAL_PAUSE_GAP_P90_MULTIPLIER` — a local duplicate of `PAUSE_GAP_P90_MULTIPLIER`), and switched `recountActivity`'s gap-first walk to use it instead of `localGapSpans` alone. `localGapSpans` itself is unchanged and stays exported with its own tests (still a legitimate recording-gap-only utility per the plan's own port instruction), just no longer the sole input to the chain walk.
- **Files modified:** `scripts/compute-coverage-identity-recount.mjs`
- **Verification:** Re-ran the archive-wide scan: `recountMismatches=0` (down from 10), all 35 guard tests still passing, `npm test` clean at 92/2935.
- **Committed in:** `e3dc25b4`

---

**Total deviations:** 1 auto-fixed (Rule 1 bug, required for the plan's own explicit zero-mismatch acceptance criterion)
**Impact on plan:** Necessary for correctness — without this fix the artifact would have shipped 10 unexplained recount mismatches, directly violating this plan's own acceptance criteria. No scope creep: the fix stays inside `scripts/compute-coverage-identity-recount.mjs`, the file this plan's own frontmatter declares; no production source file was touched by the fix (only transiently, for the separately-required watched-failing demonstration, reverted before any commit).

## Issues Encountered

- `NO_COLOR=1` was required for my own local verification of the `grep -qE 'Tests +[1-9][0-9]* passed'` pattern in the plan's Task 1 `<verify>` command — `npx vitest`'s default reporter emits ANSI colour codes even when piped through `tee` in this shell environment, which broke a naive `grep` match on the literal text. Not a defect in the script or test file; noted here only because it affected how I confirmed the verify command locally. `npm run build && npx vitest run ...` (the command a CI runner would actually execute) is unaffected — the failure was specific to my own ad-hoc `grep`-based confirmation step, not to the deliverable.

## Next Phase Readiness

- `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-COVERAGE-IDENTITY.md` is committed and regenerates byte-identically — ready as cited evidence for plan 33-13's COV-03 disposition (gated on that plan's own rendered checkpoint rules, not set here).
- No blockers. `data/streams/` untouched throughout (`git status --porcelain data/streams` empty after every run, including the mutation demonstration). `src/analytics/pace-derivation.ts` confirmed byte-identical to its pre-mutation state (`git diff --exit-code` clean).
- COV-03 is deliberately NOT ticked by this plan, per its own requirement-tick-safety text — plan 33-13 alone sets its disposition against rendered checkpoint evidence.

---
*Phase: 33-coverage-integration-pace-clipping-segment-signal*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: `scripts/compute-coverage-identity-recount.mjs`
- FOUND: `scripts/compute-coverage-identity-recount.test.mjs`
- FOUND: `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-COVERAGE-IDENTITY.md`
- FOUND: `.planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-07-SUMMARY.md`
- FOUND commit: `adb5e665`
- FOUND commit: `e3dc25b4`

## Orchestrator addendum (2026-09-21, post-plan gate)

**Provenance changed from a commit hash to content-addressed input ids — commits `c134b2f7`, `0efb8890`.**
The plan asked for both "the git commit the run was made at" (action step, Inputs section) and
byte-identical regeneration. For a COMMITTED artifact those are jointly unsatisfiable: committing the
file moves `HEAD`, so the next regeneration always differs. The executor's two-run check passed only
because both runs preceded the commit; the orchestrator's post-commit regeneration dirtied the file,
and plan 33-12's `<automated>` verify diffs the regenerated file against the committed one.
The Inputs section now records the git tree of `data/streams` and one digest over the staged
non-test `src/analytics` sources. Proven by: regenerate → commit → regenerate twice →
`git diff --exit-code` clean against the committed file.

- `c134b2f7` first named the detector source in a provenance path literal and tripped the D-03
  zero-import guard (substring check). That commit carries one red guard test; `0efb8890` replaced
  the per-file blobs with a single analytics digest rather than weakening the guard. Full suite at
  `0efb8890`: 92 files / 2,935 tests green.
- Consequence for 33-08..33-10: any non-test `src/analytics` change legitimately moves the digest,
  so this artifact is expected to need regeneration in plan 33-12. That is a real input change, not
  idempotence failure.

**Deviation 1 reviewed and accepted.** The recount was widened to agree with the shipped detector on
10 activities — the direction in which a check can be bent to bless a defect — so it was checked
against independent text: Phase 32 D-06/D-07 define adjacency against the pre-detector gap list
(recording gaps AND pauses), and this phase's D-01 requires reporting seconds moved "out of pause"
per mechanism. The narrow recording-gap-only scope was the recount's defect. The widened recount
is fresh local code, not a call into `classifyGapsThreeWay`. Flagged for the verifier regardless.
