---
phase: 37-review-queue-priority-cur-04
plan: 06
subsystem: curate-queue-ui
tags: [curation, reviewed-and-kept, queue-ui, transport, fingerprint-contract]
requires: ["37-02", "37-04"]
provides:
  - "saveReviewed, removeReviewed, loadReviewedDoc in curate-overlay/index.ts; describeFailure 409 branch"
  - "queue page: four views, review and un-review controls, orphans, per-view summary, notes, tier/metres display"
  - "client/server fingerprint contract test"
affects: [37-07]
tech-stack:
  added: []
  patterns: ["single transport module", "source-text discipline (textContent, one className, no route literals)", "contract test with injectable fingerprint function"]
key-files:
  created: []
  modified:
    - scripts/curate-overlay/index.ts
    - scripts/curate-overlay.test.mjs
    - scripts/curate-queue/index.ts
    - scripts/curate-queue.test.mjs
key-decisions:
  - "Active view persists as location.hash #view=<name>; unknown or absent falls back to To review (A4)"
  - "Changed rows offer Review again plus Un-review and no exclude control (A6)"
  - "A null reviewed doc renders every row as not reviewed with a visible note"
requirements-completed: []
completed: 2026-11-25
---

# Phase 37 Plan 06: Review-queue UI and reviewed transport Summary

The queue page now renders four views (To review, Reviewed, Excluded, All) with per-view counts, tier and contaminated-metres lines, a blank-required review control, confirm-guarded un-review, changed-since-review marking and orphans, all through the overlay's single transport module.

## Commits

- b9d22a72: reviewed transport (saveReviewed, removeReviewed, loadReviewedDoc, 409 sentence)
- d77dd156: queue views, controls, orphans, notes, tests incl. fingerprint contract
- a3911c60: removed a `/__curate` literal from a header comment (acceptance grep is raw, so it must be 0)

## Verification

- Quick run (curate-queue dir, curate-queue, curate-server, curate-overlay, curation-guard tests): 6 files, 286 tests pass.
- Both bundles build: "overlay bundled", "queue bundled".
- `fetch('/strava-widgets/data/` count in queue: 3; `/__curate` count: 0; `saveReviewed(` call sites: 1; `className =`: 1; derive-flagged.mjs untouched (`git diff --exit-code` clean).
- Gestures are not claimed here; plan 37-07 verifies them in a browser.

## Reachability evidence (D-19), each mutation applied alone, reverted, GREEN after

Task 1 (curate-overlay.test.mjs, 20 tests after revert):

| Mutation | RED test | GREEN after revert |
|----------|----------|--------------------|
| (a) 409 branch removed | describeFailure has a 409 branch that carries the server body text | yes (20/20) |
| (b) third module-scope `addEventListener` | index.ts registers exactly two module-scope listeners | yes |
| (c) saveReviewed URL segment changed to /exclusions/ | saveReviewed PUTs reason and fingerprint to the reviewed route; the saveReviewed body does not reference /exclusions | yes |
| (d) removeReviewed method DELETE to PUT | removeReviewed uses DELETE on the reviewed route and reloads | yes |
| (e) try/catch removed from loadReviewedDoc | loadReviewedDoc GETs the reviewed route, returns null on !ok, and never throws | yes |

Row (d) needed a rerun: the first attempt edited removeExclusion (wrong function) and stayed green, which showed the mutation target, not a test gap. Re-targeted at removeReviewed, it went RED.

Task 2 (curate-queue.test.mjs, 24 tests after revert):

| Mutation | RED test | GREEN after revert |
|----------|----------|--------------------|
| (a) second saveReviewed call | saveReviewed( has exactly one call site | yes (24/24) |
| (b) confirm guard removed | removeReviewed( is called only after a confirm( inside its own function | yes |
| (c) `reviewReasonInput.value = 'x'` | the review reason textarea is never assigned a value and the reason is trimmed | yes |
| (d1) 'unreliable-segment' | never references a pace-quality signal | yes |
| (d2) 'transportedCount' | never references a pace-quality signal | yes |
| (d3) 'pauseClassification' | never references a pace-quality signal | yes |
| (d4) 'Select all' | has no select-all or bulk affordance | yes |
| (d5) 'Review all' | has no select-all or bulk affordance | yes |
| (d6) 'bulk' | has no select-all or bulk affordance | yes |
| (d7) '/__curate/reviewed' | contains no reviewed route literal | yes |
| (d8) 'location.reload(' | contains no second write call site and no reload of its own | yes |
| (e) spaced-fingerprint wrapper in the contract test (`-t contract` matched 4 tests, 20 skipped) | contract: every guard x distance x transported combination is accepted unchanged | yes (4 passed) |

The contract check also carries its own can-fail test (a spaced fingerprint is rejected), and the live-archive block ran (not skipped).

## Deviations from Plan

- [Rule 3] The header comment in `curate-queue/index.ts` named the served route, which made the raw `grep -c "/__curate"` acceptance check 1. The comment was reworded in a3911c60.
- The queue test file now imports `normalizeFingerprint` from `curate-server.mjs` (import is side-effect free, guarded by an isMain check) and `fingerprintFor`/`deriveFlaggedActivities` from derive-flagged. Nothing in derive-flagged was edited.
- Prettier was not run on the edited files.

No auth gates, no package installs.

## Known Stubs

None.

## Threat Flags

None beyond the register. T-37-25 (textContent only, forbidden-token tests), T-37-26 (no route literal, writes via the imported transport), T-37-27 (null reviewed doc note), T-37-28 (contract test) and T-37-29 (confirm slice test) each have a test above.

## Requirements

CUR-04 and CUR-06 are deliberately NOT ticked: plan 37-07's human checkpoint still judges both.

## Self-Check: PASSED

Files present: scripts/curate-overlay/index.ts, scripts/curate-overlay.test.mjs, scripts/curate-queue/index.ts, scripts/curate-queue.test.mjs. Commits b9d22a72, d77dd156, a3911c60 in git log.
