---
created: 2026-09-23T12:10:00.000Z
title: Pauses summary row names the not-classifiable category, not the mechanisms actually present
area: dashboard
files:
  - src/dashboard/views/detail-sections.ts
  - src/analytics/dashboard-index.types.ts
  - src/analytics/compute-dashboard-index.ts
  - src/analytics/pace-quality.ts
---

## Problem

Surfaced by the developer at the Phase 34 human browser checkpoint (plan 34-11, row R4) and
disclosed in `34-11-SUMMARY.md`: 3475740390's Quality Signals Pauses row labels its five
not-classifiable intervals with the generic category, although all five are isolated-jump segments
and none is a hidden-pause segment.

Plan 34-16 reworded the clause so it reads as a CATEGORY rather than as a list of mechanisms
present, which removes the false implication at zero cost. Naming the actual mechanisms is the
remaining want.

## Why deferred

The summary row is fed from the index row, not the shard (D-14/D-17: the row's scalars come from
`index.json` so Phase 37 can read them without a shard fetch). The index row carries only
`pauseClassification.notClassifiableCount`, a single total. Naming mechanisms needs:

- an additive index key (e.g. per-mechanism counts, or a compact mechanism list),
- a decision on whether `DASHBOARD_INDEX_SCHEMA_VERSION` stays at 1 (D-17 kept it additive so far),
- the CR-01 missing-key fallback extended to the new key,
- a full `compute-dashboard-index` regeneration and a re-look at the rendered row.

That is a schema change with a browser re-check, not a wording fix.

## Acceptance

- The row names the mechanisms actually present (e.g. "5 not classifiable: isolated-jump"), with the
  category wording retained when more than one mechanism is present
- The new index key is additive, with the stale-index fallback tested
- The rendered row is re-checked once against a digest-verified served build
