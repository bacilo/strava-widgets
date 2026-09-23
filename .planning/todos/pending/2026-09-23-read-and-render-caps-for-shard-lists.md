---
created: 2026-09-23T12:15:00.000Z
title: unreliableSegments and impossibleSamples shard lists are capped on write only
area: dashboard
files:
  - src/dashboard/data/pace-quality-client.ts
  - src/dashboard/views/detail-sections.ts
  - src/analytics/pace-quality.ts
---

## Problem

Phase 34 code review finding WR-07 (`34-REVIEW.md`, 2026-09-23), sibling half.

The 100-entry cap on shard lists is enforced by the projection on the WRITE side only. The read side
(`parsePaceQualityShard`) and the render side map every parsed entry with no ceiling, so a shard with
10 000 valid entries — a hand-edited file, a stale artifact from a future schema, or a
partially-written file served mid-deploy — builds 10 000 DOM rows.

Plan 34-16 fixed this for the `pauseIntervals` list Phase 34 added, introducing an exported
`SHARD_LIST_CAP` used by the projection, the parser and the rendered truncation notice. The
pre-existing `unreliableSegments` and `impossibleSamples` loops share the same shape and are still
write-capped only.

## Why deferred

Those two lists are Phase 32/33 surfaces with their own disclosure text and their own checkpoint
rows. Phase 34 added the third instance of a pre-existing pattern; fixing the other two reaches
code plan 34-16 does not own, and each needs its own truncation-notice wording decision.

## Acceptance

- Both loops honour `SHARD_LIST_CAP` (or their own exported constant) on read and on render
- Each list's truncation notice is built from the same constant it enforces, so the sentence cannot
  drift from the cap
- A fixture with more than the cap's worth of valid entries is shown parsing and rendering exactly
  the cap
