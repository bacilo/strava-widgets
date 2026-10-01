---
phase: 36-best-effort-clean-window-search-ceiling-recalibration
plan: 11
subsystem: analytics
tags: [best-effort, clean-window-search, archive-wide-diff, generated-artifact, idempotence, vitest]

# Dependency graph
requires:
  - phase: 36-04
    provides: "computeActivityEfforts's clean-window search wired into computeBestEfforts on every run, ComputedEffort.contaminated and the 'unreliable-segment' demotion guard — the shipped surface this plan's diff classifies"
  - phase: 36-10
    provides: "scripts/compute-ceiling-recalibration.mjs's reconstructOldEfforts/buildPopulations (the one shared OLD-state reconstruction rule, imported never reimplemented) and 36-CEILING-RECALIBRATION.md (the committed artifact this plan's ceiling table cross-checks against)"
provides:
  - "scripts/compute-clean-window-diff.mjs — pure exported functions (classifyEffortChanges, splitReinstatements, buildRankChanges, walkGuardCounts, reconcileCounts, buildCeilingTable, crossCheckCeilingAgainstRecalibration, reconcileAgainstProbe, buildDiffReport, renderDiffMarkdown) plus a gated main()"
  - ".planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-DIFF.md — the committed, three-times-proven-idempotent archive-wide before/after diff covering every rank change, newly demoted effort, reinstated effort (both kinds), moved-but-ranked effort and ceiling value"
  - "npm run compute-clean-window-diff"
  - "A genuine, previously-undocumented finding: an effort can carry `contaminated != null` AND `demotion.guard === 'ceiling'` simultaneously (the clean window itself still exceeds the personal ceiling) — contradicts best-effort.types.ts's EffortContamination docblock parenthetical, which states contaminated implies demotion:null; recorded here, not fixed (out of this plan's file scope)"
affects: [36-12, 36-13, 36-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Classification by priority, not independent predicates: REINSTATED is checked before MOVED-BUT-RANKED so the 31 real absolute-guard reinstatements (36-RESEARCH.md D-08), which structurally satisfy both literal definitions, land in exactly one bucket by design rather than silently picking one or throwing on legitimate data"
    - "A genuinely ambiguous input (duplicate OLD reconstruction records for one activity/distance key) fails closed via a Map-based duplicate-key check, reserving the fail-closed behavior for malformed input rather than the known, real 31-pair overlap"
    - "reconcileCounts never throws on a mismatch — mirrors compute-ceiling-recalibration.mjs's diffAgainstCommittedBaseline discipline: a disagreement between two independent derivations of the same document is the finding this check exists to produce, not an error to suppress"
    - "crossCheckCeilingAgainstRecalibration parses another artifact's own rendered markdown table (36-CEILING-RECALIBRATION.md's ## Headline) rather than re-deriving the figure a second way — the ONE place this generator reads a sibling artifact's output instead of computing its own"

key-files:
  created:
    - scripts/compute-clean-window-diff.mjs
    - scripts/compute-clean-window-diff.test.mjs
    - .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-DIFF.md
  modified:
    - scripts/unreliable-segment-import-guards.test.mjs
    - package.json

key-decisions:
  - "Classification priority order (reinstated > moved-but-ranked > newly-demoted > unchanged) resolves the literal overlap between 36-CONTEXT.md's MOVED-BUT-RANKED and REINSTATED definitions: a record satisfying both (OLD demotion non-null, NEW demotion null, contaminated != null) is classified 'reinstated', matching 36-RESEARCH.md D-08's own framing that these 31 pairs are 'exactly the reinstated effort population PR-09's diff must capture.' The fail-closed assertion the plan requires is reserved for a different, genuinely invalid input: two OLD records claiming the same activity/distance key."
  - "reconcileCounts's second check ('moved-but-ranked' vs walked contaminated) is DESIGNED to be able to disagree on real data, and does: see 'Internal Reconciliation Disagreement' below. This is not a bug fixed during this plan — it is the reconciliation doing exactly what PR-09 leg 2 asks it to do."
  - "MOVED_BUT_RANKED_RENDER_CAP = 50 (Claude's discretion, D-07-style bound): the probe measures ~1,200 moved-but-ranked pairs, far too many to render unbounded; the FULL count is always stated above the capped table per the plan's own T-36-66 mitigation."
  - "buildRankChanges calls markPRs on the OLD population before rankTopN, mirroring compute-pr-ceiling-diff.mjs's reconstructOldDocument dual-derivation shape, even though this diff renders no PR-flag section and wasPRAtTheTime is unused beyond the call — satisfies 'the OLD ranking came from markPRs/rankTopN,' never a second ranking implementation."

patterns-established:
  - "A reconciliation check that CAN legitimately disagree on real archive data (not just on a planted defect) must still never throw — reconcileCounts reports the 32-count gap explained fully below, rather than adjusting either side to force agreement."

requirements-completed: []  # Plan frontmatter lists PR-09 but the plan's own <objective> states: "this plan ticks nothing and edits no requirement or roadmap document. Skip any end-of-plan requirements mark-complete call."

# Metrics
duration: ~90min
completed: 2026-10-01
---

# Phase 36 Plan 11: Clean-Window Search Archive-Wide Diff Summary

**A committed, three-times-idempotent `36-DIFF.md` covers every rank change, 442 newly demoted efforts, 31 absolute-guard reinstatements (matching 36-RESEARCH.md D-08's measured figure exactly) plus 0 ceiling reinstatements, 1,169 moved-but-still-ranked efforts and every ceiling value — generated by `scripts/compute-clean-window-diff.mjs`, which imports the one shared pre-Phase-36 reconstruction rule from plan 36-10's generator, cross-checks its own classified lists against a plain walk of the shipped document, and surfaces (rather than hides) a genuine 32-record internal-reconciliation gap fully explained by two named, auditable mechanisms.**

## Performance

- **Duration:** ~90 min (extensive precedent reading, design, and a live investigation of an unexpected 32-record reconciliation gap before writing the SUMMARY)
- **Started:** 2026-10-01 (context gathering)
- **Completed:** 2026-10-01
- **Tasks:** 3 completed
- **Files modified:** 5 (matches `files_modified` exactly — confirmed via `git diff --stat` against the pre-plan commit for the 4 code/config files, plus the one generated artifact)

## Accomplishments

- **`scripts/compute-clean-window-diff.mjs`** (969 lines): ten pure exported functions (`classifyEffortChanges`, `splitReinstatements`, `buildRankChanges`, `walkGuardCounts`, `reconcileCounts`, `buildCeilingTable`, `crossCheckCeilingAgainstRecalibration`, `reconcileAgainstProbe`, `buildDiffReport`, `renderDiffMarkdown`) plus one `main()` gated behind the standard `import.meta.url === pathToFileURL(...)` self-execution guard.
- **The ONE shared OLD-state rule**: `reconstructOldEfforts`/`buildPopulations` are imported from `./compute-ceiling-recalibration.mjs`, never reimplemented — this file defines no local reconstruction, confirmed by the plan's own verify script.
- **Classification by priority, resolving a real, measured overlap**: REINSTATED is checked before MOVED-BUT-RANKED. On the real archive, 31 activity/distance pairs literally satisfy BOTH definitions (OLD demotion non-null via an absolute guard, NEW demotion null, `contaminated != null`) — these are exactly 36-RESEARCH.md D-08's 31 measured pairs, and this run reproduced that count EXACTLY (31/31). Priority ordering routes them to `reinstated`, matching D-08's own framing. The fail-closed assertion (`classifyEffortChanges` throws on ambiguity) is reserved for a genuinely invalid input — two OLD records for one activity/distance key — tested directly in Task 2.
- **`splitReinstatements`** separates the 31 absolute-guard reinstatements from 0 ceiling reinstatements on the real archive, retaining each record's OLD guard name and reason.
- **`buildRankChanges`** reconstructs each distance's OLD top-10 via the SAME `markPRs`/`rankTopN` the shipped pipeline uses (never a second ranking implementation), comparing position-by-position against the NEW document's own `rankings[distance]`.
- **`walkGuardCounts`**/**`reconcileCounts`** (PR-09 leg 2): a plain walk over the shipped document, cross-checked against the classified lists. The `unreliable-segment` check agrees EXACTLY (439 vs 439). The `moved-but-ranked` vs walked `contaminated` check disagrees by 32 — see "Internal Reconciliation Disagreement" below for the full, investigated explanation. `reconcileCounts` never throws; it reports.
- **`crossCheckCeilingAgainstRecalibration`** parses `36-CEILING-RECALIBRATION.md`'s own `## Headline` table and compares figure-by-figure against this run's own ceiling table — every one of the 7 distances agrees exactly.
- **`reconcileAgainstProbe`** addresses every row of both 36-CONTEXT.md probe tables (the per-distance ceiling table and the archive-wide census), stating the measured difference for each.
- **Test suite**: `scripts/compute-clean-window-diff.test.mjs` (527 lines, **16 tests**) covers all four classifications plus the fail-closed ambiguous-duplicate case, the reinstatement split retaining the OLD guard name, rank changes via `markPRs`/`rankTopN` against a hand-computed ordering, `reconcileCounts` agreeing AND disagreeing (with the disagreement asserted to reach the rendered markdown), renderer idempotence plus a `new Date(`-absence source check, malformed-activity-id and injected-pipe/newline/CR table safety with an unchanged line count, the Moved-But-Still-Ranked cap stating the full count above the table, and the ceiling cross-check in both directions.
- **`scripts/unreliable-segment-import-guards.test.mjs`** gained one new negative assertion for `compute-clean-window-diff.mjs`, reusing the file's existing `vi.mock('fs')` observing mechanism; both positive controls (`import-time-read-probe-named.mjs`, `import-time-read-probe-default.mjs`) still fire in the same run (9/9 tests pass), so the new assertion is falsifiable, not vacuous.
- **The artifact itself**, generated three consecutive times and diffed pairwise (`**Generated:**` line stripped) — byte-identical across all three runs. `data/` stayed git-clean throughout and `data/best-effort-ceiling.json`'s sha256 (`01802d20...`, matching 36-10's own recorded value) never moved. `36-CEILING-RECALIBRATION.md` was read but never written (sha256-identical before and after).

## Task Commits

Each task was committed atomically:

1. **Task 1: The diff generator — four populations, internal guard-count reconciliation, one shared OLD rule** - `2b1416c1` (feat)
2. **Task 2: The test sibling — classification, internal reconciliation both ways, observing import-time certification** - `9958774e` (test)
3. **Task 3: Generate 36-DIFF.md, prove three-run idempotence, verify claim by claim** - `c021530a` (feat)

**Plan metadata:** this SUMMARY commit is the metadata commit. Per the sequential-executor instructions for this plan, `.planning/ROADMAP.md` and `.planning/STATE.md` are NOT touched by this agent — the orchestrator owns that tracking.

## Files Created/Modified

- `scripts/compute-clean-window-diff.mjs` (new, 969 lines) — the PR-09 diff generator.
- `scripts/compute-clean-window-diff.test.mjs` (new, 527 lines, 16 tests) — the guard test, hand-built fixtures only.
- `.planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-DIFF.md` (new, 736 lines) — the committed artifact of record.
- `scripts/unreliable-segment-import-guards.test.mjs` — one new negative assertion (8 lines).
- `package.json` — one new script, `compute-clean-window-diff`.

## Verification Evidence

- `npm run build` exits 0.
- `npm run compute-clean-window-diff` exits 0.
- Three consecutive generations produce byte-identical output once `**Generated:**` is stripped (both pairwise diffs empty).
- `npx vitest run scripts/compute-clean-window-diff.test.mjs` — **16/16 tests pass**.
- `npx vitest run scripts/unreliable-segment-import-guards.test.mjs` — **9/9 tests pass** (including both positive controls).
- `npm test` — **106/106 files, 3891/3891 tests pass**.
- `git status --porcelain data/` empty at every checkpoint.
- `data/best-effort-ceiling.json` sha256 `01802d20cb6b97a7c7c8d63b17ab33cbfbae40fd1fc98ec73860e134dbdb8a20` — identical before and after every run in this plan, and identical to 36-10's own recorded value.
- `36-CEILING-RECALIBRATION.md` sha256 — identical before and after this plan's generator runs (confirmed via `diff` of two `shasum` captures).
- `git diff --stat` against the pre-plan commit touches exactly the 4 non-artifact `files_modified` entries; the 5th (`36-DIFF.md`) is the generated artifact committed in Task 3.
- The generated artifact contains no `sha256` string and no sign-off block (checked via the plan's own Task 3 Python verify script); it states the developer's approval lives in this phase's VALIDATION.md.
- All ten required sections present: Headline, Ceiling Values, Rank Changes, Newly Demoted, Reinstated, Moved But Still Ranked, Guard Counts, Internal Reconciliation, Reconciliation Against the Probe, Inputs.

## Headline Totals (measured, real archive, 1,874 activities)

| Population | Count |
|---|---|
| Moved but still ranked | 1,169 |
| Newly demoted | 442 |
| Reinstated — absolute-guard | 31 |
| Reinstated — ceiling | 0 |
| Unchanged | 7,349 |
| Distances whose ceiling moved | 6 of 7 |

## Ceiling Cross-Check Against 36-CEILING-RECALIBRATION.md

Every one of the 7 distances agrees exactly (`## Ceiling Values` states: "Every figure above agrees with `36-CEILING-RECALIBRATION.md`'s own ceiling table.") — both artifacts were generated from the same live archive in the same session, so exact agreement is the expected, confirmed result.

## Reconciliation Against the Probe

Every row of 36-CONTEXT.md's two probe tables is addressed. Per-distance ceiling/population figures match to within rounding noise (e.g. 400m ceiling 5.1098/5.0295 measured vs 5.1108/5.0297 probed — consistent with 36-06's own observation that the probe was an earlier, throwaway run). The archive-wide census: measured moved-but-ranked 1,169 vs the probe's 1,200 (explained below — the probe's own classification did not separate reinstated-with-contamination pairs out, since that distinction did not exist as a named population until this plan); unchanged 7,349 vs 7,352; no-clean-window (unreliable-segment demotions) 439 vs 439 (exact match).

## Internal Reconciliation Disagreement — Investigated and Fully Explained

The `'moved-but-ranked' record count vs the walked contaminated-effort count` check disagrees: **1,169 (lists) vs 1,201 (walked)**, a gap of exactly **32**. Per `reconcileCounts`'s own design (and this plan's acceptance criteria), this is reported, not adjusted away. The gap was investigated live and is fully, exactly accounted for by two named mechanisms:

1. **31 records** are the absolute-guard reinstatements themselves (36-RESEARCH.md D-08's 31 pairs): they carry `contaminated != null` (counted by the walk) but are classified `'reinstated'`, not `'moved-but-ranked'`, by this generator's priority rule (see key-decisions above).
2. **1 record** (`4598855187`@1k) is a genuinely new finding, discovered by this reconciliation: its clean sub-interval was found (`contaminated != null`, the original raw window intersected a hidden-pause segment), but the CLEAN figure itself (161.3s, implied 6.188 m/s) still exceeds the personal ceiling (4.711 m/s), so `demotion.guard === 'ceiling'` fires on the clean duration. This record is correctly classified `'newly-demoted'` (OLD demotion was null; NEW demotion is `'ceiling'`), yet it also carries `contaminated != null`, so the walk counts it under `contaminated` while the lists correctly exclude it from `moved-but-ranked`.

`1,169 + 31 + 1 = 1,201` — the gap is exactly and completely explained; no residual unaccounted-for discrepancy exists. This also surfaces a tension worth flagging for a future reader: `best-effort.types.ts`'s `EffortContamination` docblock states contamination is populated "so the effort ranks normally on the clean figure, `demotion: null`" — the real archive shows this is not a strict invariant (a clean figure can still be independently ceiling-demoted). This is PRE-EXISTING shipped behavior from an earlier phase (not introduced by this plan, and outside this plan's `files_modified` to fix), recorded here as a genuine, auditable finding rather than silently smoothed over.

## Known Stubs

None.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or schema change was introduced; this plan's threat model (T-36-62..T-36-69) is fully covered by the mitigations already implemented (throwaway paths, fail-closed classification, capped-with-full-count rendering, sanitized table cells, no-sha256/no-sign-off provenance).

## Decisions Made

See `key-decisions` in the frontmatter above. The most consequential: resolving the literal overlap between 36-CONTEXT.md's MOVED-BUT-RANKED and REINSTATED definitions via priority ordering (reinstated first), which both (a) correctly reproduces 36-RESEARCH.md D-08's exact 31-pair measurement in the reinstated-absolute-guard bucket, and (b) reserves the plan's required fail-closed behavior for a genuinely invalid input (duplicate OLD records), rather than throwing on legitimate, expected real-archive data.

## Deviations from Plan

### Auto-fixed Issues

None — the implementation matched the plan's literal specification on the first pass for every function. The one notable discovery (the `4598855187`@1k contaminated-and-ceiling-demoted record) is not a deviation from this plan's own scope — it is pre-existing behavior in code this plan does not modify (`compute-best-efforts.ts`, `best-effort-ceiling.ts`), surfaced by this plan's own reconciliation mechanism working exactly as designed. No source file outside this plan's `files_modified` was touched.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None. The plan executed as written; the one genuine finding (the internal-reconciliation 32-record gap) was anticipated by the plan's own acceptance criteria ("reconcileCounts reports a mismatch rather than throwing; the SUMMARY states why — a mismatch is the finding") and is fully explained above.

## Issues Encountered

None beyond the investigation documented above, which was itself part of this plan's required Task 3 verification work (confirm every section's content claim by claim), not a blocker.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `36-DIFF.md` is now the committed, three-times-proven-idempotent archive-wide diff plan 36-12 (PR-09's independent third reconciliation leg, `scripts/compute-clean-window-recount.mjs`) can cite or be cross-checked against — this plan's own `## Internal Reconciliation` section explicitly names that script as the third, independent leg sharing no code with this generator.
- The 32-record internal-reconciliation gap documented above gives plan 36-12's independent recount a concrete, pre-stated figure to corroborate or contest from a wholly different algorithm.
- No blockers for 36-12/36-13/36-14. This plan touched no production source module — only a new script, its test sibling, one existing test file's negative-assertion list, one npm script entry, and the generated artifact itself.
- Per this plan's objective, no requirement or roadmap document was ticked or edited; PR-09's own tick (if any) remains the orchestrator's and a later plan's responsibility.

## Self-Check: PASSED

All claimed files and commits verified present:
- FOUND: scripts/compute-clean-window-diff.mjs
- FOUND: scripts/compute-clean-window-diff.test.mjs
- FOUND: .planning/phases/36-best-effort-clean-window-search-ceiling-recalibration/36-DIFF.md
- FOUND: scripts/unreliable-segment-import-guards.test.mjs (modified)
- FOUND: package.json (modified)
- FOUND: commit 2b1416c1
- FOUND: commit 9958774e
- FOUND: commit c021530a

---
*Phase: 36-best-effort-clean-window-search-ceiling-recalibration*
*Completed: 2026-10-01*
