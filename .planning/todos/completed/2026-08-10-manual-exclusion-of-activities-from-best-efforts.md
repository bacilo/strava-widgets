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

## Resolution

**Shipped in Phase 16, plan 16-01** (`b9d10cd` — "implement exclusion loader/matcher and gate the PR accumulator"), the same evening this todo was written. Closed 2026-08-12.

Implemented exactly as proposed: `data/best-effort-exclusions.json`, hand-maintained, entries of `{activityId, distances, reason}`. `distances: null` excludes the whole run; an array of `TARGET_ORDER` keys (`400m`, `1k`, `1mi`, `5k`, `10k`, `half`, `marathon`) narrows it. `compute-best-efforts.ts:237` gates the PR accumulator via `isExcluded`; efforts are still computed and retained, flagged `excludedFromRecords`, so totals stay reconcilable with the manifest and the next-best genuine effort is promoted.

Both activities named in the Problem section (`3475726256`, `3475725513`) are in the list and confirmed excluded in the live index. Phase 18 added `buildExclusionReasonIndex`, surfacing the written reason in the detail view.

Verified 2026-08-12 that exclusion affects PR logic ONLY — zero references to `excludedFromRecords` in `compute-stats.ts`, `compute-advanced-stats.ts`, `gear-aggregate-logic.ts` or `compute-training-load.ts`, so distance, time, gear and training load still count the run.

**This todo stayed open in `pending/` for two days after being satisfied, and was consequently miscounted as outstanding by the v2.0 milestone audit's `audit-open` scan and recorded as deferred in STATE.md. Both corrected 2026-08-12.**

Follow-on (not part of this todo): a UI control to toggle exclusions without hand-editing the file — see `.planning/todos/pending/2026-08-12-exclusion-tickbox-local-curation-mode.md`.

