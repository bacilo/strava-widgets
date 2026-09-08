---
phase: 23-trends-zoom-pan-taller-bands
plan: 09
subsystem: ui
tags: [css, grid, overflow, accessibility, vitest]

# Dependency graph
requires:
  - phase: 23-trends-zoom-pan-taller-bands
    provides: "23-07's Round 1 checkpoint, which isolated Finding 9 (the year heatmap's fixed
      634px scrollWidth) as R15's sole blocking cause"
provides:
  - ".year-heatmap-scroll — a contained horizontal-scroll wrapper (overflow-x auto, D-10
    padding, min-width: 0 forward guard) applied to buildYearHeatmapSection's gridWrap div"
  - "By-value CSS tests pinning the wrapper rule and the 634px arithmetic (53 x 10 + 52 x 2),
    plus a source-text consumer guard proving trends.ts actually applies the class"
  - "Three corrected stale comments: the file's overflow-x container count (two -> three),
    the calendar block's .splits-scroll-fallback scope note, and the .segmented overflow
    guard's declarer list"
affects: ["23-11 (Round 2 re-verification of R15)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contained horizontal-scroll wrapper for a fixed-track CSS grid that cannot reflow below
      its cells' min-content contribution — reuses the .splits-scroll idiom (overflow-x: auto,
      -webkit-overflow-scrolling: touch, D-10 padding) rather than the calendar's
      breakpoint-widening (reflow) approach, because the heatmap's cells are non-focusable
      (T-18-A11Y-03) and reflowing them would drop them below the 10px legibility floor"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts
    - src/dashboard/views/trends.ts

key-decisions:
  - "Reused the shipped .splits-scroll pattern (scroll containment) rather than Phase 22's
    CAL-02 pattern (breakpoint-widened reflow) — see 22-VERIFICATION.md finding below for why"
  - "No tabindex=\"0\" on the new wrapper: the heatmap's 371 cells are deliberately
    non-focusable (T-18-A11Y-03), and the adjacent 'View as table' <details> disclosure
    already provides the accessible equivalent — matching D-13's reasoning for rejecting a
    focusable canvas"

requirements-completed: []  # TRN-03 stays Pending — gated on 23-11's Round 2 browser
  # re-verification of R15 at 390/393/412/430px, which this plan cannot discharge (no jsdom/
  # headless browser in this repo per 23-VALIDATION.md's Hard constraint).

# Metrics
duration: ~20min
completed: 2026-08-26
---

# Phase 23 Plan 09: Year-Heatmap Scroll Containment Summary

**Added `.year-heatmap-scroll`, a contained horizontal-scroll wrapper around the year
consistency heatmap's fixed-width 634px grid, closing Finding 9 — the sole cause of R15's FAIL
and the only thing keeping TRN-03 Pending.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- `.year-heatmap-scroll` rule added to `styles.css` immediately above `.year-heatmap`,
  containing the grid's structural 634px floor (`53 × 10 + 52 × 2`, from
  `grid-template-columns: repeat(53, 1fr)` and `.year-heatmap__cell { min-width: 10px }`)
  inside a scrolling wrapper instead of letting it push the document wide.
- `buildYearHeatmapSection`'s `gridWrap` div carries the new class, set once at creation and
  surviving every `renderGridForYear()` call because `replaceChildren()` only replaces
  children, never the element's own class.
- Six new by-value tests in `styles.test.ts` pin the wrapper's three declarations, the 634px
  arithmetic's two source values, a negative proving `.year-heatmap` itself declares no
  `overflow`, and a source-text consumer guard over `trends.ts` proving the class is actually
  applied (not just declared in CSS with no consumer).
- Three stale comments corrected in the same change: the file's `overflow-x: auto` container
  count (two → three), the calendar block's `.splits-scroll`-fallback note (now explicitly
  scoped to the calendar, recording that the heatmap uses the same pattern where the
  focus-jump objection does not apply), and the `.segmented` overflow guard's declarer list.

## Task Commits

1. **Task 1: Add the contained-scroll wrapper rule and pin it by value** - `7520a13` (feat)
2. **Task 2: Apply the wrapper class to the heatmap's existing gridWrap, and guard that it is
   actually applied** - `ecab026` (feat)

_Note: the consumer-guard test asserting `trends.ts` contains `'year-heatmap-scroll'` was
written as part of Task 1's `styles.test.ts` commit (per the plan's own by-value test block),
and deliberately failed red until Task 2's commit turned it green — verified explicitly with
`npx vitest run src/dashboard/styles.test.ts -t "year-heatmap-scroll"` at both checkpoints
(5/6 passing after Task 1, 6/6 after Task 2)._

## Files Created/Modified

- `src/dashboard/styles.css` — `.year-heatmap-scroll` rule added; three stale comments
  corrected (overflow-x container count, calendar `.splits-scroll`-fallback scope, `.segmented`
  guard declarer list).
- `src/dashboard/styles.test.ts` — new `describe('Phase 23 (TRN-03, gap closure) —
  .year-heatmap-scroll containment')` block (6 tests); one comment correction (declarer list).
- `src/dashboard/views/trends.ts` — `gridWrap.className = 'year-heatmap-scroll'` in
  `buildYearHeatmapSection`.

## For 23-11 Task 1 (per this plan's `<output>` spec)

**New automated command(s) to paste into the Per-Task Verification Map:**

```
npx vitest run src/dashboard/styles.test.ts -t "year-heatmap-scroll"
```
Row shape: `23-09/T1,T2 | 23-09 | 6 | TRN-03 | — | N/A | unit (rule scanner, by VALUE) +
consumer guard | npx vitest run src/dashboard/styles.test.ts -t "year-heatmap-scroll" | ✅ | ✅ green`

Also re-affirms the existing full-gate command already in the map:
```
npx tsc --noEmit && npm test && npm run build-widgets && npm run verify-dashboard
```
All four exit 0 as of this plan's completion (see Verification below).

**What `22-VERIFICATION.md` said about CAL-02's containment pattern, and whether it was
reused:** CAL-02's fix (plan 22-09, confirmed by direct read of `22-VERIFICATION.md`) is a
**breakpoint-widening reflow**, not a scroll-wrapper — it relaxes `.calendar-day`'s
`min-width`/`grid-template-columns` and `.calendar-week-total`'s `white-space` inside
`@media (max-width: 640px)`, deliberately extending the compaction band rather than adding a
`.splits-scroll`-style container. `22-VERIFICATION.md`'s own Gap 1 finding is explicit that "a
`.splits-scroll` scroll-wrapper fallback" was considered and rejected for the calendar
specifically, because its day cells are focusable buttons and a scroll container would
scroll-jump focus on Tab. **This pattern was deliberately NOT reused here.** The year heatmap's
371 cells are non-focusable (T-18-A11Y-03), so the calendar's disqualifying reason does not
apply, and reflowing the grid's cells below their 10px legibility floor would trade one defect
(overflow) for another (an unreadable ~3.4px smear at 294px columns, per R15's own
measurement) — so this plan used the `.splits-scroll` containment pattern instead, which the
calendar's own comment explicitly reserved as "still deliberately unimplemented" for the
calendar's different constraints.

## Decisions Made

- Reused `.splits-scroll`'s three declarations verbatim (`overflow-x: auto`,
  `-webkit-overflow-scrolling: touch`, `padding: var(--space-xs)`) rather than inventing a new
  shape, plus one addition (`min-width: 0`) as a non-load-bearing forward guard against a
  future flex/grid parent reintroducing the overflow.
- Did not add `tabindex="0"` to the wrapper — the heatmap's cells are deliberately
  non-focusable and the adjacent "View as table" `<details>` already supplies the accessible
  equivalent (same reasoning as D-13's rejection of a focusable canvas).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Copied gitignored `data/stats/*.json` and `data/dashboard/*.json`
fixtures from the main checkout into this worktree**
- **Found during:** Task 2 verification (`npm test`)
- **Issue:** `data/stats/` and `data/dashboard/` are gitignored, pipeline-generated directories
  (`.gitignore` line 11, 14) and therefore do not exist in a fresh git worktree — a fresh clone
  never has them. Five unrelated test files (`records-logic.test.ts`,
  `trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`,
  `trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts`) failed at file-load time
  with `ENOENT`, blocking the plan's own required `npm test` gate. None of the 1230 actual test
  cases failed — only file-level fixture-load errors.
- **Fix:** Copied `data/stats/` and `data/dashboard/` recursively from the main checkout
  (`/Users/pedf/workspace/strava-widgets/data/...`) into this worktree, following the exact
  precedent already recorded in `23-VALIDATION.md` ("`data/stats/*.json` copied in from the
  main checkout for this session only, gitignored, not committed"). Files remain gitignored
  and were never staged or committed.
- **Files modified:** none tracked (gitignored data files only; `git status --short`
  confirmed only `src/dashboard/views/trends.ts` was modified in the working tree).
- **Verification:** `npm test` went from 5 failed / 49 passed files to 54/54 passed, 1319/1319
  tests; `npm run build-widgets` and `npm run verify-dashboard` (37/37) both then succeeded.
- **Committed in:** not committed (gitignored, out of scope for git tracking — matches
  established project precedent).

---

**Total deviations:** 1 auto-fixed (blocking, environment-only, no source change).
**Impact on plan:** None on shipped code. Pre-existing worktree-vs-gitignored-fixtures
condition, unrelated to this plan's CSS/TS changes; every test case itself passed once the
fixtures were present.

## Issues Encountered

None beyond the deviation above.

## Verification

- `npx vitest run src/dashboard/styles.test.ts` — 141/141 tests pass (140 after Task 1, with
  the consumer guard intentionally red; 141/141 after Task 2).
- `npx vitest run src/dashboard/styles.test.ts -t "year-heatmap-scroll"` — 6/6 pass, non-empty
  selection.
- `grep -v '^\s*\*' src/dashboard/styles.css | grep -v '^\s*/\*' | grep -c "year-heatmap-scroll"`
  → `1` (the rule declaration is the only literal mention outside comments; prose comments were
  deliberately worded to avoid inflating this count).
- `grep -c "min-width: 10px" src/dashboard/styles.css` → `2` (unchanged from before this plan;
  the cell legibility floor was not weakened).
- `grep -c "the two .overflow-x: auto. containers" src/dashboard/styles.css` → `0` (stale
  comment corrected).
- `grep -v '^\s*\*' src/dashboard/views/trends.ts | grep -v '^\s*//' | grep -c
  "year-heatmap-scroll"` → `1`.
- `npx tsc --noEmit` — exit 0.
- `npm test` — 54/54 files, 1319/1319 tests, exit 0 (after the fixture copy above).
- `npm run build-widgets` — exit 0.
- `npm run verify-dashboard` — 37/37 checks, exit 0.
- `git status --short` after both commits — only `src/dashboard/views/trends.ts` shown modified
  before staging (no file outside this plan's `files_modified` was changed); post-commit
  deletion check (`git diff --diff-filter=D --name-only HEAD~2 HEAD`) returned empty.

**Explicitly NOT verified here** (per this plan's own `<verification>` scope): that
`document.documentElement.scrollWidth` now equals `clientWidth` at 390px, 393px, 412px and
430px in a real browser. This repo has no jsdom, headless browser, or CSSOM (confirmed in
`23-VALIDATION.md`), so no automated command here can compute a layout. That is 23-11's Round 2
re-verification of R15, which this plan's `<output>` section above hands off the exact command
and row shape for.

## Next Phase Readiness

- `.year-heatmap-scroll` ships, is pinned by value, has a passing consumer guard, and does not
  touch `.year-heatmap`/`.year-heatmap__cell` (desktop cell size and the 10px legibility floor
  are unaffected — confirmed by the unchanged `min-width: 10px` count).
- TRN-03 stays Pending in `REQUIREMENTS.md` (this plan does not tick it) — 23-11's Round 2
  browser checkpoint is the only thing that can discharge R15's "no horizontal overflow" clause
  at the four required phone widths.
- No blockers for 23-11.

---
*Phase: 23-trends-zoom-pan-taller-bands*
*Completed: 2026-08-26*

## Self-Check: PASSED

All claimed files found on disk (`src/dashboard/styles.css`, `src/dashboard/styles.test.ts`,
`src/dashboard/views/trends.ts`, this SUMMARY.md). All claimed commit hashes (`7520a13`,
`ecab026`, `b2a6c72`) found in `git log`.
