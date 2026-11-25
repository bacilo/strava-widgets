---
phase: 37-review-queue-priority-cur-04
reviewed: 2026-11-25T18:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - data/curation/reviewed.json
  - package.json
  - scripts/compute-review-queue-recount.mjs
  - scripts/compute-review-queue-recount.test.mjs
  - scripts/curate-overlay.test.mjs
  - scripts/curate-overlay/index.ts
  - scripts/curate-queue.test.mjs
  - scripts/curate-queue/derive-flagged.mjs
  - scripts/curate-queue/derive-flagged.test.mjs
  - scripts/curate-queue/index.ts
  - scripts/curate-server.mjs
  - scripts/curate-server.test.mjs
  - scripts/exclusion-cli.mjs
  - scripts/exclusion-cli.test.mjs
  - scripts/lib/curation-guard.mjs
  - scripts/lib/curation-guard.test.mjs
  - scripts/unreliable-segment-import-guards.test.mjs
  - scripts/verify-dashboard-publish-guard.test.mjs
  - scripts/verify-dashboard-publish.mjs
  - src/analytics/best-effort.types.ts
  - src/analytics/compute-age-grading.test.ts
  - src/analytics/compute-best-efforts.test.ts
  - src/analytics/compute-best-efforts.ts
  - src/analytics/compute-dashboard-index.test.ts
  - src/dashboard/data/best-efforts-client.test.ts
  - src/dashboard/data/best-efforts-client.ts
  - src/dashboard/views/detail-best-efforts-logic.test.ts
  - src/dashboard/views/records-logic.test.ts
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-11-25T18:00:00Z
**Depth:** standard (phase diff `e85d1e42..HEAD`)
**Files Reviewed:** 28
**Status:** issues_found

## Summary

I reviewed the CUR-06 priority queue (derive, recount, D-07 producer field), the CUR-04 reviewed-and-kept
write path (server routes, CLI D-11 check, overlay transport, queue UI) and both publish guards.
The core arithmetic holds up. The D-07 dedupe in the producer is correct. The recount is genuinely
independent: it imports only fs/path/url, re-measures segments from the stream, and fails closed on a
missing or altered shipped field. The live recount (`node scripts/compute-review-queue-recount.mjs`) gives
PASS with 565 rows. Guard 1 and guard 2 are both shown red on planted copies. The seven phase test files
pass (308 tests) and leave the working tree clean.

The defects are in what the review state means and in how the queue degrades:

- **The fingerprint can't tell a contaminated effort from an unreliable-segment demotion (CR-01).**
  An effort that flips between "demoted, does not rank" and "ranks on a clean window" keeps the same
  fingerprint. So a reviewed-and-kept row stays hidden while a public PR appears or disappears.
  `reviewed.json` is still empty, so the serialisation can be fixed now at no cost. After the first
  real review, fixing it resurfaces every stored entry.
- **The tracked-file SHA guard (T-37-12) is vacuous (WR-01).** Its `afterAll` is scoped to its own
  describe block, so it runs before any write test in the file. A probe confirmed the order:
  `["guard-it","guard-afterAll","writes-it"]`.
- **Fetch failures fail open (WR-02, WR-03).** A failed best-efforts fetch produces a short queue with
  no warning, and every valid review shows as "no longer flagged" with an Un-review button. A failed
  index fetch silently moves transported rows into other tiers or drops them. A docblock and a test
  still claim this cannot happen.
- **One `null` entry in `reviewed.json` blocks every write (WR-04).** The queue reports it as
  "ignored (malformed)", but every reviewed PUT/DELETE and every exclusion PUT then answers 500.

## Critical Issues

### CR-01: The fingerprint treats Branch 2 (contaminated, ranks) and Branch 3 (demoted, does not rank) as the same flag

**File:** `scripts/curate-queue/derive-flagged.mjs:154-166` (inputs from `src/analytics/compute-best-efforts.ts:305` and `:323`)

**Issue:** `fingerprintFor` builds one token, `${distance}:${flag.guard}`, from both `e.demotion` and
`e.contaminated`. The producer gives both kinds the same guard string: `contaminationRecord` returns
`guard: 'unreliable-segment'` (line 305) and `unreliableSegmentDemotion` returns
`guard: 'unreliable-segment'` (line 323). Probe:

```
fingerprintFor([{distance:'5k', demotion:null, contaminated:{guard:'unreliable-segment'}}], false)
  -> '5k:unreliable-segment|t=0'
fingerprintFor([{distance:'5k', demotion:{guard:'unreliable-segment'}, contaminated:null}], false)
  -> '5k:unreliable-segment|t=0'
```

These two states have opposite effects on the public records:

- Branch 3: the effort is demoted and does not rank.
- Branch 2: the effort ranks on a clean window and can be a published PR.

A detector recalibration or a new stream can flip a distance from one branch to the other. Under
D-10 ("Reviewed means reviewed this evidence"), that flip must resurface the row. Today the stored
fingerprint still matches, `reviewState` stays `'reviewed'`, and the row stays out of To review while
a PR it never covered appears on (or disappears from) the dashboard.

D-12 asks for "which flags, not how much". Whether an effort ranks at all is a "which" fact, not a
"how much" one. The serialisation format is explicitly Claude's discretion in 37-CONTEXT.md.

**Fix:** Encode the kind in the token. `normalizeFingerprint`'s charset already allows `:`. Ship it
while `data/curation/reviewed.json` has `"reviewed": []`, so no stored entry is invalidated:

```js
for (const [kind, flag] of [['d', e.demotion], ['c', e.contaminated]]) {
  if (flag !== null && typeof flag === 'object' && typeof flag.guard === 'string') {
    tokens.add(`${e.distance}:${kind}:${flag.guard}`);
  }
}
```

Add a derive-flagged test asserting that the Branch 2 fixture and the Branch 3 fixture produce
different fingerprints. It is red against the current code.

## Warnings

### WR-01: The T-37-12 tracked-file SHA guard checks nothing. Its `afterAll` runs before any write test

**File:** `scripts/curate-server.test.mjs:72-88`

**Issue:** The `before` and `after` hashes are taken in `beforeAll`/`afterAll` inside
`describe('tracked-file SHA guard (T-37-12)')`. Vitest runs a describe-scoped `afterAll` as soon as that
block's own tests finish. This block is the first in the file, so `after` is computed before any of the
real-socket write suites (lines ~840-1100) run. Reproduced in a scratch suite:
`ORDER ["guard-it","guard-afterAll","writes-it"]`.

The guard therefore passes even if a later test writes `data/best-effort-exclusions.json` or
`data/curation/reviewed.json`. This is the "no test may write to a tracked file" protection, and it
would not detect a regression.

**Fix:** Move the hooks to file scope (top-level `beforeAll`/`afterAll`, outside any `describe`), so
they run after every suite in the file. Prove it can fail: temporarily append a test that touches
`REVIEWED_PATH`, confirm the suite goes red, then remove that test. Alternatively, put the guard in a
vitest `globalSetup` teardown that covers the whole run.

### WR-02: A failed best-efforts fetch gives a silent partial queue and shows every valid review as "no longer flagged"

**File:** `scripts/curate-queue/index.ts:485-498, 587-591`

**Issue:** `loadBestEffortsDoc()` returns `null` on any failure. The only signal for that is
`appendEmptyState(main, bestEffortsDoc)`, and it only runs when `rows.length === 0 && orphans.length === 0`.

After Phase 37, transported rows come from the index alone (D-06). With a null best-efforts document,
`deriveFlaggedActivities` still returns the transported rows: probe
`deriveFlaggedActivities(null, null, idx).length === 1`. So the page shows a short, plausible-looking
queue (today: 5 rows instead of 565) and no "dist/widgets is likely not built" note.

Worse, every reviewed entry whose activity came from best-efforts becomes an orphan. Each one is shown
under Reviewed as "no longer flagged", with an Un-review button that deletes committed state. This fails
in the direction that invites destroying valid reviews.

**Fix:** Treat a null best-efforts document as a hard degraded state, whatever the row count:

```ts
if (bestEffortsDoc === null) {
  appendLine(main, 'data/stats/best-efforts.json could not be loaded; the queue below is incomplete ' +
    'and "no longer flagged" is not meaningful. Run `npm run build && npm run build-widgets`.',
    'data-queue-best-efforts-unavailable-note');
}
```

Also suppress the orphan list and its Un-review controls while `bestEffortsDoc === null`.

### WR-03: A failed index fetch silently changes tier, order and fingerprint. A stale docblock and a stale test claim it can't

**File:** `scripts/curate-queue/index.ts:104-120`, `scripts/curate-queue/derive-flagged.test.mjs:677-691`

**Issue:** The `loadIndexDoc` docblock still says: "A `null` here must not change the derived row set or
order". Since D-06/D-08 the index is the only source of `transported`. With a null index:

- a tier-1 row drops to tier 2 or 3, or disappears if it has no best-efforts entry;
- its fingerprint changes from `|t=1` to `|t=0`. Probe: `[1,'5k:unreliable-segment|t=1']` becomes
  `[2,'5k:unreliable-segment|t=0']`.

No note is rendered, so the CUR-06 order is wrong with no indication. If the developer re-reviews a
"changed" row in this state, the stored fingerprint records `t=0`. The row then resurfaces again on the
next healthy load.

The test "omitting indexDoc entirely changes neither the row count nor the order" still passes only
because its fixture has no transported activity. It now asserts a guarantee the code no longer provides.

**Fix:** Render a `data-queue-index-unavailable-note` when `indexDoc === null` ("transported tier
unavailable; order and fingerprints are incomplete"). Disable the review Save control in that state so
a `t=0` fingerprint is never stored from a degraded load. Correct the docblock. Rewrite the test so it
includes a transported activity and asserts the documented degradation.

### WR-04: One malformed (`null`) entry in reviewed.json blocks every write, while the queue reports it as "ignored"

**File:** `scripts/curate-server.mjs:426-429, 446, 746, 820`, `scripts/exclusion-cli.mjs:125`

**Issue:** `buildReviewedMap` skips and counts a `null` entry (D-05), so the queue shows "1 reviewed
entries ignored (malformed)". The server-side helpers, however, dereference `e.activityId` without
checking `e` first:

- `applyReviewUpsert` (`findIndex`), `applyReviewRemove` (`filter`), and the D-11 `.some(...)` checks
  in both the exclusion PUT and the CLI.

Probe: all three throw `Cannot read properties of null (reading 'activityId')`.

The effect:

- every reviewed PUT and DELETE answers 500;
- every exclusion PUT answers 500;
- `npm run exclude-activity --id X --reason ...` crashes.

The developer cannot un-review or exclude anything through the tools until they find and hand-fix the
file. The UI's "ignored" message is wrong: the entry is not ignored, it blocks every write.

**Fix:** Use one null-safe predicate everywhere:

```js
const idOf = (e) => (e !== null && typeof e === 'object' ? e.activityId : undefined);
```

Use it in `applyReviewUpsert`, `applyReviewRemove`, `handleExclusionWrite`'s D-11 check and
`exclusion-cli.mjs:125`. Malformed entries should still be carried through untouched (D-13). Add a
socket test that seeds `reviewed: [null, entry]` and asserts that PUT, DELETE and an exclusion PUT all
succeed.

### WR-05: A missing or invalid `contaminatedMetres` sends the row to the bottom of its tier, and the on-page note describes the order wrongly

**File:** `scripts/curate-queue/derive-flagged.mjs:347-354`, `scripts/curate-queue/index.ts:526-533`, `src/dashboard/data/best-efforts-client.ts:167-175`

**Issue:** An invalid figure becomes `0`. In a metres-descending sort, that places the row below every
row with a positive figure, which is the lowest-attention position in tier 1/2. This contradicts the
"fails toward more attention" rule the same phase applies to `loadReviewedDoc`.

The note says "their order within the tier falls back to newest-first". That is false: they sort after
all measured rows, then newest-first among themselves. A developer reading the note will not look for
them at the bottom.

The client-side comment ("sorts last in the review queue, so a stale or malformed value can never
inflate queue priority") is also misleading: the queue does not use `best-efforts-client.ts`.

**Fix:** Either sort `metresMissing` rows to the top of their tier (ahead of measured rows), or keep
the current order and correct the copy:

> "N rows have no contaminated-metres figure and are listed after every measured row in their tier.
> Run Recompute."

Remove the queue claim from the client comment.

## Info

### IN-01: The live recount check runs in the blocking nightly `test:logic` suite, and two data-dependent failure branches would block deploy

**File:** `scripts/compute-review-queue-recount.mjs:180-197`, `scripts/compute-review-queue-recount.test.mjs:383-407`

**Issue:** The live describe is not `*.archive.test.*`, so it runs in the blocking CI step. If an
activity with a moved effort has more than `SHARD_LIST_CAP` (100) unreliable segments or pause
intervals, the recount pushes a failure. The live test then fails and the nightly deploy stops, even
though no code is wrong.

Measured today: maximum 20 segments and 76 pause intervals per shard, 0 truncated shards. So this is
not reachable now. 76 is within reach of the cap for a long GPS-noisy run.

**Fix:** Have the live test assert that the truncation failures are a separately-reported class, or move
the live block to the archive config. Keep the unit fail-closed behaviour.

### IN-02: The live "can disagree" check in the recount test is conditional and can pass vacuously

**File:** `scripts/compute-review-queue-recount.test.mjs:400-406`

**Issue:** The swap-detection assertion only runs `if (idx.length >= 2)`. With fewer than two tier-2
rows it silently asserts nothing, while the test title still claims "and can disagree".

**Fix:** `expect(idx.length).toBeGreaterThanOrEqual(2)` before the swap, or fall back to swapping any
two adjacent rows from different positions.

### IN-03: Guard 1's path rules are case-sensitive and match exact names only

**File:** `scripts/lib/curation-guard.mjs:124-130, 170-178`

**Issue:** The rules catch `data/curation/` and files named exactly `reviewed.json`. They miss
`data/Curation/...`, `Reviewed.json`, or a renamed single copy outside the directory such as
`data/curation.json` or `data/reviewed-backup.json`. The `.json` content-scan exemption means nothing
else catches these. The docblock's "the file-name rule alone misses a renamed copy inside the
directory" admits part of this. D-03 accepted path-based detection, so this is a documentation and
hardening note, not a regression.

**Fix:** Compare `entry.name.toLowerCase()`, and document the remaining blind spot (renamed copies
outside `data/curation`) in the docblock.

### IN-04: A row that is both excluded and reviewed (reviewConflict) cannot be un-reviewed from the UI

**File:** `scripts/curate-queue/index.ts:438-441`

**Issue:** Excluded rows only get exclusion controls. A hand-edited conflict row shows a note but has no
Un-review button. The only fix through the UI is to remove the exclusion, which changes PR history.

**Fix:** When `row.reviewConflict`, also mount `mountUnreviewControl` (DELETE is never blocked by D-11).

### IN-05: Producer and recount sum segment metres in different orders before rounding

**File:** `src/analytics/compute-best-efforts.ts:575-578`, `scripts/compute-review-queue-recount.mjs:209-215`

**Issue:** The producer sums in Map insertion order (distance loop, then segment order). The recount sums
in shard order. Floating-point addition is not associative, so on a `.x5` boundary `round1` can differ
by 0.1. The recount would then report a spurious "shipped != recount" mismatch. It passes live today
(565 rows).

**Fix:** In both places, sort the de-duplicated segments by start before summing, or sum
`Math.round(m * 10)` integers and divide once.

---

_Reviewed: 2026-11-25T18:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
