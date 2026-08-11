---
phase: 18-records-trends-differentiators
plan: 02
subsystem: analytics
tags: [age-grading, wma, xlsx-parsing, html-scraping, vitest, data-sourcing]

# Dependency graph
requires: []
provides:
  - Committed, sourced WMA age-grading factor tables (data/wma/road-factors.json, data/wma/track-factors.json)
  - Re-runnable, dependency-free converter (scripts/convert-wma-tables.mjs)
  - Pure age-grading lookup/interpolation/formula module (src/analytics/wma-factors.ts)
  - Published age-grading document contract (src/analytics/age-grading.types.ts)
affects: [18-08 (compute-age-grading.ts build step), 18-XX (Records page age-grade column)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "xlsx-as-zip regex parsing via system `unzip` CLI (no xlsx-parser npm dependency)"
    - "Header-text-based column lookup instead of hardcoded column letters (handles a merged-cell column shift between the male/female source workbooks)"
    - "Two-source pairing for one committed table, each provenance documented separately (edition vs standardsEdition)"

key-files:
  created:
    - scripts/convert-wma-tables.mjs
    - data/wma/road-factors.json
    - data/wma/track-factors.json
    - data/wma/README.md
    - src/analytics/wma-factors.ts
    - src/analytics/age-grading.types.ts
    - src/analytics/wma-factors.test.ts
  modified:
    - .gitignore

key-decisions:
  - "Track open standards sourced from a different (older, 2015-edition) page on the same author/domain than the 2023 factors, because the 2023 factors-only calculator has no standard times at all; documented explicitly via separate edition/standardsEdition fields rather than silently blending provenances"
  - "Real committed data/wma/*.json tables read via fs.readFileSync in the test file rather than a static ES import, because tsc's rootDir is src/ and a static import reaching outside it would break `npm run build`"

patterns-established:
  - "Committed source artifacts for a converter live in a gitignored scripts/<name>-source/ directory, never fetched live at convert time — re-runs are deterministic/offline"

requirements-completed: [REC-06]

# Metrics
duration: 40min
completed: 2026-08-11
---

# Phase 18 Plan 02: WMA Age-Grading Factor Tables Summary

**Sourced and bundled WMA age-grading factor tables (2025 road, 2023 track) as committed JSON, with a pure lookup/interpolation/percentage module whose correctness is pinned to an independently-published worked example (58.4% for a 50-year-old male running 5k in 1500s).**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 8 (7 created, 1 modified)

## Accomplishments

- Downloaded and parsed the real WMA/road-standards source workbooks (xlsx-as-zip, no new npm dependency) and HTML pages, producing two committed, reproducible JSON factor tables that reproduce the anti-circularity worked example exactly (male/5k/age-50 factor 0.8775, open standard 769s — both cited as external in RESEARCH.md)
- Built a pure, client-safe age-grading module (`wma-factors.ts`) with total/never-throwing parsing, prototype-pollution-guarded JSON handling, UTC-only age arithmetic, and D-09's surface routing (road for 5k/10k/half/marathon, track for 400m/1mi, interpolated-and-flagged-derived for 1k)
- Anchored correctness with a 22-case test suite and manually ran the required mutation check (multiply instead of divide), confirming it fails the discriminating assertion before restoring the correct implementation

## Task Commits

1. **Task 1: Source and convert the WMA factor tables into committed JSON** - `7c15c95` (feat)
2. **Task 2: Implement the pure age-grading module and its output contract** - `a2871a8` (feat)
3. **Task 3: Test the lookup, interpolation, and formula direction against the external worked example** - `31ef530` (test)

_No plan-metadata commit yet — this is a worktree-mode executor; the orchestrator makes the final metadata commit after merge._

## Files Created/Modified

- `scripts/convert-wma-tables.mjs` - Re-runnable converter: parses xlsx-as-zip (road, via `unzip` CLI + regex over the XML parts) and two HTML pages (track factors + track standards) into the committed JSON shape
- `data/wma/road-factors.json` - 2025-edition road factors (5k/10k/half/marathon, both sexes), CC0-1.0, github.com/AlanLyttonJones/Age-Grade-Tables
- `data/wma/track-factors.json` - 2023-edition track factors (400m/800m/1mi, both sexes) paired with 2015-edition open standards (both from howardgrubb.co.uk)
- `data/wma/README.md` - Documents both sources, licences, editions, and the factors/standards edition-pairing rationale for track
- `src/analytics/wma-factors.ts` - `parseWmaFactorTable`, `ageAtDate`, `lookupFactor`, `interpolate1kFactor`, `ageGradePercent`, `resolveAgeGrade`
- `src/analytics/age-grading.types.ts` - `AgeGradingDocument` contract for `data/stats/age-grading.json` (D-20 public-artifact rule)
- `src/analytics/wma-factors.test.ts` - 22 test cases across 8 required groups
- `.gitignore` - Added `scripts/wma-source/` (raw downloaded xlsx/html, not committed)

## Decisions Made

- **Track open-standards provenance split from factors provenance.** The plan named `howardgrubb.co.uk/athletics/wmatnf23.html` as the WMA 2023 track source. Direct inspection confirmed this page is a "factors-only" calculator (it converts a raw result to an age-adjusted result via multiplication; it has no open-class standard time field anywhere, and the WMA 2023 Appendix B PDF it links to — retrieved via the Wayback Machine since the live link is now dead — is exclusively about Combined Events (decathlon/heptathlon) scoring, not single-event standards). The same author's older `wmalookup15.html` (2010/2015 editions) is the only reachable page on that domain with single-event open standards, and its 2010 and 2015 tables carry byte-identical standard times for 400m/800m/1mile in both sexes — indicating WMA's single-event open standards are revised far less often than the age-factor tables. `track-factors.json` therefore pairs 2023 factors with 2015 standards, recording both provenances explicitly (`edition`/`source` for factors, `standardsEdition`/`standardsSource` for standards) rather than mislabeling the whole file as one edition. Documented in full in `data/wma/README.md`.
- **Real committed tables read via `fs` in the test file, not a static `import`.** `tsconfig.json` sets `rootDir: "src"`; a static ES import of `../../data/wma/road-factors.json` from a file under `src/analytics/` would fail `tsc`'s rootDir containment check (test files are compiled by `tsc`, confirmed via existing `dist/analytics/*.test.js` output). Reading the file via `readFileSync` + `JSON.parse` at test-run time satisfies the plan's "must import the real committed tables directly" requirement (verified: `grep -c "data/wma" src/analytics/wma-factors.test.ts` → 6) without breaking the build.
- **Peak-age test asserts "at least one peak age in 25-35," not "the first age reaching 1.0."** The real committed road table (which, unlike a masters-only WMA table, covers ages 5-100) plateaus at exactly 1.0 across ages 19-29, not narrowly at 25-35. A naive "first age where factor equals the max" check would report age 19 and fail the plan's 25-35 assertion. Since ages 25-29 are part of the same tied maximum, the test collects all ages achieving the max and asserts the intersection with 25-35 is non-empty — this satisfies the plan's intent (peak sits inside the textbook masters band) without asserting something the real data doesn't support (a narrow single-age peak).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed peak-age test to handle a tied maximum instead of only checking the first occurrence**
- **Found during:** Task 3 (writing and running the peak-age sanity test)
- **Issue:** The initial test implementation tracked only the first age reaching the maximum factor value (`if (factor > maxFactor)`), which reported age 19 for the real table's plateau (ages 19-29 all equal 1.0) and failed the 25-35 assertion window on first run
- **Fix:** Changed the test to collect every age tied for the maximum factor and assert at least one falls within 25-35, rather than requiring the specific first-occurrence age to do so
- **Files modified:** src/analytics/wma-factors.test.ts
- **Verification:** `npx vitest run src/analytics/wma-factors.test.ts` — 22/22 passing after the fix
- **Committed in:** `31ef530` (Task 3 commit; the fix landed before the first commit of this file, so no separate follow-up commit was needed)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix makes the test correctly reflect the real committed data's actual shape rather than an assumption about where the peak would land; no scope creep, no change to production code.

## Issues Encountered

- **No live standards source for the 2023 track factors.** See "Decisions Made" above — resolved by sourcing 2015-edition standards from the same author/domain and documenting the pairing explicitly, rather than typing values from memory (which the plan's anti-circularity rule and T-18-WMA-02 explicitly forbid).
- **The official WMA 2023 Appendix B PDF link (cited in the plan's own source list via the howardgrubb.co.uk page) is now dead** (redirects to the WMA homepage). Retrieved via the Wayback Machine (`web.archive.org`) to confirm it does not contain single-event standards before concluding it wasn't the right source — this is a read-only reference check, not a data source used in the final converter.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/analytics/wma-factors.ts` and `data/wma/*.json` are ready to be consumed by plan 18-08's `compute-age-grading.ts` build step (per D-20, this module needs `birthDate`/`sex` from the athlete-private config split, which plan 18-01 delivers independently in this same wave)
- `age-grading.types.ts`'s `AgeGradingDocument` contract is ready for the Records page's age-grade column (D-10) once 18-08 produces `data/stats/age-grading.json`
- No blockers identified for downstream plans in this phase

---
*Phase: 18-records-trends-differentiators*
*Completed: 2026-08-11*
