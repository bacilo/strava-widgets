---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 12
subsystem: analytics
tags: [best-effort, clean-window-search, reconciliation, zero-import-recount, outlier-statistic, vitest]

# Dependency graph
requires:
  - phase: 36-04
    provides: "the clean-window search wired into computeBestEfforts, ComputedEffort.contaminated and the 'unreliable-segment' demotion guard — the shipped surface this leg reads and judges"
  - phase: 36-11
    provides: "36-DIFF.md's ## Guard Counts (leg 2) and ## Internal Reconciliation sections (439 unreliable-segment, 1201 walked contaminated, a 32-record moved-but-ranked gap explained by 31 reinstatements + 1 contaminated-and-ceiling-demoted record) — the figures this plan's leg 3 independently corroborates from a wholly different algorithm"
provides:
  - "scripts/compute-clean-window-recount.mjs — PR-09's third reconciliation leg: zero-import (exactly {fs, path, url}), a coarser self-referential per-window outlier-ratio statistic (max/median pair speed), a verdict threshold measured from a live CONTROL population inside the same run, a fail-closed basis gate, an internal-consistency walk, and the three pinned scoping-activity fixtures"
  - "scripts/compute-clean-window-recount.test.mjs — 21 tests: two planted partitioner defects watched failing, the basis gate watched failing in three ways plus one healthy pass, the zero-import scan watched reporting a planted import and watched NOT reporting a commented-out one, internal-consistency both directions, pinned fixtures both directions, four pairSpeeds/windowOutlierRatio totality cases"
  - "npm run compute-clean-window-recount"
  - "An independent re-discovery of 36-11's own finding: this leg's own internal-consistency walk (sharing no code with 36-11's generator) flags the SAME record, 4598855187@1k, as carrying both a non-null contaminated record and a non-null demotion (guard=ceiling) — corroborating that finding from a wholly different mechanism"
affects: [36-13, 36-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Measure before declaring: the verdict rule's threshold (ratio > control p95) was derived from a scratchpad-only throwaway probe run against the live archive BEFORE any line of the declared rule was written, mirroring the project's 'measured, not guessed' convention and D-13's own bound"
    - "A genuinely independent third leg: zero imports of the search, the detector, or either of the other two legs' own generators — only readFileSync of the shipped document and the committed streams, with its own locally-duplicated constants and its own coarser statistic"
    - "A basis gate that fails closed on degeneracy in either direction (empty contaminated population, undersized control population, or non-separating distributions) is a SEPARATE check from the verdict itself, so a degenerate run never silently produces a misleadingly strict or misleadingly lenient pass"
    - "The planted-defect test demonstrates the FAILURE MECHANISM, not just the failure: the broken-partitioner fixture's control-threshold and contaminated-median land on the exact same numeric value because both are measuring the identical burst statistic — proving the leaked window is what destroys separation, not an unrelated side effect"

key-files:
  created:
    - scripts/compute-clean-window-recount.mjs
    - scripts/compute-clean-window-recount.test.mjs
  modified:
    - scripts/unreliable-segment-import-guards.test.mjs
    - package.json

key-decisions:
  - "CONTROL_PERCENTILE_LOCAL = 95, CONTROL_BASIS_MINIMUM_LOCAL = 30, MIN_PAIRS_FOR_RATIO_LOCAL = 3 — all three stated with their reasoning in the source docblock, derived from the Task 1 measurement, and explicitly marked as never-to-be-widened to force a future run to pass."
  - "checkInternalConsistency's two-homes check is written as ONE general rule (contaminated != null AND demotion != null is always a violation, regardless of guard) rather than two separate rules, because the general rule is strictly stronger than — and implies — the narrower 'a demotion.guard===unreliable-segment effort has contaminated===null' phrasing in the plan; both are exercised by the same check and the same test."
  - "TARGET_METERS_LOCAL, required by the plan as a duplicated-deliberately local constant, is put to real use (not left as dead weight) as a membership check inside checkInternalConsistency: every effort's distance must be one of the seven known target distances."
  - "The live run's 190 ratio-rule failures and 1 internal-consistency violation are recorded as findings, per the plan's own Task 3 instruction ('a non-zero exit is a FINDING, not a task to work around') — no threshold, minimum, or fixture was adjusted to make the run pass."

patterns-established:
  - "A recount's own basis gate and its verdict function are kept as two separate exported functions (checkBasisGate, deriveVerdict) so a caller — or a test — can exercise the verdict math independently of the gate, while main() always runs the gate first and refuses to trust a verdict computed over a degenerate basis."

requirements-completed: []  # Plan frontmatter lists PR-09 but the plan's own <objective> states: "this plan ticks nothing and edits no requirement or roadmap document." No requirements.mark-complete call was made.

# Metrics
duration: ~70min
completed: 2026-10-01
---

# Phase 36 Plan 12: PR-09's Third Reconciliation Leg — Clean-Window Recount Summary

**A new, zero-import recount (`scripts/compute-clean-window-recount.mjs`) judges every contaminated window against a threshold measured live from the archive's own clean windows (control p95 = 2.98, contaminated median = 4.77 — well-separated), independently re-derives leg 2's exact guard counts (439 unreliable-segment, 1201 contaminated, 445 total demotions), and independently re-discovers 36-11's own `4598855187@1k` finding from a wholly different mechanism — all proven capable of catching a planted spanning window and a planted mislabelled window before being trusted on the real, now-regenerated archive.**

## Performance

- **Duration:** ~70 min (precedent reading, a throwaway measurement probe before any verdict rule was declared, building and testing the recount, then a live run and its reconciliation)
- **Started:** 2026-10-01
- **Completed:** 2026-10-01
- **Tasks:** 3 completed (Task 3 produced no file changes — see "Task Commits" below)
- **Files modified:** 4 (matches `files_modified` exactly: `scripts/compute-clean-window-recount.mjs`, `scripts/compute-clean-window-recount.test.mjs`, `scripts/unreliable-segment-import-guards.test.mjs`, `package.json`)

## Accomplishments

- **Measured before declaring (Step A, Task 1):** a scratchpad-only throwaway probe (never committed — lived at the session scratchpad path, deleted after use) read the regenerated shipped document and every referenced committed stream, and computed the per-window outlier ratio (`max pair speed / median pair speed`) for two populations on the live, 1,874-stream archive, 2026-10-01:

  | Population | n | min | p05 | p25 | median | p75 | p95 | max |
  |---|---|---|---|---|---|---|---|---|
  | CONTAMINATED (`contaminated != null` OR `demotion.guard === 'unreliable-segment'`) | 1627 | 1.0071 | 2.5962 | 3.4829 | 4.7911 | 7.8667 | 12.4286 | 301.0000 |
  | CONTROL (`contaminated === null` AND `demotion === null`) | 7340 | 1.0291 | 1.1587 | 1.3542 | 1.6114 | 2.0476 | 3.0000 | 12.8000 |

  **Separation check:** contaminated median (4.7911) exceeds control p95 (3.0000) — the distributions SEPARATE. Per the plan's own instruction, the rule was therefore DECLARED (`ratio > control p95`, computed live inside the run) rather than halted. The recount's own live run (Task 3) recomputed the same two populations with its own local `percentileLocal`/`medianLocal` (nearest-rank, not true-average-of-two-middle-values) and got slightly different but consistent figures (control p95 = 2.9797, contaminated median = 4.7667) — the small drift is exactly the documented, harmless rank-convention difference the source's own docblock warns a reader to expect, and separation holds just as strongly.
- **`scripts/compute-clean-window-recount.mjs`** (≈470 lines): header docblock with the FORBIDDEN paragraph (naming all eight barred modules, `pace-derivation.js` explicitly with its reason — `classifyGapsWithSegments` is the sole call site of `detectUnreliableSegments`), THE BOUND ON ITS CLAIM paragraph, and the DECLARED VALUE paragraph recording the measured basis above. Exactly three imports (`fs`, `path`, `url`). Eight exported pure functions (`pairSpeeds`, `windowOutlierRatio`, `classifyWindows`, `deriveVerdict`, `checkBasisGate`, `checkInternalConsistency`, `checkPinnedFixtures`, `renderVerdict`) plus a gated `main()`. Writes no artifact, ever.
- **`scripts/compute-clean-window-recount.test.mjs`** (21 tests): see "Planted Defects — Verbatim" and "Verification Evidence" below for the full breakdown.
- **`scripts/unreliable-segment-import-guards.test.mjs`**: one new negative assertion for `compute-clean-window-recount.mjs`, reusing the file's existing observing `vi.mock('fs')` mechanism; both positive controls still fire in the same run (10/10 total, up from 9/9).
- **The live run (Task 3)**: `npm run build && npm run compute-best-efforts` regenerated the shipped document cleanly (`git status --porcelain data/` empty both before and after). `npm run compute-clean-window-recount` exited **1** — recorded as a finding per the plan's own instruction, not worked around. See "Live Run Against the Archive" below for the full figures and the three-way reconciliation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Measure both outlier-ratio distributions, declare the verdict rule with its basis, and build the recount** - `c32d7df3` (feat)
2. **Task 2: Watch it RED — the planted broken partitioner, the zero-import scan, and the basis gate both ways** - `cf9c7eef` (test)
3. **Task 3: Run the recount against the live archive and record its verdict** - no commit. The task's own `<files>` scope (`scripts/compute-clean-window-recount.mjs`) permits a fix if the live run surfaced a bug in the recount itself; it did not — the recount ran correctly and its non-zero exit is the expected, designed outcome of a genuine finding (190 ratio-rule failures, 1 internal-consistency violation), which the plan's own instructions require recording rather than adjusting away. `data/` was regenerated and stayed clean (`git status --porcelain data/` empty), so there is nothing in this task's scope to commit.

**Plan metadata:** this SUMMARY commit is the metadata commit. Per this plan's objective, `.planning/ROADMAP.md` and `.planning/STATE.md` are NOT touched by this agent — the orchestrator owns that tracking, and no `requirements mark-complete` call was made.

## Files Created/Modified

- `scripts/compute-clean-window-recount.mjs` (new) — PR-09's third, zero-import reconciliation leg.
- `scripts/compute-clean-window-recount.test.mjs` (new, 21 tests) — the planted-defect, basis-gate, zero-import-scan, internal-consistency, pinned-fixture and totality guard tests.
- `scripts/unreliable-segment-import-guards.test.mjs` — one new negative assertion (7 lines).
- `package.json` — one new script, `compute-clean-window-recount` (no build prefix, matching the recount convention).

## Verification Evidence

- `npx vitest run scripts/compute-clean-window-recount.test.mjs -t "planted" --reporter=verbose` — **6 matched, 6 passed** (0 skipped-as-failed; the other 15 tests in the file were correctly skipped by the filter).
- `npx vitest run scripts/compute-clean-window-recount.test.mjs --reporter=verbose` — **21/21 tests pass**.
- `npx vitest run scripts/unreliable-segment-import-guards.test.mjs --reporter=verbose` — **10/10 tests pass**, including both positive controls (`import-time-read-probe-named.mjs`, `import-time-read-probe-default.mjs`).
- `npm test` (full suite) — **107 files / 3913 tests pass** (up from 106/3891 before this plan: +1 file, +22 tests).
- The recount's code region (after comment-stripping) imports exactly `fs`, `path`, `url` and references none of the eight forbidden modules — verified by both the plan's own Python script (Task 1) and a vitest zero-import scan (Task 2) that is itself watched reporting a planted `best-effort-utils.js` import and watched NOT reporting the same name planted inside a comment-only line.
- `TARGET_METERS_LOCAL`, `percentileLocal`, `medianLocal` are declared locally; `percentileNearestRank` is never imported; `speedLimitMps` appears nowhere in the file.
- The three pinned BEFORE pace strings (`'3:20'`, `'3:21'`, `'3:22'`) are present as fixtures and all three MATCH on the live, regenerated archive.
- `main()` is gated behind `import.meta.url === pathToFileURL(...)`; the recount writes no file (`writeFileSync` appears nowhere in the module).
- The throwaway measurement probe lived only in the session scratchpad directory and was never committed, staged, or referenced from source — confirmed by `git status --short` showing no trace of it.
- `git status --porcelain data/` was empty both before and after `npm run compute-best-efforts` in Task 3.
- `git diff --stat` against the pre-plan commit touches exactly the four `files_modified` entries (no `36-DIFF.md`-style generated artifact this time — this leg writes nothing).

## Planted Defects — Verbatim (Task 2, §1(b) and §1(c))

**(b) A window that SPANS the burst with `contaminated: null` (a broken partitioner) enters CONTROL and destroys separation.** Fixture: 5 of 8 correctly-partitioned burst activities rewritten so their ranked window IS the burst window and `contaminated` is `null`. Mechanism asserted, not assumed: the 5 planted windows are confirmed to land in the CONTROL population (`populations.control` grows from 27 to 32; `populations.contaminated` shrinks from 8 to 3). The basis gate's reported reason, verbatim from the test run:

> `the two distributions do not separate: the contaminated median (16.666666666666668) does not exceed the control p95 (16.666666666666668)`

The control threshold and the contaminated median land on the EXACT SAME number (asserted via `toBeCloseTo(..., 6)`) because both are now measuring the identical burst statistic — proof that the leaked window, not some unrelated side effect, is what destroys separation.

**(c) A `contaminated` record naming a CLEAN window (the search labelled the wrong window) is marked failing the ratio rule.** Fixture: one correctly-shaped burst activity's `contaminated` record is rewritten to point at a clean 10-pair sub-interval of the same stream instead of the real burst. Result: `deriveVerdict` reports `pass: 7, fail: 1`, with the single offending entry's `activityId` equal to the mislabelled activity and its `ratio` equal to `1` (a perfectly clean window, correctly judged as carrying no anomaly) against a control threshold of `1` (all-identical control population) — `1 > 1` is false, so the mislabelled window correctly fails.

## Live Run Against the Archive (Task 3)

`npm run build && npm run compute-best-efforts` regenerated `data/stats/best-efforts.json` cleanly; `git status --porcelain data/` was empty both before and after (confirming the write gate holds — nothing wrote outside the gitignored `data/stats/` tree).

`npm run compute-clean-window-recount` **exited 1**. Full figures from the console output:

- **Contaminated population:** 1640 total (assessable with a computed ratio: 1627; 13 not-assessable for having fewer than 3 qualifying sample pairs).
- **Control population:** 7346 total (assessable: 7340).
- **Basis gate: OK.** `controlN=7340`, `contaminatedN=1627`, `controlP95=2.9797297297296907`, `contaminatedMedian=4.766666666666576` — well separated.
- **Verdict:** `pass=1437`, `fail=190`, `notAssessable=13` (of 1640). 190 offending entries were printed by name (activity@distance, ratio, pair count) — full list in the recorded console output. Many of the offending entries carry very large pair counts (100s to 1000s — e.g. several `10k`/`half` windows), which is consistent with this leg's own documented, deliberate coarseness: a `max/median` ratio computed over an entire multi-thousand-pair window dilutes a short, genuinely-detected anomaly, exactly the trade-off THE BOUND ON ITS CLAIM paragraph warns about. **This is recorded as a finding, not adjusted** — no threshold, minimum, or statistic was changed in response to it, per the plan's explicit instruction.
- **Internal consistency: 1 violation** — `4598855187@1k: carries both a non-null contaminated record and a non-null demotion (guard="ceiling") — the two-homes rule forbids this`. This is the SAME record 36-11-SUMMARY.md already identified and explained (the clean sub-interval it found still exceeds the personal ceiling, so `demotion.guard === 'ceiling'` fires alongside a populated `contaminated`) — **independently re-discovered here by a leg sharing no code with 36-11's generator**, via a structural two-homes check rather than a classification-priority argument. This corroborates, from a wholly different angle, that the tension is a genuine, pre-existing archive fact and not an artifact of either generator's own logic.
- **Walked non-null-demotion count: 445.**
- **Pinned fixtures: all three MATCH** — `3475740390@400m` → `3:20`, `3475724402@400m` → `3:21`, `3475734189@400m` → `3:22`.

### The Three-Way Reconciliation

A direct query of the same regenerated document (for this reconciliation narrative only, not part of the recount's own output) confirms this leg's own independent walk gives:

| Figure | Leg 3 (this recount, independent) | Leg 2 (36-DIFF.md's walked guard counts) | Leg 1 (36-DIFF.md's classified lists) |
|---|---|---|---|
| `unreliable-segment` demotion count | 439 | 439 | 439 (newly-demoted) |
| `contaminated != null` count | 1201 | 1201 | 1169 (moved-but-ranked) |
| Total non-null demotions | 445 | 445 (0 world-record + 3 max-speed + 3 ceiling + 439 unreliable-segment) | — |

**Leg 3 agrees EXACTLY with leg 2 on both raw counts (439 and 1201).** Leg 1's own classified "moved-but-ranked" LIST total (1169) differs from the raw walked-`contaminated` count (1201) by exactly 32 — a gap 36-11-SUMMARY.md already fully investigated and explained as 31 absolute-guard reinstatements (classified `reinstated`, not `moved-but-ranked`, by leg 1's priority rule) plus the single `4598855187@1k` contaminated-and-ceiling-demoted record. Leg 3 independently rediscovers that exact same record via its own, differently-mechanised internal-consistency check, which is strong corroboration that the 32-record gap is a real, fully-accounted-for archive fact rather than a bug in either generator.

**Stated plainly, as the plan requires:** leg 1 (the diff) and leg 2 (the walked guard count) are BOTH computed by the SAME generator, `scripts/compute-clean-window-diff.mjs`, reading the SAME generated document with the SAME classification logic — they share a dependency, so their agreement with each other is expected and only partially meaningful on its own. Leg 3 (this recount) imports NEITHER the search (`compute-best-efforts.ts`) NOR the detector (`unreliable-segments.ts`/`pace-derivation.ts`) NOR `compute-clean-window-diff.mjs` itself — it is the only leg of the three that is genuinely independent of that shared generator. Its EXACT agreement with leg 2's raw counts (439 and 1201), reached via completely different code reading the document and the raw streams from scratch, is the meaningful corroboration; the three-way agreement as a whole (exact on the two raw counts, and the 32-record gap fully and independently re-explained) is what makes this finding trustworthy rather than a shared blind spot.

## Known Stubs

None — this is dev tooling with no UI surface.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or schema change. This plan's own threat register (T-36-70..T-36-77) is fully covered by the mitigations implemented: the three-import assertion, the coarser self-referential statistic with no detector-constant reuse, the measured-basis verdict rule with a fail-closed basis gate, the two planted-defect proofs, the comment-stripped zero-import scan watched both ways, the test sibling's never-reads-the-gitignored-document assertion, the four degenerate-window totality cases, and the per-failure exit-reason strings.

## Decisions Made

See `key-decisions` in the frontmatter above. The most consequential: declaring the verdict rule (`ratio > control p95`, with `CONTROL_PERCENTILE_LOCAL = 95`, `CONTROL_BASIS_MINIMUM_LOCAL = 30`, `MIN_PAIRS_FOR_RATIO_LOCAL = 3`) strictly from the Task 1 measurement, before any production code used it, and never revisiting that declaration even after the live run (Task 3) produced a non-zero exit — the 190 ratio-rule failures and the 1 internal-consistency violation are recorded as findings, exactly as the plan requires.

## Deviations from Plan

### Auto-fixed Issues

None — the implementation matched the plan's literal specification. No bug was found during the live run; the non-zero exit is the recount correctly reporting genuine findings against its own declared, measured rule, not a defect in the recount requiring a fix.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None. The plan executed as written; Task 3's non-zero exit and its 191 total findings (190 ratio-rule failures + 1 internal-consistency violation) are the expected, designed output of a leg that judges real archive data against a measured, unwidened threshold, and are documented above rather than worked around.

## Issues Encountered

None requiring problem-solving. The live run's non-zero exit is a genuine, expected finding (per the plan's own "a non-zero exit is a FINDING, not a task to work around" instruction), fully documented in "Live Run Against the Archive" above, not an issue that needed resolving.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PR-09's three-leg reconciliation is now complete: leg 1 (`36-DIFF.md`'s classified lists), leg 2 (the same artifact's walked guard counts), and leg 3 (this plan's zero-import recount) all exist and have been run against the live, regenerated archive. Leg 3 agrees exactly with leg 2 on both raw counts it can check (439, 1201) and independently re-discovers the same single internal tension (`4598855187@1k`) that leg 1's own generator found.
- The recount's 190 ratio-rule failures on the live archive are a recorded finding, not a blocker — THE BOUND ON ITS CLAIM paragraph in the recount's own header already states this leg cannot and does not arbitrate whether Phase 32's calibrated detector thresholds are exactly right; it only confirms an anomaly-detection signal is present, using a deliberately coarser statistic than the detector's own boundary.
- No blockers for 36-13/36-14. This plan touched no production source module — only two new scripts (one dev tool, one its test sibling), one existing test file's negative-assertion list, and one `package.json` script entry.
- Per this plan's objective, no requirement or roadmap document was ticked or edited; PR-09's own tick (if any) remains the orchestrator's and a later plan's responsibility.

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: scripts/compute-clean-window-recount.mjs
- FOUND: scripts/compute-clean-window-recount.test.mjs
- FOUND: scripts/unreliable-segment-import-guards.test.mjs (modified)
- FOUND: package.json (modified)
- FOUND: commit c32d7df3
- FOUND: commit cf9c7eef

---
*Phase: 36-best-effort-clean-window-search-ceiling-recalibration*
*Completed: 2026-10-01*
