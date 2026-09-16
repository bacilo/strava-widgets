---
phase: 28-pr-plausibility-ceiling
verified: 2026-09-16T13:00:00Z
status: gaps_found
score: 2/5 success criteria verified
overrides_applied: 0
gaps:
  - truth: "Criterion 3 — the pinned regression case (activity 4556693525's 400m effort, 45.2s/8.85 m/s) is demonstrated rejected as a permanent regression fixture, and the guard's effect is reported archive-wide via a dry-run count"
    status: failed
    reason: "CR-01 (28-REVIEW.md): the ceiling check is applied only to entries in Pass 1's `byDistance` accumulator, and owner-excluded efforts are `continue`d out before ever reaching `byDistance` — so an excluded effort's `demotion` can only ever be set by the world-record/max-speed guards (which run earlier, before exclusion is checked), never by the ceiling. In the live shipped `data/stats/best-efforts.json`, the pinned activity 4556693525's 400m effort (8.85 m/s, ceiling 5.1098 m/s) and its 1k effort (4.82 m/s, ceiling 4.7513 m/s) both exceed their ceiling yet carry `demotion: null` — independently re-confirmed in this session by walking the live document and comparing every effort's implied speed against `doc.ceilings[d].ceilingMps`. The regression test at compute-best-efforts.test.ts:759-773 does not catch this: it explicitly points `exclusionsPath` at a non-existent file with a comment stating this avoids 'a reachability trap' — i.e. it deliberately routes around the real committed exclusion entry for this exact activity rather than testing the real interaction, so the test proves the ceiling mechanism works in isolation but not that it fires for THIS pinned, already-excluded case as it actually ships. The would-be independent check (`scripts/compute-pr-ceiling-recount.mjs`) also cannot catch it: WR-05 (28-REVIEW.md) — `evaluateReport` computes `pinnedFixture.guardIsCeiling` and prints it but never adds it to `problems`, so the recount prints `guardIsCeiling=false` for the live archive and still reports overall PASS. Independently re-confirmed: re-ran the recount this session and its own output includes `guardIsCeiling=false` inside an otherwise-PASS report."
    artifacts:
      - path: "src/analytics/compute-best-efforts.ts"
        issue: "Pass 3 (lines ~364-396) only walks `byDistance`, which never contains owner-excluded efforts (they `continue` out of Pass 1 at lines ~286-290 before being added); no code path applies `ceilingDemotion` to an excluded effort."
      - path: "src/analytics/compute-best-efforts.test.ts"
        issue: "Lines 759-773: the pinned-fixture test uses a non-existent exclusions path specifically to avoid exercising the real (excluded) production state of activity 4556693525, so it cannot detect that the ceiling never actually rejects this activity in the shipped archive."
      - path: "scripts/compute-pr-ceiling-recount.mjs"
        issue: "`evaluateReport` (line ~301) never checks `demoted.pinnedFixture.guardIsCeiling` or walks every effort's implied speed against `doc.ceilings[d].ceilingMps`, so it cannot detect any owner-excluded, over-ceiling effort missing its ceiling demotion — undercutting the 'classifier-independent' verification D-15 requires."
    missing:
      - "Apply the ceiling check to every effort not already demoted by an absolute guard, regardless of `excludedFromRecords`, e.g. a post-Pass-3 sweep over every activity's efforts (28-REVIEW.md CR-01 supplies a concrete patch)."
      - "Add a regression fixture that uses a REAL exclusion entry for 4556693525 (not a missing-file dodge) and asserts `demotion.guard === 'ceiling'` for its 400m effort."
      - "Make `compute-pr-ceiling-recount.mjs`'s `evaluateReport` fail when `pinnedFixture.present && !pinnedFixture.guardIsCeiling`, and add a full independent sweep comparing every effort's implied speed to `doc.ceilings[d].ceilingMps` (WR-05)."
      - "Regenerate `data/stats/best-efforts.json` and `28-DIFF.md` after the fix and re-run the Round 1 checkpoint rows that depend on activity 4556693525 (R3), since its detail-view badge/mechanism will change."
  - truth: "Criterion 4 — for every ceiling-rejected effort, the effort remains visible with a stated demotion reason; absent only from the ranked PR list"
    status: failed
    reason: "Direct consequence of CR-01, independently reproduced in this session: 13 real efforts in the live shipped document exceed their distance's ceiling (`impliedSpeed > ceilings[d].ceilingMps`) yet carry `demotion: null` — 11 at 400m (3475711469, 3475711630, 3475715178, 3475726256, 3475727228, 3475732221, 3475735603, 14122328106, 4556693525, 5059204779, 5588316886) and 2 at 1k (3475725513, 4556693525). All 13 are `excludedFromRecords: true`. Their detail-view badge shows only 'Excluded — {reason}', with no mention that the effort also exceeds the personal ceiling — so these efforts are NOT 'always visible with a stated demotion reason' for the mechanism that, by the numbers, should have rejected them. This is a data-contract violation independent of ranking correctness (rankings themselves are unaffected, since exclusion alone already keeps these out of `byDistance`/rankings): `best-effort.types.ts` documents `demotion: null` as the correct PERMANENT value for 'an effort no guard rejected', which is now false for these 13."
    artifacts:
      - path: "data/stats/best-efforts.json"
        issue: "13 efforts (list above) have implied speed exceeding their distance's ceiling but `demotion: null` — confirmed by direct computation against the live committed file in this session."
      - path: "src/analytics/best-effort.types.ts"
        issue: "Documents `demotion: null` as meaning 'no guard rejected' this effort; false for the 13 efforts above."
    missing:
      - "Same fix as Criterion 3's gap (apply the ceiling check to excluded efforts too)."
  - truth: "Criterion 5 — the archive-wide diff is a reviewed, human-signed-off deliverable whose record count reconciles with the independently-derived ceiling-rejected count from criterion 3's dry run"
    status: failed
    reason: "The literal 18-vs-18 reconciliation between `28-DIFF.md` and `compute-pr-ceiling-recount.mjs`'s `byGuard.ceiling` figure does hold (re-confirmed independently in this session), but this is a self-agreeing check between two artifacts that share the same CR-01 blind spot: neither the diff generator nor the recount script detects the 13 real over-ceiling efforts CR-01 identifies, so '18' is not actually the true ceiling-rejected count — it is the count the flawed Pass-3 logic happens to produce, echoed by a checker with the identical blind spot. The developer's sign-off ('approved', 2026-09-16, bound to 28-DIFF.md's sha256) was given before CR-01/CR-02 were discovered by the same-day code review, so the sign-off was not informed of this discrepancy. This is exactly the self-agreeing-check failure mode 28-VALIDATION.md's own Manual-Only Verifications table cites the Phase 23 CR-01 lesson to guard against — it applies here to the automated reconciliation, not just to a hypothetical JSON-only manual check."
    artifacts:
      - path: ".planning/phases/28-pr-plausibility-ceiling/28-DIFF.md"
        issue: "Its 'ceiling-only' total (18) does not include the 13 real efforts CR-01 shows should also carry a ceiling demotion; the diff's reconciliation target is itself incomplete."
    missing:
      - "Re-derive `28-DIFF.md` after CR-01 is fixed and obtain a fresh developer sign-off against the corrected diff and corrected reconciliation count."
deferred: []
---

# Phase 28: PR Plausibility Ceiling Verification Report

**Phase Goal:** A personal plausibility ceiling, derived non-circularly from each athlete's own already-filtered effort history, demotes-and-flags implausible efforts from PR ranking — never deletes them — with an archive-wide before/after diff reviewed by a human before ship.

**Verified:** 2026-09-16
**Status:** gaps_found
**Re-verification:** No — initial verification

All evidence below was reproduced independently in this session (tests re-run, scripts re-executed, source read directly, live `data/stats/best-efforts.json` walked with hand-written arithmetic) rather than taken from SUMMARY.md, 28-VALIDATION.md, or 28-REVIEW.md claims on trust. `.planning/phases/28-pr-plausibility-ceiling/28-REVIEW.md` (code review, same day, `status: issues_found`, 2 critical / 6 warning / 5 info) was read in full and its two critical findings (CR-01, CR-02) were independently reproduced against the live archive before being weighed here. This VERIFICATION.md's initial draft (before CR-01/CR-02 were surfaced) scored the phase `passed`; that draft is superseded by this version.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, scored individually)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Three-pass structure is deterministic (no iteration to convergence) | ✓ VERIFIED | `src/analytics/compute-best-efforts.ts:329-396` has three literally-marked passes. `deriveCeilings(` appears exactly twice in the file (one comment, one real call site, line 347) — re-confirmed by `grep -c`. Re-ran independently: `-t "deterministic"` → 1 passed; `-t "no iteration to convergence"` → 1 passed, demonstrating an iterate-to-convergence variant strictly diverges while the shipped single-pass code matches the single-pass value. Full suite (79 files / 2286 tests) green, `npx tsc --noEmit` clean. Unaffected by CR-01/CR-02 (both are about which population the ceiling *check* applies to, not the pass structure or the ceiling's own derivation determinism). |
| 2 | Ceiling derived non-circularly (from Pass 1's already-filtered population only) | ✓ VERIFIED | `byDistance` (Pass 1) only receives efforts where `effort.demotion === null` AND `!isExcluded(...)` — built before any ceiling exists; Pass 2 reads only `byDistance`. Re-ran `-t "non-circular"` independently → 1 passed. `best-effort-ceiling.ts` re-verified pure (no fs/path/process/while outside comments). CR-01 does not touch this — the *derivation's input population* is correctly filtered; the bug is entirely in Pass 3's *application* of the resulting ceiling value, which never reaches excluded efforts at all (neither correctly nor incorrectly influencing the derived ceiling itself). |
| 3 | Pinned regression case (4556693525, 45.2s/8.85 m/s) demonstrated rejected as a permanent regression fixture; guard's effect reported via 662-cohort dry run | ✗ FAILED | **CR-01, independently reproduced this session:** the live shipped `data/stats/best-efforts.json` shows activity `4556693525`'s 400m effort at implied speed 8.8496 m/s against a 5.1098 m/s ceiling — and its 1k effort at 4.8216 m/s against a 4.7513 m/s ceiling — both with `demotion: null`, both `excludedFromRecords: true`. The pinned case does **not** hold in production: the effort this criterion names is not, in fact, rejected by the ceiling in the shipped archive. The regression test (`compute-best-efforts.test.ts:759-773`) does not detect this because it deliberately substitutes a non-existent exclusions file instead of the real committed exclusion entry for this activity, by its own comment's admission, to dodge "a reachability trap." The archive-wide dry-run count this criterion also requires (`compute-pr-ceiling-recount.mjs`) computes `pinnedFixture.guardIsCeiling` but never uses it in `evaluateReport` (confirmed by reading the function) — so the script reports overall PASS while its own printed line reads `guardIsCeiling=false` for this exact pinned activity. See gap #1 in frontmatter. |
| 4 | Rejected efforts demoted, never deleted; visible in detail view with stated reason; code audit confirms no delete path | ✗ FAILED | The never-delete / append-only invariant itself IS sound (`auditNoDemotedEffortRemoved` re-run independently, passes against the real document and is demonstrated failing against a delete-mutated copy). **But** "for every ceiling-rejected effort... a stated demotion reason" fails: independently walking the live `data/stats/best-efforts.json` in this session found **13 efforts** whose implied speed exceeds their distance's ceiling yet carry `demotion: null` (11 at 400m, 2 at 1k — full id list in gap #2). These efforts show only an "Excluded" badge on the detail view, with no ceiling-related reason at all, even though by the ceiling's own numbers they should be flagged. This is CR-01's direct consequence: the ceiling check never runs on owner-excluded efforts, so whether an over-ceiling excluded effort gets ANY demotion depends entirely on whether an earlier absolute guard (world-record/max-speed) happened to also reject it — an inconsistency with how the other two guards behave (they DO run on excluded efforts, since exclusion is checked after `computeActivityEfforts`). |
| 5 | Archive-wide diff generated, human-reviewed and signed off; reconciles with criterion 3's dry-run count | ✗ FAILED | `28-DIFF.md`'s ranking content (which activities enter/exit top-10, `wasPRAtTheTime` flips) is unaffected by CR-01, since exclusion alone already keeps the 13 affected efforts out of rankings regardless of demotion status — re-confirmed idempotent this session, sha256 matches the signed-off hash. However, the criterion's required reconciliation — "record count reconciles with the independently-derived ceiling-rejected count from criterion 3's dry run" — is compromised: the diff's stated "18 ceiling-only" total and the recount's `byGuard.ceiling: 18` agree with EACH OTHER (re-confirmed this session) but neither one detects the 13 additional efforts CR-01 shows should also carry a ceiling demotion (WR-05: the recount's own pinned-fixture check is computed but never wired into its pass/fail verdict). Two artifacts sharing one blind spot agreeing with each other is exactly the self-agreeing-check failure the project's own Phase 23 CR-01 lesson (cited elsewhere in 28-VALIDATION.md) exists to catch — it applies to this automated reconciliation, not only to a hypothetical manual JSON read. The developer's sign-off ("approved", 2026-09-16) was given before the code review that found CR-01/CR-02 landed the same day, so it was not made with knowledge of this gap. |

**Score:** 2/5 success criteria verified. 3/5 FAILED (all three trace to one root cause, CR-01, plus a contributing factor, CR-02, on criterion 5's trustworthiness).

### Root Cause

**CR-01 (28-REVIEW.md, independently reproduced):** In `src/analytics/compute-best-efforts.ts`, Pass 1 removes an owner-excluded effort from consideration (`continue`, before it reaches the `byDistance` accumulator that feeds the ceiling) — correct for keeping the *derivation's input population* clean (PR-02), but Pass 3 then ONLY applies `ceilingDemotion` to entries still inside `byDistance`. An excluded effort therefore never has its own speed compared against the derived ceiling at all. The world-record and max-speed guards do not have this gap (they run inside `computeActivityEfforts`, before the exclusion check happens in the outer loop), so the same effort's demotion status today depends on which guard would have caught it — an inconsistency the demotion data model (`EffortDemotion`, D-10) was specifically designed to prevent duplicating.

Verified directly against the live archive in this session (not taken from 28-REVIEW.md's word):

```
count of (impliedSpeed > ceiling AND demotion === null): 13
  400m (11): 3475711469, 3475711630, 3475715178, 3475726256, 3475727228,
             3475732221, 3475735603, 14122328106, 4556693525, 5059204779, 5588316886
  1k (2):    3475725513, 4556693525
  all 13 have excludedFromRecords: true
```

**CR-02 (28-REVIEW.md, independently reproduced):** `src/dashboard/views/records-logic.ts:225-235` (`resolvePrTableDemotionNote`) and its empty-state counterpart attribute the FULL all-guard `countDemotedAtDistance` count to "the plausibility ceiling." At 400m the shipped copy would read "36... demoted by the plausibility ceiling" when only 8 of the 36 are ceiling demotions (18 world-record, 10 max-speed — re-confirmed via this session's own `compute-pr-ceiling-recount.mjs` run). This does not independently fail any of the 5 named success criteria (none specify the Records screen's aggregate note must attribute cause per-guard — criterion 4 is about the per-effort detail-view reason, which IS guard-accurate for efforts that do carry a demotion), but it materially weakens confidence in criterion 5's "reviewed by a human before ship" language: the same-session code review found this misleads the reader about which mechanism did what, on a screen a reviewer would plausibly consult while forming their sign-off judgment.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/analytics/compute-best-efforts.ts` | Three-pass shape, single shared demotion path, ceiling applied to every non-absolute-guard-demoted effort | ⚠️ PARTIAL | Pass structure and determinism sound (Criteria 1/2 VERIFIED). Ceiling application incomplete: skips owner-excluded efforts (CR-01). |
| `src/analytics/compute-best-efforts.test.ts` | Determinism, no-iteration, non-circularity, pinned-fixture, no-delete-audit coverage | ⚠️ PARTIAL | Determinism/non-circularity/no-delete suites sound and green. The pinned-fixture suite (4556693525) does not exercise the real production exclusion state, so it cannot catch CR-01. |
| `scripts/compute-pr-ceiling-recount.mjs` | Classifier-independent recount that would catch a ceiling regression | ⚠️ PARTIAL | Runs clean and reproducible (exit 0), but `evaluateReport` does not fail on `guardIsCeiling === false` for the pinned fixture, nor does it sweep every effort for over-ceiling-but-null-demotion cases (WR-05) — so it cannot detect CR-01, undercutting its "classifier-independent verifier" purpose. |
| `.planning/phases/28-pr-plausibility-ceiling/28-DIFF.md` | Archive-wide before/after diff, idempotent, human-signed-off | ✓ Mechanically sound, ⚠️ built on the CR-01-affected document | Idempotent and hash-matched (re-verified). Content is internally consistent but the underlying `best-efforts.json` it summarizes has the CR-01 gap; a corrected re-generation is required after the fix. |
| `src/dashboard/views/records-logic.ts` | Demoted-count-aware empty/short-table copy | ⚠️ STUB-adjacent (misattribution) | `resolvePrTableDemotionNote`/`resolvePrTableEmptyState` present and unit-tested, but the copy attributes all-guard counts to "the plausibility ceiling" specifically (CR-02). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Pass 1 `byDistance` accumulator | Pass 2 `deriveCeilings` | single call, no loop | ✓ WIRED | Confirmed by source read + grep count. |
| Derived ceiling (`ceilings[d]`) | every effort's demotion status | `ceilingDemotion` applied per effort | ✗ NOT_WIRED for excluded efforts | Only applied to `byDistance` survivors (non-excluded); confirmed by source read and by 13 counter-examples in the live document. |
| `28-DIFF.md` | `compute-pr-ceiling-recount.mjs` | ceiling-only total (18) reconciled against `byGuard.ceiling` (18) | ⚠️ PARTIAL — numerically agrees, but both share CR-01's blind spot | Reproduced both numbers independently; agreement does not establish correctness given WR-05. |
| `effort.demotion` | Detail-view badge (`prFlagBadgeSpecs`) | `visibleText: Demoted — ${row.demotionReason}` | ✓ WIRED for efforts that DO carry a demotion | Confirmed by source read; does not fire for the 13 CR-01 efforts because they carry no demotion at all. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Determinism | `npx vitest run compute-best-efforts.test.ts -t "deterministic"` | 1 passed | ✓ PASS |
| No iteration to convergence | `npx vitest run compute-best-efforts.test.ts -t "no iteration to convergence"` | 1 passed | ✓ PASS |
| Non-circularity | `npx vitest run compute-best-efforts.test.ts -t "non-circular"` | 1 passed | ✓ PASS |
| Full file suite | `npx vitest run compute-best-efforts.test.ts` | 41/41 passed | ✓ PASS |
| Whole-repo regression | `npm test` | 79 files / 2286 tests passed | ✓ PASS (does not include a test that fails for CR-01 — no test currently asserts an excluded, over-ceiling effort gets a ceiling demotion) |
| Type check | `npx tsc --noEmit` | clean | ✓ PASS |
| Classifier-independent recount | `node scripts/compute-pr-ceiling-recount.mjs` | exit 0, "PASS" banner, but its own printed line shows `guardIsCeiling=false` for the pinned fixture | ⚠️ PASSES BUT DOES NOT CATCH CR-01 |
| Direct arithmetic check of live archive (this session, ad hoc) | walk `data/stats/best-efforts.json`, compare every effort's implied speed to `ceilings[d].ceilingMps` | 13 efforts exceed ceiling with `demotion: null` | ✗ FAIL — confirms CR-01 |
| Dashboard artifact/build integrity | `npm run verify-dashboard` | 64/64 checks passed | ✓ PASS (does not check demotion correctness) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| PR-01 | 28-05, 28-06 | Strict three-pass shape, deterministic CI output | ✓ SATISFIED | Verified above (Criterion 1); unaffected by CR-01/CR-02. `REQUIREMENTS.md` still shows this unticked (deliberately left for this verification per 28-09-SUMMARY.md) — this verifier's evidence supports ticking it. |
| PR-02 | 28-01, 28-03, 28-05 | Ceiling derived from already-filtered population, never raw archive | ✓ SATISFIED | Verified above (Criterion 2); unaffected — the derivation's input population is correctly filtered, independent of the Pass-3 application bug. Also left unticked in `REQUIREMENTS.md`, deliberately, per the same note; this verifier's evidence supports ticking it. |
| PR-03 | 28-02, 28-03, 28-04, 28-05 | Effort exceeding ceiling flagged/demoted, never deleted, always visible with reason | ✗ NOT SATISFIED — RE-OPEN | `REQUIREMENTS.md` currently shows this ticked `[x]`, citing 28-09's Round 1 Checkpoint (2026-09-16, blanket "approved"). That checkpoint did not have visibility into CR-01 (found by the same-day code review after the checkpoint ran) — it verified the mechanism using non-excluded ceiling-demoted activities (e.g. `3475712118`) and one excluded-but-not-ceiling activity (`4556693525`), correctly reading what each currently displays, but did not know the latter SHOULD also carry a ceiling demotion. This verification finds PR-03's "always visible with the reason it was demoted" clause false for 13 real efforts. Recommend re-opening this tick pending the CR-01 fix. |
| PR-04 | 28-06, 28-07, 28-08 | Archive-wide before/after diff produced and human-reviewed before ship | ⚠️ SATISFIED MECHANICALLY, RECOMMEND RE-SIGN-OFF | Diff generation/idempotence/hash-binding all sound and re-verified. The sign-off itself predates CR-01/CR-02's discovery; recommend a fresh sign-off once the diff is regenerated against the corrected computation. |
| PR-05 | 28-01, 28-03, 28-05, 28-08 | Sharpened guard validated archive-wide (662-cohort), pinned fixture rejected | ✗ NOT SATISFIED — RE-OPEN | `REQUIREMENTS.md` ticked, with an existing disclosed caveat about the pinned fixture's live-archive state (that it's excluded, not ceiling-demoted). This verification found that caveat understates the actual defect: it is not merely that a different mechanism keeps the activity off rankings — the ceiling guard itself has a structural hole (CR-01) that silently skips every owner-excluded effort archive-wide (13 known instances), and the dry-run count meant to validate the guard's effect (`compute-pr-ceiling-recount.mjs`) cannot detect this (WR-05). Recommend re-opening this tick pending the CR-01 fix and a corrected dry-run verdict. |

**Orphan check:** all five PR-* requirements map to at least one Phase 28 plan's `requirements:` frontmatter field; none are orphaned.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/analytics/compute-best-efforts.ts` | ~286-298 (Pass 1 exclusion `continue`), ~364-396 (Pass 3 survivors loop) | CR-01: ceiling check silently skipped for owner-excluded efforts | 🛑 BLOCKER | Fails Criteria 3, 4, and materially weakens Criterion 5's trustworthiness. See gaps in frontmatter. |
| `src/dashboard/views/records-logic.ts` | 225-235 (`resolvePrTableDemotionNote`), 190-218 (`resolvePrTableEmptyState`) | CR-02: all-guard demotion count mislabeled as ceiling-caused | ⚠️ WARNING | Does not independently fail a named success criterion, but weakens confidence in the human-review process underlying Criterion 5 and is user-facing misinformation about which mechanism acted. |
| `scripts/compute-pr-ceiling-recount.mjs` | `evaluateReport` (~line 301) | WR-05: computed `pinnedFixture.guardIsCeiling` never gates the pass/fail verdict | ⚠️ WARNING | The "classifier-independent" verifier cannot actually catch a ceiling regression on excluded efforts, including the one this phase pins as its permanent regression fixture. |
| `scripts/compute-pr-ceiling-calibration.mjs` | `buildFilteredPopulations` (57-97) | WR-03: stale pre-D-08 assumption that `efforts` is already guard-filtered; regenerating today would silently shift the published ceiling numbers | ℹ️ INFO/WARNING | Not currently shipping wrong (the committed `28-CEILING-CALIBRATION.md` predates D-08's shape change and was not regenerated), but a future regeneration would drift; also poses a real risk if a future world-record-guard rejection appears at 5k/10k/half (per 28-REVIEW.md WR-03). |
| `src/dashboard/styles.css` | 385-388 | WR-02: `.badge--demoted` fails WCAG AA contrast in dark theme (2.87:1 / 3.29:1 vs. 4.5:1 required) | ⚠️ WARNING | Accessibility defect on the new demoted-badge styling; not one of the 5 named criteria but relevant to PR-03's "always visible" spirit for low-vision users. |
| Multiple (see 28-REVIEW.md IN-01 through IN-05) | — | Stale comments/strings post-D-08, inconsistent "excluded" wording in screen-reader text, minor null-guard inconsistency in the recount script, an un-cleaned temp directory, a purity-boundary weakening in `records-logic.ts`'s import graph | ℹ️ INFO | Non-blocking; listed for completeness, not re-litigated here (see 28-REVIEW.md for details and fixes). |

No TBD/FIXME/XXX/HACK/PLACEHOLDER debt markers found in phase-modified files.

### Human Verification Required

None additional beyond what 28-VALIDATION.md's Round 1 Checkpoint already exercised (browser-based reads of R1-R7, all recorded with the developer's own verbatim verdicts). However, given CR-01/CR-02 postdate that checkpoint, the following should be re-run once the fix lands, since the on-screen state of the activities involved will change:

1. **R3 re-check.** Activity `4556693525`'s detail view currently shows only "Excluded — bad measurement." After the CR-01 fix, this effort's 400m (and 1k) rows should additionally show a ceiling-demotion reason (or the exclusion badge should be paired with the demotion the effort now also carries). Re-verify this on-screen once fixed.
2. **R6 wording re-check.** After CR-02 is addressed, re-verify the 400m Records-table note's wording matches whatever attribution scheme is chosen (guard-neutral copy or ceiling-only count).
3. **Fresh PR-04 sign-off.** Once `28-DIFF.md` is regenerated against the corrected `best-efforts.json`, the developer should re-read and re-sign the diff, since the current sign-off predates the CR-01/CR-02 discovery.

### Gaps Summary

Phase 28's core architectural claims — the strict three-pass shape, the non-circular ceiling derivation, and the never-delete/append-only invariant — are all independently verified and sound (Criteria 1, 2, and half of Criterion 4 hold up under direct re-testing and direct arithmetic against the live archive).

However, a same-day code review (`28-REVIEW.md`, `status: issues_found`) found, and this verification independently reproduced against the live committed `data/stats/best-efforts.json`, a structural gap: the ceiling guard is never applied to owner-excluded efforts (CR-01). Thirteen real efforts in the live archive exceed their distance's ceiling yet carry `demotion: null`, including — critically — the exact activity (`4556693525`) this phase pins as its permanent regression fixture for Criterion 3/PR-05. The regression test guarding this case avoids the real production interaction by construction (uses a non-existent exclusions file), and the independent classifier-free recount script computes but never acts on the one check that would have caught this (`pinnedFixture.guardIsCeiling`).

A second, related finding (CR-02) shows the Records screen's demotion-count copy misattributes non-ceiling (world-record/max-speed) demotions to "the plausibility ceiling" — a real but narrower defect that does not independently fail a named criterion but weakens confidence in the human-review chain underlying Criterion 5.

Net effect: Criteria 3, 4, and 5 do not hold as written against the live shipped archive today, despite the Round 1 human checkpoint's blanket "approved" — that checkpoint ran before CR-01/CR-02 were found and could not have weighed them. This is a genuine architectural gap requiring a code fix (28-REVIEW.md CR-01 supplies a concrete patch), not a documentation or wording issue, and not something an override can responsibly paper over given it touches the phase's own named pinned regression case.

**Recommended path:** apply CR-01's fix (extend the ceiling check to every effort not already absolute-guard-demoted, regardless of exclusion status), correct the pinned-fixture test to use the real exclusion entry, wire `guardIsCeiling` into the recount's verdict (WR-05), decide and apply a CR-02 copy fix, regenerate `best-efforts.json` and `28-DIFF.md`, and obtain a fresh developer sign-off before re-verifying.

---

_Verified: 2026-09-16_
_Verifier: Claude (gsd-verifier)_
