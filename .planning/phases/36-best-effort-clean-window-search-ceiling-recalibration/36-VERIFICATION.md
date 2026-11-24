---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
verified: 2026-11-24T00:00:00Z
status: gaps_found
score: 3/4 roadmap success criteria verified
overrides_applied: 0
re_verification: false
gaps:
  - truth: "SC4 / PR-09: an archive-wide before/after diff covering every rank change, every newly demoted effort, every reinstated effort and every ceiling value is reconciled three ways and signed against its sha256"
    status: failed
    reason: >
      scripts/compute-clean-window-diff.mjs never applies the pre-phase ceiling to the OLD
      reconstruction. reconstructOldEfforts (scripts/compute-ceiling-recalibration.mjs:183-230)
      recomputes only the absolute guards via isPlausible and never emits 'ceiling'. main() derives
      oldCeilings (line 923) but passes them only to buildCeilingTable (lines 421, 572); nothing runs
      ceilingDemotion over oldEfforts. Production ranked only ceiling survivors, so the diff's OLD state
      is a ranking that never shipped. Consequences, confirmed independently: (1) the ceiling bucket of
      splitReinstatements is structurally unreachable on real input (its only test feeds a synthetic
      oldGuard:'ceiling' row), so 36-DIFF.md states "Reinstated: 31 (31 absolute-guard, 0 ceiling)" and
      files real ceiling reinstatements under "Moved but still ranked", violating the criterion's
      "every reinstated effort"; (2) the OLD columns of ## Rank Changes list efforts the old ceiling
      would have demoted (400m old ranks 1-8 at 66.3-78.2 s imply 5.11-6.03 m/s against the committed
      pre-phase 400m ceiling of 5.1098 m/s = 78.28 s); (3) the moved-but-ranked and newly-demoted
      populations are mis-sized. The reviewer measured 15 real ceiling reinstatements (400m 7, 1k 5,
      1mi 3). My own independent probe (committed ebe0245c ceilings vs data/stats/best-efforts.json,
      without the absolute-guard filter) gave 400m 31, 1k 9, 1mi 5 above the old ceiling and now ranking;
      that count includes the 31 absolute-guard cases, so it corroborates direction and does not
      reproduce 15 exactly. Zero is falsified either way. Legs 1 and 2 share this generator and leg 3
      (recount) does not reconstruct the OLD state, so none of the three reconciliation legs could catch
      it. The developer's "sign-both" signature (sha256 0f3803b3...89e1) is therefore bound to a document
      that misstates the before-state, and the 36-VALIDATION.md record that the developer signed on
      "reinstated 31 = 31 absolute-guard + 0 ceiling" carries the misstatement.
    artifacts:
      - path: "scripts/compute-clean-window-diff.mjs"
        issue: "oldCeilings derived at line 923 but never applied to oldEfforts; classifyEffortChanges (186-249) has no ceiling step and no excludedFromRecords check"
      - path: "scripts/compute-ceiling-recalibration.mjs"
        issue: "reconstructOldEfforts (183-230) documented to never emit 'ceiling'; buildPopulations({useOld:true}) throws on a 'ceiling' guard (line 295), so the fix must order around it"
      - path: ".planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-DIFF.md"
        issue: "Headline 'Reinstated: 31 (31 absolute-guard, 0 ceiling)' and OLD rank columns misstate the before-state; sha256 0f3803b3...89e1 signed over it"
      - path: "scripts/compute-clean-window-diff.test.mjs"
        issue: "ceiling-bucket test uses a synthetic oldGuard:'ceiling' row; no real-pair test"
    missing:
      - "Apply ceilingDemotion(old.impliedSpeedMps, oldCeilings[distance]) to the reconstructed OLD efforts (absolute guards first, ceiling after), reordering around the buildPopulations useOld assertion"
      - "A test on a real activity/distance pair that asserts splitReinstatements(...).ceiling.length > 0"
      - "Regenerate 36-DIFF.md (and re-prove idempotence), recompute its sha256 externally, and obtain a fresh developer signature recorded in 36-VALIDATION.md"
      - "Disclose owner-excluded handling in the diff: add an 'excluded' kind to classifyEffortChanges (or skip with a stated count) and print the count in the headline (WR-01)"
  - truth: "PR-07: the contaminated effort's badge and record state its ranking disposition truthfully"
    status: partial
    reason: >
      Warning, not a blocker for the goal. The detail view renders "Ranked on clean window" for every
      effort with a contaminated record, including the 39 owner-excluded ones on today's data
      (11+11+11+4+1+1 across 400m/1k/1mi/5k/10k/half, measured), next to "Excluded from records".
      detail-best-efforts-logic.test.ts asserts the contradictory combination. Separately, the
      "contaminated implies demotion null" invariant is asserted by three components but not guaranteed
      by the writer (WR-02), and countContaminatedAtDistance does not skip demoted efforts (WR-04). Both
      overlaps measure 0 today (contaminated-and-demoted = 0 at every distance), so no figure is wrong
      on the shipped archive.
    artifacts:
      - path: "src/dashboard/views/detail-best-efforts-logic.ts"
        issue: "299-309: contaminated badge text claims rank regardless of excluded/demoted"
      - path: "src/dashboard/views/records-logic.ts"
        issue: "388-405: countContaminatedAtDistance does not skip effort.demotion != null"
    missing:
      - "Reword the badge or condition it on !excluded && !demoted, with a test (WR-03)"
      - "Skip demoted efforts in countContaminatedAtDistance (WR-04); pick and enforce one contract for WR-02"
human_verification: []
---

# Phase 36: Best-Effort Clean-Window Search and Ceiling Recalibration Verification Report

**Phase Goal:** A best-effort window may not span or interpolate a crossing across an unreliable segment; the contaminated effort is demoted-and-kept while the search continues for the best clean sub-interval by partitioning (never splicing), exclusion runs strictly before ceiling derivation, and both a best-effort diff and a ceiling recalibration diff are signed before the phase closes.
**Verified:** 2026-11-24
**Status:** gaps_found
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria, with dated amendments)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 3475740390's 400m no longer spans the jump; demoted record states every intersected segment (capped, trailing count); ranked figure from partitioning | VERIFIED | Checkpoint rows a, b PASS (4:59/km, badge names 2 segments + "+2 more", 4 segments intersected). `compute-best-efforts.ts` Branch 1/2/3 at lines ~400-510: `complementSubIntervals` then a bounded sweep per clean sub-interval, with `contaminationRecord` carrying the original window. `best-effort-fixtures.test.ts` and `clean-window-archive.test.ts` pass on a re-run (37 tests with the diff test file). |
| 2 | A test shows the d-rebased splice fabricates a faster window than partition on 3475740390@400m | VERIFIED | Plan 36-05 splice demonstration, comparison is splice versus partition per the D-02 amendment. Suite 3,921 tests green (reported); fixtures file re-run green. |
| 3 | Exclusion runs strictly before ceiling derivation inside the three-pass shape; per-distance movement measured and explained; fail-open named | VERIFIED | Exclusion lives in Pass 1 (`computeActivityEfforts`). `36-CEILING-RECALIBRATION.md` exists with a cause per row; ceilings moved on 6 of 7 distances; half fails open (population 104 to 71, below the floor of 100) as a named finding. Measured on `data/stats/best-efforts.json`: ceiling demotions at half = 0. |
| 4 | Archive-wide diff covering every rank change, every newly demoted effort, every reinstated effort and every ceiling value, reconciled three ways and signed | FAILED | See gap 1. The diff omits the ceiling reinstatements and misstates the OLD rank columns. The signature exists (sign-both, sha256 matches) but covers a document that misstates the before-state. The three scoping fixtures are pinned (row a). |

**Score:** 3/4 truths verified

### Independent assessment of the 36-14 row failures (d, e, g)

I measured `data/stats/best-efforts.json` directly (1,874 activities). Non-excluded demotion counts are 400m 4, 10k unreliable-segment 278, half unreliable-segment 33, which are the Records-screen figures. Adding the owner-excluded demotions (400m +1, 10k +7, half +2) gives 5, 285 and 35, which are the frozen Expected values. The rows were therefore drafted against a population the screen deliberately excludes (documented in the `countDemotedAtDistance` docblock, D-10). These are row defects, not code defects. The count-independent clauses held: two different counts shown together, the guard named with its exact parenthetical, and 0 ceiling demotions at half. PR-07 and PR-08 are substantively satisfied by the code. Their `[ ]` state in REQUIREMENTS.md is a bookkeeping disposition that the developer, not this verifier, resolves. Row defects were left unpatched in 36-VALIDATION.md.

Contaminated counts on the same data (non-excluded): 400m 247, matching the frozen Expected for row d.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| PR-06 | No window spans a segment; partition not splice; splice test | SATISFIED | Truths 1 and 2. REQUIREMENTS.md: `[x]` / Complete. |
| PR-07 | Contaminated effort kept as demoted/contaminated record; no-clean-window case says why | SATISFIED in code, with warnings | Rows b, c, f PASS; rows d and e are row defects (above). WR-03/WR-04 are truthfulness warnings. REQUIREMENTS.md: `[ ]` Withheld. |
| PR-08 | Exclusion before ceiling; movement reported; fail-open named; write gate | SATISFIED in code | Truth 3; row g count-independent clause held; write gate sha256 unchanged. REQUIREMENTS.md: `[ ]` Withheld. |
| PR-09 | Diff and recalibration signed; scoping fixtures pinned | BLOCKED (diff half) | Gap 1. The recalibration artifact is not implicated by CR-01. REQUIREMENTS.md currently shows `[x]` / Complete, which this verification contradicts. |
| SEG-05b (final half) | Phase 36's consumer reads the detector, load-bearing | SATISFIED | Plan 36-05 Task 4 stub proof, recorded in the REQUIREMENTS.md row. |

No orphaned requirement IDs: PR-06..PR-09 all appear in plan frontmatter and in REQUIREMENTS.md.

### Anti-Patterns Found

No unreferenced TBD/FIXME/XXX gate was run beyond the review's file list. The code review (36-REVIEW.md) found CR-01, WR-01 to WR-04 and six Info items. CR-01 is the only goal-blocking item. IN-01 (recount floor chosen against its own population, so leg 3 is corroboration and not proof) and IN-04 (OLD plausibility re-evaluated on a rounded duration, a feed into the signed artifact) are strength-of-evidence notes that the re-sign should state.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Fixtures, archive and diff tests | `npx vitest run best-effort-fixtures clean-window-archive compute-clean-window-diff` | 37 passed | PASS |
| Records counts vs frozen rows | node probe of `data/stats/best-efforts.json` | 4 / 278 / 33 non-excluded; 5 / 285 / 35 with excluded | PASS (explains d, e, g) |
| Old-ceiling reinstatement exists | node probe, ebe0245c ceilings vs current document | nonzero above-old-ceiling-now-ranking (400m 31, 1k 9, 1mi 5 before the absolute-guard filter) | FAIL for "0 ceiling" claim |
| Probe execution (Step 7c) | Not run | The phase's recount is `npm run compute-clean-window-recount`, reported exit 0 in 36-VALIDATION.md; I did not re-run it. | SKIPPED |

### Gaps Summary

One blocker. The phase's search, ceiling ordering, recalibration and the Records and detail surfaces are implemented and wired. The PR-09 clean-window diff, though, was generated from a before-state that omits the pre-phase ceiling. It reports zero ceiling reinstatements, its OLD rank tables list never-ranked efforts, and the developer signed that exact sha256. ROADMAP criterion 4 names "every reinstated effort" and a three-way reconciliation, and no leg could detect the omission because two share the generator and the third never reconstructs the old state. The fix is small and localized: apply `ceilingDemotion` to the reconstructed OLD efforts, add a real-pair test, regenerate `36-DIFF.md`, and re-sign over the new sha256. `36-CEILING-RECALIBRATION.md`, signed separately, is not implicated.

Recommended bookkeeping when closing the round (not done here): reopen PR-09 in REQUIREMENTS.md, the traceability row and the ROADMAP phase line; PR-07 and PR-08 can be ticked after the developer accepts the row-defect disposition.

---

_Verified: 2026-11-24_
_Verifier: Claude (gsd-verifier)_
