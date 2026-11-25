---
created: 2026-11-25T14:30:00.000Z
title: Small fail-open hardening in exports and the intervals provider (36.1 review)
area: api
files:
  - src/exports/adapters/garmin.ts
  - src/api/intervals-provider.ts
---

## Problem

1. The Garmin adapter reads activityId through JSON.parse, so an id above 2^53 would be rounded before the WR-10 round-trip check sees it. 2. intervals-provider treats an activity with no type as 'Run', so the nightly sync counts it as a run (fail-open). Neither affects current data.

## Solution

Parse ids as strings (a reviver or raw-text extraction) and refuse unsafe ids; make a missing type surface as unknown instead of defaulting to Run.
