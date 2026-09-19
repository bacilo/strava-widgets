---
phase: 28-pr-plausibility-ceiling
verified: 2026-09-17T10:15:00Z
status: passed
score: 5/5 success criteria verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "Criterion 3 — pinned regression case (4556693525) rejected as a permanent regression fixture, guard's effect reported archive-wide via dry-run"
    - "Criterion 4 — every ceiling-rejected effort visible with a stated demotion reason"
    - "Criterion 5 — archive-wide diff reviewed and signed off, reconciling with criterion 3's dry-run count"
  gaps_remaining: []
  regressions: []
deferred: []
---

# Phase 28: PR Plausibility Ceiling Verification Report

**Phase Goal:** A personal plausibility ceiling, derived non-circularly from each athlete's own already-filtered effort history, demotes-and-flags implausible efforts from PR ranking — never deletes them — with an archive-wide before/after diff reviewed by a human before ship.

**Verified:** 2026-09-17
**Status:** passed
**Re-verification:** Yes — after gap-closure plans 28-10..28-15

## Previous Verification (superseded)

`28-VERIFICATION.md` dated 2026-09-16 scored this phase 2/5 (`gaps_found`). Its root cause, CR-01
(28-REVIEW.md): `compute-best-efforts.ts`'s Pass 3 only applied the ceiling check to entries inside
`byDistance`, and owner-excluded efforts never entered `byDistance` — so an excluded, over-ceiling
effort (13 of them archive-wide, including the pinned regression case 4556693525) shipped with
`demotion: null`. This failed Criteria 3, 4 and 5. Every claim in that report was independently
reproduced in this session's earlier draft (walking the live archive by hand, re-running tests,
re-running `compute-pr-ceiling-recount.mjs`), not taken on SUMMARY.md's word.

Gap-closure plans 28-10 (recount teeth), 28-11 (CR-01 fix in `compute-best-efforts.ts`), 28-12 (diff
and calibration generator fixes), 28-13 (Records copy CR-02 fix + WR-01/WR-02/IN-02), 28-14
(regeneration + reconciliation), and 28-15 (Round 2 human checkpoint + fresh PR-04 sign-off) closed
all three gaps. This report re-verifies the result from scratch against the live codebase, not
against the gap-closure plans' own claims.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, scored individually)

All five re-derived independently in this session: full test suite re-run, `tsc` re-run,
`verify-dashboard` re-run, `compute-pr-ceiling-recount.mjs` re-run, and a fresh, hand-written
node script (never seen by any prior plan) walking the live `data/stats/best-efforts.json` and
comparing every effort's implied speed against `doc.ceilings[d].ceilingMps` directly.

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Three-pass structure is deterministic (no iteration to convergence) | ✓ VERIFIED | `src/analytics/compute-best-efforts.ts` has three literally-marked passes (`// PASS 1 — ACCUMULATE` line 235, `// PASS 2 — DERIVE` line 335, `// PASS 3 — FILTER AND FLAG` line 366); `deriveCeilings(` called exactly once (line 353). Re-ran independently: `-t "deterministic"` → 1 passed, `-t "no iteration to convergence"` → 1 passed. Full suite (79 files / 2330 tests) green, `npx tsc --noEmit` clean. Unaffected by the CR-01 fix (which changed only which population is *checked*, not the pass structure). |
| 2 | Ceiling derived non-circularly (from Pass 1's already-filtered population only) | ✓ VERIFIED | Re-ran `-t "non-circular"` independently → 1 passed. Source read confirms Pass 2 reads only `byDistance` (Pass 1's already-filtered accumulator); the CR-01 fix's excluded-effort sweep (Pass 3, lines 408-417) never writes into `byDistance` and never re-calls `deriveCeilings`, confirmed by the acceptance-criterion grep (`deriveCeilings(` count = 1) and by direct source read. |
| 3 | Pinned regression case (4556693525, 45.2s/8.85 m/s) demonstrated rejected as a permanent regression fixture; guard's effect reported via a 662-cohort dry run | ✓ VERIFIED | Re-ran `node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 65` in this session: exit 0, `PASS`, `byGuard.ceiling` 31, `independentCeilingCount` 31, `overCeilingWithoutDemotion` 0, pinned fixture `4556693525@400m` `guard="ceiling"` `durationSec=45.2` `guardIsCeiling=true`. Independently confirmed by my own from-scratch sweep script against the live document: pinned activity's 400m and 1k efforts both show `demotion.guard: "ceiling"`; its 1mi/5k/10k efforts show `demotion: null` and are correctly under-ceiling (4.0867 < 4.6323, 3.3364 < 4.3458, 3.0230 < 4.2236). Cohort dry-run: `archiveDenominator` 1890, `cohortCount` 662 (35%), reported in the same run. |
| 4 | Rejected efforts demoted, never deleted; visible in detail view with stated reason; code audit confirms no delete path | ✓ VERIFIED | My own sweep script found **zero** efforts archive-wide where implied speed exceeds the distance ceiling with `demotion: null` (the exact CR-01 shape) — down from 13 in the pre-fix document. `grep` for any reassignment/splice/filter of `activities[id].efforts` in `compute-best-efforts.ts` returns nothing; the never-delete audit test (`auditNoDemotedEffortRemoved`) passes against the real document and is demonstrated failing against a delete-mutated copy (part of the green 2330-test run). Detail-view wiring confirmed by source read of `detail-best-efforts-logic.ts`'s `prFlagBadgeSpecs` (Demoted badge, then Excluded badge, distinct `descriptionIdSuffix`) and by the developer's own pasted browser observation for activity 4556693525 (both claims render as two distinct badges, not a run-on string) recorded in `28-VALIDATION.md` § Round 2 Outcome. |
| 5 | Archive-wide diff generated, human-reviewed and signed off; reconciles with criterion 3's dry-run count | ✓ VERIFIED | `shasum -a 256 28-DIFF.md` in this session = `64c90981e1ed3db643af77ee7e4953f912fb2817f84dafd10b2d112090565cd2`, matching the sha256 recorded in `28-VALIDATION.md` § PR-04 Sign-off (Round 2, D-14) exactly — the signed artifact is byte-unchanged since the checkpoint. `28-DIFF.md`'s "Ceiling demotions on owner-excluded efforts" section lists exactly the 13 labels my independent sweep also found, with matching durations/speeds/ceilings. Its Reconciliation states 31, which equals my own re-run of `byGuard.ceiling` (31) and `independentCeilingCount` (31) — three independently-computed routes (this session's ad hoc sweep, the recount script, and the diff generator) agree, closing the prior "18=18 self-agreeing check" defect. The Round 2 human sign-off is recorded with the three-way figures, the 13-row listing and the unchanged-sections diff presented before the verdict (see Checkpoint Evidence Assessment below for a note on evidentiary format). |

**Score:** 5/5 success criteria verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/compute-best-efforts.ts` | Three-pass shape, ceiling applied to every non-absolute-guard-demoted effort regardless of exclusion | ✓ VERIFIED | CR-01 fix present at lines 401-418: a second per-distance sweep over sorted activity ids, reusing the same `ceilingDemotion(...)` call, applied only to excluded efforts still carrying `demotion === null`, never touching `byDistance`/`survivors`/`deriveCeilings`. |
| `src/analytics/compute-best-efforts.test.ts` | Real-exclusion pinned regression, precedence, non-circularity-with-exclusion, determinism | ✓ VERIFIED | `grep -c "REAL committed exclusion"` ≥ 1; `no-such-exclusions.json` now used only by the renamed non-excluded-path variant; all suites green in the full re-run. |
| `scripts/compute-pr-ceiling-recount.mjs` | Classifier-independent recount that fails on the CR-01 shape | ✓ VERIFIED | `recountCeilingSweep` + `guardIsCeiling` now gate `evaluateReport`'s verdict; re-run in this session against the live document: exit 0, PASS, all figures match prediction. |
| `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` | Regenerated archive-wide diff, idempotent, human-signed-off, reconciled | ✓ VERIFIED | sha256 matches the recorded sign-off; 13-row owner-excluded listing matches my independent sweep; Reconciliation states 31 = 31 = 31. |
| `.planning/phases/28-pr-plausibility-ceiling/28-CEILING-CALIBRATION.md` | D-13 calibration record | ⚠️ STALE COLUMN (advisory, not a criterion artifact) | Regenerated and idempotent (WR-03/WR-04 fixed), but its "Demoted" column (8/7/3=18) still counts only the non-excluded population and disagrees with the pipeline/diff's 19/9/3=31 (WR-08, fresh 28-REVIEW.md). This artifact is not "the archive-wide diff" criterion 5 names — see Findings for Escalation below. |
| `src/dashboard/views/records-logic.ts` | Guard-accurate, per-guard, owner-exclusion-aware demotion copy | ✓ VERIFIED | `DemotionCounts`, `describeDemotionCounts` present; live 400m note reads exactly `35 ... (8 by the personal ceiling, 17 by the world-record pace guard, 10 by the activity max-speed guard) ...` — confirmed by source read and by the developer's Round 2 browser observation. |
| `src/dashboard/styles.css` | Dark-theme-AA demoted-badge token | ✓ VERIFIED | `--demoted-text` declared per theme; dark `#fb923c` = `rgb(251, 146, 60)` ≥ 4.5:1, confirmed by the fresh code review's recomputed contrast (7.54:1/6.58:1) and by the developer's disclosed-readback-confirmed browser observation. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Pass 1 `byDistance` accumulator | Pass 2 `deriveCeilings` | single call, no loop | ✓ WIRED | Confirmed by source read + grep count (1). |
| Derived ceiling (`ceilings[d]`) | every effort's demotion status (excluded included) | `ceilingDemotion` applied per effort in both the survivors loop and the new excluded sweep | ✓ WIRED | Confirmed by source read (two `ceilingDemotion(` call sites) and by zero counter-examples in my independent live-document sweep (down from 13). |
| `28-DIFF.md` | `compute-pr-ceiling-recount.mjs` | ceiling-only total (31) reconciled against `byGuard.ceiling` (31) and `independentCeilingCount` (31) | ✓ WIRED | Reproduced all three numbers independently in this session; they agree, and agreement is no longer self-referential (the recount now computes its own arithmetic from `durationSec`/`doc.ceilings`, never reading `effort.demotion` as ground truth for "is this over the ceiling"). |
| `effort.demotion` | Detail-view badge (`prFlagBadgeSpecs`) | `visibleText: Demoted — ${row.demotionReason}` | ✓ WIRED | Confirmed by source read and by the developer's pasted browser observation for both 4556693525 and 3475725513 (precedence case). |
| Records screen count | Owner-excluded efforts | excluded entirely from `countDemotedAtDistance` (D-10) | ✓ WIRED | Confirmed by source read (`effort.excludedFromRecords === true` → skip) and by the live 400m figure (35, not 47 — 47 is the all-guard, no-exclusion-filter figure my own script also reproduced). |

### Behavioral Spot-Checks (this session, independently re-run)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full regression suite | `npm test` | 79 files / 2330 tests passed | ✓ PASS |
| Type check | `npx tsc --noEmit` | clean, exit 0 | ✓ PASS |
| Dashboard artifact/build integrity | `npm run verify-dashboard` | 64/64 checks passed | ✓ PASS |
| Classifier-independent recount | `node scripts/compute-pr-ceiling-recount.mjs --expect-demoted 65` | exit 0, PASS, ceiling 31, independentCeilingCount 31, guardIsCeiling=true | ✓ PASS |
| Ad hoc, from-scratch archive sweep (this session, not any prior script) | walk `data/stats/best-efforts.json`, compare every effort's implied speed to `ceilings[d].ceilingMps` | 0 over-ceiling efforts with `demotion: null`; 0 ceiling-guard efforts not over ceiling; 13 excluded-ceiling demotions (matches 28-DIFF.md's listing) | ✓ PASS |
| Debt-marker scan | `grep -nE "TBD|FIXME|XXX|HACK|PLACEHOLDER"` across all phase-modified files | no matches | ✓ PASS |
| Commit skip-token scan | `git log --format=%s` across all phase-28 gap-closure commits | no `skip ci` token found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| PR-01 | 28-05, 28-11 | Strict three-pass shape, deterministic CI output | ✓ SATISFIED — recommend ticking | Verified above (Criterion 1), unaffected by the CR-01 fix. Currently unticked in `REQUIREMENTS.md`, left for this verifier per the phase's process note; this verifier's independently-reproduced evidence supports ticking it now. |
| PR-02 | 28-01, 28-03, 28-05, 28-11 | Ceiling derived from already-filtered population, never raw archive | ✓ SATISFIED — recommend ticking | Verified above (Criterion 2). The CR-01 fix only changed the *check's* population (excluded efforts too), never the *derivation's* population, which remains `byDistance`-only. Currently unticked, left for this verifier; evidence supports ticking. |
| PR-03 | 28-02, 28-03, 28-04, 28-05, 28-11, 28-13 | Effort exceeding ceiling flagged/demoted, never deleted, always visible with reason | ✓ SATISFIED | Already ticked (re-ticked 2026-09-17 on Round 2). This verifier independently confirmed the underlying claim: 0 over-ceiling efforts with `demotion: null` archive-wide, detail-view badge wiring confirmed, never-delete audit passes. |
| PR-04 | 28-06, 28-07, 28-08, 28-12, 28-14, 28-15 | Archive-wide before/after diff produced and human-reviewed before ship | ✓ SATISFIED | Already ticked. Sha256-bound sign-off confirmed unchanged in this session; three-way reconciliation independently re-derived. See Checkpoint Evidence Assessment for a note on the Round 2 sign-off's evidentiary format (assessed as adequate, not a gap). |
| PR-05 | 28-01, 28-03, 28-05, 28-08, 28-11 | Sharpened guard validated archive-wide (662-cohort), pinned fixture rejected | ✓ SATISFIED | Already ticked. Pinned fixture (4556693525@400m) independently confirmed `guard: "ceiling"` in the live shipped document (not just a synthetic fixture, as the pre-gap-closure caveat had noted); cohort dry-run (662/1890, 35%) reproduced in this session. |

**Orphan check:** all five PR-* requirements map to at least one Phase 28 plan's `requirements:` frontmatter field; none are orphaned.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/compute-pr-ceiling-calibration.mjs` | `renderCalibrationMarkdown` ~579-590, ~644-649 (WR-07, fresh 28-REVIEW.md) | Hard-coded prose asserting a data-dependent claim ("400m shows the largest drift") that is already false against the committed artifact's own table (5k shows −7, larger than 400m's −6) | ⚠️ WARNING (advisory) | Affects only `28-CEILING-CALIBRATION.md`, a D-13 informational artifact, not the "archive-wide diff" named in Criterion 5. Does not defeat any of the 5 success criteria. Worth fixing before the next regeneration, since a future reader could be misled. |
| `scripts/compute-pr-ceiling-calibration.mjs` | `applyCeiling` ~270-296 (WR-08, fresh 28-REVIEW.md) | Calibration's "Demoted" column (8/7/3 = 18) counts only the non-excluded population and now disagrees, unlabelled, with the pipeline/`28-DIFF.md`'s 19/9/3 = 31 ceiling-demoted counts since the CR-01 fix | ⚠️ WARNING (advisory) | Same reasoning as WR-07: this is the calibration artifact's own internal count, not the diff artifact criterion 5 names. The diff and recount's 31/31/31 reconciliation (criterion 5's actual reconciliation target) is unaffected and independently confirmed in this session. A reader comparing the two documents side by side would see two different "demoted at 400m" numbers with no explanation — legitimate confusion risk, not a phase-goal defect. |
| `src/analytics/compute-best-efforts.test.ts` | ~944-1197 (WR-09, fresh 28-REVIEW.md) | Four new CR-01 regression tests depend on the live, owner-editable `data/best-effort-exclusions.json` without fully checking its contents; only one test verifies its own premise | ⚠️ WARNING (advisory) | A future curation edit (un-excluding 3475711469, or narrowing an entry to specific distances) could break these tests with an unexplained numeric mismatch, and `npm test` gates the nightly Pages deploy. This is a real operational fragility risk, but it does not affect the current, already-passing state of the code (confirmed green in this session's full re-run) and does not defeat any of the 5 success criteria as currently demonstrated. Recommend fixing before it bites a future curation session — not a phase-close blocker. |
| `src/analytics/compute-best-efforts.ts`, `.github/workflows/daily-refresh.yml` | WR-06 (partially resolved, fresh 28-REVIEW.md) | Comments corrected, but the opt-in write gate for `data/best-effort-ceiling.json` was deliberately not added (developer decision required, per `deferred-items.md`) | ℹ️ INFO | Explicitly deferred with reasoning in `deferred-items.md`; not a gap. |
| Multiple (IN-05, IN-06, IN-07, IN-08, fresh 28-REVIEW.md) | — | Stale comments, an unlabelled p90-only movement report line, two sibling recount functions still throwing on null input | ℹ️ INFO | Non-blocking, listed for completeness; see `28-REVIEW.md` for details. |

No TBD/FIXME/XXX/HACK/PLACEHOLDER debt markers found in phase-modified files (re-confirmed by direct grep in this session).

### Checkpoint Evidence Assessment (requested explicitly for this verification)

The Round 2 checkpoint (`28-VALIDATION.md` § Round 2 Outcome) recorded the developer's single word
`"pass"` as the verdict for **both** R2-5 (dark-theme badge contrast) and R2-6 (fresh PR-04
sign-off), in answer to one combined prompt. Assessed explicitly, per row:

- **R2-5:** ADEQUATE. The plan's own house rule for this row requires either a developer-pasted
  value or "an agent may read it back from the DOM, disclosed as agent readback, and the developer
  confirms it." That is exactly what happened: the agent's disclosed readback quoted concrete,
  falsifiable values (`rgb(251, 146, 60)` dark, `rgb(179, 57, 10)` light) that match this session's
  own independently-recomputed hex→rgb conversion of `--demoted-text` read as text from
  `styles.css`. The developer's "pass" is the required confirmation step, not the observation
  itself — the observation was already quoted and disclosed. The combined-prompt ambiguity was
  self-disclosed transparently in `28-VALIDATION.md` rather than silently assumed, which is what
  the plan's transcription instruction required.
- **R2-6:** ADEQUATE, with a caveat worth surfacing. R2-6 is explicitly *not* one of the rows the
  plan's house rule requires a quoted rendered value for (that list is "R2-2, R2-3, R2-4 and
  R2-5" only) — it is a document-read sign-off, structurally the same kind of judgment call as
  Round 1's R7 (which was not faulted for being terse; it was faulted because the underlying
  diff was wrong). The material presented before the verdict was substantially more complete than
  Round 1's: the explicit 13-row owner-excluded listing, the three-way 31/31/31 figure, and the
  D-04 observation were all surfaced by name before the "pass." This verifier independently
  reproduced all three of those figures from scratch in this session and found them correct. The
  one-word reply does not, on its own, prove the developer individually cross-checked all 13
  listed activity IDs against their own memory of what they excluded — but those 13 IDs are drawn
  from a pre-existing, already-curated exclusion file the developer authored before this phase
  began, not a new list this session introduced, which lowers the risk that "pass" papered over an
  unrecognized entry. **This is flagged here for visibility, per instruction, rather than silently
  accepted** — if the developer wants a per-ID confirmation on the 13-row listing, that is a cheap,
  low-risk follow-up action, not a phase-blocking gap.

Net: neither row is treated as a gap. Both are assessed adequate against the plan's own stated
evidentiary bar, with the R2-6 caveat surfaced explicitly rather than smoothed over.

### Human Verification Required

None. The Round 2 checkpoint (`28-VALIDATION.md` § Round 2 Checkpoint / § Round 2 Outcome) already
exercised every rendered-evidence truth this phase's success criteria require, with quoted
developer-pasted observations for R2-2/R2-3, disclosed-and-confirmed agent readback for R2-4/R2-5,
and a document-read sign-off for R2-6 (assessed adequate above). No new rendered-UI state exists
in the codebase since that checkpoint that would require a fresh browser observation.

### Gaps Summary

No gaps. All three prior gaps (Criteria 3, 4, 5, traced to CR-01) are closed in code
(`compute-best-efforts.ts`'s excluded-effort ceiling sweep), independently re-verified against the
live shipped archive in this session (a from-scratch sweep script, not any prior plan's code,
found zero over-ceiling efforts with `demotion: null`, down from 13), and reflected in a
regenerated, hash-verified, freshly-signed-off `28-DIFF.md` reconciling 31/31/31 across three
independent computation paths. Criteria 1 and 2, previously verified and unaffected by the fix,
were re-confirmed rather than assumed carried-over.

A same-day fresh code review (`28-REVIEW.md`, 2026-09-17, 0 critical / 3 warning / 3 info) found
three new warnings (WR-07, WR-08, WR-09). None defeat a named success criterion: WR-07 and WR-08
concern `28-CEILING-CALIBRATION.md`, a D-13 informational artifact distinct from "the archive-wide
diff" criterion 5 names (`28-DIFF.md`, whose own 31/31/31 reconciliation is unaffected and
independently confirmed); WR-09 concerns a future operational fragility risk in a currently-passing
test suite, not a present defect. All three are recorded as advisory findings above, with reasoning
tying them (or explicitly not tying them) to the roadmap criteria, per this verification's
instructions — not rubber-stamped, not escalated into gaps without cause.

**Recommendation:** proceed. Phase 28's goal is achieved and independently demonstrated in the live
codebase. Consider a small follow-up (not blocking) to fix WR-07/WR-08's calibration-generator
prose and WR-09's test coupling to the live exclusions file before the next `compute-all-stats`
regeneration or curation edit.

---

_Verified: 2026-09-17_
_Verifier: Claude (gsd-verifier)_
