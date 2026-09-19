---
phase: 26-shared-gap-aware-pace-derivation-honest-coverage
plan: 09
subsystem: analytics
tags: [pace-derivation, residual-report, roadmap-correction, archive-sweep, vitest]

# Dependency graph
requires:
  - phase: 26-shared-gap-aware-pace-derivation-honest-coverage
    provides: "derivePaceWithCoverage/paceHistogramSamples (26-02), the shared gap-aware pace module's D-16 entry point"
provides:
  - "scripts/compute-pace-residual.mjs — the regenerating script for the PACE-06 residual report (D-19)"
  - "26-RESIDUAL.md — the committed, regenerable residual deliverable Phase 27 consumes as pre-flagged input"
  - "ROADMAP.md Phase 26 Criteria 1 and 3, corrected to match what research proved unsatisfiable/misworded"
affects: [27]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Self-execution guard (import.meta.url === pathToFileURL(process.argv[1]).href) on a script whose pure functions are also imported by a guard test — a deviation from the compute-route-data.mjs analog's unconditional main(), needed because that analog has no test file importing it and this script does"

key-files:
  created:
    - scripts/compute-pace-residual.mjs
    - scripts/compute-pace-residual.test.mjs
    - .planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md
  modified:
    - package.json
    - .planning/ROADMAP.md

key-decisions:
  - "Added a self-execution guard to compute-pace-residual.mjs rather than following the compute-route-data.mjs analog's unconditional main() — see Deviations."
  - "Criterion 1's amended wording keeps the exact 13/154 counts research measured, since this execution reproduced them exactly; only the generation date and 26-RESIDUAL.md citation were added, not new counts."
  - "One residual-list ID differs from research's frozen list (3925007542 replacing 5059213289) — treated as expected archive drift per the plan's own instruction, not a defect, and recorded in both 26-RESIDUAL.md's regenerated content and this summary."

requirements-completed: [PACE-04, PACE-06]

# Metrics
duration: ~30min
completed: 2026-09-08
---

# Phase 26 Plan 09: Archive-Wide Residual Report & ROADMAP Criterion Corrections Summary

**A regenerating script (`scripts/compute-pace-residual.mjs`) sweeps all 1,866 committed streams, measures baseline-vs-adaptive fast mass against the real unfixed per-sample path, and produces the committed `26-RESIDUAL.md` deliverable — 154-activity cohort, 13 residual activities (max 2.42%), zero Criterion 1 violations — while two ROADMAP Phase 26 success criteria are corrected to match what research proved unsatisfiable (Criterion 1's literal "strictly lower for all") or misworded (Criterion 3's non-existent `elapsed_time` stream field).**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2/2 completed
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `scripts/compute-pace-residual.mjs` exports five pure functions (`zeroAdvanceFraction`, `isSevereStairStep`, `baselineFastMass`, `adaptiveFastMass`, `renderResidualMarkdown`) plus a `main()` that sweeps `data/streams/*.json`, identifies the severe stair-step cohort, measures each member's baseline (negative case 8 — the unfixed `dt/dd` path replicated verbatim from `detail-zones.ts`) and adaptive (`derivePaceWithCoverage` + `paceHistogramSamples`, restricted to covered time) fast mass, and renders the Markdown report.
- Run against the live committed archive: **1,866 streams scanned, 154-activity cohort, 13 residual activities, max 2.42%, zero Criterion 1 violations** (153 strictly improved, 1 tied at zero, 0 regressed) — reconciling almost exactly against 26-RESEARCH.md's measured figures.
- `26-RESIDUAL.md` is committed and proven regenerable: a second `npm run compute-pace-residual` run left the file's content identical except its generation timestamp (`git diff --stat` showed exactly 1 line changed), then that verification-only diff was discarded via `git checkout --` on the single file before the real Task 2 commit.
- `git status --porcelain data/streams` reported clean after every run — the script never wrote into `data/` (T-26-10).
- ROADMAP.md Phase 26 Criterion 1 amended: "strictly lower ... for all 154" → "strictly lower ... or both exactly zero", with the `3475742397` tie case and D-19/Pitfall 2 citation inline; Criterion 3 amended: "the stream's own `elapsed_time` field" → "the stream's own span, `t[n-1] - t[0]`", with the D-06 citation and the measured `4556693525` divergence (stream span 3,394s vs metadata `elapsed_time` 3,393s, independently re-measured from the committed files in this session) inline. `git diff --stat .planning/ROADMAP.md` confirms the edit is confined to those two criteria lines (2 lines changed, nothing else touched).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the archive sweep producing the baseline-vs-adaptive comparison and the Markdown report** - `52375126` (feat)
2. **Task 2: Generate and commit 26-RESIDUAL.md, and amend ROADMAP Criteria 1 and 3** - `0fb14903` (feat)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified

- `scripts/compute-pace-residual.mjs` (new, 330 lines) — the archive-sweep script; exports pure functions plus a self-guarded `main()`.
- `scripts/compute-pace-residual.test.mjs` (new) — 9 tests exercising `isSevereStairStep`/`zeroAdvanceFraction`, `baselineFastMass` (both directions: high on an alternating stair-step fixture, 0 on a clean evenly-advancing one), `adaptiveFastMass`, and `renderResidualMarkdown` (row count matches residual entries, violation section renders when present).
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md` (new) — the committed PACE-06 deliverable: cohort definition, window formula (D-03), summary line, residual table (13 rows), Criterion 1 reconciliation (counts + named tie), the `4556693525` dual-role note (Open Question 2), and the regeneration command.
- `package.json` — added `"compute-pace-residual": "npm run build && node scripts/compute-pace-residual.mjs"`.
- `.planning/ROADMAP.md` — Phase 26 Criteria 1 and 3 amended (see Accomplishments).

## Measured Figures (execution-time vs. research, per D-03)

| Metric | 26-RESEARCH.md (measured during research session) | This execution (2026-09-08, live archive) |
|---|---|---|
| Archive size scanned | 1,890 activities | **1,866 streams** |
| Severe stair-step cohort | 154 | **154** (exact match) |
| Residual count (>0.5% covered-time fast mass) | 13 | **13** (exact match) |
| Max residual | 2.42% (`4556693525`) | **2.42%** (`4556693525`, exact match) |
| Criterion 1 tie | `3475742397` (153 improve / 1 tie / 0 regress) | **`3475742397`** (153 improve / 1 tie / 0 regress — exact match) |

**Did the archive grow between research and execution?** Not monotonically in the direction the plan's interfaces text anticipated. The research session recorded scanning 1,890 activities; `data/streams/` at execution time holds **1,866** files (`ls data/streams | wc -l` = 1866, and the sweep's own "Archive size scanned" line agrees) — 24 *fewer* than research's own count, though still within PROJECT.md's originally-cited 1,864-1,868 scoping range. The cohort, residual count and max residual all reproduced exactly regardless. The one place drift did show up: **1 of the 13 residual IDs differs** — this run's list has `3925007542` (0.56%) where research's frozen list had `5059213289` (0.64%); the other 12 IDs and percentages match research's list to within rounding. Per the plan's explicit instruction ("Divergence is expected and is not a failure — the archive grows nightly"), this single-ID substitution is recorded here and in `26-RESIDUAL.md` itself, not treated as a defect.

## Decisions Made

- Kept the ROADMAP's hardcoded "13 of the 154" counts as-is (this execution reproduced them exactly) rather than substituting new numbers — only appended the generation date and the `26-RESIDUAL.md` citation, per the plan's "replace ... with the counts the executed run actually produced" instruction (which happened to be identical to the original numbers).
- `4556693525`'s stream-span-vs-`elapsed_time` divergence (3,394s vs 3,393s) cited in the Criterion 3 amendment was independently re-measured in this session directly from `data/streams/4556693525.json` and `data/activities/4556693525.json` (not copied from 26-CONTEXT.md's D-06 text unverified) — confirmed to match exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added a self-execution guard to `compute-pace-residual.mjs`, deviating from the plan's stated `compute-route-data.mjs` analog**
- **Found during:** Task 1, while drafting the file per the plan's `<interfaces>` instruction to match `compute-route-data.mjs`'s "no `import.meta.url === process.argv[1]` guard" convention.
- **Issue:** The plan's own task text requires the exported pure functions to be "exercise[d] ... without running the whole sweep" by the guard test. If `main()` is invoked unconditionally at module scope (as `compute-route-data.mjs` does), then `import { isSevereStairStep, ... } from './compute-pace-residual.mjs'` in the test file would execute `main()` as an ES module top-level side effect — sweeping all 1,866 real stream files and overwriting `26-RESIDUAL.md` on every `npx vitest run`, contradicting the plan's own "without running the whole sweep" requirement. `compute-route-data.mjs` has no test file importing it, so its "no guard" convention was never actually exercised against this failure mode.
- **Fix:** Added `if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { main(); }`, mirroring the identical pattern already used by `curate-server.mjs` and `exclusion-cli.mjs` — both of which ALSO have companion test files importing their pure exports, making them the more precisely-applicable convention than the (test-free) `compute-route-data.mjs`.
- **Files modified:** `scripts/compute-pace-residual.mjs`
- **Verification:** `npx vitest run scripts/compute-pace-residual.test.mjs` completes in 3ms (no archive sweep triggered by import); `npm run compute-pace-residual` (direct invocation) still runs `main()` and writes the report correctly.
- **Committed in:** `52375126` (Task 1's commit)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Corrects a self-contradiction between two clauses of the same task's instructions (follow the no-guard analog vs. the guard test must not run the whole sweep on import). No behavioral change to `main()`'s output when run directly; only prevents the ES-module-import side effect.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `26-RESIDUAL.md` is committed and regenerable; Phase 27 can consume its residual list as pre-flagged input and re-derive it at its own boundary via `npm run compute-pace-residual`, per D-19.
- ROADMAP.md Phase 26 Criteria 1 and 3 now match what the shared derivation (`src/analytics/pace-derivation.ts`, plans 26-01/26-02) can actually satisfy — no future verification round should hit the "unsatisfiable checkpoint row" trap Pitfall 2 warned about, since the amended wording already accounts for the `3475742397` tie and the `CanonicalStream` schema's real shape.
- `git status --porcelain data/streams` was clean after every run in this plan; the committed stream archive was never touched (T-26-10 honored).

---
*Phase: 26-shared-gap-aware-pace-derivation-honest-coverage*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: scripts/compute-pace-residual.mjs
- FOUND: scripts/compute-pace-residual.test.mjs
- FOUND: .planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md
- FOUND: .planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-09-SUMMARY.md
- FOUND: 52375126 (feat: PACE-06 residual sweep script and guard tests)
- FOUND: 0fb14903 (feat: commit PACE-06 residual report and amend ROADMAP Criteria 1/3)
