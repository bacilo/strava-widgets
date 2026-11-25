---
phase: 37-review-queue-priority-cur-04
plan: 04
subsystem: curate-queue
tags: [curation, derive, tiers, fingerprint, review-overlay, zero-import]
requires: []
provides:
  - "deriveFlaggedActivities(best, excl, index, reviewed): D-06 union, tier, contaminatedMetres, metresMissing, transported, contaminatedEfforts, fingerprint, reviewState, reviewConflict"
  - "compareQueueRows, fingerprintFor, countMalformedReviewed, rowsForView, deriveOrphans, summarizeViews, QUEUE_VIEWS"
affects: [37-05, 37-06, 37-07]
tech-stack:
  added: []
  patterns: ["zero-import pure derive", "fail-closed numeric read", "fail-closed tier ladder (unrecognised row leaves the set)"]
key-files:
  created: []
  modified:
    - scripts/curate-queue/derive-flagged.mjs
    - scripts/curate-queue/derive-flagged.test.mjs
key-decisions:
  - "Unknown view string falls back to to-review (adds attention)"
  - "A hand-edited excluded+reviewed row keeps its computed reviewState but is shown under Excluded only, with reviewConflict true"
  - "Tier ladder has no benign else: a row matching none of transported, guard-moved or demotion is skipped, never labelled tier 3"
metrics:
  tasks: 2
  completed: 2026-11-25
requirements: [CUR-06, CUR-04]
---

# Phase 37 Plan 04: Queue derivation Summary

The pure queue derivation now returns the D-06 union with D-08 tiers and metres-first order, a fail-closed metres read, a canonical D-12 fingerprint, D-10 resurfacing, four views, orphans and the D-05 malformed count, all pinned by hand-derived fixtures.

## Commits

- 96fbd150: union membership, tiers, fail-closed metres, comparator, zero-import scan, live check re-scoped
- 68b485e0: fingerprint, review overlay, views, orphans, malformed count

## Verification

- `npx vitest run scripts/curate-queue/derive-flagged.test.mjs scripts/curate-queue/format.test.mjs scripts/curate-queue.test.mjs`: 3 files, 94 tests pass (derive-flagged 69).
- The live archive cross-check ran (data present, not skipped), now over `rows.filter(r => r.flaggedEfforts.length > 0)`; full-set count and order move to plan 37-05's recount.
- Zero-import one-liner prints "zero-import ok". The retired comparator string is absent. `summarizeQueue` body unchanged.
- Every expected value comes from fixture Q or the planted docs, with the derivation in a comment. No CONTEXT.md probe figure is used.

## Reachability evidence (D-19), each mutation applied alone, reverted, GREEN after

Task 1 (derive-flagged.test.mjs, 51 tests):

| Mutation | Result |
|----------|--------|
| tier line removed from compareQueueRows | RED, 3 failed (fixture Q order, 5-order stability, excluded-stays-in-tier) |
| metres sorted ascending | RED, 3 failed (same three) |
| transported-without-entry union dropped | RED, 4 failed (adds the TX presence test) |

Task 2 (69 tests):

| Mutation | Result |
|----------|--------|
| durationSec added to the fingerprint token | RED, 7 failed (including the metre/duration-drift invariance test) |
| changed rows counted as reviewed | RED, 3 failed (G3 changed, To review view, summarizeViews) |
| orphans dropped | RED, 3 failed (ghost orphan, orphan sort, summarizeViews) |

All restored: 69/69 GREEN. The zero-import scan itself is shown RED on a planted fixture (import plus console flagged; comment-only mentions not flagged) before the real file is scanned.

## Deviations from Plan

None. The `reviewedDoc` parameter was accepted and ignored in Task 1 as specified, then wired in Task 2.

## Known Stubs

None.

## Threat Flags

None. T-37-17 (`__proto__` skipped and counted, Map-keyed), T-37-18 (eight malformed classes counted, never mark reviewed), T-37-19 (finite non-negative read, else 0 plus metresMissing) and T-37-20 (reviewConflict, Excluded wins) each have a test.

## Requirements

CUR-06 and CUR-04 are deliberately NOT ticked: plan 05 (independent recount), plan 06 (UI) and plan 07 (checkpoint) still deliver parts of both.

## Self-Check: PASSED

Files present: scripts/curate-queue/derive-flagged.mjs, scripts/curate-queue/derive-flagged.test.mjs. Commits 96fbd150 and 68b485e0 are in git log.
