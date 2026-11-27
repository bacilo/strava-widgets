---
phase: 37-review-queue-priority-cur-04
plan: 03
subsystem: publish-guards
tags: [curation, publish-guard, planted-fixture, d-01, d-03, d-04]
requires: []
provides:
  - "findCurationArtifacts path rules: anchored data/curation directory and any file named reviewed.json"
  - "three literal expect404 assertions in verify-dashboard-publish.mjs (eight total)"
affects: [37-07]
tech-stack:
  added: []
  patterns: ["path rules for content-exempt .json", "literal-path 404 assertions, never a /data/ prefix"]
key-files:
  created: []
  modified: [scripts/lib/curation-guard.mjs, scripts/lib/curation-guard.test.mjs, scripts/verify-dashboard-publish.mjs, scripts/verify-dashboard-publish-guard.test.mjs]
key-decisions:
  - "Forbid BOTH the data/curation tree and any reviewed.json file: the directory rule alone misses data/reviewed.json, the file rule alone misses a renamed copy in the directory"
requirements-completed: []
duration: ~15min
completed: 2026-11-25
---

# Phase 37 Plan 03: Publish guards for reviewed state Summary

Both publish guards now fail on a leaked reviewed file or route: guard 1 by path (the `.json` content exemption is untouched), guard 2 by three literal 404 assertions.

## Tasks and commits

| Task | Commit | Result |
|------|--------|--------|
| 1. Guard 1 path rules + cases (a)-(f) | 328bb5f6 | `data/curation` directory (anchored via relative path) and `reviewed.json` file name; `build-widgets.mjs` unchanged |
| 2. Guard 2 literal 404s + Cases H, I, J | 689de9db | eight `/__curate` or curation 404 lines; planted leaks exit non-zero naming the path |

## Matched counts

- `curation-guard.test.mjs -t "Phase 37 D-03"`: 6 matched, 6 passed. Full file: 36 passed (includes the whole-tree real-dist regression; dist/widgets is built in this checkout).
- `verify-dashboard-publish-guard.test.mjs`: 12 passed, 0 skipped (dist/widgets built here, so this is real evidence, not a skip).

## Reachability evidence (each mutation applied alone, reverted, GREEN after)

| Mutation | Went RED |
|----------|----------|
| Guard 1: file-name rule disabled | (a), (c), (d) failed (3 of 6) |
| Guard 1: directory rule disabled | (a), (b) failed (2 of 6) |
| Guard 2: `/data/curation/reviewed.json` expect404 commented out | Case J (verifier exit 0) and Case A (missing line) failed |

All restored, full suites green. `git diff --exit-code scripts/build-widgets.mjs` clean. After the runs `dist/widgets/data/curation` and `dist/widgets/__curate` do not exist; the post-suite test also asserts `best-effort-exclusions.json` still exists.

Acceptance greps: 7 `/__curate/` expect404 calls, 1 `/data/curation/reviewed.json` call, no `/data/` prefix match. `UNSCANNED_EXTENSIONS` still exactly `['.json']`.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. T-37-13..T-37-16 each covered by a test above.

## Requirements

CUR-04 deliberately NOT ticked: UI and checkpoint criteria are delivered by plans 05, 06, 07. Plan 37-07 should re-run the guard suites against a freshly built dist/widgets on the primary checkout.

## Self-Check: PASSED

Files present: scripts/lib/curation-guard.mjs, scripts/verify-dashboard-publish.mjs and both test files. Commits 328bb5f6 and 689de9db in git log.
