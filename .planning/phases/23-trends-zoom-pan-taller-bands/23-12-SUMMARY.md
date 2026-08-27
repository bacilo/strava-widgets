---
phase: 23-trends-zoom-pan-taller-bands
plan: 12
subsystem: ui
tags: [css, scroll-containment, aria, tablist, chart.js, trends]

# Dependency graph
requires:
  - phase: 23-09
    provides: the .splits-scroll / .year-heatmap-scroll containment pattern this plan's fourth instance follows
  - phase: 23-11
    provides: Round 2 gap-closure checkpoint results, Finding 11 (root cause) and Finding 12 (deferred defect)
provides:
  - ".trends-tablist-scroll — a fourth instance of the shipped overflow-x:auto containment pattern, closing the phone-width horizontal-overflow gap (Finding 11 / R35(b))"
  - "buildTablistAndPanels wraps the role=tablist .segmented element in the new scroll container, outside the tablist so ARIA ownership stays intact"
  - "Finding 12's dated, reasoned DEFERRED disposition in deferred-items.md"
affects: [23-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fourth .{feature}-scroll wrapper instance following the .splits-scroll precedent, this one with load-bearing (not forward-guard) focus-ring padding because its children are focusable"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts
    - src/dashboard/views/trends.ts
    - .planning/phases/23-trends-zoom-pan-taller-bands/deferred-items.md

key-decisions:
  - "Scroll wrapper (.trends-tablist-scroll) chosen over flex-wrap or padding-shrink, per the plan's own rejected-alternatives analysis — both alternatives would reintroduce CR-02's notched-join defect or blow the single-@media-block test constraint"
  - "Wrapper placed OUTSIDE the tablist (never inside), preserving ARIA role=tab DOM-containment ownership without needing aria-owns"
  - "No tabIndex on the wrapper — the roving-tabindex model already gives the strip one Tab stop, and focus() triggers native scroll-into-view"
  - "Finding 12 deferred, not fixed — gates no requirement, predates Phase 23, and fixing it would reopen trends-charts.ts's chart-config code outside this round's scope"

patterns-established:
  - "Where a stale comment names a wrapper by its literal class token, prefer descriptive prose ('the X's scroll wrapper below') over the literal class name when the literal name would otherwise appear in unscoped grep-by-value acceptance checks"

requirements-completed: []  # TRN-03 stays Pending — gated on plan 23-13's R46, per this plan's own <output> instruction

# Metrics
duration: 15min
completed: 2026-08-27
---

# Phase 23 Plan 12: Trends tablist scroll containment (Finding 11) Summary

**Added `.trends-tablist-scroll`, the fourth `.splits-scroll`-pattern wrapper, containing the Trends five-tab strip's 412px min-content floor so `documentElement.scrollWidth` no longer exceeds `clientWidth` at phone widths — plus a dated DEFERRED disposition for Finding 12's tooltip-epoch defect.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-27T05:41:00Z (approx, worktree setup)
- **Completed:** 2026-08-27T05:52:43Z
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments

- `.trends-tablist-scroll` added to `styles.css`: unconditional, `overflow-x: auto`, `-webkit-overflow-scrolling: touch`, load-bearing `padding: var(--space-xs)` (unlike the other two wrappers, this one has five focusable children), and a forward `min-width: 0` guard.
- The 412px min-content floor arithmetic, the `viewport − 96` inset arithmetic, and both rejected alternatives (`flex-wrap: wrap`, padding-shrink) recorded in the stylesheet with the R35 measurements that produced them.
- Four stale comments corrected in the same change: the two `overflow-x: auto` container counts (two → three, three → four), the calendar-block objection sharpened to scope its reasoning to Tab-stop count rather than focusability, and the test file's declarer list.
- `buildTablistAndPanels` in `trends.ts` now returns `{ tablistScroll, panelsWrap }`: the unchanged `role="tablist"` `.segmented` element is appended INTO the new wrapper (never the reverse), preserving ARIA tab ownership. The other three `.segmented` builders in the file are untouched (4 `className = 'segmented'` occurrences before this plan, 4 after).
- 9 new by-value tests plus a consumer guard and two ARIA/tabIndex contract guards added to `styles.test.ts`.
- Finding 12 (Training Load tooltip title renders a raw epoch-millisecond value) given a dated, reasoned DEFERRED disposition in `deferred-items.md`, naming its evidence, its four reasons, and the concrete fix shape (`plugins.tooltip.callbacks.title` reusing `formatTimeAxisTick`) plus the three other Trends charts (`mountVolumeChart`, `mountYoyChart`, `buildChannelBand`) that share the same time-scale tooltip shape.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the .trends-tablist-scroll rule, pin it by value, correct stale comments** - `bc565ec` (feat)
2. **Task 2: Wrap the tablist in trends.ts, guard the wrap stays applied** - `742f632` (feat)
3. **Task 3: Record Finding 12's disposition** - `463b97f` (docs)

**Plan metadata:** committed separately by the orchestrator after this worktree merges (per worktree-mode instructions, this agent does not write STATE.md/ROADMAP.md).

## Files Created/Modified

- `src/dashboard/styles.css` - New `.trends-tablist-scroll` rule with its full arithmetic/rejected-alternatives comment; four stale comments corrected
- `src/dashboard/styles.test.ts` - New `describe('Phase 23 (TRN-03, gap closure round 2) — .trends-tablist-scroll containment')` block (9 tests); one stale comment's declarer list corrected
- `src/dashboard/views/trends.ts` - `buildTablistAndPanels` wraps `tablist` in `tablistScroll`; `load()` consumes the renamed return value
- `.planning/phases/23-trends-zoom-pan-taller-bands/deferred-items.md` - Finding 12's dated DEFERRED disposition appended; the pre-existing env-gap entry extended with a 2026-08-27 `npm ci` resolution note

## Decisions Made

- Followed the plan's chosen approach (scroll wrapper) and its explicit rejection of `flex-wrap: wrap` and padding-shrink — no deviation from the plan's own architectural analysis.
- Stale-comment phrasing: where the plan's prose named the new class literally ("the fourth is `.trends-tablist-scroll`"), the actual comment text uses descriptive prose ("the Trends tablist's scroll wrapper below") instead of the literal class token, matching how the pre-existing comment already referred to `.year-heatmap-scroll` ("the year-heatmap's scroll wrapper below") without spelling it out. This keeps the plan's own acceptance check (`grep -c "trends-tablist-scroll"` outside comment-opening lines outputs `1`) satisfied while still recording the same reasoning a literal name would.
- Task boundary: the consumer guard and the two ARIA/tabIndex contract guards specified in Task 2's action were added in Task 2's commit (once `trends.ts` actually has the wrapper), not in Task 1's, even though the plan's prose described them as being added to "the describe block Task 1 created" — this preserves each task's own commit being independently green (Task 1's `npx vitest run styles.test.ts -t "trends-tablist-scroll"` exits 0 on Task 1's own commit, rather than depending on Task 2 landing first).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored an entirely empty `node_modules/` via `npm ci`**
- **Found during:** Task 2, running the plan's `<verify>` command (`npx tsc --noEmit && npm test && npm run build-widgets && npm run verify-dashboard`)
- **Issue:** This worktree's `node_modules/` had zero installed packages (only Vite's own cache dirs existed) — `npx tsc`/`npx vitest` worked anyway via npx's own package cache, but `npm test` failed hard on `chartjs-plugin-zoom` being unresolvable, and `data/stats/*.json` (gitignored, pipeline-generated) was also absent, matching the pre-existing env-gap entry already on file in `deferred-items.md`.
- **Fix:** Ran `npm ci` against the committed, unmodified `package-lock.json` (no `package.json` change — this restores already-locked dependencies, not a new package, so the Package Legitimacy Gate does not apply), then the same `npm run build` / `npm run compute-dashboard-index` / `npm run compute-all-stats` sequence the 23-03 precedent already used and documented.
- **Files modified:** None tracked by git (`node_modules/`, `data/stats/`, `data/dashboard/` are all gitignored). `data/geo/geo-metadata.json`'s `generatedAt` timestamp was touched as a side effect and reverted via `git checkout --` before staging, matching the 23-03 precedent exactly.
- **Verification:** Full suite green after the fix — 55/55 files, 1359/1359 tests; `npm run build-widgets` exit 0; `npm run verify-dashboard` 37/37 checks passing.
- **Committed in:** N/A (no tracked-file change; documented in `deferred-items.md`'s existing env-gap entry, commit `463b97f`)

---

**Total deviations:** 1 auto-fixed (1 blocking, environment-only, no source change)
**Impact on plan:** No scope creep — restores the environment to the state the plan's own verification commands assume; matches an already-documented precedent from plan 23-03.

## Issues Encountered

None beyond the environment-restoration deviation above.

## For 23-13 Task 1 (per this plan's `<output>` spec)

**New automated command(s) to paste into the Per-Task Verification Map:**

```
npx vitest run src/dashboard/styles.test.ts -t "trends-tablist-scroll"
```
Row shape: `23-12/T1,T2 | 23-12 | 11 | TRN-03 | — | N/A | unit (rule scanner, by VALUE) +
consumer guard + ARIA/tabIndex contract guards | npx vitest run src/dashboard/styles.test.ts -t "trends-tablist-scroll" | ✅ | ✅ green`

Also re-affirms the existing full-gate command already in the map:
```
npx tsc --noEmit && npm test && npm run build-widgets && npm run verify-dashboard
```
All four exit 0 as of this plan's completion.

**`className = 'segmented'` count in `trends.ts`, before/after this plan:** `4` before, `4` after
(the volume-granularity group, the TRIMP model group, the load-window group, and the tablist
itself — unchanged; only the tablist's *container* changed, not its class).

**Exact string for a Round 3 build-freshness check to grep for in the served/built bytes:**
```
trends-tablist-scroll
```
Confirmed present in this plan's own local build: `dist/widgets/assets/index-B573RjUr.css` (1
occurrence) and `dist/widgets/assets/index-BQy-1dz6.js` (1 occurrence). Plan 23-13's Round 3
checkpoint should re-run `npm run build-widgets` itself and grep the resulting asset filenames
(which will differ from the two above once fresh), since content-hashed filenames are exactly the
staged-build-cache trap the checkpoint must avoid re-serving stale bytes for.

**Explicitly NOT verified here, and NOT claimable by this plan** (per its own `<verification>`
section): that `document.documentElement.scrollWidth` now EQUALS `document.documentElement.clientWidth`
at 390px, 393px, 412px and 430px. `vitest.config.ts` runs `environment: 'node'` — no jsdom, no
headless browser, no CSSOM, no canvas polyfill — so no command in this repository can compute a
layout. Plan 23-13's R46 is the only thing that discharges it, at all four widths individually.
`requirements-completed` for this plan is `[]`; TRN-03 stays Pending.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 23-13's Round 3 browser checkpoint (R46) is the only remaining gate for TRN-03 and for Phase
23 overall. The wrapper is applied and by-value/consumer-guard verified; only the rendered
`documentElement.scrollWidth === clientWidth` equality at the four phone widths, and the rightmost
tab's actual reachability by scroll and by keyboard, remain to be confirmed in a real browser.

---
*Phase: 23-trends-zoom-pan-taller-bands*
*Completed: 2026-08-27*

## Self-Check: PASSED

- FOUND: `.planning/phases/23-trends-zoom-pan-taller-bands/23-12-SUMMARY.md`
- FOUND: `src/dashboard/styles.css` contains `trends-tablist-scroll`
- FOUND: `src/dashboard/views/trends.ts` contains `trends-tablist-scroll`
- FOUND: `.planning/phases/23-trends-zoom-pan-taller-bands/deferred-items.md` contains "Finding 12"
- FOUND: commit `bc565ec` (Task 1)
- FOUND: commit `742f632` (Task 2)
- FOUND: commit `463b97f` (Task 3)
- FOUND: commit `543527b` (SUMMARY.md)
