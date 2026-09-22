---
phase: 33-coverage-integration-pace-clipping-segment-signal
verified: 2026-09-22T08:16:14Z
status: human_needed
score: 9/10 must-haves verified (1 uncertain, routed to human)
overrides_applied: 0
must_haves:
  truths:
    - "classifyGaps is widened to a four-way GapKind with 'unreliable' at the top of the strict-priority tree, moving seconds out of recordingGapSec/pauseSec (D-01/D-02)"
    - "PACE-08: the pace chart band and histogram inherit clipping through detail-charts-logic.ts / detail-zones.ts / detail.ts with genuinely zero source-line change, proven by extent (not absence) on real streams"
    - "PACE-09: the per-km split covering 3475740390's t=2508 jump carries the unreliable marker"
    - "COV-03: the archive-wide coverage identity holds with 0 identity violations and 0 recount mismatches over 1,874 streams via a detector-free gap-first recount, watched failing first against a broken detector"
    - "COV-03: the coverage caption discloses unreliable time as an always-on fourth term, including 0% on a clean control"
    - "SEG-06: unreliable segments surface as a seventh quality signal (count, metres, excess metres, seconds, mechanisms), tiered by a non-circularly-derived constant shipped from a committed artifact"
    - "SEG-06: hasAnySevereSignal's Pick<> stays exactly three members (decimation, gapProfile, impossibleSamples), proven by a never-widen guard watched RED"
    - "SEG-06: DASHBOARD_INDEX_SCHEMA_VERSION stays 1; the shard's per-segment list carries no parts"
    - "REQUIREMENTS.md reflects only the intended state changes: SEG-06/PACE-08/PACE-09/COV-03 ticked, SEG-05b reopened and left Pending"
    - "The phase's rendered claims (PACE-09 split marker, COV-03 caption, SEG-06 badge/row) were confirmed by an actual human observing the served, digest-verified build — not solely by the orchestrator's own code-level self-probe"
  artifacts:
    - path: "src/analytics/pace-derivation.ts"
      provides: "four-way classifyGaps, classifyGapsThreeWay, classifyGapsWithSegments accessor"
    - path: "scripts/compute-coverage-identity-recount.mjs"
      provides: "detector-free archive-wide recount discharging COV-03"
    - path: "src/analytics/pace-quality.ts"
      provides: "UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION, UnreliableSegmentsSignal, never-widen guard"
    - path: ".planning/phases/33-coverage-integration-pace-clipping-segment-signal/33-VALIDATION.md"
      provides: "the D-13 checkpoint contract and its transcribed verdicts"
  key_links:
    - from: "src/dashboard/views/detail-charts-logic.ts"
      to: "src/analytics/pace-derivation.ts derivePaceWithCoverage"
      via: "unchanged call site; clipping inherited through widened gapIntervals"
    - from: "33-VALIDATION.md verdicts"
      to: ".planning/REQUIREMENTS.md"
      via: "all-rows-PASS rule per requirement"
human_verification:
  - test: "Open the served, digest-verified build (as plan 33-13 built it) and directly observe, as a human looking at the rendered page (not via a script importing dist/ code): (a) the per-km split table on 3475740390 — split 8 actually shows the unreliable-segment marker in the DOM (R5/PACE-09); (b) the coverage caption on 3475724402, 3475734189, 3475740390 and the clean control 10146303423 actually renders its four terms including '0% unreliable' on the control (R6-R9/COV-03); (c) the list-row badge and the detail view's ninth Quality Signals row on 3475734189, 3475740390 (severe, badge shown) and 3475724402, 10146303423 (minor/none, no badge) actually appear as claimed in the live DOM (R10-R13/SEG-06); (d) the two rows disclosing unreliable-segment counts (Coverage gaps row vs. Unreliable segments row) don't read as visually conflicting (R15)."
    expected: "Every one of R5-R13 and the visual half of R15 renders exactly as the orchestrator's code-level pre-read predicted."
    why_human: "33-VALIDATION.md's own record states plainly that only R1-R4 and R14 (5 of 15 rows) were actually reviewed by the human developer in the 33-13 checkpoint session. R5, R6-R9, R10-R13 and R15's visual half were dispositioned PASS solely on the orchestrator's own 'pre-read' — importing the shipped dist/ code and running it against data fetched from the served build. That is strong evidence the underlying DATA and render-PLAN logic are correct (and this verifier independently re-confirmed several of those computations), but it is not a human observation of the painted page, which is precisely what a browser checkpoint (an Escalation Gate, task type checkpoint:human-verify) exists to catch — CSS/layout defects, an element failing to actually mount, a badge hidden by a stale bundle, etc. Plan 33-13's own acceptance criterion ('every verdict is a verbatim quotation of the developer's words, or explicitly labelled as a blanket approval covering a named set of rows') was not met for these 10 rows, and the SUMMARY documents this directly rather than concealing it. PACE-09, and most of COV-03's and SEG-06's rendered-claim rows, currently rest on this gap."
---

# Phase 33: Coverage Integration — Pace Clipping & Segment Signal Verification Report

**Phase Goal:** The detector's output is wired into `classifyGaps` as a fourth `GapKind`; the pace
chart band, histogram and per-km splits inherit clipping from the widened `GapKind` with zero
change at their own call sites (PACE-08, D-12-amended); the coverage identity is re-verified
archive-wide across the new four-way split (COV-03); a per-km split containing an unreliable
segment carries a marker (PACE-09); unreliable segments surface as the seventh
individually-disclosed per-activity quality signal, badged with its measured value, additively
with `DASHBOARD_INDEX_SCHEMA_VERSION` unchanged, with the severe-composite decision recorded not
assumed (SEG-06).

**Verified:** 2026-09-22T08:16:14Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `classifyGaps` widened to four-way `GapKind`, `unreliable` top-priority (D-01/D-02) | ✓ VERIFIED | `src/analytics/pace-derivation.ts` read directly; `pace-derivation.test.ts -t "unreliable"` green (12/12); `classifyGapsThreeWay` seam confirmed detector-free |
| 2 | PACE-08: chart band/histogram inherit clipping with genuinely zero call-site change, proven by extent not absence | ✓ VERIFIED | `git diff --stat 6772dca5 HEAD -- detail-charts-logic.ts detail-zones.ts detail.ts` empty (independently re-run); `detail-charts-logic.test.ts -t "unreliable"` green 12/12, asserting fastest-pace extent (173.01/231.21 sec/km) against an independently hand-computed value, not an absence check |
| 3 | PACE-09: split covering 3475740390's t=2508 jump carries the `unreliable` marker | ✓ VERIFIED (code) / see #10 (render) | `detail-sections.ts` three-way `splitGapAnnotations`, watched RED on a restored two-way branch (`33-04-SUMMARY.md`); orchestrator's live probe against the served build confirms split 8 carries `kind: 'unreliable'` — but not independently confirmed on the rendered page by a human (R5) |
| 4 | COV-03: archive-wide identity 0 violations, 0 recount mismatches over 1,874 streams via a detector-free recount, watched failing first | ✓ VERIFIED | Independently re-ran `npm run compute-coverage-identity-recount`: `scanned=1874 skipped=0 identityViolations=0 recountMismatches=0`, byte-identical to committed artifact; `grep` confirms no non-comment import of `unreliable-segments`; `33-07-SUMMARY.md`'s 699/1874-mismatch watched-FAILING demonstration verified present |
| 5 | COV-03: coverage caption discloses unreliable time as an always-on fourth term, including 0% on a clean control | ✓ VERIFIED (code) / see #10 (render) | `coverageCaptionText` source and tests confirm no `> 0` guard around the fourth term; caption strings for R6-R9 independently reproduced by the orchestrator's own probe against `dist/` — not independently confirmed by a human on the rendered page |
| 6 | SEG-06: seventh signal (count/metres/excess/seconds/mechanisms) tiered by a non-circularly-derived, artifact-shipped constant | ✓ VERIFIED | `UNRELIABLE_SEGMENTS_SEVERE_EXCESS_FRACTION = 0.00423` in `pace-quality.ts`, character-identical to `33-CALIBRATION.md`'s `## Chosen constant`; independently regenerated the calibration artifact (`npm run compute-unreliable-segment-severity-calibration`), confirmed shape R1 selected by first-clearing order, `selectShape(rows)` reads only `{id, pass}` (source read directly) |
| 7 | SEG-06: `hasAnySevereSignal`'s `Pick<>` never widened (D-06), proven by a guard watched RED | ✓ VERIFIED | `grep` confirms `Pick<ActivityQualitySignals, 'decimation' \| 'gapProfile' \| 'impossibleSamples'>` unchanged; `pace-quality.test.ts -t "anySevere excludes unreliableSegments"` passes (1/1); RED demonstration quoted verbatim in `33-09-SUMMARY.md` |
| 8 | SEG-06: `DASHBOARD_INDEX_SCHEMA_VERSION` stays `1`; shard's per-segment list carries no `parts` | ✓ VERIFIED | `grep -n "DASHBOARD_INDEX_SCHEMA_VERSION"` → `= 1`; `projectUnreliableSegments` source read directly, projects exactly `{startSec, endSec, metres, excessMetres, seconds, mechanism}`, no `parts`/`startIndex`/`endIndex` |
| 9 | REQUIREMENTS.md reflects only the intended state changes | ✓ VERIFIED | `git diff 6772dca5 HEAD -- .planning/REQUIREMENTS.md` shows exactly SEG-06/PACE-08/PACE-09/COV-03 ticked Complete and SEG-05b reverted to Pending with a dated D-15 note; nothing else moved |
| 10 | The phase's rendered claims were confirmed by a human observing the served build, not solely by the orchestrator's own code-level self-probe | ? UNCERTAIN | `33-VALIDATION.md`'s own text states only R1-R4 and R14 (5 of 15 checkpoint rows) were actually walked with the human developer; R5 (PACE-09), R6-R9 (COV-03), R10-R13 (SEG-06) and R15's visual half were dispositioned PASS purely on the orchestrator's own "pre-read" (importing `dist/` code and running it against data fetched from the served build) — see Human Verification below |

**Score:** 9/10 truths verified; 1 routed to human verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/pace-derivation.ts` | four-way `classifyGaps`, `classifyGapsThreeWay`, `classifyGapsWithSegments` | ✓ VERIFIED | Read directly; one `detectUnreliableSegments(` call site confirmed by grep |
| `src/analytics/unreliable-segments.ts` | `excessMetres` output field, detection unmoved | ✓ VERIFIED | Field present; `32-CALIBRATION.md`/`33-COVERAGE-IDENTITY.md` both regenerated byte-identical in this session |
| `scripts/compute-coverage-identity-recount.mjs` | detector-free archive-wide recount | ✓ VERIFIED | Re-run live: 0/1874 mismatches, 0 violations, byte-identical artifact |
| `scripts/compute-unreliable-segment-severity-calibration.mjs` | D-16 non-self-referential derivation, `PREDECLARED_SHAPES`, `selectShape` | ✓ VERIFIED | Re-run live: shape R1 selected (0.004229… → 0.00423), matches shipped constant; `selectShape` reads only `{id, pass}` |
| `src/analytics/pace-quality.ts` | `UnreliableSegmentsSignal`, shipped constant, never-widen guard, shard projection | ✓ VERIFIED | All present and read directly; both associated tests pass live |
| `src/dashboard/views/list.ts` / `detail-sections.ts` | sixth badge source, ninth Quality Signals row | ✓ VERIFIED (code) | Source and tests confirm severe-only gate and nine-row ordering; DOM rendering not independently human-observed (see Truth #10) |
| `.planning/phases/33-.../33-VALIDATION.md` | drafted + transcribed D-13 checkpoint rows | ⚠️ PARTIAL | Fully drafted with CAN FAIL/CAN PASS reachability per row; only 5/15 rows carry an actual human transcript, the rest carry an orchestrator self-probe explicitly labelled as such |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `detail-charts-logic.ts` pace branch | `pace-derivation.ts derivePaceWithCoverage` | unchanged call site | ✓ WIRED | `git diff` empty against phase-33 base; test suite proves the inherited clip is real (extent match, not just import presence) |
| `detail-zones.ts computePaceDistribution` | `pace-derivation.ts paceHistogramSamples` | unchanged call site, `coverage.gapIntervals` | ✓ WIRED | `git diff` empty; `bucketedSec <= coveredSec` accounting identity re-verified as the load-bearing discriminator (per `33-06-SUMMARY.md`'s own watched-failing finding that band-absence alone was insensitive) |
| `pace-quality.ts unreliableSegmentsSignal` | `UnreliableSegment.excessMetres` | sums the field, never re-derives | ✓ WIRED | `grep -c "unreliable-segments" src/analytics/pace-quality.ts` → 0 (no direct detector import); arithmetic sums the field only |
| `33-VALIDATION.md` verdicts | `.planning/REQUIREMENTS.md` | all-rows-PASS rule per requirement | ✓ WIRED (mechanically) / ⚠️ evidentially thin for 3 of 4 | The tick mechanism itself is correctly gated (verified: every mapped row for each requirement is PASS before a tick), but 10 of the 15 underlying verdicts are an orchestrator self-probe rather than a human read-back — the mechanism is sound, the evidence feeding it is partial |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Coverage caption (`coverageCaptionText`) | `coverage.unreliableSec` | `classifyGaps` run against real committed streams | Yes — independently re-derived by this verifier's re-run of `compute-coverage-identity-recount` and cross-checked against `33-CALIBRATION.md`'s figures | ✓ FLOWING |
| SEG-06 badge/row | `UnreliableSegmentsSignal.count/totalMetres/…` | `resolveCoverage` → `classifyGapsWithSegments` (one detector run per producer) | Yes — figures reproduced identically across 33-09/33-11/33-14 SUMMARYs and this verifier's own constant/Pick<>/shard checks | ✓ FLOWING |
| Shard `unreliableSegments` list | `projectUnreliableSegments(segments)` | same resolver result, no second detector call | Yes — key-set assertion and cap/truncation logic read directly | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Chart band clips with zero call-site change | `npx vitest run src/dashboard/views/detail-charts-logic.test.ts -t "unreliable"` | 12 passed, 0 failed | ✓ PASS |
| Archive-wide detector-free identity/recount | `npm run compute-coverage-identity-recount` | `scanned=1874 skipped=0 identityViolations=0 recountMismatches=0` + byte-identical diff | ✓ PASS |
| D-07 severity constant regenerates and matches shipped | `npm run compute-unreliable-segment-severity-calibration` | R1 selected, `0.00423`, byte-identical diff | ✓ PASS |
| `hasAnySevereSignal` never-widen guard | `npx vitest run src/analytics/pace-quality.test.ts -t "anySevere excludes unreliableSegments"` | 1 passed, 0 failed | ✓ PASS |
| Constant pinned to artifact (both directions) | `npx vitest run src/analytics/pace-quality.test.ts -t "shipped from 33-CALIBRATION"` | 1 passed, 0 failed | ✓ PASS |
| Full suite / typecheck / build | `npx tsc --noEmit && npm run build && npm test` | 0 / 0 / 93 files, 3,104 tests, all green | ✓ PASS |
| Dashboard integrity | `npm run verify-dashboard` | 66/66 checks passed | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repo; this phase's probes are the `npm run compute-*` generators, exercised above under Behavioral Spot-Checks (all re-run live by this verifier, not taken from SUMMARY narration).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEG-06 | 33-08/33-09/33-10/33-11/33-14 (ticked by 33-13) | Seventh quality signal, tiered, excluded from severe composite | ✓ SATISFIED (code) / ⚠️ rendered-claim rows mostly orchestrator-only | Constant, guard, shard shape all independently re-verified; R10-R13 (badge/row on the live page) not human-observed |
| PACE-08 | 33-01/33-06 (ticked by 33-13) | Pace chart/histogram/splits clip unreliable segments, zero call-site change | ✓ SATISFIED | Fully human-reviewed (R1-R4) with verbatim developer transcript; zero-diff on the three render-side files independently re-confirmed |
| PACE-09 | 33-04 (ticked by 33-13) | Per-km split marker | ⚠️ SATISFIED (code) / render-claim not human-observed | Split-8/`unreliable` marker confirmed by tests and orchestrator probe; R5 never walked with the developer |
| COV-03 | 33-03/33-04/33-05/33-07 (ticked by 33-13) | Archive-wide identity + caption term | ✓ SATISFIED (identity, code) / ⚠️ caption render-claim mostly orchestrator-only | Non-rendered half (identity/recount) independently re-verified exactly; rendered caption (R6-R9) not human-observed |
| SEG-05b | 32/33/35/36 (Phase 33's half recorded, stays Pending) | Detector is the single source, per-consumer | ✓ SATISFIED for this phase's half | `git diff` confirms row reverted to Pending with dated D-15 note naming the load-bearing proof; correctly NOT re-ticked |

No orphaned requirements found — REQUIREMENTS.md's Phase-33-mapped rows (SEG-06, PACE-08, PACE-09, COV-03) all appear in plan frontmatter across the 14 plans.

### Anti-Patterns Found

None blocking. `33-REVIEW.md` (code review, standing artifact) found 1 Critical (CR-01, missing `npm run build &&` prefix on two new scripts) and 1 Warning (WR-01, `NaN`/`Infinity` not rejected by two new parsers) — both independently confirmed RESOLVED in commit `fa8c6598` (`package.json` now carries the build prefix on both new scripts; `finiteNumberOrNull` now used in both new parsers). 4 Info items recorded and independently spot-checked as legitimate, non-masking findings (test re-pins reflecting genuine widened behaviour; a deliberate all-or-nothing `mechanisms` parse decision that diverges from plan prose but is documented and safer; a reporting-only `none`-vs-`not-computable` blind spot in the calibration script's own distribution function, confined to that artifact's own prose section and not affecting shipped code; the `excessMetres` clamp-to-0 behaviour confirmed additive).

No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` debt markers found in the phase's modified files during this verification's spot-reads.

### Human Verification Required

### 1. Complete the browser checkpoint for the 10 rows the developer did not actually walk

**Test:** Serve the merged tree exactly as plan 33-13 built it (or rebuild fresh and re-verify the
served digest), then, as a human looking at the rendered page:
- `#/activity/3475740390`'s per-km split table — confirm split 8 visibly carries the
  unreliable-segment marker (R5, PACE-09).
- The coverage caption on `#/activity/3475724402`, `#/activity/3475734189`,
  `#/activity/3475740390` and the clean control `#/activity/10146303423` — confirm all four terms
  render, including `0% unreliable` on the control (R6-R9, COV-03).
- The list-row badge (`#/list`) and the detail view's ninth "Unreliable segments" Quality Signals
  row on `3475734189` and `3475740390` (expect: badge shown, severe tier) and on `3475724402` and
  `10146303423` (expect: no badge, minor/none tier) (R10-R13, SEG-06).
- On all three named activities, confirm the existing "Coverage gaps" row and the new "Unreliable
  segments" row don't read as visually conflicting even though both disclose the same count (R15).

**Expected:** Every one of these renders exactly as `33-VALIDATION.md`'s "Orchestrator pre-read"
table already predicts (it quotes exact strings and counts) — this is a confirmation step, not an
open-ended investigation.

**Why human:** `33-VALIDATION.md` and `33-13-SUMMARY.md` both explicitly record that only 5 of the
15 drafted checkpoint rows (R1-R4, R14) were actually reviewed by the human developer in the 33-13
session; the remaining 10 were dispositioned PASS by the orchestrator's own code-level self-probe
(importing `dist/` and running it against the served build's HTTP-fetched data) rather than by a
human observing the painted page. That self-probe is strong evidence the underlying data and
render-plan logic are correct — several of its claims were independently re-derived by this
verifier and matched exactly — but it cannot catch the class of defect a browser checkpoint exists
for (a CSS/layout issue, an element failing to mount, a stale served bundle). Plan 33-13's own
acceptance criterion ("every verdict is a verbatim quotation of the developer's words, or
explicitly labelled as a blanket approval") was not met for these 10 rows, and the phase's own
convention states the checkpoint closes the phase specifically because "no automated test in this
phase has looked at a painted page" (33-13-PLAN.md's own objective text).

### Gaps Summary

No code-level gaps were found. Every piece of the analytics/wiring/shard/constant/guard chain this
verifier could check by reading source, re-running generators, and re-running the test suite
matched what the fourteen plans' SUMMARYs claimed — often to the exact decimal (0.00423, 173.01
sec/km, 1874/0/0, etc.). The one open item is procedural: the phase's closing human browser
checkpoint (an Escalation Gate, `checkpoint:human-verify`) was completed in full for PACE-08 only;
for PACE-09, COV-03 and SEG-06 the majority of their mapped rows were disposed PASS by the
orchestrator's own self-probe rather than a human observing the served page, which the checkpoint
plan's own text and acceptance criteria required. This does not indicate a defect — it indicates
the verification chain for three of the four requirement ticks is thinner than the phase's own
process demands. Recommend completing a short, targeted browser pass over R5-R13 and R15's visual
half before treating those requirement ticks as fully discharged; the expected values are already
drafted and would make this a confirmation, not new work.

---

_Verified: 2026-09-22T08:16:14Z_
_Verifier: Claude (gsd-verifier)_
