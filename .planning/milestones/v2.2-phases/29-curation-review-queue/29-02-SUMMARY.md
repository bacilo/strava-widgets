---
phase: 29-curation-review-queue
plan: 02
subsystem: testing
tags: [vitest, verify-dashboard-publish, curation-guard, regex-pin, http-404]

# Dependency graph
requires:
  - phase: 24-local-curation-mode
    provides: the shipped publish verifier and its planted-fixture guard-test suite this plan extends
provides:
  - Two new literal expect404 assertions in verify-dashboard-publish.mjs for /__curate/queue and /__curate/queue.js (D-17)
  - Case E/F planted-fixture proofs in verify-dashboard-publish-guard.test.mjs, observed RED before the fix and GREEN after
  - Case A extended to require both new success lines in the same clean run
  - IN-18: curation-seam.test.ts's WR-17 pin converted from a brittle literal toContain to a format-robust regex match, with inline positive/negative discriminator proofs
affects: [29-curation-review-queue remaining plans that add the queue's server routes and client, which this plan's guard now polices]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard extension must be observed RED before the fix lands (D-19) — Cases E/F failed against the unextended verifier before Task 2's fix made them pass"
    - "Regex-shape source-structure pins (whitespace/newline-tolerant, identifiers still pinned) proven with an inline reflowed-positive and wrong-identifier-negative sample, without touching the production file the pin targets"

key-files:
  created: []
  modified:
    - scripts/verify-dashboard-publish.mjs
    - scripts/verify-dashboard-publish-guard.test.mjs
    - src/dashboard/curation-seam.test.ts

key-decisions:
  - "D-17: verify-dashboard-publish.mjs gets one explicit literal 404 assertion per new path (/__curate/queue and /__curate/queue.js), never a prefix match — extends the existing three-item list to five, comment updated to note Phase 29"
  - "D-19 (HTTP half): planted-fixture Cases E/F prove the new assertions RED when the paths are served and GREEN when absent"
  - "IN-18: curation-seam.test.ts's WR-17 literal-string pin converted to the same regex shape the identifier-comparison test two blocks below already used"

patterns-established:
  - "A guard test extension goes RED against the unmodified production file before the production fix lands, in its own commit — makes the guard's own increase in coverage demonstrable, not merely asserted"

requirements-completed: [CUR-03]

# Metrics
duration: ~30min
completed: 2026-09-18
---

# Phase 29 Plan 02: HTTP Guard Coverage for the Review Queue Routes Summary

**Extended the shipped `verify-dashboard-publish.mjs` with two literal 404 assertions for `/__curate/queue` and `/__curate/queue.js`, proven failing under a planted leak before the fix and passing after, plus converted `curation-seam.test.ts`'s WR-17 literal pin to a reflow-tolerant regex.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-18T09:00:00Z (approx.)
- **Completed:** 2026-09-18T09:20:13Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `scripts/verify-dashboard-publish.mjs` now asserts a literal 404 for both new curation review-queue routes, extending the existing three-item explicit list to five (no prefix/wildcard match, per the file's own stated convention).
- `scripts/verify-dashboard-publish-guard.test.mjs` gained Case E (planted queue page) and Case F (planted queue bundle), both observed failing against the unextended verifier before Task 2's fix and passing after; Case A extended to require both new `✓ GET /__curate/queue... -> 404` lines in the same clean run.
- Folded todo IN-18 landed: `curation-seam.test.ts`'s two brittle `toContain` literal-argument pins (WR-17) are now regex-shape matches identical in spirit to the identifier-comparison pin already used two blocks below, each carrying its own inline reflowed-positive and wrong-identifier-negative proof.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Case E/F and extend Case A — observed RED** - `d18ce4ca` (test)
2. **Task 2: Add the two literal expect404 assertions (D-17)** - `cb21d3ef` (feat)
3. **Task 3: IN-18 — convert the WR-17 literal pin to a regex-shape pin** - `571bf446` (fix)

_No plan-metadata commit in this file — SUMMARY.md and REQUIREMENTS.md are committed together per the worktree parallel-execution protocol; STATE.md/ROADMAP.md are owned by the orchestrator._

## Files Created/Modified

- `scripts/verify-dashboard-publish.mjs` - two new literal `expect404` lines for `/__curate/queue` and `/__curate/queue.js`; comment extended to note Phase 29
- `scripts/verify-dashboard-publish-guard.test.mjs` - Case E/F planted-fixture proofs; Case A extended to assert five `✓` lines instead of three
- `src/dashboard/curation-seam.test.ts` - WR-17's two literal pins converted to regex-shape pins with inline positive/negative discriminator samples

## Decisions Made

- Followed D-17/D-19/IN-18 exactly as scoped in `29-CONTEXT.md`. No new decisions required during execution — the plan's `read_first`/`action` blocks were precise enough that no ambiguity arose.

## Deviations from Plan

None - plan executed exactly as written.

One environment-setup step not explicit in the plan's tasks but required to make its own verification commands meaningful: this worktree had no `data/stats/` or `data/dashboard/` (both gitignored, generated artifacts) checked out, so `dist/widgets` built without `data/dashboard/index.json` and the guard suite reported `FATAL: dist/widgets is not fully built` rather than exercising the real assertions. Copied both directories from the parent checkout (read-only reuse of already-committed-elsewhere generated data, no source change) and re-ran `npm run build-widgets`, after which the guard suite ran for real (not skipped) as the plan's context block requires ("a skipped guard proves nothing and must not be reported as green"). Not logged as a Rule 1-3 auto-fix because it touched no file in this plan's `files_modified` list and made no code change — pure local-environment setup to exercise the existing build pipeline.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Criterion 3 (both guards discriminating in both directions on the new routes) is closed for the HTTP half: `npx vitest run scripts/verify-dashboard-publish-guard.test.mjs` exits 0 (7/7, block executed not skipped), `npm run verify-dashboard` exits 0 with five `✓ GET /__curate/... -> 404` lines, and `test ! -e dist/widgets/__curate` holds after every run.
- `src/dashboard/curation-seam.test.ts` passes 84/84 with `detail.ts` and `detail-sections.ts` untouched; the D-06 zero-`__curate`-occurrence pins still hold.
- The build-time half of Criterion 3 (D-18's `findCurationArtifacts` proof and the IN-17 fix) is out of this plan's scope — tracked for a sibling plan against `scripts/lib/curation-guard.mjs` and `scripts/lib/curation-guard.test.mjs`, per this plan's declared `files_modified` boundary.
- No blockers for downstream plans that add the queue's actual server routes (`GET /__curate/queue`, `GET /__curate/queue.js`) and client — this plan's extended verifier will immediately start failing (correctly) the moment those routes are wired to serve real content, which is the intended discriminating behavior until D-06's "outside the publish graph" placement is honored by that later plan.

---
*Phase: 29-curation-review-queue*
*Completed: 2026-09-18*
## Self-Check: PASSED

- FOUND: .planning/phases/29-curation-review-queue/29-02-SUMMARY.md
- FOUND: d18ce4ca (test)
- FOUND: cb21d3ef (feat)
- FOUND: 571bf446 (fix)
- FOUND: f352d75a (docs)

