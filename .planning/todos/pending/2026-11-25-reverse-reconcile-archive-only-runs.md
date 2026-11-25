---
created: 2026-11-25T14:30:00.000Z
title: Reverse reconcile — archive runs with no Garmin twin (watch-dead phone recordings)
area: exports
files:
  - src/exports/reconcile.ts
---

## Problem

User (2026-11-25): runs in the archive but absent from Garmin are likely Strava phone recordings from days the watch was dead (e.g. 18180779941, 2026-04-20). There may be more. Missing heart-rate data is one indicator. Today's reconcile only lists export-side runs missing from the archive (decision L-01c).

## Solution

Add a reverse direction: archive runs inside the Garmin export's coverage window with no Garmin twin within 120 s, listed with their HR presence. Report only; never delete.
