---
phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
reviewed: 2026-09-19T14:40:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - scripts/lib/copy-data-tree.mjs
  - scripts/lib/copy-data-tree.test.mjs
  - scripts/lib/stream-files.mjs
  - scripts/compute-pace-quality-calibration.mjs
  - scripts/compute-pace-residual.mjs
  - scripts/compute-pace-residual.test.mjs
  - scripts/compute-pr-ceiling-calibration.mjs
  - scripts/compute-pr-ceiling-calibration.test.mjs
  - scripts/compute-pr-ceiling-diff.mjs
  - scripts/compute-pr-ceiling-diff.test.mjs
  - scripts/compute-pr-ceiling-recount.mjs
  - scripts/compute-pr-ceiling-recount.test.mjs
  - scripts/curate-queue/derive-flagged.mjs
  - scripts/curate-queue/derive-flagged.test.mjs
  - scripts/curate-queue/index.ts
  - src/analytics/__fixtures__/best-effort-exclusions.fixture.json
  - src/analytics/best-effort-ceiling.ts
  - src/analytics/best-effort-ceiling.test.ts
  - src/analytics/compute-best-efforts.test.ts
  - src/dashboard/views/detail-best-efforts-logic.test.ts
  - src/dashboard/views/records-logic.ts
  - src/dashboard/views/records-logic.test.ts
findings:
  critical: 1
  warning: 3
  info: 8
  total: 12
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-09-19T14:40:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the diff from `7cb7c793^..HEAD` across the 22 listed files (1,397 insertions / 150 deletions), with the six verification targets from the review brief checked explicitly. All nine touched test files pass locally (260 tests). Results against the brief:

| Brief item | Verdict |
|---|---|
| Recount imports nothing from the classifier or queue code | **Holds.** `scripts/compute-pr-ceiling-recount.mjs` imports only `fs`, `path`, `url` (lines 60-62); no dynamic `import()`. |
| `copyJsonTree` size-then-digest cannot skip a same-size different-content file; log fires only on same-size replacements | **Holds.** `shouldCopy` starts `true` and is only cleared on a digest match (lines 50-66); the log sits inside the same-size/different-digest branch only. Two info items on the log line (IN-01, IN-02). |
| `records-logic.ts` `other` bucket cannot let total and breakdown disagree | **Holds.** `countDemotedAtDistance` increments `total` and exactly one bucket per iteration; `other` is a required field so no literal can omit it. |
| `derive-flagged.mjs` malformed counting matches the recount's four classes so the two cannot silently diverge | **Does not hold.** Two concrete divergences reproduced with `node` (CR-01, WR-02); no cross-implementation parity test exists. |
| 3-dp margin cannot render a negative or zero margin | **Half holds.** Negative is impossible (strict `>` guard). Zero is reachable: any margin below 0.0005 m/s renders `by 0.000 m/s` (WR-01, reproduced). |
| `export { } from` pitfall fully fixed in `compute-pace-quality-calibration.mjs` | **Holds.** Line 48 is a real `import`, line 49 a separate `export { }`; both sweep call sites (473, 487, 491) use the local bindings. |

The D-01/D-02/D-03 fixture decoupling is clean: exactly one test reads the live file, the fixture entries match the live file byte-for-byte today, and the mutation test writes only under `tmpDir`. The WR-07/WR-08 generator fixes are numerically correct against today's archive (19 non-excluded + 13 owner-excluded = 32, matching the shipped document per-distance), but the rendered reconciliation sentence asserts that identity without measuring it (WR-03).

## Critical Issues

### CR-01: Recount fails open on non-object exclusion entries, diverging from the queue's malformed count

**File:** `scripts/compute-pr-ceiling-recount.mjs:290`
**Issue:** D-08 says a malformed exclusions entry must make the recount exit non-zero, and the review brief asks that the queue and the recount cannot silently diverge on the same file. Line 290 (`if (!entry || typeof entry !== 'object') continue;`) silently drops a `null`, string, number or boolean entry without pushing to `malformedExclusions`, so the verdict stays `pass: true`. `derive-flagged.mjs:68-77` counts the very same entry as malformed (`skippedCount += 1`). Reproduced:

```
exclusions: [null, { activityId: 'X', reason: 'ok' }]
  queue  countMalformedExclusions -> 1   (page shows "1 exclusion entries ignored (malformed)")
  recount malformedExclusions    -> []   (PASS, exclusionsTotal 1)

exclusions: ['garbage', 42]
  queue -> 2 malformed
  recount -> [] (PASS)
```

The recount is the CI-gating verifier; it is the one that must fail closed. The test file's "non-string activityId" case (`compute-pr-ceiling-recount.test.mjs`, "number, null, object") only covers `activityId: null` inside an object, never a `null` entry, so the gap is untested. There is also no test that asserts `countMalformedExclusions(doc) === recountDemotedActivities(doc, ...).malformedExclusions.length` on a planted document, which is the only thing that would have caught this (and WR-02) mechanically.

**Fix:**
```js
// scripts/compute-pr-ceiling-recount.mjs, replace line 290
if (!entry || typeof entry !== 'object') {
  malformedExclusions.push(`index ${i}: entry is not an object`);
  continue;
}
```
And add a parity test (in `derive-flagged.test.mjs`, which already imports both modules) over a planted document containing every class at once — `null` entry, primitive entry, non-string id, `__proto__`, empty reason, duplicate, and the WR-02 rejected-then-repeated pair — asserting `countMalformedExclusions(doc)` equals `recountDemotedActivities(emptyBestEfforts, doc).malformedExclusions.length`.

## Warnings

### WR-01: Ceiling demotion reason can still render `by 0.000 m/s` — the self-contradiction D-10 set out to remove

**File:** `src/analytics/best-effort-ceiling.ts:203-207`
**Issue:** `margin = impliedSpeedMps - ceilingMps` is strictly positive, so a negative margin is impossible, but `margin.toFixed(3)` rounds any margin below 0.0005 m/s to `0.000`. Reachable with ordinary inputs at the archive's 0.1 s duration resolution — a 1mi effort of 347.7 s against the live ceiling 4.6281 renders:

```
implied 4.629 m/s exceeds personal ceiling 4.628 m/s by 0.000 m/s (…)
```

and an implied speed of 4.6284 renders the fully self-contradictory `implied 4.628 m/s exceeds personal ceiling 4.628 m/s by 0.000 m/s`. The existing regex test (`best-effort-ceiling.test.ts:187`) uses `ceilingMps + 0.0001` and its pattern `by \d+\.\d{3} m\/s` accepts `by 0.000`, so it passes on exactly this output. Since the PR-04 re-sign (D-12) binds to these strings, a future archive can ship a sentence the reviewer signed against as "never self-contradictory".

**Fix:** Never render a zero margin; state the sub-resolution case explicitly, and keep implied/ceiling at 3 dp:
```ts
const marginText = margin < 0.0005 ? '<0.001' : margin.toFixed(3);
reason: `implied ${impliedSpeedMps.toFixed(3)} m/s exceeds personal ceiling ${derivation.ceilingMps.toFixed(3)} m/s by ${marginText} m/s (…)`
```
(or render the margin at 4 dp, the ceiling's own resolution, so it is always non-zero: `Math.max(margin, 0.0001).toFixed(4)` is not honest — use the ceiling's true precision instead). Add a test with `ceilingMps + 0.0001` asserting `not.toMatch(/by 0\.000 m\/s/)`, and tighten the regex at line 187 to reject `0.000`.

### WR-02: Recount and queue disagree on a valid entry that follows a rejected entry with the same id

**File:** `scripts/compute-pr-ceiling-recount.mjs:303-309` and `scripts/curate-queue/derive-flagged.mjs:79-83`
**Issue:** The recount adds `activityId` to `seenActivityIds` (line 307) before validating `reason` (line 309), so a later well-formed entry with the same id is reported as a duplicate of an entry that was itself rejected. The queue only records an id after the entry is accepted (`map.set`, line 83), so it accepts the later entry. Reproduced:

```
exclusions: [{ activityId: 'X', reason: '' }, { activityId: 'X', reason: 'ok' }]
  recount: malformed 2 ("X: reason is missing…", "X: duplicate activityId"), exclusionsTotal 0, excludedWithinFlagged 0
  queue:   malformed 1, row X excluded = true
```

Both surfaces do flag the file, so this is not silent, but the counts and the exclusion status of `X` differ between the two on the same bytes — the D-16 "matches exactly" cross-check between `excludedCount` and `excludedWithinFlaggedCount` breaks for a file the recount claims to have fully diagnosed. Whichever ordering is chosen, both modules must use it.

**Fix:** Move `seenActivityIds.add(entry.activityId)` below the reason check in the recount so only accepted entries claim an id (mirrors the queue and the pipeline's `buildExclusionIndex`), and cover it in the CR-01 parity test.

### WR-03: Calibration reconciliation sentence asserts agreement with the pipeline and the recount without reading either

**File:** `scripts/compute-pr-ceiling-calibration.mjs:750-760`
**Issue:** The new sentence states that `totalNonExcludedDemoted + totalOwnerExcludedAboveCeiling` "is the figure the pipeline reports as its total ceiling demotions and the one `compute-pr-ceiling-recount.mjs --expect-demoted` checks". The script never reads the shipped `demotion.guard === 'ceiling'` count or any recount output; it derives `k` afresh each run (`Math.ceil(k * 100) / 100`, line 253) while the pipeline's `CEILING_K` is a fixed 1.28. Today the numbers agree (verified: 19 + 13 = 32, per-distance identical). After archive growth moves the argmax ratio above 1.28, the calibration's ceilings diverge from the shipped ones and this sentence will print a confident false identity into an artifact of record — the same "prose that outlives its data" class WR-07 was fixing one paragraph earlier.

**Fix:** Count the shipped ceiling demotions in `buildCalibrationReport` (the document is already in hand) and render agreement as a measured statement:
```js
let shippedCeilingDemotions = 0;
for (const a of Object.values(bestEffortsDoc?.activities ?? {}))
  for (const e of a?.efforts ?? []) if (e?.demotion?.guard === 'ceiling') shippedCeilingDemotions++;
// render: `${sum} — ${sum === shippedCeilingDemotions ? 'matches' : 'DOES NOT MATCH'} the shipped document's ${shippedCeilingDemotions} ceiling demotions`
```
Add a render test for the mismatch branch.

## Info

### IN-01: Staleness log prints an absolute path and fires before the copy succeeds

**File:** `scripts/lib/copy-data-tree.mjs:63`
**Issue:** D-05 specifies `replaced stale dist/widgets/data/<path>`; `destPath` is `resolve()`d so the line prints `/Users/…/dist/widgets/data/<path>`, which is noisier to quote in a checkpoint plan and machine-specific. The log is also emitted before `copyFileSync` (line 68); if the copy throws, the last line on screen says "replaced".
**Fix:** Log `relative(process.cwd(), destPath)` after `copyFileSync` returns, e.g. set a `stale = true` flag in the digest branch and log inside `if (shouldCopy) { copyFileSync(...); if (stale) console.log(...) }`.

### IN-02: No test asserts the log stays silent on ordinary copies

**File:** `scripts/lib/copy-data-tree.test.mjs:106-137`
**Issue:** D-05 says ordinary rebuilds print nothing extra; the different-size and missing-destination tests do not spy on `console.log`, so a regression that logs on every copy would pass.
**Fix:** Add a `vi.spyOn(console, 'log')` to those two tests and assert zero calls.

### IN-03: `stream-files.mjs` claims a single owner while a third copy remains

**File:** `scripts/lib/stream-files.mjs:17-18`; `scripts/compute-elevation-calibration.mjs:63-74`
**Issue:** The header says the module "closes both by giving the filter exactly one owner", but `compute-elevation-calibration.mjs` still exports its own `idFromFilename`/`isStreamFile`. Not a behavioural bug today (the bodies are identical), but the very drift D-11 was closing.
**Fix:** Replace the elevation script's definitions with `import { idFromFilename, isStreamFile } from './lib/stream-files.mjs'; export { idFromFilename, isStreamFile };` (same shape as line 48-49 of the pace-quality script) so its `mod.isStreamFile` test keeps passing.

### IN-04: Unused import and use-before-declaration of the shared report fixture

**File:** `scripts/compute-pr-ceiling-calibration.test.mjs:15`, `:558`
**Issue:** `TARGET_METERS` is imported but never referenced (only mentioned in a test title). `SAMPLE_REPORT` is declared at line 558, after three `describe` blocks that reference it; it works only because `it` bodies run after module evaluation — any `describe`-level use (e.g. `it.each(SAMPLE_REPORT…)`) would throw a TDZ `ReferenceError`.
**Fix:** Drop the import; move `SAMPLE_REPORT` above its first use.

### IN-05: Stale comments in two tests

**File:** `src/analytics/best-effort-ceiling.test.ts:258`; `src/analytics/compute-best-efforts.test.ts:1023`
**Issue:** The ceiling test comment computes the margin against the unrounded `5.10976`; the code subtracts the rounded `ceilingMps` 5.1098 (margin 3.7402, same 3-dp text, different arithmetic). The compute-best-efforts comment says the premise test is "below" — it is above (line 981).
**Fix:** Correct both comments.

### IN-06: Pluralisation of the queue's malformed line

**File:** `scripts/curate-queue/index.ts:315`
**Issue:** Renders `1 exclusion entries ignored (malformed)`.
**Fix:** `${malformedCount} exclusion ${malformedCount === 1 ? 'entry' : 'entries'} ignored (malformed)`; the existing "flagged / already excluded" line is count-only so it does not have this problem.

### IN-07: Raw untrusted `activityId` echoed into the recount's problem lines

**File:** `scripts/compute-pr-ceiling-recount.mjs:293-311`
**Issue:** `offender` is the raw string from a hand-edited JSON file and is interpolated into terminal output; a value containing newlines or ANSI escapes can garble the FAIL list. Consistent with the file's existing pattern, so info only.
**Fix:** `JSON.stringify(entry.activityId)` when building `offender`, or reuse the diff script's `safeActivityId` idea (regex-validate, else print `(malformed id)`).

### IN-08: Empty-string `activityId` is "valid" to the queue and recount but malformed to the pipeline

**File:** `scripts/curate-queue/derive-flagged.mjs:71`; `scripts/compute-pr-ceiling-recount.mjs:293`; cf. `src/analytics/best-effort-exclusions.ts:39`
**Issue:** `{ activityId: '', reason: 'ok' }` counts toward `exclusionsTotal` in the recount and is accepted by the queue, while `buildExclusionIndex` drops it (`activityId.length === 0`). A third definition of malformed exists; today it only shifts `exclusionsTotal` by one and can never match a flagged id, so it is informational.
**Fix:** Add `entry.activityId.trim() === ''` to the non-string-id class in both modules, and include it in the CR-01 parity test.

---

_Reviewed: 2026-09-19T14:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
