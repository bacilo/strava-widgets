---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
verified: 2026-09-10T09:18:33Z
status: passed
score: 7/7 success criteria verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "6/7 (3/7 PARTIAL, single root cause CR-03: pace chart band overrode the adaptive window)"
  gaps_closed:
    - "CR-03 — `buildChannelSeries`'s pace branch (`detail-charts-logic.ts:101`) now calls `derivePaceWithCoverage(stream).paceSeries` directly, the identical call `detail.ts:717` makes for the histogram/caption/splits. The fixed-20s `derivePaceSeries` wrapper and `PACE_SMOOTHING_WINDOW_SEC` constant are deleted entirely (grep confirms zero occurrences in `src/`). Verified by reading the current file, not the SUMMARY: import list, header comment, and the pace branch (`:101`) all read `derivePaceWithCoverage(stream)`. A permanent regression test (`detail-charts-logic.test.ts`'s `CR-03` describe block) pins index-for-index equality between the chart's own output and `derivePaceWithCoverage(...).paceSeries` on the pinned exemplar 5059204779, with a non-vacuity guard (window=150s, exceeds the 20s floor) and a no-regression control (4556693525, window=floor). Full suite re-run independently in this verification: `detail-charts-logic.test.ts` 39/39, `pace-single-source.test.ts` 74/74, `pace-derivation.test.ts` 32/32, `list.test.ts` 70/70, whole repo 1907/1907, `tsc --noEmit` clean."
    - "CR-03's audit blind spot (ES2015 object-shorthand `windowSec` override) — `OVERRIDE_LITERALS` in `pace-single-source.test.ts` extended to 6 entries including `'windowSec,'`, `'windowSec }'` and the structural `'derivePaceSeriesGapAware('` call-site literal. Confirmed present by reading the file; a permanent planted-CR-03-shape test (`:415`) exercises it."
    - "CR-02 — both `statusBadgeTexts` (`list.ts:359`) and `appendStatusBadges` (`list.ts:395`) now read `paceDisagreement` exclusively through the exported `rowPaceDisagreement(row)` helper (`:333-334`, `return row.paceDisagreement ?? null`), so a missing key resolves to `null` rather than a truthy `undefined` passing a `!== null` test. Verified by reading the current file directly (not the SUMMARY): both call sites confirmed, `grep -c \"row.paceDisagreement !== null\" list.ts` is 0. `list.test.ts`'s dedicated `CR-02` describe block (70 tests total in the file, all pass) exercises a genuinely-missing-key row via object destructuring, not `{ paceDisagreement: undefined }` (a materially different shape from what an unvalidated JSON cast actually produces)."
  gaps_remaining: []
  regressions: []
---

# Phase 26: Shared Gap-Aware Pace Derivation & Honest Coverage Verification Report

**Phase Goal:** Every consumer of derived pace (chart, histogram, splits) reads from one gap-aware
module in `src/analytics/`, coverage is exact and visibly reported, a stratified fixture library
exists for every later phase to reuse, the residue adaptive windowing does not fix is identified
and quantified rather than smoothed into plausibility, and a metadata-vs-stream pace cross-check
catches the one activity whose metadata alone would otherwise display a physically implausible
pace as fact.

**Verified:** 2026-09-10T09:18:33Z
**Status:** passed
**Re-verification:** Yes — third round. The previous `26-VERIFICATION.md` (2026-09-09T19:00:04Z,
`gaps_found`, single root cause CR-03: the pace chart band overrode the adaptive window with a
fixed 20s floor) is the report that triggered plans 26-14/26-15/26-16. That report's frontmatter
and `gaps:` array are stale and were not used as a gate here — this report reflects the codebase
as it stands now, re-derived independently against the source files, the test suite, an
independent Round 3 code review (`26-REVIEW.md`), and a Round 3 human browser checkpoint
(`26-VALIDATION.md`).

**Note on artifact state:** `ROADMAP.md` and `REQUIREMENTS.md` already carry ticks and a
"(completed 2026-09-10)" annotation written by the executor before this verification ran. Per the
task instructions, those ticks were treated as non-evidence and the codebase was judged
independently. The findings below happen to agree with the ticks, but arrived at that agreement by
reading `detail-charts-logic.ts`, `list.ts`, `pace-single-source.test.ts`, running the full test
suite (1907/1907 passing, `tsc --noEmit` clean, all independently re-run in this session) and
executing a Node probe against the live `data/dashboard/index.json` — not by trusting the ticks or
the SUMMARY files.

## Goal Achievement

### Observable Truths (7 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Archive-wide phantom-fast-mode reduction, measured per-activity against baseline, strictly lower (or both zero) for 153/154 + 1 tie, 0 regressions; residual of 14 quantified and enumerated by ID; the "trap" (fixed-window measurement manufacturing a false defect) does not recur on any named consumer | ✓ VERIFIED | `26-RESIDUAL.md` (regenerated 2026-09-09T09:08:40Z): 154 cohort, 14 residual (0.51-2.44%), 153 strictly improved / 1 tie / 0 regressed — read directly, unchanged from the prior round. The chart consumer no longer reproduces the 94.81%/30% fixed-window trap on 5059204779: confirmed by reading `detail-charts-logic.ts:101` (`derivePaceWithCoverage(stream).paceSeries`, no fixed window anywhere in the file) and by the Round 3 browser checkpoint (`26-VALIDATION.md` R3-1: largest captured chart tick `20:00/km`, bracketing the independently-derived adaptive series max of `17:29/km` — unreachable under the old fixed-20s path, whose extent topped out at `4:27/km`). |
| 2 | Gaps clip rather than manufacture pace; affected splits disclose it; both demonstrated failing when clipping/marking is removed | ✓ VERIFIED | Unaffected by this round's changes. `classifyGaps` / gap-boundary clipping in `pace-derivation.ts`; split gap marking confirmed live in 26-VALIDATION.md Row 2/R2. `pace-derivation.test.ts` (32/32 passing, re-run in this session) and `detail-sections.test.ts` cover clip removal. |
| 3 | Coverage sums exactly (covered + excluded = span, exact); pinned exemplar's on-screen coverage % matches an independent sum | ✓ VERIFIED | Unaffected by this round. `breakdownSectionPlan` gates the caption on coverage alone; Round 2 human checkpoint (R2-1/R2-3) both PASS with verbatim on-screen quotations matching independently re-derived sums. |
| 4 | Grep-based audit finds zero remaining per-sample `dt/dd` pace arithmetic outside `pace-derivation.ts`; audit demonstrated catching a reintroduced second implementation | ✓ VERIFIED | Re-run in this session: `pace-single-source.test.ts` 74/74 pass. `OVERRIDE_LITERALS` (read directly, `:240-247`) now has 6 entries including the shorthand forms (`'windowSec,'`, `'windowSec }'`) and the structural `'derivePaceSeriesGapAware('` call-site literal that closed the exact CR-03 blind spot. `grep -rn "derivePaceSeries\b\|PACE_SMOOTHING_WINDOW_SEC" src/` returns nothing — the escape hatch is deleted, not merely re-argued. The Round 3 code review independently reproduced the planted-shorthand-override catch. See Warnings below for a narrower, currently-unexploited audit gap (WR-06) that does not reflect any actual duplicate implementation in the codebase today. |
| 5 | Derivation adapts to each activity's own advance interval rather than a fixed window; the shipped adaptive approach recovers 5059204779/3647739864/4598855187 to 1.22%/0.00%/0.00% and 97/100/100% coverage, and this is what every named consumer (chart, histogram, splits) actually ships | ✓ VERIFIED | `adaptiveWindowSec` unchanged and correct (re-confirmed: 150s for 5059204779, matching the criterion). The chart band now ships this adaptive series too — closing the gap the previous round found ("shipped adaptive approach" did not reach the chart). Round 3 browser checkpoint R3-1 (chart tick extent) and R3-2 (tooltip fast-end, fastest quoted value 2:27/km, satisfying the FAIL-condition threshold) both PASS against a real rendered page, independently derived values, human-read. |
| 6 | Fixture library stratified across ≥5 device/source categories, includes decimation-aliased/recording-gap/multi-hour-pause/impossible-speed/pinned-exemplar fixtures by name | ✓ VERIFIED | Unaffected by this round. `pace-fixtures.ts` device-stratified fixtures and synthetic fixtures confirmed present by name (unchanged from prior round); `pace-fixtures.test.ts` not touched by 26-14/15/16, not re-run individually but covered by the full-suite 1907/1907 pass in this session. |
| 7 | Metadata-vs-stream cross-check flags 5059204779 (read directly from index output); archive-wide flag count exactly 1 of 1,890; demonstrated failing when check removed; robust to a stale/partial `index.json` shape (badge does not silently mis-fire or crash) | ✓ VERIFIED | Re-run directly against the live `data/dashboard/index.json` in this session (Node probe, not copied from a prior artifact): `total 1890, flagged 1, ['5059204779'], missingKey 0` — exactly matching the criterion's stated count. CR-02 (the `undefined`-vs-`null` badge hazard flagged by the prior round's review as latent but real) is now closed at the code level: `rowPaceDisagreement(row)` (`list.ts:333-334`, `?? null`) is the sole read path for both `statusBadgeTexts` and `appendStatusBadges`, confirmed by direct code read. Round 3 browser checkpoint R3-4 (stale-index fixture, doctored to genuinely omit the key and served, not merely described) PASS: list rendered normally, zero false badges, no `TypeError`. |

**Score:** 7/7 fully VERIFIED. The single root cause that produced the prior round's `gaps_found`
(the pace chart band overriding the shared adaptive derivation with a fixed 20s window) is closed
at the code level, pinned by a permanent regression test, independently re-confirmed by a Round 3
code review executing code against the real archive, and confirmed on a real rendered page by a
Round 3 human browser checkpoint using an independently-derived discriminator value (not two
surfaces merely agreeing with each other — this phase's own recorded lesson from its prior
checkpoint rounds).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/pace-derivation.ts` | Single shared gap-aware pace module | ✓ VERIFIED | `derivePaceWithCoverage`, `derivePaceSeriesGapAware`, `classifyGaps`, `adaptiveWindowSec` present, tested (32/32), used by `detail.ts`, `detail-zones.ts`, `detail-charts-logic.ts`, `compute-dashboard-index.ts` — all four consumers now resolve through the same call. |
| `src/dashboard/views/detail-charts-logic.ts` | Chart band reads the shared adaptive derivation | ✓ VERIFIED (was STUB/partial) | `buildChannelSeries`'s pace branch (`:101`) calls `derivePaceWithCoverage(stream).paceSeries` directly. No `derivePaceSeries` wrapper, no `PACE_SMOOTHING_WINDOW_SEC` constant, no fixed-window argument anywhere in the file — confirmed by direct read and grep, not SUMMARY claim. Module header (`:5-16`) states the actual current behavior accurately. |
| `src/analytics/pace-single-source.test.ts` | Grep-based single-source audit | ✓ VERIFIED (was ORPHANED BLIND SPOT) | 74/74 tests pass. `OVERRIDE_LITERALS` extended to catch the shorthand override shape that previously slipped through; permanent planted-CR-03-shape test present (`:415`). One narrower, non-currently-exploited evasion remains documented (WR-06, see Warnings) — an aliased-import + computed-key combination that requires deliberate obfuscation, not an organic override. |
| `src/dashboard/views/list.ts` | Badge rendering reads `paceDisagreement` defensively | ✓ VERIFIED (was LATENT DEFECT) | `rowPaceDisagreement(row)` is the sole read path at both call sites (`:359`, `:395`), confirmed by direct code read. `grep -c "row.paceDisagreement !== null" list.ts` is 0. |
| `scripts/compute-pace-residual.mjs` + `26-RESIDUAL.md` | PACE-06 residual deliverable | ✓ VERIFIED | Unaffected by this round; regenerated 2026-09-09T09:08:40Z, 154/14, matches the criterion. |
| `src/analytics/pace-fixtures.ts` | Stratified fixture library | ✓ VERIFIED | Unaffected by this round; confirmed present by name in the prior round, not independently re-walked in this session beyond the full-suite pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `detail-charts-logic.ts` (`buildChannelSeries`) | `pace-derivation.ts` (`derivePaceWithCoverage`) | direct call, `:101` | ✓ WIRED | Confirmed by direct read: `const paceValues = derivePaceWithCoverage(stream).paceSeries;` — same call site `detail.ts:717` uses for the histogram/caption/splits. Regression test (`CR-03` describe block) pins index-for-index equality on the pinned exemplar. |
| `detail.ts` | `pace-derivation.ts` | direct call, `:717` | ✓ WIRED | Unchanged from prior round. |
| `list.ts` (`statusBadgeTexts`, `appendStatusBadges`) | `index.json` `paceDisagreement` field | `rowPaceDisagreement(row)` (`?? null`) | ✓ WIRED | Both call sites confirmed reading through the one helper; missing-key path resolves to `null`, not a truthy `undefined`. |
| `pace-single-source.test.ts` (`OVERRIDE_LITERALS`) | every production file under `src/` | comment-stripped literal scan | ✓ WIRED (widened) | Extended to 6 literals including the structural `derivePaceSeriesGapAware(` call-site check; catches the shape that previously escaped. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| Detail page pace chart band | `paceValues` from `derivePaceWithCoverage(stream).paceSeries` | `pace-derivation.ts` shared function, activity's own adaptive window | Yes — independently re-derived in Round 3 checkpoint and in this session's test run; matches the histogram's series index-for-index (permanent regression test) | ✓ FLOWING (was DIVERGENT) |
| Detail page pace histogram | `computePaceDistribution` buckets | `derivePaceWithCoverage` result | Yes | ✓ FLOWING |
| Activities list "Pace disputed" badge | `rowPaceDisagreement(row)` | `index.json` fetch via `?? null` narrowing | Real when present; absent key now resolves to `null`, not a crash-causing truthy `undefined` | ✓ FLOWING (was HOLLOW on stale index) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Chart branch calls the shared adaptive derivation, no fixed-window escape hatch remains | `grep -n "derivePaceSeries\b\|PACE_SMOOTHING_WINDOW_SEC\|derivePaceWithCoverage\|windowSec" src/dashboard/views/detail-charts-logic.ts` | Only `derivePaceWithCoverage` occurrences (import, header prose, call site); no `derivePaceSeries`/`PACE_SMOOTHING_WINDOW_SEC`/`windowSec` | ✓ CONFIRMS FIX |
| `list.ts` badge reads go through the single nullish-narrowing helper | `grep -n "rowPaceDisagreement\|paceDisagreement" src/dashboard/views/list.ts` | Both `statusBadgeTexts` (`:359`) and `appendStatusBadges` (`:395`) call `rowPaceDisagreement(row)` | ✓ CONFIRMS FIX |
| Archive-wide pace-disagreement flag count | `node -e` scan of `data/dashboard/index.json`, 1890 rows | `total 1890, flagged 1, ['5059204779'], missingKey 0` | ✓ CONFIRMS CRITERION 7 |
| Full test suite | `npx vitest run` (whole repo) | `69 files, 1907/1907 tests passed` | ✓ PASS (re-run independently in this session, not copied from a SUMMARY) |
| Type check | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Scoped pace test files | `npx vitest run detail-charts-logic.test.ts pace-single-source.test.ts pace-derivation.test.ts list.test.ts` | `39/39, 74/74, 32/32, 70/70` all pass | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention found in this repository. This phase's own established
methodology (confirmed again in this round) is direct Node probes against the committed `dist/`
build and `data/` archive plus the vitest suite — used identically here.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| PACE-01 | 26-01, 26-04, 26-05, 26-14 | One shared module, no independent `dt/(dd/1000)`, chart/histogram cannot disagree | ✓ SATISFIED | Both the literal text (both files import the shared module) and the spirit (the two surfaces now provably cannot disagree — same call, pinned by a regression test) are satisfied. This is the requirement the prior round found "literally satisfied, spirit defeated"; that gap is closed. |
| PACE-02 | 26-01 | No manufactured pace across gaps | ✓ SATISFIED | Unaffected by this round. |
| PACE-03 | 26-02, 26-14 | Window choice justified from archive evidence | ✓ SATISFIED | `adaptiveWindowSec` unchanged; now also the only window the chart resolves. |
| PACE-04 | 26-04, 26-09, 26-14 | Histogram eliminates phantom fast mode archive-wide | ✓ SATISFIED | Histogram path unaffected (was already correct); chart path now matches it. |
| PACE-05 | 26-06, 26-10 | Split gap marking | ✓ SATISFIED | Unaffected by this round. |
| PACE-06 | 26-09 | Residue quantified, not smoothed | ✓ SATISFIED | `26-RESIDUAL.md`, 14/154, unaffected by this round. Note: `REQUIREMENTS.md`'s PACE-06 checklist prose still reads "13 of the 154" — a pre-existing documentation staleness against the corrected 14-activity artifact, flagged by the prior verification round and not touched by 26-14/15/16 (out of this closure round's scope). Does not affect the underlying artifact's correctness. |
| PACE-07 | 26-07, 26-08, 26-10, 26-15 | Metadata-vs-stream cross-check surfaced, robust to a stale index | ✓ SATISFIED | Confirmed against live `index.json` (1/1890) and CR-02 fix confirmed by direct code read + Round 3 browser checkpoint R3-4. |
| COV-01 | 26-01, 26-11, 26-13 | Coverage sums exactly, asserted by test | ✓ SATISFIED | Unaffected by this round. |
| COV-02 | 26-06, 26-10, 26-12, 26-13 | Coverage visible wherever distribution shown | ✓ SATISFIED | Unaffected by this round. |
| ERA-03 | 26-03 | Stratified fixtures by device era | ✓ SATISFIED | Unaffected by this round. |

No orphaned requirements: all 10 phase requirement IDs (PACE-01..07, COV-01, COV-02, ERA-03) appear
in at least one plan's `requirements:` frontmatter across the 16 plans, and all 10 appear ticked
Complete in `REQUIREMENTS.md`, cross-checked against this verification's own independent findings
above (not merely against the ticks).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/analytics/pace-single-source.test.ts` | 235-238 | Docblock claims the `derivePaceSeriesGapAware(` literal catches "ANY direct call … regardless of how the options object is written" — an independently reproduced Round 3 code-review probe (aliased import + a computed, non-literal `windowSec` key) shows this is false for a deliberately obfuscated evasion | ⚠️ Warning | No currently-shipping code exploits this; the actual CR-03 defect (an organically-written shorthand override) is caught. Recommend softening the claim or adding an AST-based check per `26-REVIEW.md`'s WR-06. Not a blocker: the phase goal ("one shared module … coverage is exact and visible") does not require the audit to be adversarially unbeatable, and no second pace implementation currently exists in the codebase (confirmed by the full grep sweep and the 74/74 passing audit suite). |
| `src/dashboard/views/list.ts` | 333 | `rowPaceDisagreement`'s parameter type `Pick<DashboardIndexRow, 'paceDisagreement'>` types the key as required, contradicting its own docblock's "no key can be assumed present on the read side" claim; `ParsedDashboardIndexRow` (built for exactly this) is unused here | ⚠️ Warning | Runtime behavior is correct regardless (the `?? null` guard does not depend on the type); this is a type-hygiene gap that could let a future refactor silently reintroduce CR-02 without a compiler signal. Recommend the one-line fix `26-REVIEW.md`'s WR-06 proposes. Not a blocker: no stated Success Criterion covers static-type completeness, and the currently-shipping behavior (verified above) is correct. |
| — | — | No `TBD`/`FIXME`/`XXX` markers found in any file this phase's gap-closure plans touched (`detail-charts-logic.ts`, `detail-charts-logic.test.ts`, `pace-single-source.test.ts`, `trimp.ts`, `list.ts`, `list.test.ts`, `compute-dashboard-index.test.ts`) | — | Debt-marker gate clean. |

### Human Verification Required

None. The Round 3 human browser checkpoint (`26-VALIDATION.md`, all four rows R3-1..R3-4 PASS,
verbatim developer quotations, independently-derived discriminator values, the R3-3 control's
lack of evidentiary weight and the R3-2 median-clustering deviation both recorded honestly rather
than smoothed into the verdict) already discharged the human-verification obligation for this
closure round. No new artifact in this round requires a human check that has not already been
performed against a real rendered page.

### Gaps Summary

No gaps found. The single root cause behind the prior round's `gaps_found` verdict — the detail
page's pace chart band deriving pace under a fixed 20s window while every other consumer
(histogram, coverage caption, split markers) used the adaptive resolution, reproducing the exact
94.81%/30% "phantom fast mode" trap Success Criterion 1 exists to eliminate — is closed at the
source: `buildChannelSeries` now calls `derivePaceWithCoverage(stream)` directly, the fixed-window
wrapper and its two false contract-invariant doc comments are deleted (not re-argued), and the
audit that was supposed to catch this class of defect is extended to the shape that actually got
through. CR-02 (a separate, previously-deferred badge-rendering hazard against a stale/partial
`index.json`) is also closed at the source via a single nullish-narrowing helper used at both call
sites.

This verification independently re-derived the evidence rather than accepting the SUMMARY files'
narration: it read the current state of `detail-charts-logic.ts` and `list.ts` directly, re-ran the
full 1907-test suite and `tsc --noEmit` fresh in this session, executed a fresh Node probe against
the live `data/dashboard/index.json` (1/1890 flagged, 0 missing-key rows), and cross-checked those
findings against an independent Round 3 code review (`26-REVIEW.md`) that itself executed code
against the real archive rather than reading plan claims, and a Round 3 human browser checkpoint
that used an independently-derived discriminator value rather than two surfaces merely agreeing
with each other — directly applying this phase's own recorded lesson from its earlier checkpoint
rounds.

Two narrow, non-blocking Warnings remain (WR-06: the single-source audit's docblock overclaims
completeness against a deliberately obfuscated evasion that does not exist in the shipped code;
WR-07: `rowPaceDisagreement`'s parameter type is stricter than its own docblock's stated contract,
a type-hygiene gap rather than a runtime defect). Neither maps to a stated Success Criterion's
text, neither reflects a currently-shipping duplicate pace implementation or badge-rendering
defect, and both are recommended as prompt low-cost follow-ups rather than phase-blocking gaps.

REQUIREMENTS.md's PACE-06 checklist prose ("13 of the 154") remains one activity stale against the
corrected 14-activity `26-RESIDUAL.md` artifact — a pre-existing documentation staleness flagged by
the prior verification round, unrelated to this round's CR-02/CR-03 closure work, and not a defect
in the underlying artifact of record.

---

_Verified: 2026-09-10T09:18:33Z_
_Verifier: Claude (gsd-verifier)_
