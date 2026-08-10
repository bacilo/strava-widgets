---
created: 2026-08-10T18:30:00.000Z
title: Manual exclusion of activities from best-effort/PR calculations
area: analytics
files:
  - src/analytics/compute-best-efforts.ts
  - src/analytics/best-effort-utils.ts
---

## Problem

During Phase 15 external validation (2026-08-10) the user confirmed the
best-effort engine's numbers but flagged that some activities were recorded
with a poor/inaccurate device — e.g. `3475726256` (400m/30km records) and
`3475725513` (1k record). Their times are technically present in the stream
data but the user does not trust them as genuine personal bests. Today the
engine has no way to leave an activity out: every manifest stream is swept
and eligible for PR marking.

## Solution

Add a user-maintained exclusion list (e.g. a committed
`data/best-effort-exclusions.json` or config entry listing activity IDs,
optionally per target distance, with a reason field). `computeBestEfforts`
skips excluded activities for PR marking/ranking — possibly still computing
their efforts but flagging them `excluded` so the totals stay reconcilable
with the manifest. Re-running `compute-best-efforts` should then promote the
next-best genuine effort to PR. Cross-referenced in Phase 15's 15-04-SUMMARY
follow-ups and STATE.md (flagged for Phase 18 triage).
