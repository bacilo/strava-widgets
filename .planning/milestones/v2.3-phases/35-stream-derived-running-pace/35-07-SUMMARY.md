---
phase: 35-stream-derived-running-pace
plan: 07
subsystem: analytics
tags: [calibration, d13-insensitivity, gap-closure, running-pace-dispute, rpace-03, d-05, strawman, checkpoint]

# Dependency graph
requires:
  - phase: 35-stream-derived-running-pace
    provides: "scripts/compute-running-pace-dispute-calibration.mjs (plan 35-06) — the HALT-capable generator; 35-07-HALT-1.md — the measured record diagnosing S0's original whole-population smallest-positive-gap statistic as insensitive to both D-13 axes on the real archive"
provides:
  - "The GAP-CLOSURE fix to strawmanCutS0 (two iterations, both committed): restricted the gap statistic from the whole population to a tail window, then — after re-measuring against the real archive showed the first window still too wide — narrowed it to exactly the top two order statistics of E, and dropped the original 'positive gap only' filter so a duplicate-of-the-max plant registers as the zero-gap it is."
  - "The completed RPACE-03 calibration: S0 genuinely fails both D-13 axes (Axis B 122.4988%, Axis C 122.4963%), the round is valid, C3 (ratio q95 over C, N=377) clears and passes the basis gate, and PACE_DISAGREEMENT_RUNNING_RATIO = 1.0173 is the figure of record in the committed, idempotence-proven .planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md."
  - "Developer checkpoint resolved 'proceed': plan 35-08 may consume PACE_DISAGREEMENT_RUNNING_RATIO = 1.0173."
affects: [35-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A strawman's own insensitivity-control statistic can itself be under-fixed: narrowing a window by fraction-of-population (5%) can still be wide enough, on a dense real archive, to leave the statistic's own determining pair outside the perturbed region — the ONLY window guaranteed not to leave room for a >=1-item trim or a duplicate-of-the-max plant to miss it is the absolute minimum (here, exactly 2, the top two order statistics). Re-measure a fix against the real archive before trusting it; a synthetic proof of the mechanism is necessary but not sufficient when the population's own density can defeat a fractional window."
    - "A tie-skipping ('smallest POSITIVE gap') statistic can never register a plant mechanism that only ever duplicates an existing extreme value (never introduces a new distinct one) as movement, in ANY window size — the zero gap the duplicate produces is exactly what a positive-only filter discards. Counting the zero gap directly is required whenever an insensitivity axis's own perturbation mechanism is duplication rather than substitution."

key-files:
  created:
    - .planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md
  modified:
    - scripts/compute-running-pace-dispute-calibration.mjs
    - scripts/compute-running-pace-dispute-calibration.test.mjs

key-decisions:
  - "GAP-CLOSURE, not declare: per the developer's explicit choice on 35-07-HALT-1.md, the strawman's own cut definition was repaired rather than the constant being declared on stated grounds. Scope was held to strawmanCutS0, its helper, and S0's own shape metadata/tests — confirmed by diff against the pre-fix commit (3db884ea): no real shape, axis mechanism, INSENSITIVITY_TOLERANCE, population definition or arbitration rule was touched."
  - "The gap-closure fix took two iterations, both committed as the honest record: iteration 1 (6b293286, top-5%-by-fraction window) reproduced the identical dense-region insensitivity one level down when re-measured against the real archive (Axis C movement stayed 0.0000% — the 65-member window's own minimum gap sat in the untouched ~4% remainder below Axis C's trimmed top 1%). Iteration 2 (7f05f49d) narrowed the window to exactly the top two order statistics, which no >=1-item trim or duplicate-of-the-max plant can leave untouched, and dropped the positive-only gap filter for the same reason (Axis B's plant is a duplication, not a substitution)."
  - "S0 is now a narrower control than 35-06 originally intended: with the window at exactly the top two order statistics, S0 is maximally tail-sensitive and will fail against a working Axis B/Axis C on essentially any real population, not just this one. It still functions as a genuine canary for a NEUTERED axis (proven synthetically: it clears when Axis B is weakened to plant away from the window, and separately when Axis C is weakened to trim from the bottom instead of the top), but it no longer meaningfully tests 'a plausible-but-bad candidate shape' the way the 35-06 pre-declaration originally framed it. A future S0 failure on this generator should not be over-read as strong evidence that the insensitivity machinery is discriminating well in general — only that this specific, maximally-sensitive statistic moved."
  - "Developer accepted the calibrated constant. Stated reasoning (recorded verbatim): \"Accepted on the basis that the round is valid (S0 genuinely fails both axes at 122.50%), the basis gate passed, and two independent control populations converged to within 0.13% (C3 ratio q95 = 1.0173 over C, N=377; B2 ratio q95 = 1.0186 over B, N=575). ~9.7% of the candidate population badged (125 of 1291) was judged an acceptable sensitivity.\""

patterns-established:
  - "When re-measuring a just-fixed insensitivity control against the real archive still shows a cleared axis, do not assume the fix direction was wrong — check whether the SAME mechanism (a window too wide, a filter still discarding the perturbation's own signature) is recurring at a smaller scale before trying a different mechanism entirely."

requirements-completed: []  # Requirement-tick safety (plan's own Objective + Task 3 instruction): this plan ticks nothing; the orchestrator owns REQUIREMENTS.md/ROADMAP.md.

# Metrics
duration: ~35min (continuation session: gap-closure through calibration and checkpoint resolution)
completed: 2026-09-28
---

# Phase 35 Plan 07: Running-Pace Dispute Calibration — Gap-Closure, Calibration, Developer Acceptance Summary

**Closed the gap-closure round the developer chose on 35-07-HALT-1.md by narrowing the strawman S0's own gap statistic to exactly the top two order statistics of E (after a first, 5%-window attempt reproduced the same insensitivity one level down), re-ran the full seven-shape calibration against the real 1,874-stream archive, and shipped `PACE_DISAGREEMENT_RUNNING_RATIO = 1.0173` (shape C3, base population C, N=377) after the developer reviewed the full per-shape table and every finding and replied "proceed".**

## Performance

- **Duration:** ~35 min (continuation session)
- **Completed:** 2026-09-28
- **Tasks:** 3/3 (Task 1 re-measured, Task 2 executed, Task 3 checkpoint resolved `proceed`)
- **Files modified:** 3 (2 modified generator/test files, 1 created artifact)

## Accomplishments

- **Gap-closure fix to `strawmanCutS0`, two iterations, both committed as the honest record:**
  - **Iteration 1** (`6b293286`): restricted S0's gap search from the whole of E to its top 5% (by fraction), on the theory that 5% comfortably exceeds Axis B/C's own ~1% plant/trim count. Re-measuring against the real archive falsified this: Axis C's movement stayed exactly `0.0000%` — the ~65-member window's own minimum gap sat in the untouched ~4% remainder below the trimmed top 13, reproducing 35-07-HALT-1.md's own diagnosed flaw one level down, at a smaller scale.
  - **Iteration 2** (`7f05f49d`): narrowed the window to exactly the top TWO order statistics (`S0_TAIL_WINDOW_SIZE = 2`) — the only window size that cannot leave room for either perturbation to miss it: any trim of `>=1` top member always retires at least one of the two; any duplicate-of-the-max plant always collapses the pair to a gap of exactly zero. Also dropped the original "smallest POSITIVE gap" filter (renamed to a plain minimum-gap, ties included): Axis B's plant mechanism (`plantMaxStatistic`) only ever duplicates a value the population already contains, never introduces a new distinct one, so a tie-skipping statistic can never register that duplication as movement in ANY window — the filter itself, not just the window width, was reproducing the insensitivity.
  - **Scope held**: `git diff` against the pre-fix baseline (`3db884ea`) touches only `strawmanCutS0`, its new `minGapInTailWindow` helper/`S0_TAIL_WINDOW_SIZE` constant, and S0's own `meaning` text. No real shape, axis mechanism, `INSENSITIVITY_TOLERANCE`, population definition, or arbitration rule was touched — confirmed by direct diff inspection, not narration.
  - **Both required synthetic proofs present**, independent of the real archive, in `compute-running-pace-dispute-calibration.test.mjs`:
    - S0 **fails** the real, unweakened `axisBForShape`/`axisCForShape` on a fixture shaped like the diagnosed flaw (movement >1% on both axes), and the same fixture proves the fix ignores an injected dense-middle near-zero gap (0.0001) the ORIGINAL statistic would have picked instead of the top-two-window gap (5).
    - S0 **can still clear** — proving it is not rigged to fail unconditionally — when Axis B is weakened (synthetically, via `evaluateAxisBFromPlanted` fed a plant that lands away from the top-two window) and separately when Axis C is weakened (via `evaluateAxisCFromTrimmed` fed a trim from the bottom instead of the top). Neither real mechanism (`plantMaxStatistic`/`trimBaseTail`) was touched to produce these proofs.
    - The pre-existing round-invalidation-plumbing test (S0 clears → halts before C1) was rebuilt on a degenerate, fully-tied-tail fixture compatible with the new statistic (the previous fixture relied on the exact insensitivity just fixed, so it necessarily needed replacing; its purpose — proving `runCalibration`'s halt branch is reachable — is unchanged and still passes).
- **Full calibration re-run against the real archive** (`data/streams` tree `dfdc7b352f0a138645ad54fe91b881afdb9bbd5f`, unchanged since 35-07-HALT-1.md): S0 now genuinely fails both D-13 axes (Axis B 122.4988%, Axis C 122.4963%, both far over the 1% tolerance) — the round is **valid**. C3 (ratio q95 over C, N=377, cut=1.0173) clears first in the pre-declared order and passes the basis gate on 3475724402 (ratio=1.0731 > cut=1.0173).
- **`.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md` committed** (`9a9455a8`) and proven idempotent ACROSS the commit: sha256 `26d2538a628e028d2856231dd94c5a0101adecc1b7f38e66607d4796dea4b55a` both before and after the commit, `diff` exits 0, `git status --porcelain` on the artifact empty after regenerating post-commit.
- **Developer checkpoint (Task 3) resolved `proceed`** after reviewing the full per-shape table (all seven shapes, including S0's failure) and every finding, presented in full before the question was asked.

## Full per-shape table (real archive)

| Shape | Base pop (N) | Statistic | Cut | Axis A | Axis B (movement, status) | Axis C (movement, status) | shapeClears |
|---|---|---|---|---|---|---|---|
| S0 (strawman) | E (1291) | delta | −96.2006 | failed (genuine) | 122.4988% failed | 122.4963% failed | **false — round valid** |
| C1 | C (377) | delta q95 | 7.3259 | structural | 11.2293% failed | 16.0523% failed | false |
| **C3** | C (377) | ratio q95 | **1.0173** | structural | 0.4077% cleared | 0.1587% cleared | **true — selected** |
| C2 | C (377) | delta q99 | 13.7942 | structural | 286.2809% failed | 19.1294% failed | false |
| C4 | C (377) | ratio q99 | 1.0333 | structural | 7.3428% failed | 0.8355% cleared | false |
| B1 | B (575) | delta q95 | 7.4861 | structural | 14.6452% failed | 17.2518% failed | false |
| B2 | B (575) | ratio q95 | 1.0186 | structural | 0.4093% cleared | 0.2668% cleared | true (never reached — C3 selected first, per the pre-declared first-clearing order, unchanged) |

**Chosen constant:**
```
PACE_DISAGREEMENT_RUNNING_RATIO = 1.0173
provenance: calibrated (shape C3, base population C, N=377)
```
**Basis gate: PASS** — 3475724402 is eligible (`excludedM>0`) and its ratio (1.0731) exceeds the cut (1.0173).

## Every finding (verbatim from the artifact; none used to select, tune or re-order any shape)

- Newly-disputed count under the chosen cut (population E): **125** (~9.7% of E's 1291 members)
- Faster-side count at the mirror cut (D-06, never badged): **15**
- Gate-excluded population (B, `excludedM===0`): **n=575**, own delta summary q50=0.53, min=−4.16, max=212.80
- Non-computable: **1** (`stream has no covered distance or no covered time`)
- Named activities: 3475724402 badged (ratio 1.0731), 3475734189 badged (ratio 1.0410), 3475740390 **not** badged (ratio 1.0071 < 1.0173), 5059204779 badged (ratio 3.1612 — the archive maximum)

## Developer's stated reasoning (recorded verbatim, per Task 3's own instruction)

> Accepted on the basis that the round is valid (S0 genuinely fails both axes at 122.50%), the basis gate passed, and two independent control populations converged to within 0.13% (C3 ratio q95 = 1.0173 over C, N=377; B2 ratio q95 = 1.0186 over B, N=575). ~9.7% of the candidate population badged (125 of 1291) was judged an acceptable sensitivity.

## Reconciliation against 35-RUNNING-PACE-RECOUNT.md (independent derivation; neither file edited)

All four named activities' running-pace figures differ between the two independent derivations, but **every divergence is already an EXPLAINED DIVERGENCE under one of 35-05's own three named, structurally-verified causes** — none is a new or unexplained finding surfaced by this plan:

| Activity | Recount coveredM/excludedM/pace | Shipped (calibration) coveredM/excludedM/pace | Named cause (35-05-SUMMARY.md) |
|---|---|---|---|
| 3475724402 | 11709.7 / 1715.0 / 305.6 | 11171.6 / 2253.1 / 317.59 | `traversal-shape/boundary` (small, bounded, unchanged since 35-05) |
| 3475734189 | 6830.3 / 0 / 347.1 | 6648.8 / 181.5 / 355.40 | `segment-scope-gap` (35-05's Second post-hoc correction, 2026-09-27): the 181.5 m divergence exceeds the ordinary boundary-pair bound (147 m) but matches this activity's own single reported unreliable segment's metres (181.5 m) exactly — production's unreliable-segment detector excludes it; this recount never modeled that mechanism |
| 3475740390 | 10515.0 / 56.1 / 340.8 | 10348.8 / 222.3 / 344.87 | `traversal-shape/boundary` (small, bounded, unchanged since 35-05) |
| 5059204779 | 10638 / 166 / 356 | 10638 / 166 / 355.80 | `traversal-shape/boundary` (a 2-second `coveredSec` difference only) |

## Carry-forward findings, resolved (not open questions)

1. **The 5059204779 recount-side change is explained, not archive drift.** 35-07-HALT-1.md observed this activity moved from "NOT COMPUTABLE under the recount" (35-05's original run) to computable-and-closely-agreeing (this session), while `data/streams`' tree hash stayed at `dfdc7b352f...` throughout. This is the **user-authorized "Post-hoc correction" recorded in 35-05-SUMMARY.md (2026-09-26)**: the recount's own over-speed rule previously flagged 5059204779's 59 quantized-distance lumps individually and concluded `recountCoveredM=0` — a defect in the recount's verification scaffolding, not a second opinion on production. The fix made the aggregate speed window extend backward through the immediately preceding zero-advance stretch (a window correction, independently motivated by the stream's own reporting mechanism, never copied from production's excess-floor gate). Production code (`src/analytics/pace-derivation.ts`) was never touched. Not drift; not a new defect; not investigated further by this plan.

2. **The 5059204779 badge is correct, and is a concrete validation of RPACE-03, not merely a tolerated edge case.** Its stored metadata is `distanceM=10804`, `movingTimeSec=1216`, implying `paceSecPerKm=112.6` (~1:52/km, ~32 km/h) — physically impossible for a run — while `avgCadenceRpm=90` confirms a genuine run occurred. The stream itself gives 10804 m over a 3788 s span (~5:50/km), and `deriveRunningPace` reports ~355.8 sec/km, matching. **The metadata pace is the broken figure; the stream-derived pace is correct.** The ratio of 3.1612 (the archive maximum) fires the badge for the right reason — this inverts an earlier scoping concern that quantized-distance streams might be spuriously badged: they are badged precisely BECAUSE their metadata pace is wrong, which is exactly what RPACE-03 exists to disclose.

3. Seven activities fall into **no population** because `excludedM` is a sub-picometre negative float (e.g. `-1.8189894035458565e-12`), failing both `excludedM > 0` and `excludedM === 0`: `12992993271, 13098246407, 14049367721, 15923122090, 5619205516, 5875527057, 6924646802`. Not fixed here (would change a population operator mid-round) — carried forward for a future plan.
4. The three quantized-distance streams (`3647739864, 4598855187, 5059204779`) sit at the extreme top of E's delta distribution (ranks 1279, 1264, 1291 of 1291). No candidate shape reads E today, so nothing is skewed — but any future badge count over E would be dominated by them at its extreme tail. Not fixed here — carried forward.

## Task Commits

Each task was committed atomically:

1. **Gap-closure fix, iteration 1 (top-5%-by-fraction window)** - `6b293286` (fix)
2. **Gap-closure fix, iteration 2 (top-two-order-statistics window)** - `7f05f49d` (fix)
3. **Task 2: Full calibration, artifact committed, idempotence proven across the commit** - `9a9455a8` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `scripts/compute-running-pace-dispute-calibration.mjs` — `strawmanCutS0` redesigned (two iterations); no other shape, axis, population, tolerance or arbitration rule touched.
- `scripts/compute-running-pace-dispute-calibration.test.mjs` — two new synthetic proofs (S0 fails on working axes; S0 clears on weakened axes) plus a rebuilt round-invalidation-plumbing test compatible with the new statistic.
- `.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md` — the committed figure of record (created).

## Decisions Made

See `key-decisions` in the frontmatter: (1) gap-closure, not declare, per the developer's explicit prior choice; (2) the fix took two honestly-recorded iterations, the first of which reproduced the same insensitivity one level down; (3) S0 is now a narrower, maximally-tail-sensitive control than 35-06 originally intended — still a genuine canary for neutered axes, but a weaker test of "plausible-but-bad shape" than before, disclosed so a future reader does not over-read a subsequent S0 failure; (4) the developer accepted the calibrated constant with reasoning recorded verbatim above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Gap-closure fix required a second iteration**
- **Found during:** re-measuring iteration 1's fix against the real archive (this plan's own Task 1 re-run, before Task 2)
- **Issue:** A top-5%-by-fraction window for S0's gap statistic still left Axis C's movement at exactly `0.0000%` — the window's own minimum gap sat in the untouched ~4% remainder below Axis C's trimmed top 1%, reproducing 35-07-HALT-1.md's diagnosed flaw one level down.
- **Fix:** Narrowed the window to exactly the top two order statistics and dropped the "positive gap only" filter (see key-decisions). Re-measured against the real archive: S0 now fails both axes by >122%.
- **Files modified:** `scripts/compute-running-pace-dispute-calibration.mjs`, `scripts/compute-running-pace-dispute-calibration.test.mjs`
- **Verification:** Full suite (`npx vitest run`, 3633/3633) and `npx tsc --noEmit` green after each iteration; real-archive dry run confirmed the fix before `--write`.
- **Committed in:** `7f05f49d` (separate commit from iteration 1, per the plan's own instruction to keep the honest record rather than silently rewriting iteration 1)

---

**Total deviations:** 1 auto-fixed (1 bug, within the gap-closure's own explicitly authorized scope — not a deviation from the developer's `gap-closure` instruction, but a deviation from the plan's own first-attempt design)
**Impact on plan:** Necessary to reach a genuinely valid round. No scope creep — both iterations touch only `strawmanCutS0` and its own tests, confirmed by diff against the pre-fix baseline.

## Issues Encountered

None beyond the gap-closure iteration documented above. `git status --porcelain data/` was empty throughout; no test wrote to or checked out a tracked file.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `PACE_DISAGREEMENT_RUNNING_RATIO = 1.0173` (shape C3, base population C, N=377, basis gate PASS) is the figure of record in the committed, idempotence-proven `35-CALIBRATION.md` (sha256 `26d2538a628e028d2856231dd94c5a0101adecc1b7f38e66607d4796dea4b55a`), ready for plan 35-08 to consume via the `PACE_DISAGREEMENT_RUNNING_` naming pattern.
- Two carry-forward findings (the seven sub-picometre-`excludedM` activities landing in no population; the three quantized-distance streams dominating E's extreme tail) remain unfixed and undecided — flagged for a future plan, not blocking 35-08 since no current shape reads E for selection.
- This plan ticks no requirement and edits no ROADMAP/STATE/REQUIREMENTS file — the orchestrator owns `RPACE-03`'s tick.
- No blockers for plan 35-08.

---
*Phase: 35-stream-derived-running-pace*
*Completed: 2026-09-28*
