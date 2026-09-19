---
phase: 27-per-activity-quality-signals
plan: 03
subsystem: analytics
tags: [calibration, quality-signals, threshold-sensitivity, dry-run, roadmap-amendment]

# Dependency graph
requires:
  - phase: 27-per-activity-quality-signals
    provides: "27-01/27-02's pace-quality.ts type contract, tiering signals, thresholds and QualityThresholdOverrides knob"
provides:
  - "27-CALIBRATION.md: the committed, regenerable archive-wide calibration report (denominators, per-signal cohorts, the true composite union, D-02 disposition, D-04 boundary cross-check, Threshold Sensitivity table)"
  - "A recorded developer disposition (split-the-criterion) on the measured composite severe rate"
  - "ROADMAP Phase 27 Criterion 4 split into 4a (gate) and 4b (reported finding)"
  - "REQUIREMENTS QUAL-05 restated against the live denominator with the disagreement kept visible"
affects: [27-05, 27-10, 28]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split satisfiable-gate / reported-finding criterion structure, applied when a locked upstream decision (D-04) creates a hard measurement floor above a literal target"

key-files:
  created: []
  modified:
    - ".planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md"
    - ".planning/ROADMAP.md"
    - ".planning/REQUIREMENTS.md"

key-decisions:
  - "split-the-criterion: ROADMAP Criterion 4 split into 4a (GATE: live denominator, classifier-independent recount, both-direction threshold sensitivity) and 4b (REPORTED FINDING: the measured composite rate and per-signal breakdown, no threshold gate) — because Criterion 4 as literally worded and D-01/D-02/D-04 are jointly unsatisfiable (D-04's locked 154-activity severe-decimation cohort alone is 8.15% of the live archive, already above the ~5% target)"
  - "Live-denominator correction: the committed report's stream-file count (1866) and stream-less count (24) were corrected to 1865/25 after discovering the original readdirSync glob counted data/streams/manifest.json (a non-activity stream-availability index file) as a per-activity stream; the activity count (1890) and composite (299) are unchanged"
  - "QUAL-05 restated against the live archive rather than resolved: its 'materially above target is a calibration failure' language is left in explicit, recorded tension with the measured 15.8%/16.0% rate rather than dissolved by moving the ~5% figure or narrowing D-04"

patterns-established:
  - "Split satisfiable-gate / reported-finding criterion structure"

requirements-completed: [QUAL-05]

# Metrics
duration: 35min
completed: 2026-09-10
---

# Phase 27 Plan 03: Archive-Wide Calibration Dry Run and Checkpoint Disposition Summary

**Measured the true composite severe rate as a 299-activity union over the live 1,890-activity archive (independently reproduced three ways), proved the threshold knob moves it in both directions without editing a shipped constant, and — per the developer's `split-the-criterion` disposition — split ROADMAP Criterion 4 into a satisfiable gate (4a) and a reported finding (4b) rather than silently retuning a locked threshold to chase a stale ~5% target.**

## Performance

- **Tasks:** 3 (Tasks 1-2 completed and merged in prior worktree sessions; this continuation executed Task 3 — the checkpoint disposition — plus the live-denominator reconciliation and the ROADMAP/REQUIREMENTS amendments it authorized)
- **Files modified (this continuation):** 3 (`27-CALIBRATION.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`)

## Accomplishments

- Corrected `27-CALIBRATION.md`'s stream-file denominator from a stale 1866/24 to a live 1865/25 (one-activity correction — the original glob counted `data/streams/manifest.json`, a non-activity manifest, as a per-activity stream) and recorded the three-way independent corroboration of the composite figure.
- Received and transcribed the developer's checkpoint disposition (`split-the-criterion`) verbatim.
- Split ROADMAP Phase 27 Criterion 4 into 4a (GATE) and 4b (REPORTED FINDING), with a dated, house-style amendment note explaining the joint-unsatisfiability reasoning.
- Restated REQUIREMENTS QUAL-05 against the live denominator, keeping its "calibration failure" language in explicit, recorded tension with the measured rate rather than resolving the disagreement by moving a number.

## Task Commits

Tasks 1 and 2 (already merged to `master` prior to this continuation):

1. **Task 1: The full-archive calibration sweep and its committed report** - `694128ab`
2. **Task 2: Prove the threshold knob is connected, in both directions** - `0d377a92`

This continuation (Task 3 and its authorized follow-on amendments):

3. **Task 3a: Live-denominator correction + three-way 299 corroboration in `27-CALIBRATION.md`** - `b9dcbda5` (docs)
4. **Task 3b: ROADMAP Criterion 4 split into 4a/4b** - `53c40881` (docs)
5. **Task 3c: REQUIREMENTS QUAL-05 restated against the live archive** - `a5c53d3b` (docs)

**Plan metadata:** committed alongside this SUMMARY (see final commit below)

## Files Created/Modified

- `.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md` - Corrected stream-file/stream-less denominators (1866/24 → 1865/25); composite (299) and activity count (1890) unchanged; added the three-way independent corroboration record.
- `.planning/ROADMAP.md` - Phase 27 Criterion 4 split into 4a (GATE) / 4b (REPORTED FINDING) with a dated amendment note; progress table untouched.
- `.planning/REQUIREMENTS.md` - QUAL-05 restated against the live archive; traceability table untouched.

## The Measured Composite (from `27-CALIBRATION.md`, corrected denominators)

- **Composite ("any severe signal"): 299 activities.**
  - **15.8%** of the activity-count denominator (299 of 1,890).
  - **16.0%** of the corrected stream-count denominator (299 of 1,865 — corrected from an initially-reported 1,866; the composite and both rounded percentages are unchanged by the denominator correction).
- Sanity gate: max(marginals) = 154 ≤ composite = 299 ≤ sum(marginals) = 312 → **PASS**.

**Three per-signal severe cohorts:**

| Signal | Severe count | % of activity count (1,890) | % of stream count (1,865) | Minor count |
|---|---|---|---|---|
| Decimation (D-04) | 154 | 8.1% | 8.3% | 56 |
| Gap profile | 127 | 6.7% | 6.8% | 337 |
| Impossible samples | 31 | 1.6% | 1.7% | 631 |

**Three-way overlap breakdown:** exactly one signal severe: 286; exactly two: 13; all three: 0.
**Pairwise intersections:** decimation ∩ gapProfile = 8; **decimation ∩ impossibleSamples = 4 (12.9% of the 31-activity impossible-sample-severe cohort)** — far below the raw ≥1-impossible-sample population's measured 90% overlap, because the chosen ≥10 cut already excludes the single-glitch population driving that 90% figure; gapProfile ∩ impossibleSamples = 1.

## The D-04 Boundary Cross-Check (Section 6 of `27-CALIBRATION.md`)

Ran `npm run compute-pace-residual` live and compared the regenerated `26-RESIDUAL.md` against the version committed as of Phase 26's close:

- Committed severe-decimation cohort size: **154**; residual list size: **14**.
- Regenerated (live) severe-decimation cohort size: **154**; residual list size: **14**.
- 14-activity residual list: **MATCH by id** (`4556693525, 5059204779, 3925007542, 3647739864, 4548213751, 5520899318, 5566805363, 4531479183, 5465833080, 5246078056, 4569639779, 4667351283, 3789623232, 4332544744`).
- The severe-decimation cohort size has **NOT drifted** from the committed figure.

## Threshold Sensitivity Table (full, all six rows, from `27-CALIBRATION.md`)

Shipped (no-override) composite: **299**. No source constant in `src/analytics/pace-quality.ts` is edited to produce any row; every override goes through the `QualityThresholdOverrides` function parameter.

| Threshold | Shipped value | Override | Expected direction | Composite | Delta | Verdict |
|---|---|---|---|---|---|---|
| Gap profile severe fraction — LOOSER (more inclusive) | 0.2 | 0.15 | increase | 366 | +67 | MOVED (+67) |
| Gap profile severe fraction — STRICTER (less inclusive) | 0.2 | 0.25 | decrease | 261 | -38 | MOVED (-38) |
| Impossible-sample severe count — LOOSER (more inclusive) | 10 | 5 | increase | 332 | +33 | MOVED (+33) |
| Impossible-sample severe count — STRICTER (less inclusive) | 10 | 20 | decrease | 279 | -20 | MOVED (-20) |
| Decimation zero-advance fraction — LOOSER (more inclusive) (DEMONSTRATION ONLY — D-04 locks the shipped value; not a proposal) | 0.15 | 0.1 | increase | 334 | +35 | MOVED (+35) |
| Decimation zero-advance fraction — STRICTER (less inclusive) (DEMONSTRATION ONLY — D-04 locks the shipped value; not a proposal) | 0.15 | 0.2 | decrease | 255 | -44 | MOVED (-44) |

At least one row shows the composite strictly INCREASING relative to the shipped run: **CONFIRMED**. At least one row shows the composite strictly DECREASING: **CONFIRMED**. The two decimation rows are demonstration-only proof that the same `options` knob also reaches that signal — `DECIMATION_SEVERE_ZERO_ADVANCE_FRACTION` stays locked at its shipped 0.15/50 pair verbatim per D-04, and neither row is a proposal.

## Three-Way Independent Corroboration of 299

The composite figure has now been reproduced by three separate, independently-executed paths, none sharing code with either of the others:

1. **This plan's own classifier sweep** over the live archive (`scripts/compute-pace-quality-calibration.mjs`, Task 1): **299**.
2. **Plan 27-04**, in a separate worktree via a separate code path, independently recomputed `totals.qualityAnySevere` directly from the WRITTEN `data/dashboard/index.json` without importing the classifier — `27-04-SUMMARY.md`'s "Live Archive Verification": `recomputed anySevere: 299   totals.qualityAnySevere: 299   match: true`.
3. **The orchestrator's post-merge `npm run compute-dashboard-index` run** against the MAIN checkout, after both plans' work landed: `"Quality: any severe signal: 299"`, `"Quality: not computable: 25"`.

All three agree exactly on **299**.

## Live-Denominator Correction

The committed `27-CALIBRATION.md` originally reported a stream-file count of **1866** and a stream-less count of **24**, computed with a naive `readdirSync('data/streams').filter(f => f.endsWith('.json'))`. That glob also counts `data/streams/manifest.json` — the stream-availability index file written by backfill-streams and the daily intervals.icu sync, not a per-activity stream — inflating the stream-file count by exactly one and understating the stream-less count by one.

Re-derived directly against the live archive at `/Users/pedf/workspace/strava-widgets/data` (read-only, from the main checkout — my isolated worktree's own bundled `data/` copy still showed the stale 1866/1890 snapshot, matching the pre-correction report): diffing the activity-id set against the stream-id set (excluding `manifest.json`) confirms **1865 per-activity stream files** and **25 activities with no stream**, matching the orchestrator's own live measurement (`compute-dashboard-index`'s "With streams: 1865", "Without streams: 25").

**Corrected values:** stream-file count **1865** (was 1866), stream-less count **25** (was 24). **Unchanged:** activity count **1890**, composite **299**. This is a one-activity denominator correction, not a change in the measured composite — the prior values are preserved inline in `27-CALIBRATION.md`'s Section 1 rather than silently overwritten, matching how `26-RESIDUAL.md` and ROADMAP already record measurement corrections in this project (e.g. Phase 26 Criterion 1's "corrected 2026-09-08" note).

## Developer Disposition (verbatim)

The developer was presented with the checkpoint — both denominators and the stream-less count, the three per-signal severe cohorts, the composite union with its overlap breakdown, the full Threshold Sensitivity table, and the D-04 boundary cross-check result — and selected:

> **split-the-criterion** — Split Criterion 4 into a failable half and a reported half. The gate keeps real pass/fail teeth on what IS satisfiable — live denominator, independent recount reproducing the count without importing the classifier (D-03), knob demonstrated responsive in both directions — while the rate's VALUE becomes a reported finding.

No threshold constant in `src/analytics/pace-quality.ts` was edited under this disposition (verified: `git diff --stat src/analytics/pace-quality.ts` is empty for this continuation).

## Original Wording Preserved Verbatim (before amendment)

**ROADMAP Phase 27 Criterion 4 (original):**

> 4. Severity is calibrated against a measured, independently re-derived archive-wide rate: a dry-run report against the full 1,864-activity archive states the actual top-tier flag count and it is under ~5% (≈90 activities); a standalone script counting top-tier flags from the shipped index reproduces the same count, and the criterion is demonstrated failing by moving a threshold and observing the measured rate move accordingly.

**REQUIREMENTS QUAL-05 (original):**

> - [ ] **QUAL-05**: Severity tiers are calibrated against an archive-wide dry run before ship, targeting a top tier under ~5% of activities (≈90 of 1,864). The measured flag rate per tier is reported and justified; a top tier materially above that target is a calibration failure, not an acceptable outcome.

## Amendments Applied (follow-on commits, per the developer's `split-the-criterion` disposition)

**ROADMAP Phase 27 Criterion 4, amended 2026-09-10** (commit `53c40881`), split into:

- **4a — GATE (pass/fail):** the composite rate is measured against a live denominator (recomputed at run time, never hardcoded); a standalone script counting top-tier flags from the shipped index reproduces the same count WITHOUT importing the classifier (D-03); and the criterion is demonstrated failing by moving a threshold and observing the measured rate move accordingly, in BOTH directions.
- **4b — REPORTED FINDING (no threshold gate):** the measured composite severe rate (299 — 15.8% of 1,890 / 16.0% of 1,865) and its per-signal cohort breakdown (154/127/31) are reported, not gated.
- **Amendment rationale (recorded inline in ROADMAP):** Criterion 4 as literally worded and D-01/D-02/D-04 are jointly unsatisfiable — D-04 locks Phase 26's severe-decimation cohort verbatim at 154 activities, 154/1,890 = 8.15% of the live archive, a floor that alone exceeds the ~5% (~95-activity) target by 59 activities before the other two tiering signals contribute anything, and D-02 forbids retuning backward from the target to close that gap. This is a criterion-wording defect, not a data or code defect.

**REQUIREMENTS QUAL-05, restated 2026-09-10** (commit `a5c53d3b`): the "≈90 of 1,864" figure is restated against the live 1,890-activity archive (~5% ≈ 95, not ≈90); the measured 299-activity (15.8%/16.0%) rate is recorded inline; and QUAL-05's own "a top tier materially above that target is a calibration failure" language is explicitly left in recorded tension with the measured rate — the disagreement is preserved as a live finding about the archive (see ROADMAP Criterion 4b), not silenced by moving a number or narrowing D-04.

## Decisions Made

- **split-the-criterion** (developer's disposition, transcribed verbatim above) — chosen over `accept-and-amend` and `revisit-d04` because it preserves a real, independently-verifiable pass/fail gate on everything that IS satisfiable (live denominator, classifier-independent recount, bidirectional threshold sensitivity) while being honest that the rate's absolute value cannot be gated without either violating D-02 (retuning backward from the target) or D-04 (narrowing Phase 26's locked decimation cohort).
- Live-denominator correction applied as a stated, non-silent correction (prior 1866/24 values preserved inline) rather than an overwrite, per this project's own house style for measurement corrections.
- QUAL-05's disagreement with the measured rate is left visible rather than resolved, per D-02's explicit instruction that a materially-above-target rate is "a finding to surface, not a reason to retune."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the committed report's stale stream-file denominator**

- **Found during:** Task 3's mandatory live-denominator reconciliation (per this continuation's explicit instructions).
- **Issue:** `27-CALIBRATION.md`'s Section 1 stream-file count (1866) and stream-less count (24) were computed by a naive `readdirSync('data/streams').filter(f => f.endsWith('.json'))` that also counted `data/streams/manifest.json` — a stream-availability index file, not a per-activity stream — inflating the stream denominator by one file.
- **Fix:** Re-derived the true per-activity stream-file count (1865) and stream-less count (25) by diffing the activity-id set against the stream-id set directly against the live archive at the main checkout, and corrected `27-CALIBRATION.md`'s Section 1, Section 4, and Section 5 accordingly, preserving the prior (stale) values inline with an explanatory correction note rather than overwriting them silently.
- **Files modified:** `.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md`.
- **Verification:** Independent diff of `data/activities/*.json` ids against `data/streams/*.json` ids (excluding `manifest.json`) at `/Users/pedf/workspace/strava-widgets/data`, read-only, confirms 1865 matched streams and 25 unmatched activities — matching the orchestrator's own `compute-dashboard-index` live measurement ("With streams: 1865", "Without streams: 25"). The composite (299) and activity count (1890) were unaffected and are asserted unchanged in the corrected report.
- **Committed in:** `b9dcbda5`.

---

**Total deviations:** 1 auto-fixed (1 bug fix, denominator correction only — no threshold or code logic touched).
**Impact on plan:** Necessary for the checkpoint's own mandatory reconciliation instruction; no scope creep. `src/analytics/pace-quality.ts` was not touched (`git diff --stat src/analytics/pace-quality.ts` is empty).

## Issues Encountered

None beyond the live-denominator staleness documented above as a deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 27-05 (D-03's independent recount, demonstrated failing on three mutations) can now cite ROADMAP Criterion 4a's finalized gate wording directly.
- Plan 27-10's browser checkpoint can verify Criterion 4b's reported figures (299 / 15.8% / 16.0%) against the shipped index without needing to resolve QUAL-05's recorded tension — that tension is intentionally left open as a finding, not a blocker.
- Phase 28 (PR Plausibility Ceiling) is unaffected by this plan's wording amendments; no functional coupling.

## Self-Check: PASSED

- `.planning/phases/27-per-activity-quality-signals/27-CALIBRATION.md` — FOUND (corrected).
- `.planning/ROADMAP.md` — FOUND (Criterion 4 split into 4a/4b).
- `.planning/REQUIREMENTS.md` — FOUND (QUAL-05 restated).
- Commit `b9dcbda5` — FOUND in `git log --oneline --all`.
- Commit `53c40881` — FOUND in `git log --oneline --all`.
- Commit `a5c53d3b` — FOUND in `git log --oneline --all`.
- `git diff --stat src/analytics/pace-quality.ts` — empty (no threshold edited).

---
*Phase: 27-per-activity-quality-signals*
*Completed: 2026-09-10*
