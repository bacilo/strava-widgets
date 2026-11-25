---
created: 2026-11-25T18:15:00.000Z
title: Review-queue degraded-input hardening (37 review WR-02..WR-05)
area: curation
files:
  - scripts/curate-queue/index.ts
  - scripts/curate-queue/derive-flagged.mjs
  - scripts/curate-server.mjs
  - scripts/exclusion-cli.mjs
  - src/dashboard/data/best-efforts-client.ts
---

## Problem

Deferred from `.planning/phases/37-review-queue-priority-cur-04/37-REVIEW.md` (CR-01 and WR-01 were fixed; these were not). All are fail-open or crash paths on degraded or hand-edited inputs; the healthy path is verified.

1. WR-02: if `best-efforts.json` fails to load, the queue silently shows only the index-sourced transported rows (5 of 565), and every valid review renders as "no longer flagged" with an Un-review button, inviting deletion of committed state.
2. WR-03: if the dashboard index fails to load, transported rows drop a tier or vanish and their fingerprints change. The `loadIndexDoc` comment and the test "omitting indexDoc changes neither count nor order" both claim otherwise; the test passes only because its fixture has no transported activity.
3. WR-04: a single `null` entry in `reviewed.json` makes the server helpers and `exclusion-cli.mjs` throw, so reviewed PUT/DELETE and exclusion PUT all return 500, while the queue says the entry was "ignored (malformed)".
4. WR-05: a missing contaminated-metres figure sorts the row to the bottom of its tier (least attention). The on-page note says such rows "fall back to newest-first", and a comment in `best-efforts-client.ts` claims a queue effect it does not have.

## Solution

Fail closed with a visible banner when either input fails to load (hide Un-review on orphans while degraded); give the WR-03 test a transported fixture; make writers skip malformed entries the way the reader does; decide the missing-metres position deliberately and make the note and comment match it.
