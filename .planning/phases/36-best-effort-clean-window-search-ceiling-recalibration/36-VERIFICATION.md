---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
verified: 2026-11-25T00:00:00Z
status: passed
score: 4/4 roadmap success criteria verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  previous_report: "git 575a917a (36-VERIFICATION.md as of the round-1 verification)"
  gaps_closed:
    - "SC4 / PR-09: diff omitted ceiling reinstatements and misstated the OLD rank columns (CR-01)"
    - "PR-07: contaminated badge claimed 'Ranked' beside Excluded/Demoted (WR-03), countContaminatedAtDistance did not skip demoted efforts (WR-04), no enforced contaminated/demotion contract (WR-02)"
    - "Owner-excluded efforts undisclosed in the diff (WR-01)"
  gaps_remaining: []
  regressions: []
warnings_not_blocking:
  - "Review WR-01 (leg 2 reconcileCounts) is unfailable inside main(): the signed 'four legs green' counts one check that cannot disagree"
  - "Review WR-02 (leg 4) cannot see rows or pairs the diff omitted: latent, measured clean on live data"
  - "Review WR-03 (recount) is a deny-list: a contaminated effort with an unknown or missing demotion guard passes"
  - "Row d2 cannot discriminate the WR-04 contaminated-and-demoted clause on live data; row f carried forward"
deferred: []
human_verification: []
---

# Phase 36: Best-Effort Clean-Window Search and Ceiling Recalibration Verification Report

**Phase Goal:** A best-effort window may not span or interpolate a crossing across an unreliable segment; the contaminated effort is demoted-and-kept while the search continues for the best clean sub-interval by partitioning (never splicing), exclusion runs strictly before ceiling derivation, and both a best-effort diff and a ceiling recalibration diff are signed before the phase closes.
**Verified:** 2026-11-25
**Status:** passed (with four non-blocking warnings, below)
**Re-verification:** Yes, after gap-closure round 2 (plans 36-15..36-20). The round-1 `gaps_found` report is preserved in git at `575a917a`.

## Disposition check

This verdict does NOT reverse any disposition the developer signed at a blocking checkpoint. The developer signed `sign-both` on `36-DIFF.md` e67f3cba... and `36-CEILING-RECALIBRATION.md` 48b9e083..., and PASSed rows d2, e2, g2, i, b2. I reproduced both hashes and found nothing that contradicts those verdicts. The four ticks made by 36-20 before this verification ran (PR-06..PR-09) stand. Nothing needs reopening.

## Prior-gap closure (against 575a917a)

| Prior gap | Now | Independent evidence |
|---|---|---|
| CR-01 (SC4/PR-09): OLD state never applied the pre-phase ceiling, so "0 ceiling reinstatements" and the OLD rank columns were wrong | CLOSED | Regenerated diff states "Reinstated: 45 (30 absolute-guard, 15 ceiling)". I built the pre-phase tree (`ebe0245c`, the last commit before any phase code touched `compute-best-efforts.ts`) in a scratch worktree and ran leg 4 myself: `BEFORE-STATE LEG: OK`, 7/5/3 ceiling reinstatements at 400m/1k/1mi. My own probe, which does not reuse leg 4's comparison, found the derived reinstated pair sets (pre-phase pipeline vs current pipeline, owner-excluded skipped) identical by id and distance to the pairs the diff lists: 30 of 30 absolute-guard, 15 of 15 ceiling. Newly demoted 372 matches the list (363 numeric ids + 9 `i`-prefixed). The OLD ceilings agree with `36-CEILING-RECALIBRATION.md`. |
| WR-01 (owner-excluded undisclosed) | CLOSED | Headline: "Owner-excluded ... 61". Leg 4 derives 61 from the two pipelines. |
| PR-07 warning: badge says "Ranked" beside Excluded/Demoted (WR-03) | CLOSED | `detail-best-efforts-logic.ts:307-315`: `ranks = !row.excluded && !row.demoted` selects "Ranked" or "Measured on clean window". Pinned by a 5-test describe. |
| PR-07 warning: contamination count did not skip demoted efforts (WR-04) | CLOSED | `records-logic.ts:406` `if (effort.demotion != null) continue;`, test at `records-logic.test.ts:945`. |
| PR-07 warning: invariant asserted by three components, not guaranteed (WR-02) | CLOSED (contract chosen) | Developer accepted the contract "contaminated and demotion are independent; only contaminated + unreliable-segment is impossible". Writer tests (Branch 2 max-speed, Branch 3 forbidden pair, ceiling orchestration case) exist and pass. Live data: contaminated-and-demoted is 0 at every guard. |

## Goal Achievement

### Observable Truths (ROADMAP success criteria, with dated amendments)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 3475740390's 400m no longer spans the jump; the contaminated record names every intersected segment (capped, trailing count); the ranked figure comes from partitioning | VERIFIED | Unchanged from round 1 (Branch 1/2/3 in `compute-best-efforts.ts`; rows a and b PASS). Regression check only: full suite green; recount pinned fixtures MATCH (3475740390 3:20, 3475724402 3:21, 3475734189 3:22). |
| 2 | A test shows the d-rebased splice fabricates a faster window than partition on 3475740390@400m | VERIFIED | Unchanged from round 1; covered by the green suite. |
| 3 | Exclusion runs strictly before ceiling derivation in the three-pass shape; per-distance movement measured with a cause per row; fail-open named | VERIFIED | `36-CEILING-RECALIBRATION.md` sha256 48b9e083... is byte-identical to the signed copy. Ceiling table in the regenerated diff agrees with it (6 of 7 moved; half 104 to 71 fails open; marathon 0 to 0). Leg 4 independently reproduced all seven pre-phase ceilings at 4 dp with populations. Live: demotion guards are unreliable-segment 386, max-speed 3, ceiling 5, none at half. |
| 4 | Archive-wide diff covering every rank change, newly demoted, reinstated and ceiling value, reconciled three ways and signed against its sha256; three scoping fixtures pinned | VERIFIED | See the CR-01 row above. I re-ran `shasum -a 256`: `36-DIFF.md` e67f3cba48ac7e96e1ecac3de7f9db7d8525d5deaea124f14f55a78e39afacb4, matching the signed value. Rank rows: 19 rank positions the diff does not render all agree between the pre-phase and current documents, so no omission is hiding a changed rank. Signature record in `36-VALIDATION.md` shows the Fail-Open Findings were read verbatim before the signature was taken. |

**Score:** 4/4

### Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `scripts/compute-clean-window-diff.mjs` | VERIFIED | `applyOldCeilings` wired in `main()` (derive `oldCeilings`, then apply, then `buildDiffReport`); `excluded` kind checked first |
| `scripts/compute-clean-window-before-state.mjs` | VERIFIED | Runs the pre-phase pipeline, not a reconstruction; red on the pre-fix artifact (52 disagreements), green now (90/90) |
| `scripts/compute-clean-window-recount.mjs` | VERIFIED with WR-03 | exit 0, pass=1440 fail=0 notAssessable=74 |
| `src/dashboard/views/detail-best-efforts-logic.ts`, `records-logic.ts` | VERIFIED | Truthful badge and count, tests present |
| `36-DIFF.md`, `36-CEILING-RECALIBRATION.md` | VERIFIED | Hashes match the signature record |

### Behavioral Spot-Checks and Probe Execution

| Behavior | Command | Result | Status |
|---|---|---|---|
| Type check | `npx tsc --noEmit` | exit 0 | PASS |
| Full suite | `npx vitest run` | 108 files, 3971 tests passed | PASS |
| Leg 3 | `npm run compute-clean-window-recount` | pass=1440 fail=0 notAssessable=74, internal consistency OK, 3 fixtures MATCH | PASS |
| Leg 4 | `node scripts/compute-clean-window-before-state.mjs --pre-phase-dist <ebe0245c build>` | `BEFORE-STATE LEG: OK`, onlyInOld=0 onlyInNew=0 | PASS |
| Pair-identity probe (mine) | scratch script, pre-phase vs current pipelines vs diff text | 30/30 absolute and 15/15 ceiling pairs identical; 19/19 unrendered rank positions unchanged; newly demoted 372 | PASS |
| Working tree after all runs | `git status --short` | clean; scratch worktree removed | PASS |

Leg 4 is reachable in both directions: it went RED on the pre-fix artifact (52 disagreements, ceiling 15 vs 0) in plan 36-16, and I reproduced GREEN here. Leg 3 was shown red against a planted broken partitioner in 36-12.

### Requirements Coverage

| Requirement | Plans | Status | Evidence |
|---|---|---|---|
| PR-06 | 36-19, 36-20 (and 36-01..14) | SATISFIED | Truths 1, 2; row a PASS; REQUIREMENTS.md `[x]`/Complete |
| PR-07 | 36-17, 36-18, 36-19, 36-20 | SATISFIED | Rows b, c, f (carried), d2, e2, i, b2 PASS; code and tests confirmed above. The WR-04 clause rests on a unit test alone (see warnings) |
| PR-08 | 36-16, 36-19, 36-20 | SATISFIED | Truth 3; row g2 PASS |
| PR-09 | 36-15, 36-16, 36-17, 36-19, 36-20 | SATISFIED | Truth 4; re-signature on the corrected diff |

No orphaned IDs: PR-06..PR-09 are in plan frontmatter and in REQUIREMENTS.md, all `[x]`/Complete, consistent with the VALIDATION.md disposition table.

### Anti-Patterns

No TBD/FIXME/XXX in the phase's source files. No finding is a blocker.

## Judgement on the three round-2 review warnings

I judged these from the code and from my own probes, not from the reviewer's text. None undermines a must-have. One of them (WR-01) does mean the signed phrase "all four reconciliation legs are green" overstates the number of independent checks.

**Review WR-01, leg 2 is unfailable in `main()`: CONFIRMED, does not undermine PR-09.** `reconcileCounts` (`compute-clean-window-diff.mjs:452-488`) sums `newGuard === 'unreliable-segment'` and `contaminatedReason != null` across every kind of `changes`, and compares each to a walk of the same field over the same document. The classification never affects either sum, so it can only disagree on a degenerate document. Its only failing tests hand-build `changes` and `guardCounts` separately, which `main()` never does. Reachability: it cannot fail on any document the generator produces. So the signed claim is three effective legs plus one check that always passes. The claim it supports is nonetheless true, because the quantities it guards are covered independently elsewhere. Leg 4 derives newly demoted (372), unchanged, moved-but-ranked and owner-excluded from two fresh pipeline runs, not from the diff's own pass. Separately, I counted the live document's demotion guards myself: unreliable-segment 386, max-speed 3, ceiling 5, which match the Guard Counts table. The VALIDATION.md record already says legs 1 and 2 "share the diff generator's reconstruction" and that leg 4 is the only independent BEFORE-state leg, so the developer was not told leg 2 was independent. The PR-09 phrase "diff, guard counts, independent sweep" is satisfied by diff + (leg 4 and my recount of the guard counts) + leg 3, not by leg 2.

**Review WR-02, leg 4 checks only what the diff renders: CONFIRMED as a latent weakness, no live consequence.** The structural gap is real: leg 4 compares rank rows only at positions the artifact renders and reinstatements only as per-distance counts. I closed it empirically instead of relying on the structure. All 19 rank positions the diff omits are identical in the pre-phase and current documents. The reinstated pair sets match by identity (30/30 and 15/15). So the signed numbers and the listed pairs are correct on this archive. The weakness would only bite on a future regeneration, which is a hardening follow-up and not a gap in this phase's claim.

**Review WR-03, recount's narrowed rule is a deny-list: CONFIRMED fail-open, no live consequence.** I called `checkInternalConsistency` with planted data: `guard:'typo'` yields 0 violations, a demotion with no `guard` yields 0, `unreliable-segment` yields 1, and `ceiling` yields 0. Both the "typo" and "missing guard" cases pass when they should fail. The docblock states an allow-list, so code and contract disagree. On live data contaminated-and-demoted is 0 at every guard, so nothing shipped is wrong. It weakens the leg-3 internal-consistency evidence for future regenerations and should be fixed with the reviewer's allow-list.

Other limits, stated plainly:
- **Row d2** cannot discriminate the WR-04 contaminated-and-demoted clause on live data (count 0 at every distance). That clause rests on plan 36-18's unit test (`records-logic.test.ts:945`, three tests, including the disjointness assertion). I read the code and the tests, and they are sound.
- **Row f** was carried forward, not re-judged on the round-2 bundle. The "Ranked" copy path for a ranking effort is the unchanged branch of `ranks`, and b2 pins it on 3475740390@400m, so I accept the carry-forward.
- **Moved-but-ranked** is rendered as the first 50 of 1044 with an explicit "+994 more". It is not one of the four populations the criterion names, and the truncation is disclosed, so I treat it as informational.
- The diff's probe table reports measured 1044/7469/386 against the older scoping probe figures 1200/7352/439 as drift. Those are reference figures, not criteria, and the artifact says so.

## Recommended follow-up (non-blocking, any later phase or a `/gsd-quick`)

1. Switch the recount rule to the allow-list (world-record, max-speed, ceiling) with planted tests for a typo guard and a missing guard.
2. Make leg 2 compare a classification-dependent figure against an independent walk, or stop counting it as a leg in VALIDATION.md.
3. Add the unrendered-rank and pair-identity comparisons to leg 4.

None needs to hold the phase.

---

_Verified: 2026-11-25_
_Verifier: Claude (gsd-verifier)_
