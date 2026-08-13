---
phase: 20-row-click-interaction-pattern
plan: 04
subsystem: ui
tags: [css, vitest, mutation-testing, accessibility, regression-guard]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    plan: "01"
    provides: "NAVIGABLE_ROW_CLASS marker literal (row-navigation.ts)"
  - phase: 20-row-click-interaction-pattern
    plan: "02"
    provides: "renderActivityRow/renderRecentPrRow whole-row <a> anchors in list.ts/overview.ts for the D-06 link treatment to style"
  - phase: 20-row-click-interaction-pattern
    plan: "03"
    provides: "records.ts's PR/progression tables carrying NAVIGABLE_ROW_CLASS for the D-10 scoping to reach"
provides:
  - "Phase 20 stylesheet block: D-06 bare-a link treatment, D-09 row-anchor hover, D-10 navigable-row cursor/hover scoping"
  - "11 mutation-proven styles.test.ts assertions pinning every Phase 20 stylesheet claim"
  - "src/dashboard/row-semantics.test.ts - a new source-structure guard over list.ts/overview.ts/records.ts/trends.ts/detail-sections.ts/row-navigation.ts, proving UX-02/D-01/D-02/D-03/D-05/D-10 hold in source"
affects: [20-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comment-stripped TypeScript source-structure guard (row-semantics.test.ts), mirroring styles.test.ts's comment-stripped CSS guard for a different source type"
    - "Mutation-proving discipline extended from CSS assertions (styles.test.ts) to TS source assertions (row-semantics.test.ts)"

key-files:
  created:
    - src/dashboard/row-semantics.test.ts
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts

key-decisions:
  - "D-06 bare `a` rule uses `color: inherit`, not `color: var(--accent)` - this repo's own measured contrast (~3.4:1 light, ~2.8:1 dark, 17-UI-SPEC.md:105) is below the 4.5:1 AA floor, so an accent-colored link would ship a contrast failure everywhere at once"
  - "D-10 scoping keys off NAVIGABLE_ROW_CLASS (the helper-applied marker), not the shared `pr-table` class - four non-activity tables (Riegel, two Trends, best-efforts) share that class string but are never clickable, so an opt-out class was rejected as the wrong default"
  - "D-11: no row-specific :focus-visible variant added - rows inherit Phase 19's global two-tone ring unchanged; plan 20-05's checkpoint arbitrates on rendered evidence"
  - "row-semantics.test.ts's own header explicitly disclaims rendering/clicking coverage - this repo has no jsdom/happy-dom, so only plan 20-05's human browser checkpoint proves the click actually works"

patterns-established:
  - "Source-structure guard over TypeScript view files (row-semantics.test.ts): same stripComments + exact-occurrence-count discipline styles.test.ts established for CSS, now applied to .ts source text"

requirements-completed: [UX-02, UX-03]

# Metrics
duration: 12min
completed: 2026-08-13
---

# Phase 20 Plan 04: Row-Click Stylesheet + Structural Guards Summary

**Landed the Phase 20 stylesheet block (D-06 shared link treatment, D-09 row-anchor hover, D-10 navigable-row scoping) with 11 mutation-proven styles.test.ts assertions, plus a new row-semantics.test.ts source-structure guard over the view files that mutation-proves 5 of its own assertions across UX-02/D-02/D-05/D-10 and the location.hash house rule.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-13T19:43:16Z (worktree base corrected to 6c8e10c)
- **Completed:** 2026-08-13T19:55:34Z
- **Tasks:** 3 completed
- **Files modified:** 3 (2 modified, 1 new)

## Accomplishments
- Deleted `.activity-table tbody tr` / `:hover`'s cursor-and-hover rules (the lying pointer four non-activity tables — Riegel, two Trends, the best-efforts table — used to show) and replaced them with `.activity-table__row--navigable` / `:hover`, scoped to the marker class `attachRowNavigation` actually applies (D-10)
- Added the D-06 bare `a` rule (`color: inherit; text-decoration: underline;`) — every anchor in the app, including `.app-nav__brand` and `.detail-nav`'s Newer/Older links, now reads in theme colors instead of browser-default blue, in both themes
- Added `.activity-row`'s `text-decoration: none` and `.activity-row:hover`'s byte-identical `color-mix(in srgb, var(--surface) 92%, var(--text))` hover (D-09) — the whole-row `<a>` plans 20-02/20-03 built now has the row-level hover feedback and no stray link underline
- Wrote 11 assertions in `styles.test.ts` pinning every Phase 20 stylesheet claim, each confirmed to fail under a targeted mutation before being kept (all 11 mutations recorded below), and deleted the now-obsolete `.activity-table tbody tr:hover` assertion (superseded by the new positive/negative pair)
- Built `src/dashboard/row-semantics.test.ts` — a new TypeScript-source structure guard (16 tests) proving the CTA removal, the single `row-navigation.js` import, the `attachRowNavigation`/`activityDetailHref` counts (including the three load-bearing zero-counts on Overview/Trends/best-efforts), the Records column removals, D-01's no-tabindex/no-role="link", D-02's no-keydown, and the house rules against `location.hash` assignment and the `innerHTML` family — with its own header stating plainly it proves nothing about rendering or clicking

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase 20 stylesheet block - link treatment, row hover, navigable-row scoping** - `7a90043` (feat)
2. **Task 2: Phase 20 stylesheet assertions, mutation-proven** - `1fe7f2f` (test)
3. **Task 3: Source-structure guard over the view files** - `8d198e7` (test)

**Plan metadata:** `5bd7d33` (docs: deferred-items.md update); SUMMARY.md commit follows this document in worktree mode.

## Files Created/Modified
- `src/dashboard/styles.css` - Deleted `.activity-table tbody tr`/`:hover`; added a load-bearing comment on `.activity-row`; appended the banner-commented Phase 20 block (bare `a`, `.activity-row` text-decoration, `.activity-row:hover`, `.activity-table__row--navigable`/`:hover`)
- `src/dashboard/styles.test.ts` - New `describe('styles.css - Phase 20 row-click interaction pattern', ...)` with 11 assertions; imports `NAVIGABLE_ROW_CLASS` from `./row-navigation.js`; deleted the obsolete `.activity-table tbody tr:hover` assertion
- `src/dashboard/row-semantics.test.ts` - New file: `stripComments` + 4 self-tests, then 16 assertions across UX-02/UX-01/D-03/D-10/D-05/D-01/D-02 and two house rules

## Decisions Made
- Followed the plan's explicit ban on `declarationsFor('a')` (it resolves to `.cta {`, not the bare `a` rule) — used `selectorListDeclares` for all three D-06 assertions instead
- Reused the Phase 19 `color-mix(in srgb, var(--surface) 92%, var(--text))` formula byte-identically in both new hover rules rather than re-deriving it, per the plan's explicit constraint
- `.activity-table__row--highlight` left untouched immediately below the deleted rules, as instructed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, verification-script conflict] Reworded a styles.test.ts comment to avoid the literal substring `declarationsFor('a')`**
- **Found during:** Task 2, running the plan's own automated verify script
- **Issue:** The plan's own Task 2 verify command rejects the file if it contains the substring `declarationsFor('a')` anywhere — but the acceptance criteria also require an explanatory comment naming exactly why `declarationsFor('a')` must not be used for the D-06 assertions. My first draft named it directly in prose and tripped the check (the same class of tension 20-01-SUMMARY.md documented for its own verify script).
- **Fix:** Reworded to "Do NOT use the declarationsFor helper on the bare `a` selector" — preserves the reasoning without the exact forbidden substring.
- **Files modified:** `src/dashboard/styles.test.ts`
- **Verification:** Re-ran the plan's verify script (now reports `styles.test.ts Phase 20 block OK`); `npx vitest run src/dashboard/styles.test.ts` still green (68/68)
- **Committed in:** `1fe7f2f` (Task 2 commit)

**2. [Rule 1 - Bug I introduced and caught before committing] `row-semantics.test.ts`'s own header comment contained a literal `*/` that closed the JSDoc block early**
- **Found during:** Task 3, first `npx vitest run` attempt on the new file
- **Issue:** Writing "same first-`*/`-wins rationale" inside a real `/** ... */` block comment terminated the comment at that literal `*/`, producing an esbuild syntax error (`Expected ";" but found "styles"`) — the exact GAP 1 failure class this phase's own stylesheet guard exists to catch, self-inflicted in the new test file's own prose.
- **Fix:** Reworded to "same first-closer-wins rationale", removing the literal `*/` from the comment body entirely.
- **Files modified:** `src/dashboard/row-semantics.test.ts`
- **Verification:** File parses; `npx vitest run src/dashboard/row-semantics.test.ts` green (16/16)
- **Committed in:** `8d198e7` (Task 3 commit)

**3. [Rule 3 - Blocking, verification-script conflict] Reworded row-semantics.test.ts's header to avoid the literal words `jsdom`/`happy-dom`**
- **Found during:** Task 3, running the plan's own automated verify script
- **Issue:** The plan's acceptance criteria require the header to state plainly that this repo has no jsdom/happy-dom (so a reader doesn't mistake a green run for DOM coverage), but the same verify script's own DOM-environment check (`/\bdocument\b|jsdom|happy-dom|puppeteer|playwright/`) fails the file if those literal words appear anywhere, including in prose.
- **Fix:** Reworded to "no DOM-simulation library dependency and no headless browser anywhere in this project" — preserves the honest disclosure without the forbidden literal library names.
- **Files modified:** `src/dashboard/row-semantics.test.ts`
- **Verification:** Re-ran the plan's verify script (now reports `row-semantics guard OK`)
- **Committed in:** `8d198e7` (Task 3 commit)

**4. [Rule 3 - Out-of-scope, logged not fixed] `npm run verify-dashboard` fails on missing gitignored dashboard-index data**
- **Found during:** Task 3's overall-verification pass (plan's `<verification>` section)
- **Issue:** `verify-dashboard` fails with `FATAL: dist/widgets/data/dashboard/index.json` missing. Traced to the same root cause 20-01-SUMMARY.md already logged: `data/dashboard/` is gitignored and generated by `compute-dashboard-index`, which needs a compiled `dist/index.js` (never built in this worktree) and the same missing gitignored `data/stats/*.json` inputs. Unrelated to this plan's `styles.css`/`styles.test.ts`/`row-semantics.test.ts` changes.
- **Fix:** Not fixed — out of scope. Logged to `deferred-items.md`.
- **Files modified:** `.planning/phases/20-row-click-interaction-pattern/deferred-items.md` (documentation only)
- **Verification:** `npm run build-widgets` (the plan's actual Task 1 gate) exits 0 with zero `css-syntax-error` occurrences, confirming the bundle itself compiles cleanly; only the publish-verifier's data-reachability check is blocked by missing local data.
- **Committed in:** `5bd7d33`

---

**Total deviations:** 4 (3 Rule 3 verify-script wording conflicts self-resolved before committing, 1 out-of-scope environment gap logged and deferred)
**Impact on plan:** No scope creep and no shipped-code change from any deviation — all four are either comment wording adjusted to satisfy the plan's own automated checks, or a pre-existing, already-logged environment gap unrelated to this plan's files.

## Mutation-Proving Record

### Task 2 — styles.test.ts (11/11 mutated and reverted)

| # | Assertion | Mutation applied | Confirmed failing? | Reverted & green? |
|---|-----------|-------------------|---------------------|---------------------|
| 1 | `a` declares `color: inherit` | `color: inherit` → `color: unset` | Yes | Yes |
| 2 | `a` declares `text-decoration: underline` | `underline` → `none` | Yes | Yes |
| 3 | `a` does not declare `color: var(--accent)` | `inherit` → `var(--accent)` | Yes | Yes |
| 4 | `.activity-row` keeps `display: flex` | `flex` → `block` | Yes | Yes |
| 5 | `.activity-row` declares `text-decoration: none` | `none` → `underline` | Yes | Yes |
| 6 | `.activity-row:hover` mixes from `--surface` | `--surface` → `--accent` in the mix | Yes | Yes |
| 7 | `.activity-table__row--navigable` declares `cursor: pointer` | `pointer` → `default` | Yes | Yes |
| 8 | `.activity-table__row--navigable:hover` mixes correctly | dropped the `color-mix(...)`, left flat `var(--surface)` | Yes | Yes |
| 9 | `.activity-table tbody tr` no longer declares `cursor: pointer` | re-added the deleted rule pair | Yes (both 9 and 10 caught by the one mutation) | Yes |
| 10 | `.activity-table tbody tr:hover` no longer declares `color-mix` | (same mutation as #9) | Yes | Yes |
| 11 | Marker class parity with `NAVIGABLE_ROW_CLASS` | renamed both CSS rule selectors to `.activity-table__row--nav-mutated` | Yes | Yes |

### Task 3 — row-semantics.test.ts (5 of 16, spanning different decisions, mutated and reverted)

| # | Assertion | File mutated | Mutation applied | Confirmed failing? | Reverted & green? |
|---|-----------|---------------|-------------------|---------------------|---------------------|
| A | `className = 'cta'` per-file count | `detail.ts` | changed one `className = 'cta'` to `'cta-mutated'` | Yes (`detailCount` 4→3) | Yes |
| B | `attachRowNavigation(` zero-count | `overview.ts` | appended a string literal containing `attachRowNavigation(` | Yes (0→1) | Yes |
| C | `keydown` zero-count (D-02) | `row-navigation.ts` | appended a string literal containing `keydown` | Yes (0→1) | Yes |
| D | No `location.hash` assignment (house rule) | `trends.ts` | added `window.location.hash = newHash;` inside a dead `if (false)` branch, next to the existing legitimate `!==` comparison | Yes — and confirmed the existing `!==` comparison still does NOT trip the assertion | Yes |
| E | Records column removal (D-05) | `records.ts` | re-added `{ label: 'Activity', numeric: false }` to the headers array | Yes | Yes |

All mutations were applied with `Edit`/scripted string replacement, verified with a scoped `npx vitest run ... -t "..."` run, then reverted with `git checkout -- <file>` (never `git clean`, never a blanket reset) and re-confirmed green with the full test file.

## Issues Encountered
None beyond the four deviations documented above, all resolved before committing.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 20-05's human browser checkpoint is the only remaining proof that: anchors actually read correctly in both themes (D-06), the row-anchor hover feels right (D-09), the navigable/non-navigable row distinction is visible and correct (D-10), and the inherited global focus ring reads acceptably on a full-width row (D-11) — nothing in this plan's automated gates (vitest, tsc, build-widgets) can observe any of those.
- All source and stylesheet claims Phase 20 makes now have a guard proven to fail when the claim is false: `styles.test.ts`'s 11 new assertions (mutation-proven) plus `row-semantics.test.ts`'s 16 assertions (5 mutation-proven across different decisions).
- The 5 pre-existing `vitest` failures (missing gitignored `data/stats/*.json`) and `npm run verify-dashboard`'s missing `data/dashboard/index.json` (same root cause, newly logged this plan) persist unchanged in this worktree; neither blocks plan 20-05's human checkpoint, which runs against a live deployed/built dashboard, not this isolated worktree's local data.

## Self-Check: PASSED

- FOUND: src/dashboard/styles.css (modified)
- FOUND: src/dashboard/styles.test.ts (modified)
- FOUND: src/dashboard/row-semantics.test.ts (new)
- FOUND: 7a90043 (Task 1 commit)
- FOUND: 1fe7f2f (Task 2 commit)
- FOUND: 8d198e7 (Task 3 commit)
- FOUND: 5bd7d33 (deferred-items.md commit)

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-13*
