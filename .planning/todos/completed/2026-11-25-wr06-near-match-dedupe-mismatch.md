---
created: 2026-11-25T14:30:00.000Z
title: FIT importer vs IntervalsSync near-match dedupe mismatch (36.1 WR-06)
area: api
files:
  - src/exports/fit-import.ts
  - src/api/intervals-provider.ts
---

## Problem

importFit refuses starts within 120 s of an archive record, but IntervalsSync dedupes on exact start epoch only. If intervals.icu later delivers an imported run 1+ s off, it becomes a second record (a CAN-FAIL test in fit-import.test.ts pins today's behaviour).

## Solution

Have IntervalsSync treat a near match (within 120 s) of a garmin-export record as a duplicate, or report it. Update the pinned test deliberately.
