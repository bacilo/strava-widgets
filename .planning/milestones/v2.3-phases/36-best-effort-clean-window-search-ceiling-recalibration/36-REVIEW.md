---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
round: 2
reviewed: 2026-11-25T00:00:00Z
depth: standard
diff_base: e55f0540
round_1_review: 1a3f88f4
files_reviewed: 14
files_reviewed_list:
  - package.json
  - scripts/compute-clean-window-before-state.mjs
  - scripts/compute-clean-window-before-state.test.mjs
  - scripts/compute-clean-window-diff.mjs
  - scripts/compute-clean-window-diff.test.mjs
  - scripts/compute-clean-window-recount.mjs
  - scripts/compute-clean-window-recount.test.mjs
  - src/analytics/best-effort.types.ts
  - src/analytics/compute-best-efforts.test.ts
  - src/analytics/compute-best-efforts.ts
  - src/dashboard/views/detail-best-efforts-logic.test.ts
  - src/dashboard/views/detail-best-efforts-logic.ts
  - src/dashboard/views/records-logic.test.ts
  - src/dashboard/views/records-logic.ts
round_1_disposition:
  CR-01: closed
  WR-01: closed
  WR-02: closed
  WR-03: closed
  WR-04: closed
  IN-01: open
  IN-02: open
  IN-03: open
  IN-04: partially_closed
  IN-05: open
  IN-06: open
findings:
  critical: 0
  warning: 3
  info: 10
  total: 13
status: issues_found
---

# Phase 36: Code Review Report (Round 2)

**Reviewed:** 2026-11-25
**Depth:** standard
**Files Reviewed:** 14 (diff `e55f0540..HEAD`, each read in the context of the whole file)
**Status:** issues_found

This file replaces the round-1 review. Round 1 (CR-01, WR-01..WR-04, IN-01..IN-06) is preserved in git at `1a3f88f4`.

## Summary

Round 2 covers gap-closure plans 36-15..36-18:
- **36-15:** the diff generator applies the OLD ceiling and adds the `excluded` and `demoted-guard-changed` kinds.
- **36-16:** a new leg 4 runs the pre-phase pipeline from `ebe0245c`.
- **36-17:** the WR-02 contract is written down and enforced at the writer and in the recount.
- **36-18:** the badge copy and the Records count are made truthful.

**All five round-1 Critical and Warning findings are closed.** The fixes do what their findings asked. Leg 4 is a real independent check: it runs the shipped pre-phase code rather than a second reconstruction. It went red on the pre-fix artifact (52 disagreements, ceiling 15 vs 0) and green on the regenerated one (90/90).

I checked the write paths:
- `FileStore` resolves absolute paths with `path.resolve`.
- Both pipelines get temp `statsDir` and `ceilingStatePath`.
- The pre-phase pipeline's conditional ceiling-state write therefore lands in `mkdtemp`.
- No new test writes a tracked file. The real-pair test only reads `data/activities` and `data/streams`.

**Three new defects:**
- **WR-01 (leg 2):** the rewritten leg 2 now counts the same set twice. It cannot disagree on any document the generator produces, so "four green legs" is really three legs plus a check that always passes.
- **WR-02 (leg 4):** leg 4 only checks the old rank rows that the diff chose to render, and only the reinstatement *counts*. It cannot detect a row or a pair the diff left out.
- **WR-03 (recount):** the narrowed recount rule blocks one forbidden guard instead of allowing the permitted ones. A contaminated effort with an unknown or missing demotion guard passes.

None of the three changes a shipped number today, so none is a Blocker. Each one weakens the evidence PR-09's re-signature rests on.

## Round-1 Disposition

| ID | Status | Evidence |
|---|---|---|
| CR-01 | **CLOSED** | The OLD ceiling is derived from the pre-ceiling reconstruction, then applied with the shipped `ceilingDemotion` (`compute-clean-window-diff.mjs:200-210`, `:1047-1049`, `:1066-1068`). Precedence never overwrites an absolute guard (`:203`). The real-pair test feeds real archive data (activity 3475714424) with pre-phase ceilings pinned from `ebe0245c`, and asserts `ceiling.length === 1` (`compute-clean-window-diff.test.mjs:259-292`). It has a watched red. Leg 4 independently confirms 15 ceiling reinstatements, the per-distance split, all seven ceilings-before, and every rendered old rank row (36-19-SUMMARY:44). |
| WR-01 | **CLOSED** | `excluded` is checked first (`compute-clean-window-diff.mjs:266-267`). The headline discloses the excluded count (`:709-712`) and a per-distance section renders it. Leg 4's own exclusion rule (`compute-clean-window-before-state.mjs:101`) agrees with the artifact. |
| WR-02 | **CLOSED** (contract chosen: contaminated and demotion are independent) | Docblocks: `best-effort.types.ts:101-107, 132-143, 196-201, 214-223` and `compute-best-efforts.ts:471-477`. Writer tests: Branch-2 max-speed, Branch-3 forbidden pair, and an orchestration ceiling case with the ceiling computed by hand (`compute-best-efforts.test.ts:552-590, 2916-3008`). The recount is narrowed to the one impossible pair (`compute-clean-window-recount.mjs:563`), but see new **WR-03** on how it was narrowed. |
| WR-03 | **CLOSED** | The badge word follows rank: `ranks = !row.excluded && !row.demoted` (`detail-best-efforts-logic.ts:307-315`). It is pinned by a 5-test describe (`detail-best-efforts-logic.test.ts:531`). |
| WR-04 | **CLOSED** | `countContaminatedAtDistance` now skips demoted efforts (`records-logic.ts:406`), so it is disjoint from `countDemotedAtDistance` by construction. Test at `records-logic.test.ts:945`. |
| IN-01 | OPEN | The recount still prints no control-population false-pass rate for the p75 floor. |
| IN-02 | OPEN | `pace-single-source.test.ts:1294` still calls `vi.doUnmock` inside the `try` and not in the `finally` (`:1301`). File out of round-2 scope. |
| IN-03 | OPEN | `pace-single-source.test.ts:1290` `paceMinSec` still floors before rounding. |
| IN-04 | PARTIALLY CLOSED | The generator still reconstructs from `round1`'d durations. Leg 4 now evaluates unrounded production output and agreed 90/90, so a boundary flip would now be caught. The generator itself still has the ±0.05 s exposure, and its provenance section does not state it. |
| IN-05 | OPEN | `contaminatedDurationSec`/`contaminatedPaceSecPerKm` are still populated (`detail-best-efforts-logic.ts:226-227`) and read by no non-test code. |
| IN-06 | OPEN | The note still says "the segment [is] named" (`records-logic.ts:433`), while reasons are capped at two segments. |

## Warnings

### WR-01: Leg 2 (`reconcileCounts`) now counts the same set twice and can never disagree

**File:** `scripts/compute-clean-window-diff.mjs:452-488`, called at `:636-640`

**Issue:** Before this round, leg 2 compared a *classified bucket* (newly-demoted, moved-but-ranked) with a walked total. That comparison could and did disagree, and the disagreement was informative. 36-15 changed both checks to sum "across every kind":
- check 1 counts `c.newGuard === 'unreliable-segment'` over every change;
- check 2 counts `c.contaminatedReason != null` over every change.

`changes` comes from `classifyEffortChanges(newDoc, …)`, which emits exactly one change per effort in `newDoc` and throws if any effort lacks an OLD record. `guardCounts` comes from `walkGuardCounts(newDoc)` over the same efforts. Both sides therefore read the same field off the same efforts of the same document. The classification never enters either sum, so the check passes by construction.

The only reachable disagreements are degenerate:
- an effort with an unknown `distance`, which the reconstruction skips and so already throws;
- a `contaminated` record whose `reason` is `null`.

The tests that show leg 2 disagreeing (`compute-clean-window-diff.test.mjs:541-610`) hand-build `changes` and `guardCounts` independently. `main()` never does that. This is the "asserts internal agreement, not an independent value" pattern. The 36-19 claim that "all four reconciliation legs are green" counts leg 2 as evidence, but it is a check that cannot fail.

**Fix:** Make leg 2 compare a classification-dependent figure with an independent walk. For example, reconcile the per-kind partition against the walk:
```js
// every walked contaminated effort must be in exactly one of the kinds that may carry it,
// and moved-but-ranked must equal walked(contaminated && demotion == null && !excluded)
const walkedMovedRanked = countWhere(newDoc, e => e.contaminated != null && e.demotion == null && e.excludedFromRecords !== true);
rows.push({ check: 'moved-but-ranked + reinstated-with-contamination vs walked ranked-contaminated',
  listsFigure: (addends['moved-but-ranked'] ?? 0) + reinstatedWithContamination, walkedFigure: walkedMovedRanked, ... });
```
Then add a test that runs `classifyEffortChanges` and `walkGuardCounts` on **one** hand-built document with a planted misclassification, and assert `agrees === false`. Alternatively, keep the current rows but stop counting them as a reconciliation leg in 36-VALIDATION.md and say so.

### WR-02: Leg 4 only checks the rows and counts the diff chose to render, so omissions are invisible

**File:** `scripts/compute-clean-window-before-state.mjs:264-307` (rank rows `:285-299`)

**Issue:**
- **Rank rows.** These are checked only for positions the artifact renders under `## Rank Changes`. The generator renders a position only when its reconstructed OLD ranking differs from NEW (`compute-clean-window-diff.mjs:374-377`). Suppose the reconstruction's OLD row equals NEW at some position while the real pre-phase ranking differs. The diff omits that row and leg 4 never looks at it. Leg 4 has everything needed to close this (`oldDoc.rankings` and `newDoc.rankings`) but never compares the unrendered positions. A distance with no rendered rows ("No rank position changed at: …") gets zero old-rank checks.
- **Reinstatements.** These are reconciled as per-distance counts only. `ceilingPairs` (`:109-114`) is derived and printed but never compared with the pairs the artifact lists. Two compensating misattributions at the same distance would pass.

This is the before-state counterpart of round-1's CR-01, where the generator could only see what it already computed.

**Fix:**
```js
// in reconcileBeforeState(derived, parsed, oldDoc, newDoc):
for (const d of TARGET_ORDER_LOCAL) {
  const rendered = new Set(((parsed.oldRankRows ?? {})[d] ?? []).map(r => r.rank));
  const oldR = oldDoc.rankings?.[d] ?? [], newR = newDoc.rankings?.[d] ?? [];
  for (let i = 0; i < Math.max(oldR.length, newR.length); i++) {
    if (rendered.has(i + 1)) continue;
    const same = oldR[i]?.activityId === newR[i]?.activityId && oldR[i]?.durationSec === newR[i]?.durationSec;
    rows.push({ check: `unrendered rank ${d} #${i + 1} unchanged`, derived: same, artifact: true, agrees: same });
  }
}
```
Also parse the artifact's reinstated-pair table and compare its `activityId|distance` set with `ceilingPairs` and the absolute-guard pairs.

### WR-03: The narrowed recount rule blocks one guard instead of allowing three, so unknown guards pass

**File:** `scripts/compute-clean-window-recount.mjs:563`; docblock `:532-537`

**Issue:** The docblock states the contract as an allow-list: a contaminated effort "MAY also carry a world-record, max-speed or ceiling demotion". The code implements a deny-list: it only reports `demotion.guard === 'unreliable-segment'`. A contaminated effort whose demotion has a misspelled guard, a guard added later, or no `guard` field at all (`{ reason: 'x' }`) produces zero violations.

Before this round, the same check reported *any* demotion on a contaminated effort, so it failed closed. The narrowing turned it into a fail-open check. The new tests only cover the three permitted guards and the one forbidden guard (`compute-clean-window-recount.test.mjs:500-526`), so this gap is not exercised.

**Fix:**
```js
const PERMITTED_WITH_CONTAMINATED = new Set(['world-record', 'max-speed', 'ceiling']);
if (hasContaminated && hasDemotion && !PERMITTED_WITH_CONTAMINATED.has(effort.demotion.guard)) {
  violations.push(`${label}: contaminated record with demotion guard ${JSON.stringify(effort.demotion.guard)} — only world-record, max-speed or ceiling may accompany it (WR-02 contract)`);
}
```
Add planted tests for `guard: 'typo'` and a demotion object with no `guard` field.

## Info

### IN-07: An old rank row whose OLD side is legitimately empty can never pass leg 4

**File:** `scripts/compute-clean-window-before-state.mjs:288-296`

**Issue:** The generator renders a position present only on the NEW side with `—` in the old columns. Leg 4 then sets `derivedText = null` when the pre-phase ranking also has no entry at that rank, and `agrees` requires `derivedText !== null`. Both sides agree that there is no entry, yet the row fails. Today no such row exists (90/90 agree). A distance whose top-N grows from fewer than 10 entries (half, for example) would make leg 4 permanently red.

**Fix:** Map a missing pre-phase entry to `'— —'` before comparing, so that "absent on both" agrees.

### IN-08: Leg 4 silently drops unrecognised distances and can produce zero ceiling rows

**File:** `scripts/compute-clean-window-before-state.mjs:98`, `:241`

**Issue:**
- `if (!(d in out.excluded)) continue;` discards a pair with an unknown distance without counting it anywhere. Contrast `onlyInOld` and `unknownOldGuard`, which are counted.
- `compareCeilingsBefore` skips a distance that is absent on both sides. If the table header is found but has no rows, and `oldDoc.ceilings` is missing, it returns `[]`, a vacuous pass for that check.

**Fix:** Count unknown distances into a reconciled-to-0 row. Emit one failing row when `compareCeilingsBefore` would return no rows.

### IN-09: `findForbiddenImports` misses re-exports and `require`

**File:** `scripts/compute-clean-window-before-state.mjs:316-326`

**Issue:** The guard regexes cover `import … from` and `import()`. They do not cover `export { x } from '…/compute-clean-window-diff.mjs'` or `createRequire(...)('…')`, so leg 4's independence guarantee depends on contributors not using those forms.

**Fix:** Add `\bexport\b[^'"`;]*?\bfrom\s*['"`]…` and `\brequire\s*\(\s*['"`]…` patterns, each with a planted-hit test.

### IN-10: Stale wording survives the WR-02 contract change

**File:** `src/dashboard/views/records-logic.ts:366`; `scripts/compute-clean-window-diff.mjs:118-123`; `src/dashboard/styles.css:422-427` (out of scope, comment only)

**Issue:**
- The CSS comment still says a contaminated effort "still ranks — the opposite claim from .badge--demoted". Under the WR-02 contract both badges can appear on one row.
- Two docblocks still quote the probe figure "~1,200" moved-but-ranked. The regenerated diff measures 1044.

**Fix:** Reword the CSS comment to "which window was measured, independent of rank". Drop or date the probe figures.

### IN-01, IN-02, IN-03, IN-04 (partial), IN-05, IN-06: carried from round 1

These are unchanged except IN-04. See the disposition table above and the round-1 text at `1a3f88f4`. These six make up the remaining Info count.

---

_Reviewed: 2026-11-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Round 1 preserved at commit 1a3f88f4_
