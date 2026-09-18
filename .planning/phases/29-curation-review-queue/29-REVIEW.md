---
phase: 29-curation-review-queue
reviewed: 2026-09-18T11:07:49Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - scripts/compute-pr-ceiling-recount.mjs
  - scripts/compute-pr-ceiling-recount.test.mjs
  - scripts/curate-overlay.test.mjs
  - scripts/curate-overlay/index.ts
  - scripts/curate-queue.test.mjs
  - scripts/curate-queue/derive-flagged.mjs
  - scripts/curate-queue/derive-flagged.test.mjs
  - scripts/curate-queue/format.mjs
  - scripts/curate-queue/format.test.mjs
  - scripts/curate-queue/index.ts
  - scripts/curate-server.mjs
  - scripts/curate-server.test.mjs
  - scripts/lib/curation-guard.mjs
  - scripts/lib/curation-guard.test.mjs
  - scripts/verify-dashboard-publish-guard.test.mjs
  - scripts/verify-dashboard-publish.mjs
  - src/dashboard/curation-seam.test.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-09-18T11:07:49Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the Phase 29 diff (`ce656477^..HEAD`) across the five pre-existing files and the four new `scripts/curate-queue/*` modules, plus the eight test files. The full phase test set (8 files, 302 tests) was run and is green; several findings below were confirmed by executing the shipped functions directly rather than by reading alone.

No Critical findings. The new code is defensive and the server gate is applied to both new routes. The main concerns are (1) a real HTML-attribute injection in `renderQueuePage` reachable through a single-quoted `href` in `dist/widgets/index.html` (confirmed: `onload="alert(1)"` lands in the served page — trust boundary is a local build artifact, so Warning not Critical), (2) the two "independent" flagged-count implementations that the D-16 cross-check relies on disagree on three input shapes (duplicate exclusion entries, non-string `reason`, `__proto__` keys), (3) the recount CLI now hard-fails on a missing exclusions file while carrying a dead "unavailable" branch written for exactly that case, and (4) a copied UI quirk that exposes a "Remove exclusion" button on rows that have nothing to remove.

## Warnings

### WR-01: `renderQueuePage` interpolates an unescaped href into an HTML attribute (attribute injection)

**File:** `scripts/curate-server.mjs:279-282` (`renderQueuePage`), `scripts/curate-server.mjs:245-251` (`extractStylesheetHref`)
**Issue:** `extractStylesheetHref` accepts single-quoted `href='...'` values (`'([^']*)'`), which may legally contain `"`. `renderQueuePage` then writes the value into `href="${stylesheetHref}"` with no escaping. Confirmed by execution:

```
input : <link rel="stylesheet" href='x.css" onload="alert(1)'>
output: <link rel="stylesheet" href="/strava-widgets/x.css" onload="alert(1)">
```

The CSP (`script-src 'self'`) blocks the inline handler, but the attribute boundary is broken and any attribute (e.g. `rel`, `crossorigin`, `integrity`) can be injected. The source is `dist/widgets/index.html`, a local build artifact, so this is not remotely exploitable — but the function's own docblock promises it "never throws — a malformed dist/widgets/index.html must degrade the queue page to unstyled-but-functional", and this is the malformed case it does not handle.
**Fix:** Either reject any extracted href containing `"`, `'`, `<`, `>` (return `null`, which the caller already handles), or escape at the sink:

```js
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stylesheetTag = typeof stylesheetHref === 'string' && stylesheetHref.length > 0
  ? `<link rel="stylesheet" href="${escapeAttr(stylesheetHref)}">`
  : '';
```

Add a test: `renderQueuePage('a"b.css')` must not contain `href="a"b.css"`.

### WR-02: `recountDemotedActivities` and `deriveFlaggedActivities` disagree on exclusion semantics, weakening the D-16 cross-check

**File:** `scripts/compute-pr-ceiling-recount.mjs:256-291`; `scripts/curate-queue/derive-flagged.mjs:52-69, 115-116`
**Issue:** The live-archive test (`derive-flagged.test.mjs:335-348`) asserts the two implementations agree, and the phase treats that agreement as the proof the queue header is right. They only agree on well-formed input. Confirmed by execution against a one-activity fixture:

| input shape | queue `excludedCount` | recount `excludedWithinFlaggedCount` |
|---|---|---|
| two exclusion entries with the same `activityId` | 1 | 2 |
| exclusion entry with `reason: null` | 0 | 1 |
| `__proto__` activity key (flaggedActivityCount) | 1 row | 2 |

Causes: recount does not dedupe (`for` loop increments per entry, line 286-289), does not require `typeof entry.reason === 'string'` (line 286), and does not skip the `__proto__` key (line 263) while `derive-flagged.mjs` does all three. `data/best-effort-exclusions.json` is described as "Hand-maintained by the developer", so a duplicate or reason-less entry is a realistic edit, and when it happens the recount's `MATCH` verdict and the queue header will silently diverge.
**Fix:** Align the recount's exclusion filter to the queue's contract so the cross-check is a real contract, not a coincidence:

```js
const seen = new Set();
for (const entry of exclusions) {
  if (!entry || typeof entry.activityId !== 'string' || typeof entry.reason !== 'string') continue;
  if (entry.activityId === '__proto__' || seen.has(entry.activityId)) continue;
  seen.add(entry.activityId);
  exclusionsTotal += 1;
  if (flaggedSet.has(entry.activityId)) excludedWithinFlaggedCount += 1;
}
```

and `if (activityId === '__proto__') continue;` in the activities loop. Add the three fixtures above to `compute-pr-ceiling-recount.test.mjs` and to the derive-flagged cross-check.

### WR-03: Recount CLI makes the exclusions file mandatory, leaving the "unavailable" branch dead and its message misleading

**File:** `scripts/compute-pr-ceiling-recount.mjs:678-679, 691-693, 738-740`
**Issue:** `recountDemotedActivities` was designed to return `excludedWithinFlaggedCount: null` when the exclusions doc is absent, and `main()` prints "unavailable (exclusions document unreadable)" for that case. But `main()` also pushes any exclusions read failure into `readErrors` (line 679), and `evaluateReport` turns every `readErrors` entry into a failing problem. So the "unavailable" path can never coexist with a passing verdict from the CLI: a missing/unparseable `data/best-effort-exclusions.json` now fails the whole recount (including `--expect-demoted`/`--expect-cohort`, which have nothing to do with exclusions), while the code at line 738-740 reads as if it were a tolerated condition. One of the two intents is wrong.
**Fix:** Decide which contract holds and make the code say it. If the exclusions doc is optional for the recount (the function's shape says so), do not push its read failure into `readErrors` — record it separately and print the "unavailable" line:

```js
const exclusionsRead = readShippedJson(exclusionsPath);
const exclusionsWarning = exclusionsRead.ok ? null : exclusionsRead.reason;
// ... later, in the flaggedActivities block:
if (flaggedActivities.excludedWithinFlaggedCount === null) {
  console.log(`    of which already excluded: unavailable (${exclusionsWarning})`);
}
```

If it is mandatory, delete the `null` branch in `main()` and drop the `undefined` argument path from `recountDemotedActivities`'s contract (or keep it library-only and document that).

### WR-04: "Remove exclusion" button is revealed on rows that have no exclusion to remove

**File:** `scripts/curate-queue/index.ts:164-169, 193, 206-214`
**Issue:** `applyVisibility(excluded)` sets `removeButton.hidden = !excluded`, and the checkbox `change` handler calls `applyVisibility(checkbox.checked)`. Ticking a not-yet-excluded row therefore reveals a destructive-labelled "Remove exclusion" button whose confirm dialog says "deletes it and changes PR history" for an entry that does not exist. Pressing it sends `DELETE /__curate/exclusions/<id>`, which `applyRemove` treats as a filter no-op, rewrites and mirrors the (unchanged) file, and reloads the page — discarding whatever the developer had typed in the prefilled textarea. The inline comment (line 162: "Remove absent") describes the intended shape, not the implemented one. This is copied verbatim from `exclusion-panel.ts:117-122` (pre-existing), but the queue page multiplies the exposure across every listed row.
**Fix:** Gate the remove button on the stored state, not the checkbox:

```ts
function applyVisibility(formOpen: boolean): void {
  reasonLabel.hidden = !formOpen;
  textarea.hidden = !formOpen;
  saveButton.hidden = !formOpen;
  removeButton.hidden = !currentlyExcluded;
}
```

(`currentlyExcluded` is declared at line 171; hoist it above the function or convert to a `const` since it is never reassigned.) Apply the same fix to `exclusion-panel.ts` for consistency.

### WR-05: `QueueRow.detailUrl` is a dead field whose encoding disagrees with `activityDetailUrl`

**File:** `scripts/curate-queue/derive-flagged.mjs:36, 149`; `scripts/curate-queue/format.mjs:90-92`; `scripts/curate-queue/index.ts:245`
**Issue:** `deriveFlaggedActivities` builds `detailUrl` with the raw `activityId` (no `encodeURIComponent`), while `format.mjs` exports `activityDetailUrl` which encodes. `index.ts` uses only `activityDetailUrl`; `row.detailUrl` has no non-test consumer (`grep -rn detailUrl scripts src` finds only the definition and its test). Two builders of the same URL with different escaping is a latent divergence — the next consumer that reaches for `row.detailUrl` (the typed field on the row is the more discoverable one) gets the unencoded form.
**Fix:** Delete `detailUrl` from `QueueRow` and the derive test at `derive-flagged.test.mjs:210-220`, leaving `activityDetailUrl` as the single builder. If the field must stay for D-12 traceability, build it via the same encoding: `` detailUrl: `/strava-widgets/#/activity/${encodeURIComponent(activityId)}` `` and make the test assert on an id that needs encoding.

### WR-06: `formatPace` renders `NaN:NaN/km` for `undefined`; the derivation passes effort fields through unvalidated

**File:** `scripts/curate-queue/format.mjs:33-39`; `scripts/curate-queue/derive-flagged.mjs:127-133`; `scripts/curate-queue/index.ts:261-263`
**Issue:** `deriveFlaggedActivities` is documented as tolerant of malformed input but copies `effortEntry.distance/durationSec/paceSecPerKm` and `demotion.guard/reason` without type checks. `formatPace` only guards `null` and `NaN`, so a missing `paceSecPerKm` renders `NaN:NaN/km` (confirmed: `formatPace(undefined) === 'NaN:NaN/km'`; also `formatPace(-5) === '-1:-5/km'`), and a missing `distance`/`guard`/`reason` renders the literal string `undefined` in the row text. `formatEffortDuration` and `formatActivityDate` already handle this correctly; `formatPace` is the odd one out. The live archive currently has all 65 flagged efforts well-formed, so this is latent, not active.
**Fix:**

```js
export function formatPace(secPerKm) {
  if (typeof secPerKm !== 'number' || !Number.isFinite(secPerKm) || secPerKm < 0) return '—';
  ...
}
```

and add `formatPace(undefined)` / `formatPace(-5)` cases to `format.test.mjs`. Optionally coerce `distance`/`guard`/`reason` to `typeof === 'string' ? value : '—'` in `derive-flagged.mjs:127-133`.

## Info

### IN-01: CSP docblock and test title claim inline style is forbidden; the policy allows it

**File:** `scripts/curate-server.mjs:257-260, 285`; `scripts/curate-server.test.mjs:163-166, 185-188`
**Issue:** The `renderQueuePage` docblock says "a strict CSP forbidding inline script/style" and the test is titled "contains no inline `<style>` block — the CSP forbids it", but the emitted policy is `style-src 'self' 'unsafe-inline'` (as 29-06-PLAN.md specified). The queue client uses no inline style (`curate-queue.test.mjs` pins that), so `'unsafe-inline'` is unnecessary here.
**Fix:** Either drop `'unsafe-inline'` from `style-src` (tightening to match the docblock and D-09), or correct the docblock and test title to say only inline *script* is forbidden.

### IN-02: Live cross-check test's `undefined` exclusions fallback can never pass

**File:** `scripts/curate-queue/derive-flagged.test.mjs:338-346`
**Issue:** When `EXCLUSIONS_PATH` is absent the test passes `undefined` to both functions, then asserts `summarizeQueue(rows).excludedCount` (a number, `0`) equals `recount.excludedWithinFlaggedCount` (`null`). The `existsSync` guard suggests the author expected the absent case to be tolerated; it is not. `data/best-effort-exclusions.json` is committed so this is currently unreachable, but the fallback is misleading.
**Fix:** Either `describe.skipIf(!existsSync(BEST_EFFORTS_PATH) || !existsSync(EXCLUSIONS_PATH))`, or only assert the excluded-count equality when the exclusions doc was loaded.

### IN-03: Error-fallback empty state gives a misleading diagnosis

**File:** `scripts/curate-queue/index.ts:355-361, 108-114`
**Issue:** The `DOMContentLoaded` catch path calls `appendEmptyState(main, null)`, which appends "dist/widgets is likely not built, or data/stats/best-efforts.json is missing." That text is correct for a `null` document but wrong for a render-time exception (the only way to reach this catch, since all three loaders and the derivation are never-throw). The fallback page also omits the heading and Recompute control.
**Fix:** Pass a distinct reason (e.g. a third parameter or a second helper) so the fallback says "The queue failed to render — see the browser console." rather than blaming the build.

### IN-04: 403 response body duplicated four times

**File:** `scripts/curate-server.mjs:734-740, 757-763` (new), `scripts/curate-server.mjs:561-567, 808-814` (pre-existing)
**Issue:** The identical `writeHead(403)` + two-line message block now appears four times. A future wording change or header addition (e.g. `Cache-Control: no-store`) has to be applied in four places.
**Fix:** Extract `function respond403(res) { ... }` beside `respond500` and call it from all four sites.

### IN-05: Recount `flaggedActivityIds.sort()` and derive test comparison rely on default string sort

**File:** `scripts/compute-pr-ceiling-recount.mjs:271`; `scripts/curate-queue/derive-flagged.test.mjs:347`
**Issue:** Both sides use `Array.prototype.sort()` with no comparator, which is correct for string ids but would silently mis-order if ids ever became numbers (index.json already uses numeric `id`). Not a bug today; noting because the cross-check's correctness depends on both sides choosing the same accidental default.
**Fix:** Use an explicit comparator on both sides: `.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))`.

---

_Reviewed: 2026-09-18T11:07:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
