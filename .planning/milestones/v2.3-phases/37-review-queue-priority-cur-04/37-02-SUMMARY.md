---
phase: 37-review-queue-priority-cur-04
plan: 02
subsystem: curate-server
tags: [curation, reviewed-and-kept, write-route, d-11, path-injection]
requires: []
provides:
  - "data/curation/reviewed.json seed (committed, never published)"
  - "GET/PUT/DELETE /__curate/reviewed routes on the existing curate server"
  - "applyReviewUpsert, applyReviewRemove, normalizeFingerprint, readReviewedFile, sharedActivityIds, resolveServerPaths, REVIEWED_PATH"
  - "path-injectable createServer(options)"
  - "D-11 mutual exclusion on the UI server (both directions) and in exclusion-cli"
affects: [37-05, 37-06, 37-07]
tech-stack:
  added: []
  patterns: ["shared resolveWriteTarget prefix for both write handlers", "injected tmp paths for every write test", "SHA-256 before/after guard over tracked files"]
key-files:
  created: [data/curation/reviewed.json]
  modified: [scripts/curate-server.mjs, scripts/curate-server.test.mjs, scripts/exclusion-cli.mjs, scripts/exclusion-cli.test.mjs]
key-decisions:
  - "Dispatch is PUT|DELETE only on /reviewed/:id; GET and POST on it fall through to 404 (same as exclusions)"
  - "Reviewed corrupt file fails closed everywhere: 500 from the server, non-zero exit from the CLI"
  - "reviewedAt is a full ISO timestamp stamped by the server"
requirements-completed: []
duration: ~25min
completed: 2026-11-25
---

# Phase 37 Plan 02: Reviewed-and-kept write path Summary

The curate server now persists reviewed-and-kept entries to a committed, never-mirrored `data/curation/reviewed.json` through a gated sibling of the exclusions route, with excluded and reviewed mutually exclusive on every write path.

## Tasks and commits

| Task | Commit | Result |
|------|--------|--------|
| 1. Path-injectable createServer + SHA guard | bfc9479f | `resolveServerPaths(options)` pinned to the constants by a test; suite-level SHA-256 guard over both tracked files |
| 2. Seed, routes, helpers, 409 both ways | c8a64001 | seed file, `handleReviewedWrite`, GET route, shared `resolveWriteTarget`, 53 new tests, all against `os.tmpdir()` |
| 3. CLI check + disjointness test | 4035312d | CLI refuses reviewed ids, fails closed on corrupt file, remove unblocked; committed-files disjointness test with planted counterpart |

Full `npx vitest run scripts`: 40 files, 1250 tests green. `git diff --exit-code` on both tracked data files is clean after the runs.

## Reachability evidence (each mutation applied alone, reverted, GREEN after)

Matched counts: curate-server.test.mjs 121 tests after Task 2 (68 before); exclusion-cli.test.mjs 21 (17 before, 4 new CLI cases); 3 new disjointness cases.

| Mutation | Test(s) that went RED |
|----------|----------------------|
| Task 2: exclusions check disabled in `handleReviewedWrite` | "409 when the id is in the exclusions file, and the reviewed file is unchanged"; "409 leaves no reviewed file behind when none existed" (2 failed) |
| Task 2: reviewed check disabled in `handleExclusionWrite` | "409 when the id is in the reviewed file, and the exclusions file and publish copy are unchanged"; "a corrupt reviewed file fails closed with 500" (2 failed) |
| (a) tmp stand-in file added to the SHA guard and written by a temporary `it` | guard afterAll equality failed, diff named the `curate-sha-standin-*/standin.json` path (reported on "hashes both tracked paths at suite start"); stand-in and temp test removed |
| (b) `mirrorExclusions(paths)` added to `persistReviewed` | "leaves the publish root empty after PUT and DELETE" and "its function body contains neither mirrorExclusions nor dist" (2 failed) |
| (c) read failure falls back to the default doc | "PUT on a corrupt existing reviewed file responds 500 and the corrupt bytes are unchanged", "with a corrupt file responds 500", the symmetric exclusions 500 case, and the two `readReviewedFile` throw cases (5 failed) |
| Task 3 (a): CLI reviewed-id check disabled | "refuses an add for a reviewed id, names \"reviewed\", and leaves the exclusions file byte-identical" (1 failed) |
| Task 3 (b): CLI corrupt-file branch falls through | "fails closed on a corrupt reviewed file and leaves the exclusions file byte-identical" (1 failed) |

## Deviations from Plan

- Mutation (c) was applied inside `readReviewedFile` (catch and return the default doc) rather than as a catch inside `handleReviewedWrite`. It fails the same handler-level test, plus the helper's own unit tests. Same observable defect, wider blast radius.
- `sharedActivityIds` was added in the Task 2 commit alongside the other pure helpers; its tests landed with Task 3 as planned.
- Prettier was not run on `curate-server.mjs`: the file was already non-conforming at HEAD, so a format pass would have added unrelated churn.

No auth gates. No package installs.

## Known Stubs

None. `data/curation/reviewed.json` ships with `"reviewed": []` by design (D-02); nothing consumes it until plans 05/06.

## Threat Flags

None beyond the plan's register. T-37-04..T-37-12 are each covered by a test named above.

## Requirements

CUR-04 is deliberately NOT ticked: its UI, guard and checkpoint criteria are delivered by plans 03, 05, 06 and 07.

## Self-Check: PASSED

Files verified present: data/curation/reviewed.json, scripts/curate-server.mjs, scripts/exclusion-cli.mjs. Commits bfc9479f, c8a64001, 4035312d present in git log.
