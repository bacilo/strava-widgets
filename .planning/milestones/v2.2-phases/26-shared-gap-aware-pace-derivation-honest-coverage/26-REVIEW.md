---
phase: 26
status: issues_found
depth: standard
reviewed: 2026-09-10
review_round: 3
files_reviewed: 7
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
critical: 0
warning: 2
prior_round_dispositions:
  CR-01: resolved
  WR-01: resolved
  CR-02: resolved
  CR-03: resolved
files_reviewed_list:
  - src/dashboard/views/detail-charts-logic.ts
  - src/dashboard/views/detail-charts-logic.test.ts
  - src/analytics/pace-single-source.test.ts
  - src/analytics/trimp.ts
  - src/dashboard/views/list.ts
  - src/dashboard/views/list.test.ts
  - src/analytics/compute-dashboard-index.test.ts
---

# Phase 26 Code Review — Round 3 (gap-closure 26-14 / 26-15 / 26-16)

**Reviewed:** 2026-09-10
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

> **Document layout.** This round's findings come first. Round 2 (including its own preserved Round 1
> archive, the orchestrator's CR-01 downgrade, and the CORRECTION that retracted it) is preserved
> verbatim below under "Round 2 archive". Nothing from either prior round has been edited or deleted.

## Structural Findings (fallow)

No `<structural_findings>` substrate was supplied for this round.

## Narrative Findings (AI reviewer)

Scope: the three files plan 26-14 changed in production code and tests (`detail-charts-logic.ts`,
`detail-charts-logic.test.ts`, `pace-single-source.test.ts`, `trimp.ts`), the two files plan 26-15
changed (`list.ts`, `list.test.ts`), and the one file the orchestrator's timeout fix touched
(`compute-dashboard-index.test.ts`). 26-16 made no source changes (checkpoint/documentation only,
confirmed by `git diff f1c9feaa..HEAD --stat`).

Both open Criticals were re-verified by executing the code against the real committed archive and the
real built output — not by reading the plan summaries' claims — per this round's mandate.

### CR-03 — CONFIRMED RESOLVED

`buildChannelSeries`'s pace branch (`detail-charts-logic.ts:101`) now calls
`derivePaceWithCoverage(stream).paceSeries` directly, the identical call `detail.ts:717` makes for the
histogram/caption/splits, over the identical `detail.stream` object. `derivePaceWithCoverage` is pure
and deterministic (`pace-derivation.ts:448-467`: `classifyGaps` → `adaptiveWindowSec` →
`derivePaceSeriesGapAware`, no hidden state), so two calls on the same stream cannot diverge. The
fixed-20s `derivePaceSeries` wrapper and `PACE_SMOOTHING_WINDOW_SEC` are gone —
`grep -rn "derivePaceSeries\b|PACE_SMOOTHING_WINDOW_SEC" src/` returns nothing. Re-ran Round 2's own
divergence probe against the current `dist/` build on all three previously-diverging activities plus
the control:

```
5059204779  windowSec=150                 chart===histogram-derived series: true  (1841 pts)
4598855187  windowSec=247.5               chart===histogram-derived series: true  (2344 pts)
3647739864  windowSec=221.00000000000009  chart===histogram-derived series: true  (2406 pts)
4556693525  windowSec=20 (floor, control) chart===histogram-derived series: true  (1682 pts)
```

Every activity Round 2 cited as disagreeing now agrees exactly, index-for-index, between the chart
band and the histogram/caption derivation. `detail-charts-logic.ts:5-16`'s header comment states this
claim accurately and the permanent `CR-03` describe block in `detail-charts-logic.test.ts` pins it
with `5059204779` as the non-vacuous discriminator (`windowSec` measured 150s, exceeding the floor) —
a real regression test, not a tautology, confirmed by reading the RED transcript in `26-14-SUMMARY.md`
(3/5 CR-03 tests failed before the fix, with the exact `t=175: 66.45 s/km vs 498.34 s/km` divergence
quoted) and by independently re-running `npx vitest run detail-charts-logic.test.ts` (39/39 green) and
`npx tsc --noEmit` (clean) myself. **CR-03 is closed.**

### CR-02 — CONFIRMED RESOLVED

Both `statusBadgeTexts` (`list.ts:356`) and `appendStatusBadges` (`list.ts:392-401`) now read
`paceDisagreement` exclusively through the exported `rowPaceDisagreement(row)` helper
(`list.ts:333-335`, `return row.paceDisagreement ?? null`), and `appendStatusBadges` hoists the
narrowed value to a single local (`const disagreement = rowPaceDisagreement(row)`) used for both the
dispatch condition and the value passed to `appendPaceDisputedBadge` — so the two decisions cannot
independently re-read `row.paceDisagreement` and drift the way `:341`/`:380` did pre-fix. Confirmed
`grep -c "row.paceDisagreement !== null" list.ts` is `0` and `grep -c "rowPaceDisagreement(row)"` is
`2`. Reproduced the fix at runtime against the actual built output with a row object that genuinely
lacks the key (not `paceDisagreement: undefined`, which is a different object shape):

```
badges for missing-key row: [ 'No HR' ]        // no "Pace disputed", no crash
rowPaceDisagreement(missing-key row): null
```

`detail.ts:631` already used the same `?? null` pattern before this round and is unchanged. Grepping
every production consumer of `paceDisagreement` (`grep -rln "paceDisagreement" src/` minus `.test.ts`
files) turns up exactly two: `list.ts` (fixed) and `detail.ts` (already safe). `overview.ts`'s
`buildRecentPrsCard`/`buildRecentActivitiesCard` render through the same shared `renderActivityRow`/
`buildTableRow` → `appendStatusBadges` path (`overview.ts` itself contains no independent badge or
`paceDisagreement` logic — grepped and confirmed), so all four surfaces (`activity-card`,
`activity-table`, `overview-prs`, `overview-activities`) inherit the fix from the single dispatch
point, as `list.ts`'s own D-11 comment claims. `calendar-logic.ts`, `trends-*.ts` and
`records-logic.ts` never read `paceDisagreement` at all. No third call site with the same
undefined-vs-null hazard was found. **CR-02 is closed.**

## Warnings

### WR-06: `pace-single-source.test.ts`'s new "load-bearing" claim for `derivePaceSeriesGapAware(` is falsifiable — a two-part evasion (aliased import + a non-literal window-key) produces zero matches

**File:** `src/analytics/pace-single-source.test.ts:235-238` (claim), `:240-247` (`OVERRIDE_LITERALS`),
`:271-292` (`findConfinedCallSites`)

**Issue:** The corrected docblock states, as an unconditional claim: *"`derivePaceSeriesGapAware(` is
the load-bearing check: it catches ANY direct call to the gap-aware primitive outside
`pace-derivation.ts` regardless of how the options object is written."* `findConfinedCallSites` is a
raw whole-file substring scan (`stripped.indexOf(literal, ...)`), not an AST-aware call-target
resolver — it has no concept of "this identifier resolves to the primitive" versus "this identifier is
an unrelated local variable with the same text." Reproduced against the exact audit logic
(`OVERRIDE_LITERALS` copied verbatim from the file, `findConfinedCallSites`'s algorithm re-implemented
line for line) with a planted file that aliases the import and builds the window key dynamically:

```ts
import { derivePaceSeriesGapAware as gapAwarePace } from '../../analytics/pace-derivation.js';
const FIXED_WIN = 20;
export function sneaky(t, d, gapIntervals) {
  const opts = {};
  opts['window' + 'Sec'] = FIXED_WIN;
  opts.gapIntervals = gapIntervals;
  return gapAwarePace(t, d, opts);
}
```

```
matches: []
```

Zero of the six `OVERRIDE_LITERALS` fire: the call site text is `gapAwarePace(`, not
`derivePaceSeriesGapAware(`, and no literal `windowSec:` / `windowSec,` / `windowSec }` substring
exists anywhere in the file. The claim that the primitive-name literal catches "ANY direct call …
regardless of how the options object is written" is therefore false — it is falsified by the
combination of an aliased import (which the "ANY direct call" half of the claim does not survive)
and a non-literal key (which the "regardless of how the options object is written" half does not
survive). Note the two conditions are independently necessary: aliasing alone does not evade the scan
(a second probe using the same alias but the literal `{ windowSec: 20, gapIntervals }` form is still
caught by the `windowSec:` literal, confirmed: `alias-only (windowSec: literal present) matches:
[ 'windowSec:' ]`), so this is a real but narrow hole, not a wide-open one — it requires a
deliberately obfuscated evasion, not an organically-written one. This is exactly the "audit whose
header claims completeness it has not demonstrated" failure class the same docblock (two paragraphs
earlier) says this phase keeps re-encountering, reproduced a third time in the same file that named
the first two instances.

**Fix:** Either soften the claim to name its actual scope (a heuristic textual scan over the literal
call and key names, not a semantic one — same honesty standard `pace-single-source.test.ts`'s own
opening docblock already applies to its known gaps), or close the gap for real with an AST-based check
(e.g. a TypeScript `ts.SourceFile` walk resolving import specifiers to their original binding before
matching call expressions, so aliasing cannot evade it) — a change proportionate to the file's own
stated ambition ("structural, not formatting"), not to the literal-scan's actual power today.

---

### WR-07: `rowPaceDisagreement`'s parameter type claims the key is always present — the exact fact its own docblock says cannot be assumed

**File:** `src/dashboard/views/list.ts:333` (signature), contradicted by `:319-331` (its own docblock)
and `src/analytics/dashboard-index.types.ts:130` (`ParsedDashboardIndexRow`)

**Issue:** `rowPaceDisagreement`'s docblock states plainly: *"no key can be assumed present on the read
side"* — the entire reason the function exists. Its actual signature does the opposite:

```ts
export function rowPaceDisagreement(row: Pick<DashboardIndexRow, 'paceDisagreement'>): PaceDisagreement | null {
  return row.paceDisagreement ?? null;
}
```

`Pick<DashboardIndexRow, 'paceDisagreement'>` is `{ paceDisagreement: PaceDisagreement | null }` — a
**required** key, per `DashboardIndexRow`'s own doc comment two lines above it in
`dashboard-index.types.ts` ("REQUIRED, deliberately … making this key optional would let
compute-dashboard-index.ts silently stop emitting it with no compile error"). That requiredness is
correct for the *writer* side, but every real call site here is on the *read* side: `statusBadgeTexts`
and `appendStatusBadges` both take `row: DashboardIndexRow`, and `index-client.ts`'s `getRows()`/
`getRow()` — the actual source of every row these functions ever see — hand out values typed
`DashboardIndexRow` after an unvalidated `(await response.json()) as DashboardIndexDocument` cast
(unchanged by this round; logged as a deliberate deferral in `deferred-items.md`). So the whole call
chain is statically typed as though the key can never be missing, while `rowPaceDisagreement`'s own
prose — and the CR-02 defect it exists to close — says the opposite is true at runtime. The `?? null`
guard is correct and does its job regardless of what TypeScript believes, but nothing in the type
system reflects why the guard is there; a future refactor that "notices" the type says the key is
always present and inlines `row.paceDisagreement` directly (exactly the change CR-02 fixed) would
compile cleanly and reintroduce the defect with zero compiler signal. The codebase already has the
correctly-shaped type for this exact hazard — `ParsedDashboardIndexRow = Partial<DashboardIndexRow> &
{ id: string }` — one line away in the same file, built for exactly this purpose, and unused here.

**Fix:**

```ts
export function rowPaceDisagreement(
  row: Pick<ParsedDashboardIndexRow, 'paceDisagreement'>
): PaceDisagreement | null {
  return row.paceDisagreement ?? null;
}
```

This is the narrowest possible change (one type parameter) and makes the signature assert exactly what
the docblock already claims — a genuinely-optional key — so a future caller passing a
`DashboardIndexRow` still type-checks (required is assignable to optional), but the function's own
contract stops silently overstating what it can rely on.

---

## Info

None this round.

## What I checked and found clean (Round 3 scope)

- `26-16` made no production or test source changes — confirmed via `git diff f1c9feaa..HEAD --stat`
  (only `.planning/` docs and `26-16-SUMMARY.md`/`26-VALIDATION.md`/`deferred-items.md`), so no
  additional source files were in scope beyond the seven reviewed here.
- `compute-dashboard-index.test.ts`'s archive-wide pace-disagreement sweep (Round 2 WR-03) now carries
  an explicit `60_000` timeout (`}, 60_000);` at the `it(...)` call), closing that finding as a
  byproduct of this round's file set — not re-flagged.
- `trimp.ts`'s only change is a rotted citation correction (pointed at `derivePaceSeriesGapAware`
  instead of the now-deleted `derivePaceSeries`); accurate, no behavioural change.
- `npx tsc --noEmit` is clean and `npx vitest run detail-charts-logic.test.ts pace-single-source.test.ts
  list.test.ts` passes 183/183 on the current tree.
- No hardcoded secrets, `eval`, `innerHTML`, or shell interpolation introduced by this round's diff.
- The `CR-03` and `CR-02` regression tests are both genuinely non-vacuous: `26-14-SUMMARY.md`'s RED
  transcript shows 3/5 CR-03 tests failing pre-fix with the real divergent values quoted, and
  `26-15-SUMMARY.md`'s RED transcript shows 4/6 CR-02 tests failing pre-fix with `expected [ 'Pace
  disputed' ] to deeply equal []`. Neither is a test that would pass regardless of the fix.

---

_Reviewed: 2026-09-10 (Round 3)_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
---

# Round 2 archive (2026-09-09) — preserved verbatim, do not edit

Everything below this line is the Round 2 report exactly as written, including its own preserved
Round 1 archive, the orchestrator's CR-01 downgrade, and the CORRECTION that retracted it.


# Phase 26 Code Review — Round 2 (post gap-closure 26-11 / 26-12 / 26-13)

**Reviewed:** 2026-09-09
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

> **Document layout.** This round's findings come first. The complete Round 1 report — including
> the orchestrator's CR-01 downgrade and the CORRECTION that retracted it — is preserved verbatim
> at the bottom under "Round 1 archive". Nothing from Round 1 has been edited or deleted.

## Narrative Findings (AI reviewer)

No `<structural_findings>` substrate was supplied for this round, so every finding below is
narrative, derived from reading the files and from executable probes against the committed archive
(`dist/` build + `data/streams/`). Probe commands and their raw output are quoted inline so a later
reader can re-run them rather than take the numbers on trust.

### Verification of the two prior findings

Both were re-tested against the live tree by executing the code, not by reading the summaries.

| ID | What it was | Verified disposition |
|---|---|---|
| **CR-01** | `buildBreakdownSection` gated the `Pace Distribution` heading *and* the D-08/COV-02 coverage caption behind `buckets.length > 0`, so real archive activity `11865310195` (33% covered / 67% recording gaps) rendered no section at all. | **RESOLVED.** Verified by probe, not by description. |
| **WR-01** | `paceHistogramSamples` documented an "INVARIANT: sum of every returned `timeSec` equals `coverage.coveredSec` EXACTLY" that an isolated zero-net-advance `covered` segment flanked by two recording gaps violates. | **RESOLVED.** Verified by probe. |

**CR-01 — evidence.** `breakdownSectionPlan` (`detail-sections.ts:497-523`) now computes
`captionText` from `coverage` alone and gates only `showBars` on `buckets.length`;
`buildBreakdownSection` (`:559-604`) is a pure emitter over that plan with no residual decision
logic (the only conditionals it contains are `plan.showPaceHeading`, `plan.captionText !== null`,
`plan.noteText !== null`, `plan.showBars`, `plan.showHrZones` — all plan fields, none re-derived).
Running the real production path against the real stream:

```
$ node probe.mjs   # derivePaceWithCoverage + computePaceDistribution + breakdownSectionPlan, dist/ build
coverage { spanSec: 18, coveredSec: 6, recordingGapSec: 12, pauseSec: 0,
           gapIntervals: [ { startSec: 2, endSec: 14, kind: 'recording-gap' } ] }
buckets  []
plan     { showPaceHeading: true,
           captionText: '33% of elapsed time covered · 67% recording gaps · 0% paused',
           showBars: false,
           noteText: 'No pace buckets — 0:06 of covered time produced no derivable pace.',
           showHrZones: false }
```

The activity that previously disappeared now renders a heading, the honest 33%/67% caption, and an
itemised note. The fix holds and introduced no new decision-in-the-emitter defect.

**WR-01 — evidence.** The false invariant is gone from the `paceHistogramSamples` doc comment
(`pace-derivation.ts:469-503`), replaced with an explicit statement that the bare sum is *not*
guaranteed, plus the itemised identity in `paceHistogramAccounting` (`:554-570`). The shape the
Round 1 finding predicted is now a permanent, reachable, non-vacuous test
(`pace-derivation.test.ts:521-560`). Re-derived independently:

```
$ node probe.mjs   # t = [0,12,14,26], d = [0,30,30,60]
WR01 cov  { spanSec: 26, coveredSec: 2, recordingGapSec: 24, pauseSec: 0, gapIntervals: [2] }
WR01 acct { samples: [], bucketedSec: 0, unbucketedCoveredSec: 2 }
```

`coveredSec (2) === bucketedSec (0) + unbucketedCoveredSec (2)`. An archive-wide re-run of the
identity across all 1,865 committed streams found **0 violations, 44 activities with
`unbucketedCoveredSec > 0`, 0 negative values** — matching plan 26-11's stated sweep. The
consumer (`breakdownSectionPlan:507`) **imports** `unbucketedCoveredSec` rather than re-deriving
the subtraction inline, satisfying PACE-01's single-derivation constraint at that seam.

Neither fix is carried forward as open. The findings below are **new**.

---

## Critical Issues

### CR-02: A pre-Phase-26 `index.json` makes every activity row render a false "Pace disputed" badge, then crashes the list and overview renders with a TypeError

**File:** `src/dashboard/views/list.ts:341` and `:380-381` (with `src/dashboard/data/index-client.ts:59`)

**Issue:** `paceDisagreement` is the new additive index field this phase introduces. `index.json`
is a *gitignored, CI-regenerated, separately-cached* artifact — `dashboard-index.types.ts:106-124`
says so explicitly and even ships a dedicated `ParsedDashboardIndexRow` type for exactly this
reason ("Serialization plus re-parse does not carry the producer's required-key guarantee, so no
key can be assumed present here"). `index-client.ts` ignores that type entirely and does an
unvalidated `(await response.json()) as DashboardIndexDocument` cast, so at runtime `getRows()`
hands out rows that may legitimately lack the key.

`statusBadgeTexts` then tests it with a strict `!== null`:

```ts
if (row.paceDisagreement !== null) {     // list.ts:341 — undefined !== null is TRUE
  texts.push(PACE_DISPUTED_BADGE_TEXT);
}
```

`undefined !== null` is `true`, so **every** row of an index that predates this field is labelled
"Pace disputed". `appendStatusBadges` then repeats the same wrong test and passes `undefined` into
a function that dereferences it:

```ts
} else if (text === PACE_DISPUTED_BADGE_TEXT && row.paceDisagreement !== null) {  // :380
  appendPaceDisputedBadge(container, idPrefix, row.paceDisagreement);             // :381 — undefined
```

`appendPaceDisputedBadge` → `paceDisputedExplanation(disagreement)` → `disagreement.streamPaceSecPerKm`
→ **TypeError**, thrown inside `renderActivityRow`/`buildTableRow`, i.e. inside the synchronous
list and overview render paths. Reproduced against the shipped build:

```
$ node -e "import {statusBadgeTexts, paceDisputedExplanation} from './dist/dashboard/views/list.js' ..."
badges for a pre-Phase-26 index row: [ 'Pace disputed' ]
paceDisputedExplanation(undefined) -> TypeError: Cannot read properties of undefined (reading 'streamPaceSecPerKm')
```

Reachability is not theoretical. This project has a recorded lesson about exactly this shape
("Staged-build browser cache trap — stale `index.html`/`index.json` in checkpoints"): a browser
holding a cached `index.json` while loading a newly deployed bundle hits it, as does any staged
build, any local run against a `data/dashboard/index.json` generated before this phase, and any
partial deploy. The same crash reaches four surfaces (`activity-card`, `activity-table`,
`overview-prs`, `overview-activities`) through the single `appendStatusBadges` dispatch.

Note that `detail.ts:631` reads the same field **correctly** — `getRow(detail.id)?.paceDisagreement ?? null`
— which shows the undefined case was considered at one call site and missed at the other. Every
test fixture (`list.test.ts:402`, `list-logic.test.ts:53`, `calendar-logic.test.ts`,
`overview.test.ts`, `trends-*.test.ts`, `gear-aggregate-logic.test.ts`) sets `paceDisagreement: null`
explicitly, so no test exercises the missing-key path at all.

**Fix:** Use a nullish test at both sites (and prefer a narrowing local so the second test cannot
drift from the first):

```ts
// list.ts:341
const disagreement = row.paceDisagreement ?? null;
if (disagreement !== null) {
  texts.push(PACE_DISPUTED_BADGE_TEXT);
}

// list.ts:376-384
function appendStatusBadges(container: HTMLElement, row: DashboardIndexRow, idPrefix: string): void {
  const disagreement = row.paceDisagreement ?? null;
  for (const text of statusBadgeTexts(row)) {
    if (text === LOW_CONFIDENCE_BADGE_TEXT) {
      appendLowConfidenceBadge(container, idPrefix);
    } else if (text === PACE_DISPUTED_BADGE_TEXT && disagreement !== null) {
      appendPaceDisputedBadge(container, idPrefix, disagreement);
    } else {
      appendBadge(container, text);
    }
  }
}
```

Add a permanent regression test that builds a row object **without** the `paceDisagreement` key
(cast through `ParsedDashboardIndexRow`, not `Partial<DashboardIndexRow>` with an explicit `null`)
and asserts `statusBadgeTexts(row)` returns `[]`. Separately, `index-client.ts` should type its
rows as `ParsedDashboardIndexRow` — the type the codebase already wrote for this exact hazard —
rather than casting raw JSON to the producer type.

---

### CR-03: The pace chart band and the pace histogram on the same detail page derive pace under **different** window widths and visibly disagree — while `detail-charts-logic.ts`'s own header states they cannot

**File:** `src/dashboard/views/detail-charts-logic.ts:80`, `:92-99`, `:120` (contract claim at `:5-9`)

**Issue:** `derivePaceWithCoverage` resolves the averaging window per activity via
`adaptiveWindowSec` = `max(20, 2.5 × p90(advance intervals))` (D-01/D-02). `detail.ts:717` uses it,
so the histogram, the coverage caption and the split gap markers all read the adaptive series.
The **chart band** does not. `buildChannelSeries` hard-codes the floor as the window:

```ts
const paceValues = derivePaceSeries(stream.t, stream.d, PACE_SMOOTHING_WINDOW_SEC); // :120, = 20
```

`PACE_SMOOTHING_WINDOW_SEC` is `PACE_WINDOW_FLOOR_SEC` (20s) — and `PACE_WINDOW_FLOOR_SEC`'s own
doc comment in `pace-derivation.ts:281-291` names the fixed-20s configuration as
"**the roadmap's demonstrated-failing case (PACE-03)**". The chart therefore still ships the
configuration this phase exists to replace.

This is not cosmetic. Measured across the committed archive:

```
$ node probe2.mjs
streams 1865, with adaptive window != the chart's 20s: 11
widest: 4598855187 -> 247.5s, 3647739864 -> 221.0s, 5059204779 -> 150.0s
activity 4598855187: max |chart - histogram| = 29656.7 sec/km at i=1389
                     (chart says 30000.0 sec/km, histogram says 343.3 sec/km)

$ node probe3.mjs   # Δt-weighted fraction of covered time faster than 3:00/km
4598855187  chart(20s) 42.72%   adaptive 0.00%
3647739864  chart(20s) 59.65%   adaptive  0.62%
5059204779  chart(20s) 94.80%   adaptive  1.17%
4556693525  chart(20s)  2.44%   adaptive  2.44%   <- unaffected (p90 small, window resolves to 20)
```

Those three activities are precisely the ones `PACE_WINDOW_P90_MULTIPLIER`'s doc comment cites as
"the roadmap's own cited windows (150s / ~230s / ~248s for the three 'recovered' activities)". They
are **not recovered on the chart**. On `5059204779` — the exemplar the phase's own browser
checkpoint reads back, and the one activity carrying the new "Pace disputed" badge — the Pace &
Effort chart band still shows 94.8% of covered time faster than 3:00/km while the Pace Distribution
histogram directly below it, on the same page, in the same paint, shows 1.17%. That is the
two-surfaces-disagreeing defect PACE-01 exists to eliminate, still shipping.

Two contract comments assert the opposite of what the code does — the exact COV-01 failure mode
this phase forbids:

- `detail-charts-logic.ts:5-9`: "*the chart and `detail-zones.ts`'s histogram both read the same
  gap-aware series so the two surfaces cannot disagree*" — false, demonstrated above.
- `detail-charts-logic.ts:76-80`: "*this constant is now a floor, not the only value*" — but it is
  the only value at the module's sole internal call site, `:120`.

`derivePaceSeries` also re-runs `classifyGaps` independently (`:97`) and returns a pace series with
**no** coverage attached — the precise thing D-16's single-entry-point contract
(`pace-derivation.ts:427-431`, "no caller can hold pace without coverage, so no caption can drift
from the histogram beside it") says must not be possible.

**Why nothing caught it:** `pace-single-source.test.ts`'s `OVERRIDE_LITERALS` scan looks for the
literal `windowSec:`. The bypass is written as ES2015 shorthand — `derivePaceSeriesGapAware(t, d, { windowSec, gapIntervals })`
at `:98` — and the fixed value arrives through a *named constant*, so the audit that exists to stop
exactly this passes it clean. The audit's own docblock even explicitly excuses this file
("would false-positive on `detail-charts-logic.ts`'s `derivePaceSeries` wrapper … and is not an
override of `derivePaceWithCoverage`'s adaptive resolution"), which is the reasoning error: passing
a fixed 20s in place of the adaptive resolution *is* the override.

**Fix:** Make the chart read the same resolved window as everything else, and delete the two false
contract claims:

```ts
// detail-charts-logic.ts — buildChannelSeries
import { adaptiveWindowSec } from '../../analytics/pace-derivation.js';

if (channel === 'pace') {
  const paceValues = derivePaceSeries(stream.t, stream.d, adaptiveWindowSec(stream.t, stream.d));
  ...
}
```

Better still, have `buildChannelSeries` call `derivePaceWithCoverage(stream)` directly so the chart
obtains pace *and* coverage together (honouring D-16) and `derivePaceSeries`'s coverage-less escape
hatch can be deleted. Then extend the single-source audit to catch the shorthand form — add
`windowSec,` and `windowSec }` to `OVERRIDE_LITERALS`, or scan for `derivePaceSeriesGapAware(`
call sites outside `pace-derivation.ts` — and add a test asserting that, for activity
`5059204779`, the chart series and the histogram series are the *same* array of values.

---

## Warnings

### WR-02: `paceDisagreement`'s contract says `null` NEVER means "not checked", but a stream read failure writes exactly that `null`

**File:** `src/analytics/dashboard-index.types.ts:88-102`, violated by `src/analytics/compute-dashboard-index.ts:219-236`

**Issue:** The field's doc comment states, absolutely: "*`null` NEVER means 'not checked' — the
writer always evaluates the check and assigns a value here.*" The writer does not. It reads the
stream inside a `try`, and on any read/parse failure logs a warning and assigns `paceDisagreement = null`
(`:229-234`) — the identical value it assigns for "checked, and the paces agree". A reader of the
published index cannot distinguish "this activity's metadata pace was cross-checked and is fine"
from "we could not read the stream, so we do not know". For a phase whose whole point is that
absence must never be readable as good news (D-08's "a healthy run visibly says so instead of the
reader having to read silence as good news"), collapsing unknown into clean is the wrong default —
and stating an invariant the code does not hold is the exact WR-01 shape COV-01 forbids.

Note also that this is not the same as the threshold gate: when `paceSecPerKm >= threshold` the
check is genuinely equivalent to `detectPaceDisagreement` returning `null`, so that branch is fine.
Only the catch branch is dishonest.

**Fix:** Either correct the comment to state the two things `null` actually means, or (preferred,
and consistent with the phase's own itemise-don't-hide discipline) model the unknown case
explicitly:

```ts
// dashboard-index.types.ts
export interface DashboardIndexRow {
  /** `null` = checked and not flagged. `'unchecked'` = the stream could not be read. */
  paceDisagreement: PaceDisagreement | null | 'unchecked';
}

// compute-dashboard-index.ts:229-234
} catch (error) {
  console.warn(`  ${id}: could not read stream for pace disagreement check (${(error as Error).message})`);
  paceDisagreement = 'unchecked';
}
```

If the field shape must stay binary, at minimum add a `paceDisagreementUnchecked` count to
`DashboardIndexTotals` alongside `skippedUnreadable`, so the failure is visible in the published
totals rather than only in a build log.

---

### WR-03: The archive-wide pace-disagreement sweep is a ~3,750-file sequential read running under vitest's 5,000 ms default timeout — a latent CI flake

**File:** `src/analytics/compute-dashboard-index.test.ts:905-947`

**Issue:** The `it(...)` at `:905` awaits `fs.readdir('data/activities')` and then, for each of
~1,890 activities, sequentially `await`s a `readFile` + `JSON.parse` of the activity JSON **and**
a second `readFile` + `JSON.parse` of the matching stream JSON (streams are hundreds of KB each),
then runs `detectPaceDisagreement` over both. That is roughly 3,750 sequential file reads and
parses inside a single test with no `timeout` option, so it inherits vitest's 5,000 ms default. It
has already been observed timing out at 5,007 ms under full-suite parallel load and passing at
4.13 s in isolation — a ~20% margin that shrinks every night as the archive grows (the file's own
header says "the archive grows nightly"). This is a flake that will fail CI on unrelated PRs and
train reviewers to re-run red builds.

The two adjacent tests (`:950`, `:965`) read only two files each and are not at risk.

**Fix:** Give the sweep an explicit timeout — the same disclosure discipline the rest of the phase
applies, made explicit rather than inherited — and stop re-parsing streams for activities whose
metadata pace cannot clear the gate:

```ts
it('flags exactly a handful of activities archive-wide, including 5059204779, at or under the 0.5% over-fire ceiling', async () => {
  ...
  const metadataPace = metadataPaceSecPerKm(activity);
  // The writer itself only reads the stream when the metadata pace clears the
  // threshold (compute-dashboard-index.ts:220) — mirror that here so the sweep
  // reads ~3 streams instead of ~1,865.
  if (metadataPace === null || metadataPace >= PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM) continue;
  ...
}, 60_000);
```

Note the gate mirrors the production writer exactly, so the assertion's meaning is unchanged;
`scanned` must then be incremented before the `continue` (as it already is at `:915`).

---

### WR-04: `computePaceDistribution` emits an unbounded number of buckets — 343 histogram rows, up to a `2499:45–2500:00/km` label, on a real archive activity

**File:** `src/dashboard/views/detail-zones.ts:94-120`, rendered by `src/dashboard/views/detail-sections.ts:404-424`

**Issue:** The bucket index is `Math.floor(paceSecPerKm / bucketWidthSec)` with no upper bound, and
`buildPaceDistributionRows` emits one `.distribution__row` per occupied bucket. Since Phase 26 the
histogram consumes the *smoothed windowed* series, which — unlike the old per-segment `dt/dd` path
that skipped every `dd <= 0` segment — produces enormous but finite paces wherever a near-standstill
window resolves to a tiny positive `metres`. Measured on the committed archive:

```
$ node probe4.mjs
max bucket rows 343 on activity 3475740798

$ node -e "... 3475740798 ..."
rows 343, first '4:30–4:45/km', last '2499:45–2500:00/km'
coveredSec 10490, bucketed 10490, top3 [ ['6:45–7:00/km',399], ['5:15–5:30/km',294], ['6:00–6:15/km',285] ]
rows above 20:00/km: 280, carrying 2454 sec

# same activity, the pre-Phase-26 per-segment path, for comparison:
legacy rows 80, range 225 .. 30015 sec/km
```

343 rows against a legacy 80 is a 4× regression in the rendered card, on this phase's own headline
surface (D-29's "always-on pace-distribution histogram"). 280 of the 343 rows are slower than
20:00/km, each rendered as a bar sized relative to a 399 s maximum, i.e. a wall of ~200 visually
indistinguishable sub-1%-wide rows below the three that carry the signal. The bucket *sum* is
still exactly correct (`bucketed 10490 === coveredSec 10490`), so this is a presentation defect,
not an accounting one — but "2499:45–2500:00/km" (41 hours per kilometre) is not a pace a reader
can act on, and burying the real distribution under it defeats the section's purpose.

**Fix:** Clamp the slow tail into a single terminal bucket rather than dropping it (dropping would
break the `coveredSec === bucketedSec + unbucketedCoveredSec` identity WR-01 just established):

```ts
// detail-zones.ts
/** Slowest bucket floor. Everything at or beyond this collapses into one open-ended bucket. */
export const PACE_BUCKET_MAX_SEC_PER_KM = 1200; // 20:00/km

const maxIndex = Math.floor(PACE_BUCKET_MAX_SEC_PER_KM / bucketWidthSec);
const index = Math.min(maxIndex, Math.floor(paceSecPerKm / bucketWidthSec));
```

and have the terminal bucket's `label` read `${formatPaceBound(minSecPerKm)}+/km` with `maxSecPerKm: null`
(or `Infinity`), so the collapse is disclosed rather than silently truncating the range. Add a test
pinning `computePaceDistribution(...).length` for `3475740798` and asserting the bucket sum still
equals `coverage.coveredSec` after the clamp.

---

### WR-05: `compute-pace-residual.mjs` writes to a hard-coded phase directory with no `mkdir`, so the D-19 regeneration Phase 27 depends on breaks the moment phase 26 is archived

**File:** `scripts/compute-pace-residual.mjs:35-38` and `:369` (`writeFileSync(OUTPUT_PATH, ...)`)

**Issue:** `OUTPUT_PATH` is pinned to
`.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md` and written
with a bare `writeFileSync`, which throws `ENOENT` when the parent directory does not exist. The
module docblock makes a load-bearing forward promise on top of that path: "*Phase 27 consumes
`26-RESIDUAL.md`'s residual list as pre-flagged input and re-derives it at its own boundary by
running `npm run compute-pace-residual` again, rather than trusting a transcribed table.*" This
project's milestone-close step moves phase directories under `.planning/milestones/vX.Y-phases/`
(a recorded lesson), at which point the script fails outright with an unhandled `ENOENT` and
Phase 27's re-derivation is silently unavailable — the failure mode being "the regenerable
deliverable turns out not to be regenerable", which is exactly the class of thing D-19 exists to
prevent.

Secondarily, `main()`'s `writeFileSync` is the one unguarded I/O call in a script whose stated
design (`:11-13`) is that "one unreadable stream cannot abort the sweep" — the whole sweep's work
is discarded on a write failure with a raw stack trace.

**Fix:**

```js
import { mkdirSync, writeFileSync } from 'fs';
...
try {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');
} catch (error) {
  console.error(`Failed to write ${OUTPUT_PATH}: ${error.message}`);
  process.exitCode = 1;
  return;
}
```

and accept an override so the path is not welded to one phase directory:
`const OUTPUT_PATH = process.env.PACE_RESIDUAL_OUT ?? join(__dirname, '../.planning/...')`.

---

## Info

### IN-01: The authoritative statement of `paceHistogramSamples`'s exclusion rule is a garbled, merged sentence

**File:** `src/analytics/pace-derivation.ts:490-496`

**Issue:** The doc comment reads: "*`gapIntervals` is a REQUIRED third argument, not an optional
flag that defaults to the leaky behaviour `derivePaceSeriesGapAware`'s window clipping deliberately
leaves the LAST sample before a gap non-null …*" — two sentences have been spliced together during
the WR-01 rewrite, dropping the clause that connected them. `detail-zones.ts:88-92` points readers
here for "the invariant's authoritative statement", so the one place that is supposed to explain a
genuinely subtle rule is unreadable at its key sentence.

**Fix:** Restore the break, e.g. "*… not an optional flag that defaults to the leaky behaviour.
The reason it must be required: `derivePaceSeriesGapAware`'s window clipping deliberately leaves
the LAST sample before a gap non-null …*"

### IN-02: The PACE-07 threshold gate is duplicated at the call site

**File:** `src/analytics/compute-dashboard-index.ts:220-223`

**Issue:** `paceSecPerKm < PACE_DISAGREEMENT_METADATA_THRESHOLD_SEC_PER_KM` re-implements the gate
`detectPaceDisagreement` already applies internally (`pace-derivation.ts:652`). The duplication is
deliberate and documented (it avoids reading the stream file at all), and today the two are
behaviourally identical — but they are two independent copies of one rule, and the second copy will
not follow the first if the gate ever grows a condition (e.g. a minimum distance).

**Fix:** Export the gate as a predicate from `pace-derivation.ts`
(`export function isPaceDisagreementCandidate(metadataPaceSecPerKm: number | null, options?): boolean`)
and have both `detectPaceDisagreement` and the writer call it, so the cheap pre-gate cannot drift
from the real one.

### IN-03: The zero-covered-time note reads "0:00 of covered time produced no derivable pace"

**File:** `src/dashboard/views/detail-sections.ts:510-511` (pinned by `detail-sections.test.ts:256-263`)

**Issue:** When an activity is 100% recording gap (`coveredSec === 0`), the note renders
"No pace buckets — 0:00 of covered time produced no derivable pace." The caption above it already
says "0% of elapsed time covered", so the note adds a sentence that is literally true but reads as
a rounding artifact rather than as information. The exact-zero comparison `unbucketedSec > 0` at
`:512` is also unguarded against float noise — not reachable today (an archive sweep found 0 of
1,865 activities with `0 < unbucketedCoveredSec < 0.5 s`, because `t` is integer-valued
throughout), but it is one non-integer `t` away from rendering "Bars below omit 0:00 of covered
time".

**Fix:** Branch the zero case explicitly and use a small epsilon on the positive one:

```ts
const UNBUCKETED_EPSILON_SEC = 0.5; // below display resolution
if (hasCoverage && buckets.length === 0) {
  noteText = coverage!.coveredSec <= 0
    ? 'No covered time in this recording — nothing to distribute.'
    : `No pace buckets — ${formatEffortDuration(unbucketedSec)} of covered time produced no derivable pace.`;
} else if (hasCoverage && buckets.length > 0 && unbucketedSec > UNBUCKETED_EPSILON_SEC) {
  ...
}
```

---

## What I checked and found clean

Recorded so a later reader knows what was covered rather than skipped:

- `classifyGaps` strict-priority classification, gap-run merging boundaries, `advanceIntervals`
  seeding, `computeFlatRunDurations` maximal-run walk, and the `Infinity` pause threshold on a
  never-advancing stream — all correct; the `coveredSec + recordingGapSec + pauseSec === spanSec`
  identity holds by construction.
- `derivePaceSeriesGapAware` window clamping picks the max gap-end at or before `t[i]` and the min
  gap-start at or after `t[i]` correctly, and boundary samples (exactly at a gap edge) are correctly
  not treated as inside the gap.
- Every exported function in `pace-derivation.ts` is total on array-shaped input (T-26-01): probed
  with mismatched lengths, empty arrays, and non-finite values; none throws.
- `parseAthleteConfig` is `__proto__`-safe (own-property reads only) and all-or-nothing.
- `appendAccessibleBadge` uses `textContent` on both spans (no XSS surface), and
  `paceDisputedDescriptionId`'s distinct suffix genuinely prevents collision with
  `lowConfidenceDescriptionId` on a row carrying both badges.
- `detail.ts` calls `derivePaceWithCoverage` exactly once per render and feeds the histogram, the
  caption and the split annotations from that single result; all four `await` points are re-guarded
  by the `requestToken`/`mountedContainer` stale-render check.
- `compute-pace-residual.mjs`'s self-execution guard works (importing it in the test does not run
  the sweep or write the report), and the Criterion 1 classification matches its stated amended rule.
- No hardcoded secrets, no `eval`, no `innerHTML`, no shell interpolation, and no path traversal
  anywhere in the reviewed set. `loadPinnedStream`/`loadPinnedActivity` build paths from a
  closed literal fixture table, not from caller input.

---

_Reviewed: 2026-09-09 (Round 2)_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
---

# Round 1 archive (2026-09-09) — preserved verbatim, do not edit

Everything below this line is the Round 1 report exactly as written, including the orchestrator's
CR-01 downgrade and the CORRECTION that retracted it. It is retained because this project has a
recorded lesson about a downgraded finding turning out to be real; the audit trail is the point.


# Phase 26 Code Review — Shared Gap-Aware Pace Derivation & Honest Coverage

**Reviewed:** 2026-09-09
**Depth:** standard
**Files Reviewed:** 29 (per `<files_to_review>`)
**Status:** issues_found

## Summary

The phase collapses two divergent stream-derived pace implementations onto `src/analytics/pace-derivation.ts`,
adds an always-on coverage caption, per-split gap markers, and a "Pace disputed" badge. The module design is
careful: strict-priority gap classification avoids double-counting (26-RESEARCH.md Pitfall 3 is correctly
closed), the D-16 single-entry-point contract (`derivePaceWithCoverage`) is honoured everywhere it is called,
`detectPaceDisagreement`/`streamPaceSecPerKm` are total and never throw, and the `paceDisagreement` index field
is genuinely additive (schema version unchanged, matching the `gearName` precedent). The cross-plan
integration repair documented in `26-INTEGRATION-FIX.md` (requiring `gapIntervals` as a mandatory third
argument to `paceHistogramSamples`) is applied consistently at every call site I could find
(`detail-zones.ts`, `compute-pace-residual.mjs`, `pace-derivation.test.ts`).

Despite that repair, the "exact coverage" guarantee the whole phase is built around (COV-01's
`coveredSec` sum, D-08's "always-on" caption, D-16's "caption can never drift from the histogram")
is not actually airtight: it depends on every `covered`-classified sample producing a non-null pace,
which is not guaranteed. I found one concrete, reachable path where that dependency breaks visibly —
the always-on coverage caption is not actually always-on — and a second, narrower path where the
histogram's own bucket total can silently fall short of the coverage caption's claimed percentage.
Both are traced to the same root cause: `computePaceDistribution`/`buildBreakdownSection` derive their
rendering decision from whether the *smoothed pace series* produced any bucketable output, not from
whether `PaceCoverage` (which is computed independently by `classifyGaps` and does not depend on the
windowed series at all) has anything to report.

`F-26-01` (Moving Time tile discloses no corruption despite `Pace disputed` doing so for the same root
`moving_time` defect) was already logged by the Round 1 browser checkpoint and is not repeated here.

## Critical Issues

### CR-01: The "always-on" D-08/COV-02 coverage caption is not actually always-on — it is gated behind a non-empty pace histogram

**File:** `src/dashboard/views/detail-sections.ts:481` and `:486`
**Issue:** `buildBreakdownSection(buckets, coverage, zoneTimes)` only appends the `Pace Distribution`
heading — and therefore the coverage caption built from `coverageCaptionText(coverage)` at line 492,
which sits *inside* that same `if (buckets.length > 0)` block — when `computePaceDistribution` returned
at least one bucket. `PaceCoverage` (the `coverage` argument) is computed by `classifyGaps` completely
independently of the windowed pace series and can be well-defined and non-trivial (`coveredSec > 0`)
even when the histogram itself is empty. 26-CONTEXT.md's D-08 states the caption is "**Always-on, not
threshold-conditional**: … a healthy run visibly says so instead of the reader having to read silence
as good news" — this implementation makes the caption's presence conditional on an unrelated
computation (whether the smoothed series happened to resolve to any non-null value anywhere).

**Concrete failure scenario:** Take any stream whose distance never advances at all — e.g. the phase's
own `syntheticStandstillStream()` fixture in `src/analytics/pace-fixtures.ts` (dense 2s sampling,
`d` constant for the whole stream), or any real archive activity with a broken/flat distance channel.
`classifyGaps` computes `advanceIntervals(t, d) === []` (no sample ever advances `d`), so per
`pace-derivation.ts:212-215` the scale-relative pause threshold resolves to `Infinity`; nothing is ever
classified `pause`, and with dense 2s sampling nothing is `recording-gap` either, so **every** segment
is classified `covered` — `coverage.coveredSec === coverage.spanSec` (100% covered, confirmed directly
by the phase's own permanent test at `pace-derivation.test.ts:443-453`, which only asserts the pace
series is all-`null` and does not go on to check `computePaceDistribution`/`buildBreakdownSection`).
Meanwhile `derivePaceSeriesGapAware` resolves every sample's window to `metres <= 0` (there is no
distance anywhere to divide by), so `paceSeries` is all-`null` (same test, confirmed) and
`computePaceDistribution` therefore returns `buckets = []` (`src/dashboard/views/detail-zones.ts:99-119`
never populates `bucketTimeSec` when `paceHistogramSamples` returns no samples). Calling
`buildBreakdownSection([], coverage /* 100% covered */, zoneTimes)` then skips the entire
`if (buckets.length > 0)` block — **no "Pace Distribution" heading, no coverage caption, nothing** —
for an activity the code itself considers "100% of elapsed time covered." A reader gets zero disclosure
exactly where the phase's own reasoning ("a healthy run visibly says so") most wants one, and there is
no test anywhere in `detail-sections.test.ts` or `detail-zones.test.ts` exercising this combination (I
grepped both files for `standstill`/`buckets.length === 0` and found no coverage).
**Fix:** Decouple the caption from the bucket-presence guard — render the `Pace Distribution` heading
and caption whenever `coverage !== null && coverage.spanSec > 0`, independently of `buckets.length`,
and only gate the histogram *rows themselves* on `buckets.length > 0` (falling back to a short "no
distinct pace buckets to show" note when covered time exists but produced no bucketable series):

```ts
export function buildBreakdownSection(
  buckets: readonly PaceBucket[],
  coverage: PaceCoverage | null,
  zoneTimes: readonly ZoneTime[] | null
): HTMLElement | null {
  const hasCoverage = coverage !== null && coverage.spanSec > 0;
  if (buckets.length === 0 && !hasCoverage && zoneTimes === null) return null;

  const section = document.createElement('section');
  section.className = 'card detail-section';

  if (buckets.length > 0 || hasCoverage) {
    const heading = document.createElement('h2');
    heading.className = 'text-heading';
    heading.textContent = 'Pace Distribution';
    section.appendChild(heading);

    const captionText = hasCoverage ? coverageCaptionText(coverage!) : null;
    if (captionText !== null) {
      const caption = document.createElement('p');
      caption.className = 'text-label';
      caption.textContent = captionText;
      section.appendChild(caption);
    }

    if (buckets.length > 0) {
      section.appendChild(buildPaceDistributionRows(buckets));
    }
  }
  // ...zoneTimes block unchanged
```

## Warnings

### WR-01: `paceHistogramSamples`'s documented "exact coverage" invariant can be silently violated by an isolated zero-advance `covered` segment flanked by gaps

**File:** `src/analytics/pace-derivation.ts:469-511` (doc comment and implementation), interacting with
`derivePaceSeriesGapAware` at `:363-418`
**Issue:** The doc comment on `paceHistogramSamples` (rewritten during the 2026-09-08 cross-plan
integration repair) states as an "INVARIANT": *"the sum of every returned `timeSec` equals
`coverage.coveredSec` EXACTLY."* This holds for every case the phase's own tests exercise (the
`syntheticRecordingGapStream` fixture, the real archive worked example), but it is not actually
guaranteed by the implementation for every stream shape, because a segment that `classifyGaps` labels
`covered` can still resolve to a `null` smoothed pace, and `paceHistogramSamples` silently drops any
`null`-paced segment (`pace-derivation.ts:502`) without itemising the dropped seconds anywhere.

**Concrete failure scenario:** Construct (or encounter in a messy real device stream) a sample `i`
where: (a) segment `[t[i-1], t[i]]` is a `recording-gap` (large `dt`), (b) segment `[t[i], t[i+1]]` has
`d[i+1] === d[i]` (zero net advance) but is short enough on its own (its maximal flat run is just this
one segment) that it does **not** exceed the pause threshold, so `classifyGaps` labels it `covered`,
and (c) segment `[t[i+1], t[i+2]]` is itself a `recording-gap` or `pause`. In `derivePaceSeriesGapAware`
the window for sample `i` is clamped by the gap-boundary logic at `:393-398`: the preceding gap's
`endSec === t[i]` clamps `windowStart` forward to `t[i]`, and the following gap's `startSec === t[i+1]`
clamps `windowEnd` backward to `t[i+1]` — regardless of the configured `windowSec`, the window collapses
to exactly `[t[i], t[i+1]]`. `elapsed = t[i+1] - t[i] > 0` (passes the elapsed guard), but
`metres = d[i+1] - d[i] = 0`, so `!(metres > 0)` is true and `result[i] = null` (`:409-412`). Back in
`paceHistogramSamples`, this segment's own forward span is *not* inside any `gapIntervals` entry (it is
genuinely `covered`), so the `inGap` exclusion does not fire — but `pace === null` still causes the
`continue` at line 502, so the segment is dropped from every bucket. `coverage.coveredSec` (computed
independently by `classifyGaps`, unaffected by this) still includes this segment's `dt`. The result:
`sum(bucket.timeSec) === coverage.coveredSec - dt`, a shortfall that is never itemised as
`recordingGapSec` or `pauseSec` and never surfaced to the reader — the coverage caption's stated
"covered" percentage can therefore be a small overstatement of what the histogram bars actually sum to,
with no test in `pace-derivation.test.ts` (`describe('paceHistogramSamples — exact coverage invariant
…')`, `pace-derivation.test.ts:482-511`) covering an interior `covered` segment sandwiched this tightly
between two gaps — every existing invariant test uses a fixture with exactly one gap and otherwise
uninterrupted dense covered running either side.
**Fix:** Either (a) exclude a `covered` segment with `dt <= 0`/zero net advance from `coveredSec`
itself in `classifyGaps` when its own resolved window cannot produce a pace (requires threading window
info into classification, a larger change), or — more locally — (b) have `paceHistogramSamples` (or its
caller) itemise segments it drops for reasons *other* than `gapIntervals` membership (i.e. a `null`
pace on a segment `classifyGaps` called `covered`) into a distinct accounted category, so
`coveredSec === sum(bucket.timeSec) + itemisedNullSec` remains an exact, checkable identity rather than
an invariant that is only true for the fixtures currently in the suite. At minimum, add a permanent
regression test constructing exactly this three-segment (`recording-gap` / zero-advance `covered` /
`recording-gap`) fixture and asserting whether `sum(timeSec) === coverage.coveredSec` still holds, so
future readers know whether this is accepted residual imprecision or a defect to fix.

---

_Reviewed: 2026-09-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_


---

# Orchestrator verification (execute-phase, 2026-09-09)

The reviewer's findings were re-tested against the live tree rather than accepted on description.
One was confirmed as code behaviour but **downgraded from Critical to Info** on reachability
grounds. Recorded here rather than by silently editing the reviewer's own section — both readings
are preserved so a later reader can judge for themselves.

## CR-01 — DOWNGRADED to Info (reachability fails in the direction that would matter)

**Confirmed as described, at the code level.** `buildBreakdownSection` (`detail-sections.ts:481`)
wraps *both* the `Pace Distribution` heading and the coverage caption in `if (buckets.length > 0)`.
Probed directly with the phase's own `syntheticStandstillStream()` fixture:
`derivePaceWithCoverage` returns `coverage {spanSec:100, coveredSec:100, recordingGapSec:0,
pauseSec:0}` — 100% covered — while `paceSeries` is 51 entries **all null**, so
`computePaceDistribution` yields `buckets.length === 0` and no caption renders.

**But the finding does not hold at Critical, for two independent reasons.**

*First — the direction that would actually violate COV-02 is unreachable.* COV-02's text is
"coverage is visible to the reader **wherever a derived distribution is shown**". The damaging case
is therefore a distribution rendered *without* a caption, which requires `buckets.length > 0` while
`coverage === null`. At the sole production call site (`detail.ts:747`) `coverage` comes from
`derived.coverage`, and `derivePaceWithCoverage` always returns a coverage object — never null,
confirmed by probe. The `coverage !== null` ternary at `detail-sections.ts:487` is defensive dead
code there. So whenever a distribution is shown, the caption is shown. COV-02 holds.

*Second — the reachable case renders no distribution at all, so no caption is owed.* Scanning all
1,865 committed streams for zero net distance advance returns **exactly one** activity:
`11865310195` (6 samples, `d` all zero, 0 advancing samples) — the same degenerate near-empty
manual-entry stream `26-RESIDUAL.md` already excludes via its 50-sample floor. Its index row
carries `"hr": false`, so `computeHrZoneTimes` yields `null`, and
`buckets.length === 0 && zoneTimes === null` makes `buildBreakdownSection` return `null` outright.
No card, no `Pace Distribution` heading, no histogram — and therefore nothing the caption could sit
under. An absent card for an activity with no distance and no pace is the honest outcome, not a
silent omission.

**Residual value of the finding (why Info, not dismissed):** the D-08 comment block at
`detail-sections.ts:462-466` describes the caption as "always-on", which reads more absolutely than
the code delivers. Should a future change give a zero-bucket activity HR zones, the section would
render with zone content and no pace heading — coherent, but the comment would then be actively
misleading. Worth a comment correction or a pinned test; not worth blocking phase close.

## WR-01 — retained as Warning, not re-tested to conclusion

The claim is that `paceHistogramSamples`'s documented "sum of `timeSec` equals `coverage.coveredSec`
EXACTLY" invariant can be violated by an isolated zero-net-advance `covered` segment tightly flanked
by two gaps, whose averaging window clamps to itself, yielding `metres = 0` -> null pace, dropped
from the histogram without being itemised. If correct, the caption can overstate what the bars sum
to — which bears directly on COV-01/COV-02's exactness claim and deserves a real answer.

Not adjudicated here: constructing the flanking-gap geometry is more than a spot-check, and this is
an advisory gate. Carried forward as open review debt rather than closed on assertion.

## F-26-01 — correctly not re-reported

The reviewer was instructed that the `Moving Time` disclosure gap was already logged by the Round 1
browser checkpoint and did not duplicate it. It remains open in `26-VALIDATION.md`.


---

# CORRECTION — CR-01 downgrade retracted (2026-09-09)

**The Info downgrade above is wrong and is retracted. CR-01 stands as Critical.**

The reachability argument rested on a factual error. I probed reachability with the phase's
`syntheticStandstillStream()` fixture, measured it at 100% covered, and then carried that
"benign, nothing to disclose" character over to the real archive activity the scan found. Those are
not the same stream, and the real one is not benign.

`11865310195` has `t = [0, 1, 2, 14, 17, 18]`. The `2 -> 14` segment is a 12-second recording gap
in an 18-second span:

| Quantity | Value |
|----------|-------|
| spanSec | 18 |
| coveredSec | 6 (**33%**) |
| recordingGapSec | 12 (**67%**) |

So this is not "an activity with no distance and no pace" whose absent card is the honest outcome.
It is the archive's most gap-dominated stream by proportion, and `buildBreakdownSection` returns
`null` for it — no heading, no caption, no disclosure of the 67% recording gap the code has already
correctly computed. D-08's stated purpose is that an activity visibly states its own health rather
than the reader inferring it from silence; this activity's health is exactly what the silence hides.

**What survives from the retracted analysis, and what does not.**

Still correct: the inverse direction (a distribution rendered *with* buckets but *without* a
caption) is genuinely unreachable, because `derivePaceWithCoverage` never returns a null coverage
and `detail.ts:747` is the sole call site. The `coverage !== null` ternary is dead code there.

No longer load-bearing: that observation only rules out one of two failure directions. I treated it
as though it disposed of the finding. It does not — the other direction is the one that fires, and
it fires on real committed data today.

Also wrong in the retracted section: leaning on `26-RESIDUAL.md`'s 50-sample floor as evidence the
activity is negligible. That floor scopes which activities enter the *fast-mass residual cohort*; it
says nothing about whether the detail view owes a reader disclosure, and I used it as if it did.

**Disposition:** CR-01 is confirmed Critical and is the blocking gap in `26-VERIFICATION.md`
(`status: gaps_found`). The fix and the missing regression test are specified in that report's
`gaps:` array.
