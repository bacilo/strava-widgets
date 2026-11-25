---
created: 2026-11-25T14:30:00.000Z
title: consolidate-exports drops Strava provenance when export_data/strava is absent (36.1 WR-04)
area: exports
files:
  - src/exports/consolidate.ts
  - data/provenance.json
---

## Problem

consolidate-exports rebuilds provenance from scratch. Run with only export_data/garmin present, it silently drops about 1,861 Strava links and gear attributions. The committed data/provenance.json is also stale (archive_total 1866 vs 1955, no garmin source entry).

## Solution

Refuse to drop existing links for an absent source (carry them forward, or fail closed). Then rebuild data/provenance.json and review the diff before committing.
