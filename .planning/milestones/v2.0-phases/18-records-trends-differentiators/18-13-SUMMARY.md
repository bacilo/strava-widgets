---
phase: 18-records-trends-differentiators
plan: 13
subsystem: ui
tags: [dashboard, detail-view, best-efforts, age-grading, dom, vitest]

requires:
  - phase: 18-04
    provides: Shared badge/format helpers in list.ts (appendBadge, formatEffortDuration)
  - phase: 18-09
    provides: buildExclusionReasonIndex from records-logic.ts, reused for per-activity exclusion reasons
  - phase: 18-02
    provides: WMA age-grading factor tables and lookup module behind age-grade values
provides:
  - Named per-distance PR badges in the activity detail header
  - "Best Efforts This Run" panel listing every distance the run produced an effort for
  - Per-activity best-efforts shard files so the detail view never fetches the archive-wide document
  - Client-side age-grading document reader with degrade-to-null semantics
affects: [detail-view, dashboard-data-clients, publish-pipeline]

tech-stack:
  added: []
  patterns:
    - "Sibling data client rather than extending a client with hard-asserted fetch-sequence tests"
    - "Per-activity shard files to avoid shipping an archive-wide document to a single-activity view"
    - "Supplementary content mounted without awaiting, so it never delays the synchronous primary render"

key-files:
  created:
    - src/dashboard/data/age-grading-client.ts
    - src/dashboard/data/age-grading-client.test.ts
    - src/dashboard/data/best-efforts-client.ts
    - src/dashboard/data/best-efforts-client.test.ts
    - src/dashboard/views/detail-best-efforts-logic.ts
    - src/dashboard/views/detail-best-efforts-logic.test.ts
  modified:
    - src/dashboard/views/detail-sections.ts
    - src/dashboard/views/detail.ts
    - src/analytics/compute-best-efforts.ts
    - scripts/build-widgets.mjs

key-decisions:
  - "Implemented per-activity best-efforts reads as a sibling client (best-efforts-client.ts) instead of editing detail-client.ts, because detail-client's suite hard-asserts an exact 2-URL fetch sequence across ~10 tests"
  - "Extended compute-best-efforts.ts to emit per-activity shards under data/stats/best-efforts/{id}.json so the detail view never fetches the 2.9 MB archive-wide document (T-18-AVAIL-04)"
  - "Mounted badges and the panel via one guarded Promise.all fired without awaiting, so supplementary content never delays the stats/route/chart/splits render"
  - "Resolved per-activity exclusion reasons by reusing records-logic.ts's buildExclusionReasonIndex against the already-published data/best-effort-exclusions.json rather than duplicating the logic"

patterns-established:
  - "Degrade-to-null data clients: a missing or malformed document yields null rather than throwing, and enabled:false parses successfully so callers can read disabledReason (D-13)"
  - "copyJsonTree in build-widgets.mjs recurses one level into data subdirectories, so sharded output directories reach the published site"

requirements-completed: [REC-04, REC-06]

duration: ~55min
completed: 2026-08-11
---

# Phase 18 Plan 13: Detail Best Efforts & PR Badges Summary

**The activity detail view now names which PRs a run set and lists every distance it produced an effort for, reading a small per-activity shard instead of the archive-wide best-efforts document.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-11
- **Tasks:** 3 of 3
- **Files modified:** 10 (6 created, 4 modified)

## Accomplishments

- Named per-distance PR badges in the activity header, built on 18-04's shared `appendBadge` helper rather than new badge code.
- A "Best Efforts This Run" panel — Distance | Time | Pace | Age-Grade | PR? — with permanent `.pr-table__row--pr` highlighting on PR-setting rows, a named empty state when a run produced zero qualifying efforts, and the 1k interpolation footnote whenever any row carries an age-grade.
- Per-activity best-efforts shards (`data/stats/best-efforts/{id}.json`), so opening one run no longer implies fetching the 2.9 MB archive-wide `best-efforts.json` (T-18-AVAIL-04).
- An age-grading client that degrades to null on a missing or malformed document, while still parsing `enabled: false` successfully so the detail view can surface `disabledReason` (D-13).

## Task Commits

1. **Task 1: Age-grading client and per-activity best-efforts derivation** — `4ea3544` (feat)
2. **Task 2: The Best Efforts This Run panel section builder** — `0b0046b` (feat)
3. **Task 3: Wire PR badges and the best-efforts panel into the detail view** — `fdaa19a` (feat)

**Plan metadata:** this summary (docs: complete plan)

## Files Created/Modified

- `src/dashboard/data/age-grading-client.ts` — fetch-once, memoized reader for the age-grading document; degrade-to-null per D-13.
- `src/dashboard/data/age-grading-client.test.ts` — client behaviour including the disabled-document path.
- `src/dashboard/data/best-efforts-client.ts` — per-id memoized reader for the new per-activity shard, degrade-to-null.
- `src/dashboard/data/best-efforts-client.test.ts` — per-id memoization and failure handling.
- `src/dashboard/views/detail-best-efforts-logic.ts` — pure, DOM-free `buildPrBadgeLabels` and `buildBestEffortsPanelRows`.
- `src/dashboard/views/detail-best-efforts-logic.test.ts` — derivation coverage including the zero-effort case.
- `src/dashboard/views/detail-sections.ts` — `buildBestEffortsSection` panel builder.
- `src/dashboard/views/detail.ts` — optional `ageGradingClient`/`bestEffortsClient` on `DetailViewDeps`, defaulted inside `createDetailView`; `mountBestEffortsAndBadges` fired without awaiting.
- `src/analytics/compute-best-efforts.ts` — additionally writes per-activity shard files.
- `scripts/build-widgets.mjs` — `copyDataFiles` now recurses one level via `copyJsonTree`.

## Decisions Made

See `key-decisions` in the frontmatter. The load-bearing one is the sibling-client choice: the plan sanctioned "extend the detail client's existing per-activity read", and this implements that intent as `best-efforts-client.ts` rather than by editing `detail-client.ts`, whose suite hard-asserts an exact 2-URL fetch sequence across roughly ten tests that a third fetch would have broken.

## Deviations from Plan

### 1. Files touched beyond the plan's declared `files_modified`

- **Found during:** Tasks 1–3
- **Issue:** The plan declared six files. Delivering the panel without regressing the detail client, and getting the new shard files actually published, required four more: `src/dashboard/data/best-efforts-client.ts` (+ test), `src/analytics/compute-best-efforts.ts`, and `scripts/build-widgets.mjs`.
- **Fix:** Added the sibling client rather than editing `detail-client.ts`; extended `compute-best-efforts.ts` purely additively to emit shards; fixed `copyDataFiles` to recurse one level, since its flat `readdirSync` loop silently skipped the new subdirectory entirely.
- **Verification:** Full suite green at the end of Task 3; the executor reported "All green" before its session was interrupted.
- **Committed in:** `4ea3544`, `0b0046b`, `fdaa19a`

---

**Total deviations:** 1 (scope of files touched). No intra-wave conflict resulted — none of the four extra files appear in 18-11's or 18-12's `files_modified`.
**Impact on plan:** Additive. The shard-file and `copyJsonTree` changes are prerequisites for the plan's own stated availability goal rather than scope creep.

## Issues Encountered

**The executor session died before writing this summary.** After committing all three task commits with a clean working tree, the agent was terminated twice by `API Error: Connection closed mid-response` — the first time immediately after stating "All green. Now let's write the SUMMARY.md", the second time during the orchestrator's resume attempt, before any file was written.

**This summary was therefore authored by the orchestrator from the committed diff and commit messages, not by the executing agent.** Its factual claims about what was built are derived from the actual commits; the "all green" verification claim is the executor's, carried over rather than independently re-derived at the time of writing. The orchestrator's post-merge build and test gate is the independent check on that claim — see the phase execution record.

## Self-Check

Not performed by the executing agent (session terminated before the self-check step). Verification deferred to the orchestrator's post-merge build and full-suite test gate for Wave 3.
