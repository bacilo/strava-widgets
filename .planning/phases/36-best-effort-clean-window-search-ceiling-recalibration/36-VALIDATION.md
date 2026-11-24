---
phase: 36
slug: best-effort-clean-window-search-ceiling-recalibration
status: partial
nyquist_compliant: false
wave_0_complete: true
created: 2026-09-28
updated: 2026-11-24
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `36-RESEARCH.md` § Validation Architecture.

Bound 2026-10-01 (plan 36-13), on the primary checkout, AFTER confirming `origin/master`
(`5e902283`) is already an ancestor of local HEAD (a truthful no-op merge — 0 commits ahead, 0
files brought into `data/`) and AFTER regenerating both signed artifacts on that tree (commit
`893eec64`). Every `Matched` count below was measured live against this HEAD, not copied from an
earlier plan's own SUMMARY — several commands recorded in the original (planner-drafted) table
turned out to be vacuous (`-t` matched 0 tests) once the real test titles existed; those are
marked CORRECTED below with the real, non-vacuous command substituted.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing devDependency) |
| **Config file** | `vitest.config.ts` (existing, unmodified by this phase) |
| **Quick run command** | `npx vitest run <file> -t "<name>"` |
| **Full suite command** | `npm test` |
| **Measured runtime (2026-10-01, post-merge, post-gap-closure)** | **107 files / 3,921 tests, 29.66s wall-clock** (baseline at phase start 2026-09-28: 101 files / 3,676 tests). The heaviest single file is `src/analytics/compute-best-efforts.test.ts` at 3,612.9ms (≈12.2% of total wall-clock) — this is the archive-sweep-adjacent file carrying the clean-window-search's own archive orchestration describe; `scripts/verify-dashboard-publish-stats.test.mjs` (2,455.0ms) and `src/analytics/clean-window-archive.test.ts`'s sibling archive sweep together account for most of the remainder. |

---

## Sampling Rate

- **After every task commit:** targeted `-t` filtered run for the file(s) touched (seconds)
- **After every plan wave:** `npm test` (full suite)
- **Before `/gsd-verify-work`:** full suite green, `tsc --noEmit` clean, `verify-dashboard` green, all three generated artifacts regenerated-twice-and-diffed, PR-09 sha256 signed
- **Max feedback latency:** ~30 seconds

---

## Merge, Regeneration and Signature Record (plan 36-13, Task 1)

- **MERGE-01:** `git fetch origin` confirmed `origin/master` (`5e902283`, last real commit
  2026-09-19) is already an ancestor of local HEAD (`ac7d900f`) — **0 commits ahead, 0 files
  brought into `data/`**, a truthful no-op merge, the same shape as Phase 32's own 32-09
  precedent. `git merge origin/master` printed `Already up to date.`
- **Artifact regeneration commit:** `893eec64` (on top of `ac7d900f`) — regenerated
  `36-CEILING-RECALIBRATION.md` and `36-DIFF.md` and proved three consecutive runs byte-identical
  (`**Generated:**` line stripped; `36-DIFF.md` additionally cites `36-CEILING-RECALIBRATION.md`'s
  own `Generated` stamp in its `## Inputs` section — a second, legitimately-varying timestamp the
  strip pattern doesn't name; logged as a finding below, out of this plan's file scope to fix in
  the generator).
- **Every figure that moved** relative to the previously-committed artifacts is attributable to
  the already-landed, pre-existing gap-closure commits (`f5e72aa8`..`67af8d3d` — the trailing-stall
  detector fix and the recount's two-part verdict) finally being reflected in a regeneration, NOT
  to any new archive data (the merge itself was a confirmed no-op). Newly demoted moved 442 → 391
  (−51), matching the detector fix's own recorded upper bound exactly. The internal
  moved-but-ranked-vs-walked-contaminated gap narrowed from 32 to 31, because the detector fix
  resolved the one `4598855187@1k` contaminated-and-ceiling-demoted tension 36-11/36-12 both
  flagged — corroborated a third way by this run's own recount (0 internal-consistency violations,
  down from 1).
- **`npx tsc --noEmit`** exits 0. **`npm test`** — 107 files / 3,921 tests pass (29.66s).
  **`npm run verify-dashboard`** — 67/67 checks pass.
- **`git status --porcelain data/`** empty throughout (one timestamp-only
  `data/geo/geo-metadata.json` side effect from `compute-all-stats` reverted via `git checkout --`,
  matching the 28-14 precedent). **`data/best-effort-ceiling.json`** sha256 unchanged
  (`01802d20cb6b97a7c7c8d63b17ab33cbfbae40fd1fc98ec73860e134dbdb8a20`) — the 36-07 write gate
  holds; no `--write-ceiling-state` flag was ever passed. This is deliberate: the file is the
  record of CI's PREVIOUS run, and this phase does not update it — CI's next nightly writes it.
- **`npm run compute-clean-window-recount`** re-run post-merge: exit **0**, `pass=1440 fail=0
  notAssessable=74` (of 1514), all three pinned fixtures match — identical to the gap-closure
  debug record's own live run (`.planning/debug/36-recount-isolated-jump.md`), confirming the
  independent leg's verdict is stable on this tree.
- **Served-digest verification:** a local static server was spun up over `dist/widgets`; the
  served `index.html`'s referenced `assets/index-CgwZxcPm.js` and `assets/index-CfRubajH.css` were
  fetched directly and their sha256 digests (`c6b7d4cd...e9ece0117` and `c292c22f...e49a1f3b383137`
  respectively) compared against the freshly built files on disk — **both match exactly**. The
  build log alone was not treated as evidence (`build-widgets`'s own output showed `replaced stale
  ...` entries, confirming a real rebuild, not a silent mtime no-op). `data/dashboard/index.json`
  confirmed regenerated today (mtime 14:03, same run as `compute-all-stats`).
- **Three-way reconciliation, post-merge:** leg 1 (`36-DIFF.md`'s classified lists) and leg 2
  (the same generator's walked guard counts) share one dependency — both read the same generated
  document via `scripts/compute-clean-window-diff.mjs`. Leg 3 (`scripts/compute-clean-window-recount.mjs`)
  shares NEITHER the search nor the detector nor leg 1/2's own generator. Leg 3's own walked
  non-null-demotion count (**394**) agrees exactly with leg 2's own walked total
  (3 max-speed + 5 ceiling + 386 unreliable-segment = 394). Leg 1's internal
  `moved-but-ranked` (1,097) vs walked-`contaminated` (1,128) gap of 31 is now fully, exactly the
  31 absolute-guard reinstatements alone (36-RESEARCH.md D-08) — the 1-record
  `4598855187@1k` second cause 36-11/36-12 both flagged no longer exists post-detector-fix, and
  leg 3's own internal-consistency check independently confirms this (0 violations, down from 1).
- **Final sha256 values, computed EXTERNALLY via `shasum -a 256`, recorded beside commit
  `893eec64`** (the commit the artifacts were regenerated at, immediately after the confirmed
  no-op merge):
  - `36-CEILING-RECALIBRATION.md` — `48b9e0836483c1017effc5010e7f7e8d0a771c8921faa0653aec433af61c8e89`
  - `36-DIFF.md` — `0f3803b3ec56c7cbdf4a42a117ed7d44d0df6f2ee8a8a6e4111fc9d2aac589e1`

  Neither hash is written into either artifact. These are the exact values plan 36-14 asks the
  developer to sign (see Checkpoint Row h below).

---

## Per-Task Verification Map

> Bound 2026-10-01 (plan 36-13). Every `Matched` count below was measured live against HEAD
> `893eec64`. A row whose originally-drafted `Automated Command` matched 0 tests is marked
> CORRECTED, with the real command substituted (T-36-80 mitigation: a vitest `-t` filter matching
> zero tests exits 0 and is indistinguishable from a pass).

| Task ID | Plan | Wave | Requirement | Behavior | Test Type | Automated Command | File Exists | Matched | Status |
|---------|------|------|-------------|----------|-----------|-------------------|-------------|---------|--------|
| 36-05 T1 | 36-05 | 4 | PR-06 | d-rebased splice fabricates a faster window than partition on `3475740390`@400m (116.554s < 119.594s) | unit/regression | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "splice fabricates"` | ✅ exists | 2 | ✅ green |
| 36-02 T2 | 36-02 | 1 | PR-06 | `findBestEffort` with `startIndex`/`endIndex` omitted reproduces full-array behavior (13,118 archive pairs) | unit | `npx vitest run src/analytics/best-effort-utils.test.ts -t "bounds"` | ✅ exists | 11 | ✅ green |
| 36-06 T1-3 | 36-06 | 4 | PR-06 (D-01) | whole-span vs burst-only cut lists agree archive-wide (1,201/7,351/439 both readings) | integration | `npx vitest run src/analytics/clean-window-archive.test.ts -t "equivalence"` | ✅ exists | 3 | ✅ green |
| 36-04 T3 | 36-04 | 3 | PR-07 (D-05/D-06) | CORRECTED (`-t "contaminated"` is non-vacuous at 11 but spans multiple unrelated describes): the three clean-window search branches (`contaminated` set when a clean window exists, `demotion` set when none does) — `npx vitest run src/analytics/compute-best-efforts.test.ts -t "clean-window search branches"` | unit | (see Behavior) | ✅ exists | 6 | ✅ green |
| 36-05 T2 | 36-05 | 4 | PR-07 (D-08) | `3475725842`@400m: `demotion === null`, `contaminated.guard === 'unreliable-segment'` (raw fails `max-speed`, clean figure plausible) | regression, real fixture | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "3475725842"` | ✅ exists | 2 | ✅ green |
| 36-06 T1-3 | 36-06 | 4 | PR-08 (D-03) | every ranked effort's interval overlaps no detected segment (archive-wide, 0 violations) | integration | `npx vitest run src/analytics/clean-window-archive.test.ts -t "overlap invariant"` | ✅ exists | 2 | ✅ green |
| 36-05 T3 | 36-05 | 4 | PR-08 (D-14) | contaminated timings never enter the ceiling population (populationN=120 clean-case, 100 no-clean-case) | unit, synthetic | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "ceiling population"` | ✅ exists | 2 | ✅ green |
| 36-04 T2 | 36-04 | 3 | PR-08 | "no iteration to convergence" audit still green **with zero edits** (pre-existing, confirmed unmodified every commit) | existing regression | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "no iteration to convergence"` | ✅ exists (pre-existing) | 2 | ✅ green |
| 36-10 T3 / 36-13 T1 | 36-10 / 36-13 | 5 / 8 | PR-09 (D-09) | `36-CEILING-RECALIBRATION.md` regenerates byte-identically on the post-merge tree (3 consecutive runs, `**Generated:**` stripped) | idempotence | regenerate ×3 + `diff` against committed (`npm run compute-ceiling-recalibration`) | ✅ exists | n/a (scripted diff, not `-t`) | ✅ green |
| 36-12 T2 (ext. gap-closure `712140bb`) | 36-12 | 7 | PR-09 (D-13) | third-leg recount fails on planted broken partitioners before being trusted (2 from 36-12 + 3 new from the gap-closure round: dropped crossing pair, self-referential blind window, unsatisfiable p95-everywhere) | guard, watched-failing-first | `npx vitest run scripts/compute-clean-window-recount.test.mjs -t "planted"` | ✅ exists | 10 | ✅ green |
| 36-12 T3 / 36-13 T1 | 36-12 / 36-13 | 7 / 8 | PR-09 | three-way reconciliation agrees on the live, post-merge archive (exit 0, pass=1440 fail=0 notAssessable=74) | integration | `node scripts/compute-clean-window-recount.mjs` (exit code; via `npm run compute-clean-window-recount`) | ✅ exists | n/a (exit-code check, not `-t`) | ✅ green |
| 36-05 T2 | 36-05 | 4 | PR-09 | three scoping activities' 400m efforts pinned as regression fixtures (3:20/3:21/3:22 BEFORE; 4:59/4:50/5:08 AFTER) | regression | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "scoping activities"` | ✅ exists | 3 | ✅ green |
| 36-05 T4 | 36-05 | 4 | SEG-05b | CORRECTED (`-t "stubbed segments"` matches **0** — the real describe title is `"computeBestEfforts reads the detector (SEG-05b, Phase 36 half)"`): stubbing the detector to `segments: []` collapses the search to today's behavior — `npx vitest run src/analytics/pace-single-source.test.ts -t "Phase 36 half"` | unit, load-bearing proof | (see Behavior) | ✅ exists | 1 | ✅ green |
| 36-02 T2 | 36-02 | 1 | PR-06 | bounds-equivalence: bounded sweep matches an explicitly SLICED-array expectation (never the sweep agreeing with itself) on 3 synthetic streams + the real `3475740390` | unit | `npx vitest run src/analytics/best-effort-utils.test.ts -t "sliced expectation"` | ✅ exists | 4 | ✅ green |
| 36-02 T2 | 36-02 | 1 | PR-06 | bounds-totality: every malformed bound (degenerate/inverted/negative/over-long/non-integer/too-short) returns `undefined` without throwing | unit | `npx vitest run src/analytics/best-effort-utils.test.ts -t "bounds totality"` | ✅ exists | 6 | ✅ green |
| 36-04 T3 | 36-04 | 3 | PR-06 (D-04) | `complementSubIntervals`'s `+1` boundary correction (against 36-RESEARCH.md's off-by-one snippet), pinned to the exact value `5` for cut `{4,7}` | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "complementSubIntervals boundary rule"` | ✅ exists | 7 | ✅ green |
| 36-04 T3 | 36-04 | 3 | PR-07 (D-07) | bounded, house-register contamination reason strings (fixture-level: cap, length, adjective bans) | unit | `npx vitest run src/analytics/compute-best-efforts.test.ts -t "contamination reason strings"` | ✅ exists | 5 | ✅ green |
| 36-06 T1-3 | 36-06 | 4 | PR-07 (D-07) | reason-string bound archive-wide: 1,640 strings, max length 271 (cap 320), 0 pipe/CR/LF, `+N more` arithmetic parsed and checked, 0 banned adjectives | integration | `npx vitest run src/analytics/clean-window-archive.test.ts -t "reason bound"` | ✅ exists | 6 | ✅ green |
| 36-07 T3 | 36-07 | 4 | PR-08 (D-11) | write-gate both-directions proof: no-prior-file × flag on/off, existing-disagreeing-file × flag on/off (byte-unchanged vs byte-changed), flag-on-vs-off deep-equal (no derived figure changes) | unit | `npx vitest run -t "writeCeilingState"` | ✅ exists | 6 | ✅ green |
| 36-08 T1 | 36-08 | 3 | PR-07 (D-15) | `BestEffortPanelRow` carries the contaminated figure/reason, with `!= null`/`?.`/`??` stale-shard degrade | unit | `npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts -t "contaminated panel row"` | ✅ exists | 4 | ✅ green |
| 36-08 T2 | 36-08 | 3 | PR-07 (D-15) | contaminated badge spec: copy, fallback, can-fail direction, exact five-kind emission order, D-06 no-clean-window pass-through | unit | `npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts -t "contaminated badge"` | ✅ exists | 6 | ✅ green |
| 36-08 T3 | 36-08 | 3 | PR-07 (D-15) | DOM wiring guard: exactly one `appendAccessibleBadge(` call path; `badge--contaminated`/`--contaminated-text` present; the TS kind union and the JS class lookup cannot silently diverge in either direction | source-text guard | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "contaminated badge wiring"` | ✅ exists | 4 | ✅ green |
| 36-09 T2 | 36-09 | 3 | PR-07 (D-16) | `countContaminatedAtDistance` walks the document (plain `for`, no `.filter`/`.reduce`), excludes owner-excluded efforts, independent of `countDemotedAtDistance`'s own total | unit | `npx vitest run src/dashboard/views/records-logic.test.ts -t "countContaminatedAtDistance"` | ✅ exists | 5 | ✅ green |
| 36-09 T3 | 36-09 | 3 | PR-07 | three-homes lockstep audit: real direction (all 3 homes agree for every parsed guard) + 3 independent planted single-home removals + 3 comment-only-occurrence non-satisfactions | source-text guard, watched-failing-first | `npx vitest run src/analytics/effort-guard-homes.test.ts -t "effort-guard-homes"` | ✅ exists | 15 | ✅ green |
| 36-09 T3 | 36-09 | 3 | D-17 | the untouched Phase 29 review queue admits the new guard verbatim (no allowlist, no change outside the queue's own test file) | integration | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs -t "D-17"` | ✅ exists | 3 | ✅ green |
| 36-12 T1-2 (ext. gap-closure `67af8d3d`) | 36-12 | 7 | PR-09 (D-13) | the basis gate fails closed on degeneracy (planted spanning-window defect: contaminated median collapses onto the control threshold, both 16.6667) AND passes OK on the live, well-separated archive (controlP95=3.6667, contaminatedMedian=5.4355) | guard, both directions | `npx vitest run scripts/compute-clean-window-recount.test.mjs -t "THE BASIS GATE"` | ✅ exists | 4 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**No row above has a `Matched` count of 0.** Two rows' originally-drafted commands DID match 0
(the `-t "contaminated"` row and the `-t "stubbed segments"` row) and are recorded as CORRECTED
above with the real, verified-non-vacuous command substituted — per T-36-80, a 0-match filter is
never recorded as green.

`nyquist_compliant: true` — every row above carries a non-zero `Matched` count and a green
`Status`, measured live against HEAD `893eec64` on 2026-10-01.

---

## Independent-Value Discriminators

This project has twice shipped a Critical past a guard that only checked the changed code against
itself (Phase 23 extent, Phase 32 cross-segment conservation). Every guard below asserts against a
value derived **outside** the code it is guarding:

| Guard | Independent value it asserts against |
|-------|--------------------------------------|
| D-03 overlap invariant | the **detector's** own `classifyGapsWithSegments` segment output — never the partition code's internal state |
| D-13 third-leg recount | its own per-window outlier statistic, computed fresh from the raw committed stream; may not import the search or the detector. Post-gap-closure, the statistic is `max(windowSpeeds) / median(referenceSpeeds)` — the reference population is every pair ENTIRELY OUTSIDE the window on the SAME activity, never the window's own contents (closes the self-referential blind spot 36-12's own live run found) |
| D-14 ceiling-population demo | a manually computed expectation from the synthetic fixture's own known-clean speed, not the production code's output |
| PR-09 regression fixtures | 3:20 / 3:21 / 3:22 reproduced from raw committed streams via `findBestEffort` alone (all three verified against the probe 2026-09-28, and RE-VERIFIED as MATCH on the merged, post-gap-closure archive 2026-10-01 via `npm run compute-clean-window-recount`'s own pinned-fixtures check) |

---

## Two-Direction Reachability

Every row must be checked in **both** directions before it is relied on — unfailable (vacuous) and
unpassable are both live failure modes on this phase, and two rows were already caught as traps
during discussion. Below, the predicted figures from the original drafting are replaced with the
MEASURED, OBSERVED evidence from the implementing plan's own SUMMARY and this plan's own re-run.

| Row | CAN FAIL (OBSERVED) | CAN PASS (OBSERVED) |
|-----|---------------------|---------------------|
| PR-06 splice-fabricates-faster | `3475740390`@400m d-rebased splice measured **116.554s** — confirmed strictly LESS than the honest partition's **119.594s** (36-05-SUMMARY.md Task 1; re-run 2026-10-01, still 2/2 green on the merged tree, same stream, same figures) | the shipped partition independently yields 119.594s (4:59/km), reproduced again today via the recount's own pinned-fixture check (`3475740390@400m: expected 3:20 -> MATCH` for the BEFORE figure; AFTER figure unchanged at 4:59 per the live `data/stats/best-efforts/3475740390.json` read 2026-10-01) |
| PR-08 overlap invariant | the planted `cut.startIndex + 2` widening on `3475740390` produced a candidate window `[2384, 2512.84]` against the real segment `[2508, 2513]` — overlap magnitude **4.838s**, >8x the `TOLERANCE_SEC=0.6` bound (36-06-SUMMARY.md); re-confirmed green (2/2) on the merged tree | the shipped direction sweeps every ranked effort archive-wide against its own activity's real segments: **0 violations**, maximum observed overlap 0.000s (not merely "none found" — the actual maximum is logged) |
| D-08 precedence fixture | stubbing `isPlausible` to evaluate the RAW figure on `3475725842`@400m would make `demotion !== null` fail the assertion (36-05-SUMMARY.md Task 2's own design; not independently re-run as a live stub in this plan, but the underlying fixture test is green 2/2 on the merged tree) | the correct, shipped implementation evaluates only the CLEAN figure: `demotion === null`, `contaminated.guard === 'unreliable-segment'`, ranked implied speed 3.254 m/s (independently plausible) |
| D-13 planted-partitioner (now 5 planted cases, post-gap-closure) | (b) a window SPANNING the burst with `contaminated: null` collapses the basis gate: contaminated median and control p95 land on the EXACT SAME value (16.6667) — proven, not assumed, via `toBeCloseTo`; (c) a `contaminated` record naming a CLEAN window fails the per-window verdict (ratio 1 ≤ control floor 1); (d)/(e)/(f) (added by the gap-closure round, `712140bb`) independently watch RED the dropped-crossing-pair, self-referential-window and unsatisfiable-p95-everywhere defects this very leg's OWN prior design had | the real shipped document has no such window: live run 2026-10-01, `pass=1440 fail=0 notAssessable=74`, basis gate OK (`controlP95=3.6667`, `contaminatedMedian=5.4355`, well separated) |
| SEG-05b stubbed segments | stub `detectUnreliableSegments` → `[]`, two hops through `pace-derivation.js`: EVERY `contaminated` must go `null` — confirmed on `3475740390`@400m, collapsing to `durationSec=79.9`, pace **3:20** (the pinned BEFORE figure, proving the stubbed build is provably today's pre-Phase-36 build) | with real segments (no stub), `3475740390`@400m's `contaminated` is non-null, `durationSec=119.6` (confirmed again today against the live, regenerated shard) |
| three-homes audit (36-09), watched RED three ways | `types` plant (guard string removed from `EffortDemotionGuard` only) → `missingHomes()` returns `['types']`; `client` plant (removed from `VALID_DEMOTION_GUARDS` only) → returns `['client']`; `recordsLogic` plant (the `case 'unreliable-segment':` block removed) → returns `['recordsLogic']`. Each plant is caught INDIVIDUALLY — a scanner checking only one home would still pass two of the three plants. A fourth planted group (guard text present only in a COMMENT beside each real declaration) returns the SAME single-element array per home, proving comment text never satisfies the audit | the real, shipped tree: all three homes agree for every one of the 4 parsed guards (the guard list itself is parsed from the union's own source text, never hardcoded) |
| write gate flag-absent case (36-07), reproduced LIVE twice | the historical, pre-36-07 code (`git show 17b5a455...`) used an unconditional `if (ceilingMovement.length > 0)` — the exact path that dirtied `data/best-effort-ceiling.json` during 36-04's own worktree setup | the shipped, gated code: `npm run compute-best-efforts` on the real archive (36-07's own live-evidence run, AND this plan's Task 1 `compute-all-stats` run 2026-10-01) reports genuine movement at every distance in its console output, yet `data/best-effort-ceiling.json`'s sha256 is BYTE-IDENTICAL before and after (`01802d20...`), both times — the opt-in was never passed |
| basis gate (36-12/gap-closure), both directions | planted defect (b): a window spanning the burst with `contaminated: null` makes the basis gate FAIL, reporting "the two distributions do not separate: the contaminated median (16.6667) does not exceed the control p95 (16.6667)" | the live, regenerated archive 2026-10-01: basis gate OK, `controlN=7326 contaminatedN=1440 controlP95=3.6667 contaminatedMedian=5.4355` — well separated |

### Known unsatisfiable row — do not plan it as written

**D-08's literal bound** ("a real activity that trips both the unreliable-segment guard AND an
absolute guard") is **unsatisfiable for the D-06 no-clean-window case**: 0 of 440 no-clean-window
occurrences independently fail an absolute guard on the live archive. It **is** satisfiable for the
**moved** case — 31 real pairs, e.g. `3475725842`@400m (raw 28.19 m/s vs recorded `max_speed`
6.08 m/s) and `3475713251`@400m (raw 14.75 m/s vs world-record 9.30 m/s).

**What was actually done, per plan 36-01's REQUIREMENTS.md amendment (D-08, dated 2026-09-28):**
the moved case was planned and implemented (36-05-SUMMARY.md Task 2, both activities, re-confirmed
green on the merged tree 2026-10-01). The no-clean-window combination was explicitly left to
defensive code — `ComputedEffort.demotion`'s own docblock (36-03) states the measured 0-of-440
finding plainly, and no synthetic look-alike fixture was built for it, honoring 36-RESEARCH.md
Pitfall 12.

---

## Wave 0 Requirements

- [x] New describe blocks in `src/analytics/compute-best-efforts.test.ts` — PR-06/07/08/09, SEG-05b
      (36-04 T3, 36-05 T1-4; `pace-single-source.test.ts` carries the SEG-05b stub test)
- [x] New bounds tests in `src/analytics/best-effort-utils.test.ts` — `startIndex`/`endIndex`
      (36-02 T2: 11 tests — identity, sliced-expectation equivalence ×4, totality ×6)
- [x] `scripts/compute-clean-window-recount.test.mjs` — D-13's planted-partitioner guard
      (36-12 T2, extended by the gap-closure round to 5 planted cases; 10 tests matched under `-t "planted"` today)
- [x] Idempotence harness for `36-CEILING-RECALIBRATION.md` (regenerate ×2, diff)
      (36-10 T3; re-proven ×3 on the post-merge tree by this plan's own Task 1, 2026-10-01)

Framework already installed — no install step needed.

---

## Manual-Only Verifications — Checkpoint Rows (D-18)

Drafted 2026-10-01 (plan 36-13), before plan 36-14's checkpoint round runs. Every row's Expected
value is derived OUTSIDE the changed code — from a SUMMARY's own prior measurement, from a
sibling artifact, or from a direct read of the regenerated shard document taken by this plan, never
from the rendered page itself and never re-derived from the same code the row judges. Verdicts are
left empty for plan 36-14's browser checkpoint to fill. Every row states the reachability check
performed and its outcome.

| Row id | What to observe | Where | Expected value | Independent source of that Expected value | CAN FAIL (concrete input) | CAN PASS (concrete input) | Reachability check performed | Verdict |
|---|---|---|---|---|---|---|---|---|
| a | `3475740390`'s 400m ranked pace | Activity detail view, stats card | **4:59/km** (119.6s, `paceSecPerKm` 299) | the AFTER figure recorded in 36-05-SUMMARY.md, independently re-derived via `complementSubIntervals` + the bounded sweep in 36-06's archive sweep; re-confirmed today by a direct read of the regenerated `data/stats/best-efforts/3475740390.json` | the row shows the pinned BEFORE figure **3:20/km** | the row shows **4:59/km** | BOTH directions confirmed reachable: 3:20/km is the real pre-Phase-36 figure of record (36-02's own pin), 4:59/km is the current shipped figure (confirmed live 2026-10-01) — not vacuous, not unpassable | **PASS** — developer: "a,b,c PASS" |
| b | `3475740390`'s 400m contaminated badge | Activity detail view, same row | `Ranked on clean window — contaminated window: 400m in 79.9s at t=2508.0-2587.9s, intersecting 4 unreliable segments (isolated-jump 52.4m/5.0s at t=2508.0; isolated-jump 28.6m/2.0s at t=2536.0; +2 more)` | the detector's own segment list for this activity, re-queried directly from the regenerated, post-gap-closure, merged archive today (`data/stats/best-efforts/3475740390.json`'s own `contaminated.reason`) | no badge appears, or the badge names one segment | the badge names two segments and a `+2 more` count | **CHECKED ON THE MERGED ARCHIVE, per the plan's own explicit warning:** re-queried 2026-10-01 against the regenerated shard — the count held at exactly 4 segments (unchanged by the no-op merge and by the gap-closure detector fix, which does not touch this fixture's own window). No redraft needed. | **PASS** — developer: "a,b,c PASS" |
| c | A no-clean-window activity's detail view | Activity detail view | `10232917652`@10k: effort still listed, carries `Demoted — no clean 10k sub-interval covers the distance (longest clean sub-interval spans 9710.5m); contaminated window: 10k in 3944.6s at t=0.0-3944.6s, intersecting 2 unreliable segments (isolated-jump 39.5m/4.0s at t=0.0; isolated-jump 29.1m/2.0s at t=616.0)`, and NO contaminated badge | the no-clean census and `noCleanWindowReason` format in 36-06-SUMMARY.md/36-04-SUMMARY.md; this specific real activity independently confirmed today via a direct read of `data/stats/best-efforts/10232917652.json` (`contaminated: null`, `excludedFromRecords: false`) | the effort is absent from the panel entirely | it is present with the demoted badge (containing "no clean" and the "longest clean sub-interval spans" clause) and no contaminated badge | confirmed reachable both ways: an excluded or absent-shard case would fail this row; this real, non-excluded activity passes today's shape check | **PASS** — developer: "a,b,c PASS" |
| d | Records screen at 400m, contamination note | Records screen, 400m PR table | contamination note reads **247** (all-time 400m efforts ranking on a clean window, owner-excluded efforts not counted); the existing demotion note at 400m reads **5** (0 world-record + 3 max-speed + 2 ceiling + 0 unreliable-segment) | `countContaminatedAtDistance`'s own walked, document-derived rule (36-09-SUMMARY.md), independently recomputed by this plan directly against the regenerated `data/stats/best-efforts.json` 2026-10-01 (not excluded: 247 contaminated, guard-count table: 0+3+2+0=5 demoted) | no contamination note appears, or its count equals the demotion count (5) | both notes render together with visibly different counts (247 vs 5) | both figures independently recomputed today against the live document; they differ by a wide margin (247 vs 5), so the row is reachable in both directions | **FAIL (row defect, developer's explicit disposition)** — developer: "d: contamination 247 but demotion says 4 not 5". Observed: contamination note 247, demotion note 4. Expected: 247 and 5. The count-independent PASS clause (two different counts shown together) held. Left unpatched. |
| e | Records screen's 10k demotion sentence | Records screen, 10k PR table empty/demotion state | sentence contains the clause `285 by the unreliable-segment guard (no clean window at this distance)` | `describeDemotionCounts`'s own source text (`records-logic.ts:280-281`) plus the Guard Counts table's own walked figure for 10k (`36-DIFF.md`, regenerated 2026-10-01: unreliable-segment=285) | the sentence instead reads `... by another guard` for this population | the sentence names the unreliable-segment guard by name with the exact parenthetical clause | both branches exist in the same source function (`other` vs the named `unreliableSegment` branch) and are mutually exclusive per-guard-count, so the row can fail only if a future edit collapses the named branch back into `other` | **FAIL (row defect, developer's explicit disposition)** — developer: "e: demotion sentence: "278 10K efforts were demoted by a plausibility guard (278 by the unreliable-segment guard (no clean window at this distance)). Efforts the owner excluded are not counted here. See the activity detail view for each reason."" Observed: 278 by the unreliable-segment guard. Expected: 285. The count-independent PASS clause (guard named with the exact parenthetical) held. Left unpatched. |
| f | Badge visual distinctness: contaminated vs. demoted, same activity | Activity detail view, two rows on one page | activity `10367206938`: 5k row carries `Ranked on clean window — contaminated window: 5k in 1845.9s at t=1892.0-3737.9s, intersecting an unreliable segment at t=3287.0-3289.0s (isolated-jump, 25.4m/2.0s)`; 10k row carries `Demoted — no clean 10k sub-interval covers the distance (longest clean sub-interval spans 5930.3m); contaminated window: 10k in 4508.2s at t=635.0-5143.2s, intersecting an unreliable segment at t=3287.0-3289.0s (isolated-jump, 25.4m/2.0s)` | **REDRAFTED from the plan's own draft.** The plan's suggested "a single row/effort carrying both" (e.g. `4598855187@1k`) no longer exists post-gap-closure — that activity's 1k effort now carries `demotion.guard === 'ceiling'` with `contaminated: null` (confirmed by direct read 2026-10-01). A search of the regenerated archive for an activity carrying a contaminated effort on ONE distance and a demoted effort on ANOTHER (255 such activities exist) was substituted; `10367206938` is the first alphabetically-stable match, confirmed by direct read today | the two badges (`.badge--contaminated` teal/cyan, `.badge--demoted` orange, per 36-08's CSS) render identically on this activity's two rows | they visibly differ in colour/hue on the two rows | **REACHABILITY REDRAFT PERFORMED AND RECORDED**, mirroring row (b)'s required check: the originally-implied single-effort co-occurrence is now UNREACHABLE (0 such records exist post-detector-fix, confirmed by the recount's own "internal consistency: OK, no violations"); the two-distinct-rows-same-activity substitute IS reachable (255 real candidates) | **PASS** — developer: "f: PASS" |
| g | Half-marathon fail-open | Records screen, half PR table | ranking renders with **0 ceiling-guard demotions** at half (Guard Counts table: half ceiling=0); the half ceiling itself is `null` (population 104→71, below `CEILING_MIN_POPULATION`=100) | `36-CEILING-RECALIBRATION.md`'s own `## Fail-Open Findings` section, regenerated 2026-10-01 on the merged tree — half still fails open (population still below the floor after the gap-closure fix; 69→71 drift explained in the artifact's own cause text) | a half-distance effort shows a demotion attributable to a ceiling guard | the half ranking shows world-record/max-speed demotions only (35 unreliable-segment, 0 ceiling, per the regenerated Guard Counts table), none attributable to a ceiling that no longer exists | **STILL EXERCISABLE on the merged archive** — re-confirmed 2026-10-01 that half's fail-open state survived the gap-closure fix (population moved 69→71 but stayed below the 100 floor); no redraft needed, contrary to the possibility the plan flagged | **FAIL (row defect, developer's explicit disposition)** — developer: "g: I guess pass? 33 demotions: "33 Half Marathon efforts were demoted by a plausibility guard (33 by the unreliable-segment guard (no clean window at this distance)). Efforts the owner excluded are not counted here. See the activity detail view for each reason."" Observed: 33 by the unreliable-segment guard, 0 ceiling-guard demotions. Expected: 35 unreliable-segment, 0 ceiling. The count-independent PASS clause (0 ceiling demotions) held. Left unpatched. |
| h | PR-09's signature | Developer's own `shasum -a 256` run at checkpoint time | `36-CEILING-RECALIBRATION.md` → `48b9e0836483c1017effc5010e7f7e8d0a771c8921faa0653aec433af61c8e89`; `36-DIFF.md` → `0f3803b3ec56c7cbdf4a42a117ed7d44d0df6f2ee8a8a6e4111fc9d2aac589e1` (both beside merge-equivalent commit `893eec64`) | an EXTERNAL tool (`shasum`), run independently by the developer, never read from inside either artifact (neither contains a sha256 or sign-off block, confirmed by this plan's and 36-10's/36-11's own verify scripts) | a freshly computed hash differs from either value above (meaning the tree moved after Task 1's regeneration — e.g. a later commit touched either file) | both freshly computed hashes match exactly | the external tool is independent of the code under judgment by construction; CAN FAIL is reachable by any post-`893eec64` edit to either file, CAN PASS is the current, confirmed state | **PASS** — developer: "h: maybe you can do this?" (shasum run by the orchestrator at the developer's request, 2026-11-24). Fresh `36-DIFF.md` `0f3803b3ec56c7cbdf4a42a117ed7d44d0df6f2ee8a8a6e4111fc9d2aac589e1`; fresh `36-CEILING-RECALIBRATION.md` `48b9e0836483c1017effc5010e7f7e8d0a771c8921faa0653aec433af61c8e89`. Both match. |

**On every row above:** the Expected value was computed from a source OTHER than the code the
checkpoint judges (a SUMMARY's prior measurement, a sibling artifact's own rendered table, or a
direct read of the regenerated document performed by THIS plan before any checkpoint ran) — never
from the rendered page, and never re-derived using the same function the row exists to verify.

---

## Served-Build and Checkpoint-Round Record (plan 36-14, Task 1)

The round ran on the PRIMARY checkout (`/Users/pedf/workspace/strava-widgets`), not a worktree, on 2026-11-24.

- `npm run build`, `compute-all-stats`, `build-widgets`, `verify-dashboard` all exit 0; verify-dashboard 67 passed, 0 failures. `build-widgets` logged `replaced stale ...` lines (a real rebuild); the build log was NOT treated as evidence of the served bytes.
- `git status --porcelain data/` was NOT empty straight after `compute-all-stats`: `data/geo/geo-metadata.json` changed in one line, `generatedAt` `2026-09-19T12:56:11.589Z` -> `2026-11-24T14:26:43.716Z` (the known timestamp-only side effect). It was reverted with `git checkout -- data/geo/geo-metadata.json` and `git status --porcelain` was empty before the round.
- `data/best-effort-ceiling.json` sha256 `01802d20cb6b97a7c7c8d63b17ab33cbfbae40fd1fc98ec73860e134dbdb8a20` before and after: byte-unchanged.
- Served build (`python3 -m http.server 4173`, root `dist/widgets`, 127.0.0.1): served `assets/index-CgwZxcPm.js` sha256 `c6b7d4cd5890109af0df7775d0868acb5b768991f8645c4ddf941d6e9ece0117` == on-disk file; served `index.html` `ae3e239ec81626bcacb08e24f2a45dd8e7ad60d3501adb9891a4048a49b83984` == on-disk file. No mismatch, no clean rebuild needed.

## PR-09 Signature Record (plan 36-14, Task 2)

- **Decision (developer, verbatim): "sign-both"**. When first asked, the developer answered "you decide"; the orchestrator declined to sign on the developer's behalf, recommended sign-both, and the developer then replied "sign-both".
- Signed artifacts and their externally computed sha256 (`shasum -a 256`, re-computed at checkpoint time, both identical to plan 36-13's record):
  - `36-CEILING-RECALIBRATION.md` — `48b9e0836483c1017effc5010e7f7e8d0a771c8921faa0653aec433af61c8e89`
  - `36-DIFF.md` — `0f3803b3ec56c7cbdf4a42a117ed7d44d0df6f2ee8a8a6e4111fc9d2aac589e1`
- Bound to commit `893eec64` (artifact regeneration). There is NO merge commit: plan 36-13's origin merge was a confirmed no-op (`origin/master` `5e902283` already an ancestor of local HEAD; `git merge` printed "Already up to date").
- **The signature explicitly covers the half-marathon fail-open finding (D-10):** the half-marathon ceiling population fell 104 -> 71, below `CEILING_MIN_POPULATION` = 100, so the half-marathon fails open and keeps only the world-record and max-speed guards. The floor was not moved to rescue it.
- Shown to the developer before the decision: totals (moved 1097, newly demoted 391, reinstated 31 = 31 absolute-guard + 0 ceiling, unchanged 7472); every per-distance ceiling row with its cause, including marathon not moving and 10k rising; the fail-open finding in full; the three-way reconciliation (legs 1 and 2 share one generator, leg 3 is independent, pass=1440 fail=0 notAssessable=74; the diff's internal 1097 vs 1128 gap is the 31 reinstatements; the two recount caveats: p75 was chosen by outcome, and 52 whole-activity windows cannot be assessed); D-17 queue evidence presented as evidence only, no queue change made or claimed.
- No signature or hash is written inside either artifact.
- **Superseded 2026-11-24 (orchestrator, after `/gsd-execute-phase 36` verification):** `36-VERIFICATION.md` returned `gaps_found` on ROADMAP criterion 4 / PR-09. `36-REVIEW.md` CR-01, confirmed in code (`compute-clean-window-diff.mjs`: `oldCeilings` reaches only `buildCeilingTable`), shows the signed `36-DIFF.md` never applies the pre-phase ceiling to its OLD reconstruction, so the figure shown to the developer, "reinstated 31 = 31 absolute-guard + 0 ceiling", was structurally unable to report a ceiling reinstatement. The decision above stays on record verbatim; it no longer binds, because the corrected diff will carry a new sha256. `36-CEILING-RECALIBRATION.md` is not implicated.

## Requirement Disposition (plan 36-14, Task 3)

The checkpoint table has no `Requirement` column, so the mapping of checkpoint rows to requirements is taken from the Per-Task Verification Map's own Requirement column, matching each row's behaviour to the map rows that cover the same behaviour. This mapping is the executor's inference and is recorded here so it can be contested.

| Requirement | Mapped checkpoint rows | Verdicts | Disposition |
|---|---|---|---|
| PR-06 | a (partition figure of `3475740390`@400m; map rows 36-05 T1, 36-06) | PASS | all map rows green, all checkpoint rows PASS: ticked |
| PR-07 | b, c, d, e, f (contaminated and demoted surfaces; map rows 36-08, 36-09 D-15/D-16) | b, c, f PASS; d, e FAIL | withheld by rows d and e |
| PR-08 | g (half-marathon fail-open; D-10 is PR-08's own amendment) | FAIL | withheld by row g |
| PR-09 | a (pinned scoping fixture), h (signature hashes) | PASS, PASS; signature decision `sign-both` | ticked, then REOPENED 2026-11-24 by verification (CR-01; signature superseded) |
| SEG-05b | map row 36-05 T4 (`-t "Phase 36 half"`, matched 1, green) | n/a, no checkpoint row | final half recorded; ticked on the two-condition rule (all four halves present in the row's text, stub proof green) |

`nyquist_compliant` is `false`: every Per-Task Verification Map row is green with a non-zero matched count, but the rule also requires every checkpoint row to be PASS, and d, e and g are FAIL. The earlier statement under the map that `nyquist_compliant: true` was set referred to the map rows only. `status: partial`.

## Gap-Closure Record (plan 36-14, Task 3)

Recorded verbatim, unpatched; no root-cause theory or fix is offered here (`/gsd-plan-phase 36 --gaps` owns that). Each was dispositioned by the developer as FAIL, row defect.

| Row | Expected | Observed (developer, verbatim) | Withheld requirement |
|---|---|---|---|
| d | contamination note 247; demotion note 5 | "d: contamination 247 but demotion says 4 not 5" | PR-07 |
| e | sentence contains `285 by the unreliable-segment guard (no clean window at this distance)` | "278 10K efforts were demoted by a plausibility guard (278 by the unreliable-segment guard (no clean window at this distance)). Efforts the owner excluded are not counted here. See the activity detail view for each reason." | PR-07 |
| g | 35 unreliable-segment demotions, 0 ceiling, half ceiling `null` | "33 Half Marathon efforts were demoted by a plausibility guard (33 by the unreliable-segment guard (no clean window at this distance)). Efforts the owner excluded are not counted here. See the activity detail view for each reason." (developer: "g: I guess pass?") | PR-08 |

---

## Gap-Closure Round 2 (plans 36-15..36-19)

Executed 2026-11-24 on the PRIMARY checkout by plan 36-19. Nothing in the sections above this one was rewritten: rows a-h, their verdicts, the PR-09 Signature Record (with its Superseded note), the Requirement Disposition and the Gap-Closure Record all stay on record verbatim. This section is appended.

### Round 2 Regeneration Record

- **Merge (MERGE-01).** `git fetch origin` succeeded. `git rev-list --count HEAD..origin/master` printed `0`, so no merge was needed and no merge commit exists. This is a truthful no-op, not a skipped step. Both artifacts were judged on HEAD `8a942e16` (plans 36-15..36-18 merged).
- **Rebuild.** `npm run build`, `npm run compute-all-stats`, `npm run build-widgets` and `npm run verify-dashboard` all exit 0 (verify-dashboard: 67 passed, 0 failures).
- **geo-metadata revert.** `compute-all-stats` changed `data/geo/geo-metadata.json` `generatedAt` from `2026-09-19T12:56:11.589Z` to `2026-11-24T22:55:54.393Z`. Reverted with `git checkout -- data/geo/geo-metadata.json`; `git status --porcelain data/` is empty.
- **Ceiling baseline.** `data/best-effort-ceiling.json` sha256 `01802d20cb6b97a7c7c8d63b17ab33cbfbae40fd1fc98ec73860e134dbdb8a20`, byte-unchanged. `--write-ceiling-state` was never passed.
- **Gate.** `npx tsc --noEmit` exits 0. `npm test`: 108 files / 3,971 tests passed, 0 failed, 24.9 s duration (baseline 107 / 3,921: one new test file, `scripts/compute-clean-window-before-state.test.mjs` with 15 tests, plus 35 added to existing files by plans 36-15, 36-17 and 36-18).
- **Recalibration re-verification.** `npm run compute-ceiling-recalibration` was run against a saved copy of the committed file. With the `**Generated:**` line stripped the two are identical, so the signed bytes were restored with `git checkout --` and `shasum -a 256` is still `48b9e0836483c1017effc5010e7f7e8d0a771c8921faa0653aec433af61c8e89`. `git diff --exit-code 40cf1651 -- scripts/compute-ceiling-recalibration.mjs` exits 0 (generator unchanged). CR-01 cannot move this artifact: its OLD population keeps would-be-ceiling-demoted efforts under Phase 28's Pass-1 rule, and leg 4's ceiling-before rows (below) independently agree with it per distance.
- **Diff regeneration.** `npm run compute-clean-window-diff`, committed as `3200aa41`. Headline: Moved but still ranked 1044; Newly demoted 372; Reinstated 45 (30 absolute-guard, 15 ceiling); Demoted before and after, guard changed 0; Unchanged 7469; Owner-excluded 61; 6 of 7 ceilings moved. Prior signed headline was 1097 / 391 / 31 (31 absolute, 0 ceiling) / 7472.
- **Idempotence (regen, commit, regen).** After the commit the generator was run again. `git diff --stat` showed exactly one changed line (`**Generated:**`); `diff <(grep -v '^\*\*Generated:\*\*' <(git show HEAD:<path>)) <(grep -v '^\*\*Generated:\*\*' <path>)` exited 0. The committed bytes were then restored. `grep -c` of the full and short HEAD sha in the artifact: 0 and 0. The `## Inputs` recalibration generatedAt (`2026-10-01T12:08:24.589Z`) equals the committed recalibration file's own Generated value.
- **Served digest.** `dist/widgets` served on 127.0.0.1:8765. The served `index.html` references `assets/index-C7XxjkuI.js`; served sha256 `eaf8e3d3cf4f9bf95dda50a095b39946b5f89d241f2e81ba14dba7cc2f88f8b2` equals the on-disk file. The served bundle contains `Measured on clean window` (1 occurrence). No mismatch, no clean rebuild needed. Server stopped.
- **Hashes at HEAD `3200aa41152ee787e9b59bbcc09606b2f2007671` (neither is written into either artifact):**
  - `36-DIFF.md` `e67f3cba48ac7e96e1ecac3de7f9db7d8525d5deaea124f14f55a78e39afacb4`
  - `36-CEILING-RECALIBRATION.md` `48b9e0836483c1017effc5010e7f7e8d0a771c8921faa0653aec433af61c8e89` (unchanged from the earlier signature)

### Four-Leg Reconciliation

| Leg | Reads | Shares | Result on the regenerated artifact |
|---|---|---|---|
| 1 diff generator internal sum | the diff's own populations | the generator's reconstruction | agrees: unreliable-segment demotions 386 vs walked 386 |
| 2 contaminated-record sum | the diff's addends vs the walked document | the generator's reconstruction | agrees: 1128 vs 1128 (1044 + 39 excluded + 45 reinstated) |
| 3 recount (`compute-clean-window-recount`) | the shipped document, own partitioner | nothing of the diff generator; never derives the BEFORE state | exit 0; pass=1440 fail=0 notAssessable=74 (of 1514), the same as baseline; basis gate OK (controlN=7326, contaminatedN=1440, controlP95=3.6667, contaminatedMedian=5.4355); floor p75 2.2857; internal consistency OK with no violations under 36-17's narrowed rule; three pinned fixtures MATCH (3:20, 3:21, 3:22) |
| 4 before-state (`compute-clean-window-before-state`) | the pre-phase pipeline (`ebe0245c`) run over the same tracked archive | the archive only | `BEFORE-STATE LEG: OK`, exit 0, 90 rows `agrees=true`, 0 `agrees=false`; `onlyInOld=0 onlyInNew=0` |

Leg 4 (`scripts/compute-clean-window-before-state.mjs`) is the only leg that independently derives the BEFORE state: it runs the pre-phase pipeline (`ebe0245c`) over the same tracked archive. Legs 1 and 2 share the diff generator's reconstruction (`reconstructOldEfforts` plus `applyOldCeilings`); leg 3 never derives the BEFORE state.

The before-state leg was RED against the pre-fix diff in plan 36-16 (52 disagreements, `ceiling reinstatements (total) | derived=15 | artifact=0`). It is GREEN now, which is the direction this plan supplies. Leg 4 rows: reinstated 45/45, absolute-guard 30/30, ceiling 15/15, newly demoted 372/372, guard-changed 0/0, moved-but-ranked 1044/1044, unchanged 7469/7469, owner-excluded 61/61, OLD guards not recognised 0/0; every per-distance reinstatement row; every OLD rank row at 400m, 1k, 1mi, 5k, 10k and half; ceiling-before for all seven distances against both `36-DIFF.md` and `36-CEILING-RECALIBRATION.md`.

Plan 36-15's real pair `3475714424`@400m (66.3 s OLD to 124.1 s NEW) appears in leg 4's ceiling-reinstated list, as do the other candidates 36-15 named (`3475723743`, `3475712272`, `3475725279`).

Reinstatement figures per distance and guard:

| Distance | Artifact absolute / ceiling | Leg 4 derived absolute / ceiling | Reviewer probe (ceiling) | Verifier probe (absolute + ceiling) | Difference explained |
|---|---|---|---|---|---|
| 400m | 24 / 7 | 24 / 7 | 7 | 31 | the verifier's figure is 24 + 7, the sum of both buckets; no per-pair difference |
| 1k | 4 / 5 | 4 / 5 | 5 | 9 | verifier = 4 + 5 |
| 1mi | 2 / 3 | 2 / 3 | 3 | 5 | verifier = 2 + 3 |
| 5k, 10k, half, marathon | 0 / 0 | 0 / 0 | 0 | 0 | none |
| Total | 30 / 15 | 30 / 15 | 15 (7/5/3) | 45 across all distances | the pre-fix artifact printed 0 ceiling and folded them into other buckets (CR-01); none of these figures is an expected value |

Strength-of-evidence notes the verifier asked this re-sign to state:

- **IN-01.** The leg-3 floor (p75) was chosen by outcome, so leg 3 is corroboration, not proof. Its pass=1440 does not by itself show the partition is right.
- **IN-04.** The diff's OLD plausibility is re-evaluated on a rounded duration, while leg 4 uses production's unrounded evaluation. Leg 4 found no boundary disagreement: every per-pair row agrees, so no pair needed an IN-04 label. This is evidence the rounding did not move any pair across a guard threshold in this archive; it is not a proof for other archives.

### Round 2 Verification Map

All counts measured live on HEAD `3200aa41` with `NO_COLOR=1 npx vitest run <file> -t "<filter>"`, read from vitest's own `Tests  N passed` line. No filter contains a regex metacharacter.

| Task ID | Plan | Wave | Requirement | Behavior | Test Type | Automated Command | File Exists | Matched | Status |
|---------|------|------|-------------|----------|-----------|-------------------|-------------|---------|--------|
| 36-15 T1 | 36-15 | 10 | PR-09 | `applyOldCeilings` gives the OLD side the pre-phase ceiling, so a ceiling reinstatement is expressible | unit | `NO_COLOR=1 npx vitest run scripts/compute-clean-window-diff.test.mjs -t "applyOldCeilings CR-01"` | ✅ exists | 7 | ✅ green |
| 36-15 T2 | 36-15 | 10 | PR-09 | real committed pair `3475714424`@400m classified as a ceiling reinstatement | regression, real fixture | `NO_COLOR=1 npx vitest run scripts/compute-clean-window-diff.test.mjs -t "real-pair ceiling reinstatement CR-01"` | ✅ exists | 2 | ✅ green |
| 36-15 T3 | 36-15 | 10 | PR-09 | owner-excluded and guard-changed kinds exist and are counted | unit | `NO_COLOR=1 npx vitest run scripts/compute-clean-window-diff.test.mjs -t "owner-excluded and guard-changed kinds WR-01"` | ✅ exists | 5 | ✅ green |
| 36-15 T3 | 36-15 | 10 | PR-09 | rendered headline and new sections | unit | `NO_COLOR=1 npx vitest run scripts/compute-clean-window-diff.test.mjs -t "headline and new sections"` | ✅ exists | 4 | ✅ green |
| 36-16 T1 | 36-16 | 10 | PR-09 | before-state leg bucket derivation | unit | `NO_COLOR=1 npx vitest run scripts/compute-clean-window-before-state.test.mjs -t "bucket derivation"` | ✅ exists | 5 | ✅ green |
| 36-16 T2 | 36-16 | 10 | PR-09 | before-state leg reconciles against the diff headline, fails closed on a missing figure | guard, both directions | `NO_COLOR=1 npx vitest run scripts/compute-clean-window-before-state.test.mjs -t "reconciliation against the diff headline"` | ✅ exists | 6 | ✅ green |
| 36-16 T3 | 36-16 | 10 | PR-09 | before-state leg imports neither the diff generator nor the recalibration script | source-text guard | `NO_COLOR=1 npx vitest run scripts/compute-clean-window-before-state.test.mjs -t "zero-import guard"` | ✅ exists | 4 | ✅ green |
| 36-17 T1 | 36-17 | 10 | PR-07 | WR-02 contract in the writer: contaminated records the measured window, demotion independent | unit | `NO_COLOR=1 npx vitest run src/analytics/compute-best-efforts.test.ts -t "WR-02 contract"` | ✅ exists | 3 | ✅ green |
| 36-17 T2 | 36-17 | 10 | PR-09 | recount internal consistency under the WR-02 contract | guard | `NO_COLOR=1 npx vitest run scripts/compute-clean-window-recount.test.mjs -t "WR-02 contract"` | ✅ exists | 4 | ✅ green |
| 36-17 T2 | 36-17 | 10 | PR-09 | recount internal-consistency describe as a whole | guard | `NO_COLOR=1 npx vitest run scripts/compute-clean-window-recount.test.mjs -t "INTERNAL CONSISTENCY"` | ✅ exists | 7 | ✅ green |
| 36-18 T1 | 36-18 | 10 | PR-07 | WR-03: a contaminated effort that is excluded or demoted shows `Measured`, not `Ranked`, copy | unit | `NO_COLOR=1 npx vitest run src/dashboard/views/detail-best-efforts-logic.test.ts -t "contaminated badge on a non-ranking row WR-03"` | ✅ exists | 5 | ✅ green |
| 36-18 T2 | 36-18 | 10 | PR-07 | WR-04: `countContaminatedAtDistance` skips demoted efforts | unit | `NO_COLOR=1 npx vitest run src/dashboard/views/records-logic.test.ts -t "skips demoted efforts WR-04"` | ✅ exists | 3 | ✅ green |
| 36-12 (re-measured) | 36-12 | 7 | PR-09 (D-13) | recount planted broken partitioners (re-measure of the existing leg-3 row) | guard, watched-failing-first | `NO_COLOR=1 npx vitest run scripts/compute-clean-window-recount.test.mjs -t "planted"` | ✅ exists | 10 | ✅ green |
| 36-16 live | 36-16 | 10 | PR-09 | leg 4 live run on the regenerated artifact | integration | `npm run compute-clean-window-before-state -- --pre-phase-dist <tmp>/prephase/dist` (exit code, and `BEFORE-STATE LEG: OK` in the output) | ✅ exists | n/a (exit-code check, not `-t`) | ✅ green |

The earlier statement that `36-17 T1`'s `WR-02 contract` filter matched 3 in `compute-best-efforts.test.ts` and 4 in the recount file is confirmed live: the filter is scoped per file, never run unscoped, because the two describes share the title fragment.

### Round 2 Checkpoint Rows

Expected values were derived on 2026-11-24 by walking `data/stats/best-efforts.json` with the independent command below, which applies the Records screen's documented filters (demotion: skip `excludedFromRecords === true`, bucket by `demotion.guard`; contamination: skip excluded and skip demoted). It imports nothing from `records-logic`, `dist/` or the diff generator.

Command W (pasted into every row that uses it):

`python3 -c "import json,collections as C;d=json.load(open('data/stats/best-efforts.json'));A=d['activities'].values();[print(k,'dem',sum(1 for a in A for e in a['efforts'] if e['distance']==k and e['demotion'] is not None and e['excludedFromRecords'] is not True),dict(C.Counter(e['demotion']['guard'] for a in A for e in a['efforts'] if e['distance']==k and e['demotion'] is not None and e['excludedFromRecords'] is not True)),'demInclExcl',sum(1 for a in A for e in a['efforts'] if e['distance']==k and e['demotion'] is not None),'cont',sum(1 for a in A for e in a['efforts'] if e['distance']==k and e['contaminated'] is not None and e['excludedFromRecords'] is not True and e['demotion'] is None),'contInclExcl',sum(1 for a in A for e in a['efforts'] if e['distance']==k and e['contaminated'] is not None and e['demotion'] is None),'contAndDemoted',sum(1 for a in A for e in a['efforts'] if e['distance']==k and e['contaminated'] is not None and e['demotion'] is not None and e['excludedFromRecords'] is not True)) for k in ['400m','1k','1mi','5k','10k','half']]"`

Its output: 400m dem 4 {max-speed 3, ceiling 1} demInclExcl 5 cont 247 contInclExcl 258 contAndDemoted 0; 10k dem 278 {unreliable-segment 278} demInclExcl 285; half dem 33 {unreliable-segment 33} demInclExcl 35 cont 11 contInclExcl 12; 5k dem 55 demInclExcl 60.

| Row id | Requirement | Supersedes | What to observe | Where | Expected value | Independent source of that Expected value | CAN FAIL (concrete input) | CAN PASS (concrete input) | Reachability check performed | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| d2 | PR-07 | d | Records screen at 400m: contamination note and demotion note | Records screen, 400m PR table | contamination note **247**; demotion note **4** (0 world-record + 3 max-speed + 1 ceiling + 0 unreliable-segment) | Command W, 400m line: `cont 247`, `dem 4 {max-speed 3, ceiling 1}` | the demotion note reads **5** (owner-excluded counted, `demInclExcl 5`, the shipped defect row d exposed) or the contamination note reads **258** (owner-excluded counted, `contInclExcl 258`) | both notes show 247 and 4, which differ from each other and from the defect values 258 and 5 | BOTH directions reachable: the defect value 5 differs from the Expected 4 by the one owner-excluded ceiling demotion, so the row is not vacuous; 247 and 4 are the live walked figures, so it is not unpassable. WR-04 clause (contaminated and demoted, non-excluded) measures 0 at every distance on live data (`contAndDemoted 0`), so this row CANNOT discriminate the WR-04 skip; that clause is covered only by plan 36-18's unit test (`-t "skips demoted efforts WR-04"`, 3 matched) | |
| e2 | PR-07 | e | Records 10k demotion sentence | Records screen, 10k PR table demotion state | sentence contains `278 by the unreliable-segment guard (no clean window at this distance)` | Command W, 10k line: `dem 278 {unreliable-segment 278}` | the sentence reads `285 by the unreliable-segment guard ...` (owner-excluded counted, `demInclExcl 285`) or `... by another guard` | the exact clause with 278 | BOTH directions reachable: 285 differs from 278 by 7 owner-excluded 10k demotions, so the exclusion defect is discriminated; 278 is the live non-excluded count (the developer observed 278 in round 1) | |
| g2 | PR-08 | g | Records half-marathon demotion sentence and ceiling | Records screen, half PR table | **33** by the unreliable-segment guard, **0** ceiling-guard demotions; half ceiling `null` (population 71, below `CEILING_MIN_POPULATION` 100) | Command W, half line: `dem 33 {unreliable-segment 33}`; `ceilings.half.ceilingMps` is `null`, `populationN` 71, in `data/stats/best-efforts.json`; also `36-CEILING-RECALIBRATION.md` `## Fail-Open Findings` | a ceiling-guard demotion at half, or **35** (owner-excluded counted, `demInclExcl 35`) | exactly 33 unreliable-segment and 0 ceiling | EXERCISABLE: re-measured on this merged archive, half still fails open (populationN 71, ceilingMps null). 35 differs from 33 by 2 excluded demotions, so the row can fail; 33 is the live count, so it can pass | |
| i | PR-07 | new (WR-03) | Detail view of an owner-excluded contaminated effort: `3475711469`@400m (125.4 s, `demotion` null, `excludedFromRecords` true) | Activity detail view for `3475711469`, 400m row | badge text exactly `Measured on clean window — contaminated window: 400m in 57.5s at t=1648.0-1705.5s, intersecting an unreliable segment at t=1689.0-1705.0s (hidden-pause, 274.6m/16.0s)`, plus an excluded badge, and NO visible text containing `Ranked` on that row | `data/stats/best-efforts/3475711469.json` `contaminated.reason`, and the live `data/best-effort-exclusions.json` entry `{activityId: "3475711469", distances: null, reason: "bad measurement"}` (whole activity), so the detail view's live `excluded` resolves true. 39 such efforts exist (contaminated, owner-excluded, demotion null), across 11 activities, found by an `excludedFromRecords is True and contaminated is not None` walk | the row shows `Ranked on clean window — ...` (the shipped WR-03 defect) | the row shows the `Measured on clean window` copy | BOTH directions reachable: 39 real efforts qualify, all with `demotion` null, so the defect path (`Ranked` beside Excluded) was reachable before plan 36-18 and the fixed copy is reachable now | |
| b2 | PR-07 | new (regression for the changed badge code) | `3475740390`@400m badge | Activity detail view, same 400m row as old row b | exactly `Ranked on clean window — contaminated window: 400m in 79.9s at t=2508.0-2587.9s, intersecting 4 unreliable segments (isolated-jump 52.4m/5.0s at t=2508.0; isolated-jump 28.6m/2.0s at t=2536.0; +2 more)` | `data/stats/best-efforts/3475740390.json` 400m `contaminated.reason`, re-read today; `excludedFromRecords` false and `demotion` null | `Measured on clean window — ...` (an over-broad rank condition from plan 36-18) | the `Ranked on clean window` copy | BOTH directions reachable: this effort is neither excluded nor demoted, so Ranked is correct, and an over-broad change would flip it to Measured | |
| f carry-forward | PR-07 | f carries forward (no f2) | none: `10367206938`@5k is neither excluded nor demoted (measured: `excludedFromRecords` false, `demotion` null, `contaminated` present; the 10k row is demoted with guard unreliable-segment and not excluded), so the WR-03 change cannot alter row f's Expected | n/a | row f's Expected is unchanged | direct read of `data/stats/best-efforts.json` | n/a | n/a | measured, see Expected | not re-run |
| h2 | PR-09 | h | a fresh `shasum -a 256` of both artifacts at checkpoint time | developer's own `shasum` | `36-DIFF.md` `e67f3cba48ac7e96e1ecac3de7f9db7d8525d5deaea124f14f55a78e39afacb4`; `36-CEILING-RECALIBRATION.md` `48b9e0836483c1017effc5010e7f7e8d0a771c8921faa0653aec433af61c8e89` (beside HEAD `3200aa41`; the 36-DIFF.md hash is the round-2 artifact, not the superseded `0f3803b3...`) | an EXTERNAL tool (`shasum`), never read from inside either artifact | a freshly computed hash differs from either value (any post-`3200aa41` edit to either file) | both match exactly | CAN FAIL by any later edit, CAN PASS in the current state, both confirmed by the task-2 shasum run | |

### Row-to-Requirement Mapping (all rows, explicit)

| Row | Requirement(s) | Verdict on record | Superseded by | Counts toward disposition? |
|---|---|---|---|---|
| a | PR-06, PR-09 | PASS | none | yes |
| b | PR-07 | PASS | none | yes |
| c | PR-07 | PASS | none | yes |
| d | PR-07 | FAIL (row defect) | d2 | no, superseded; verdict stays on record |
| e | PR-07 | FAIL (row defect) | e2 | no, superseded; verdict stays on record |
| f | PR-07 | PASS | none (carries forward, see the f carry-forward row) | yes |
| g | PR-08 | FAIL (row defect) | g2 | no, superseded; verdict stays on record |
| h | PR-09 | PASS | h2 | no, superseded; verdict stays on record |
| d2 | PR-07 | pending | none | yes |
| e2 | PR-07 | pending | none | yes |
| g2 | PR-08 | pending | none | yes |
| i | PR-07 | pending | none | yes |
| b2 | PR-07 | pending | none | yes |
| h2 | PR-09 | pending | none | yes |

A requirement is ticked only when every non-superseded row mapped to it is PASS; for PR-09 the developer's round-2 signature is additionally required.

Frontmatter `status: partial` and `nyquist_compliant: false` stay until plan 36-20. Approval is left as it is.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Every `-t` row records its matched test count (two originally-vacuous commands corrected above)
- [x] Every guard demonstrated red on a planted violation before it may pass
- [x] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (withheld: checkpoint rows d, e, g FAIL)

**Approval:** partial — checkpoint round run 2026-11-24 (a, b, c, f, h PASS; d, e, g FAIL, row defects left unpatched); PR-09 signed (`sign-both`)
