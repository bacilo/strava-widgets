---
created: 2026-11-25T14:30:00.000Z
title: Import (or dismiss) the 4 remaining Garmin-missing runs
area: exports
files:
  - data/reconciliation/garmin.json
  - src/exports/fit-import.ts
---

## Problem

The 2026-11-25 Garmin export audit (Phase 36.1) lists 4 runs present in Garmin and absent from the archive: 18917950039 (2025-04-23 22:48Z, 6.3 km), 18665042154 (2025-03-28 20:00Z, 0 m, trivial), 11689644619 (2023-08-01 07:50Z, 1.0 km), 7206746268 (2021-07-28 17:35Z, 0.4 km). Only 18917950039 looks like a real run; the others look like empty or aborted recordings.

## Solution

Review each one in Garmin Connect. Import real ones one explicit id at a time with `import-fit` (decision L-01b). The bulk-export FIT filenames carry the account email, and CR-01 now refuses such paths, so use Export Original into export_data/garmin/single/ (or copy the file to an email-free name). Regenerate `reconcile-exports garmin` afterwards and confirm missing = recount.
