---
phase: 22-calendar-week-start-totals
plan: 11
subsystem: ui
tags: [storage-guard, bootstrap, theme, detail-view, defense-in-depth, gap-closure, round-3]

# Dependency graph
requires:
  - phase: 22-calendar-week-start-totals (plan 22-10)
    provides: "src/dashboard/storage.ts's resolveStorage(override?) handle resolver, ready to be wired app-wide"
provides:
  - "Six previously-unguarded storage-global dereference sites (main.ts:19, nav.ts:186, nav.ts:206, theme.ts:93, theme.ts:130, detail-charts.ts:218) all resolve through storage.ts's resolveStorage"
  - "A repo-wide, comment-stripped source guard in storage.test.ts proving exactly one storage-global dereference site remains app-wide (storage.ts itself)"
  - "readStoredMode, ApplyThemeOptions.storage, readStoredOverlayConfig and writeStoredOverlayConfig all tolerate a null handle with an explicit if (!storage) early return before their existing try/catch"
  - "BL-03 app-wide closure claim actually true end to end at the app level for the first time (previously only calendar-scoped)"
affects: [22-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit if (!storage) early return before an existing try/catch, mirroring readStoredWeekStart's shipped shape (GC-2b/GC-5j), applied to readStoredMode, applyThemeMode, watchSystemTheme, readStoredOverlayConfig, writeStoredOverlayConfig"
    - "Type alias delegation reused a second time: ThemeStorage = WebStorage (theme.ts), matching WeekStartStorage = WebStorage (calendar-preferences.ts) from plan 22-10"
    - "Repo-wide comment-stripped source-text regression guard (storage.test.ts) walking every non-test .ts under src/dashboard/ recursively, reusing the styles.test.ts/row-semantics.test.ts precedent at a directory-tree scope instead of a single-file scope"

key-files:
  created: []
  modified:
    - src/dashboard/theme.ts
    - src/dashboard/theme.test.ts
    - src/dashboard/main.ts
    - src/dashboard/nav.ts
    - src/dashboard/views/detail-charts.ts
    - src/dashboard/views/detail-charts-logic.ts
    - src/dashboard/views/detail-charts-logic.test.ts
    - src/dashboard/storage.test.ts
    - .planning/phases/22-calendar-week-start-totals/deferred-items.md

key-decisions:
  - "GC-5i confirmed as executed: nav.ts:186 and nav.ts:206 (not named in the user's original four-site list) were guarded alongside the four named sites, because nav.ts:186 is reached from main.ts:22's module-scope createNav call — leaving it unguarded would have moved the module-scope throw down two lines and still blanked the page"
  - "Existing detail-charts-logic.test.ts storage fixtures (previously typed as bare object literals with only getItem or only setItem, matching the old Pick<Storage,...> signatures) were widened to the full WebStorage shape — a Rule 1/3 blocking-fix the plan's own literal 'WebStorage | null' widening instruction required, since WebStorage needs both methods where the old Pick types needed only one"
  - "The plan's Task 1 automated verify script's import-quote regex (/from \".\\/storage.js\"/) assumes double-quoted imports; this codebase's convention (222 single-quoted vs 5 double-quoted import statements, confirmed by grep) is single quotes throughout, including plan 22-10's own new storage.ts/calendar-preferences.ts imports. Ran a quote-agnostic version of the same check instead of changing the codebase's import style to match a plan-script typo"

patterns-established:
  - "The BL-03 app-wide storage guard pattern (plan 22-10's design) is now fully wired: every per-key persistence module in src/dashboard/ resolves its handle through storage.ts's resolveStorage rather than dereferencing globalThis.localStorage itself, and a repo-wide test — not a paragraph of prose — enforces that no future module reintroduces the shape"

requirements-completed: []

# Metrics
duration: ~12min (across 5 commits, 22:34:55-22:41:01 local)
completed: 2026-08-18
---

# Phase 22 Plan 11: App-wide storage handle wiring (BL-03 closure) Summary

**Wired all six remaining unguarded `localStorage` dereference sites (`main.ts:19`, `nav.ts:186`/`206`, `theme.ts:93`/`130`, `detail-charts.ts:218`) through plan 22-10's shared `resolveStorage()`, closing BL-03 app-wide and proving it repo-wide with a comment-stripped source walk rather than a paragraph of prose.**

## Performance

- **Duration:** ~12 min (5 commits, 22:34:55–22:41:01 local time)
- **Completed:** 2026-08-18T20:41:15Z
- **Tasks:** 3
- **Files modified:** 9 (7 source/test files + 1 test-only addition inside an existing file + 1 tracking doc)

## Accomplishments

- **Task 1 — `theme.ts` null-tolerant, both sites guarded.** `ThemeStorage` is now `= WebStorage` (storage.ts's shape, exported name kept). `readStoredMode(storage: ThemeStorage | null)` opens with an explicit `if (!storage) return 'auto';` before its existing try/catch. `applyThemeMode` and `watchSystemTheme` both resolve their handle via `resolveStorage(options.storage ?? undefined)` instead of `options.storage ?? localStorage`. The `data-theme` DOM write stays unconditional — proven by a new test asserting it's set even with `storage: null`. Header updated to cite BL-03 while keeping the theme-ownership claim unweakened (no key, parse, or contract moved out).
- **Task 2 — the two module-scope-reachable bootstrap reads guarded.** `main.ts:19`'s `applyThemeMode(readStoredMode(localStorage))` became `applyThemeMode(readStoredMode(resolveStorage()))`, with its comment now stating the real failure mode: this statement runs at MODULE SCOPE, so an unguarded throw here fails the entire dashboard module graph, renders a BLANK page, and never reaches `onMatch`'s try/catch (which wraps `view.mount()`, not module evaluation). `nav.ts:186` (`updateThemeToggle`'s initial read, reached from `main.ts:22`'s module-scope `createNav()` call) and `nav.ts:206` (the theme-toggle click handler) both now read via `resolveStorage()` too — the discovery beyond the user's originally-named four sites, recorded per GC-5i rather than silently absorbed. `nav.ts`'s "this file never touches localStorage directly" header claim is now actually true.
- **Task 3 — the detail-charts overlay path guarded, and the app-wide invariant proven repo-wide.** `readStoredOverlayConfig`/`writeStoredOverlayConfig` widened to `WebStorage | null`, each with an explicit `if (!storage)` early return; `OVERLAY_STORAGE_KEY` and `parseOverlayConfig` stayed in `detail-charts-logic.ts` (D-06 fence, no contract moved). `detail-charts.ts:218` now resolves via `resolveStorage(options.storage)`. A new `storage.test.ts` describe walks every non-test `.ts` file under `src/dashboard/` recursively (comment-stripped), asserting zero storage-global dereferences outside `storage.ts` itself — 41 non-test modules scanned, exactly one dereference site found, matching `storage.ts`'s own single `globalThis.localStorage` occurrence.

## Task Commits

Each task was committed atomically, with Tasks 1 and 3 (both `tdd="true"`) split into separate RED (test-only) and GREEN (implementation) commits per the TDD execution protocol:

1. **Task 1 RED** — `20e4ed2` (test): failing null-storage-handle cases added to `theme.test.ts`; confirmed RED via `tsc --noEmit` (TS2345, `null` not assignable to `ThemeStorage`) — the runtime behavior happened to already pass by accident (Node's `localStorage` global + `null ?? localStorage` nullish-coalescing), so the type-check was the discriminating RED signal, not the test run.
2. **Task 1 GREEN** — `327cd2a` (feat): `theme.ts` widened and rewired through `resolveStorage`.
3. **Task 2** — `61b381e` (fix): `main.ts` and `nav.ts` guarded (not TDD — plan specified `type="auto"` without `tdd="true"` for this task; no `nav.test.ts` exists in this repo, so the change is covered by Task 3's repo-wide guard and by plan 22-12's row R22).
4. **Task 3 RED** — `523b41e` (test): failing overlay null-handle cases in `detail-charts-logic.test.ts` and the new repo-wide guard describe in `storage.test.ts`; confirmed RED both by `tsc --noEmit` (the overlay cases) and by an actual failing assertion (the repo-wide walk correctly flagged `detail-charts.ts:218` as an offender before Task 3's implementation).
5. **Task 3 GREEN** — `568ba89` (feat): `detail-charts-logic.ts` and `detail-charts.ts` guarded; existing test fixtures widened to the full `WebStorage` shape to compile; `deferred-items.md` updated with the `verify-dashboard` environmental finding (see Issues Encountered).

## Files Created/Modified

- `src/dashboard/theme.ts` — `ThemeStorage = WebStorage` alias; `readStoredMode`, `ApplyThemeOptions.storage`, `applyThemeMode`, `watchSystemTheme` all null-tolerant and resolved through `resolveStorage`; header cites BL-03
- `src/dashboard/theme.test.ts` — 6 new cases: `readStoredMode(null)`, two `applyThemeMode(..., { storage: null })` cases (DOM update unconditional, no throw with default `persist`), one `watchSystemTheme(..., { storage: null })` case asserting the callback fires (system-theme-follow is the correct default under blocked storage)
- `src/dashboard/main.ts` — `applyThemeMode(readStoredMode(resolveStorage()))` at module scope; comment states the real failure mode
- `src/dashboard/nav.ts` — both theme reads (`updateThemeToggle`'s initial call and `handleThemeToggleClick`) resolve via `resolveStorage()`; header claim corrected from aspirational to true
- `src/dashboard/views/detail-charts.ts` — `MountChartBandsOptions.storage` retyped to `WebStorage`; line 218 resolves via `resolveStorage(options.storage)`, citing BL-03
- `src/dashboard/views/detail-charts-logic.ts` — `readStoredOverlayConfig`/`writeStoredOverlayConfig` widened to `WebStorage | null` with explicit early returns; `OVERLAY_STORAGE_KEY`/`parseOverlayConfig` unchanged (still owned here)
- `src/dashboard/views/detail-charts-logic.test.ts` — 2 new null-handle cases; 7 existing fixtures widened from partial `Pick<Storage,...>`-shaped objects to full `WebStorage` objects (both methods present, unused method left as a throw-if-called or no-op) to compile against the widened signatures
- `src/dashboard/storage.test.ts` — new describe: a recursive, comment-stripped source walk over `src/dashboard/` (via `readdirSync`) proving zero storage-global dereferences outside `storage.ts`, plus a re-assertion that `storage.ts` itself holds exactly one
- `.planning/phases/22-calendar-week-start-totals/deferred-items.md` — new entry logging an out-of-scope `verify-dashboard` gap (see Issues Encountered)

## Decisions Made

- **GC-5i honored exactly as the plan specified:** `nav.ts:186` and `nav.ts:206` were guarded even though the user's originally-locked list named only `main.ts:19`, `theme.ts:93`, `theme.ts:130`, `detail-charts.ts:218`. This is recorded here per the plan's own instruction to record the discovery rather than silently absorb it — it was already flagged in the plan text itself (found by the planner's own grep), not newly discovered during execution.
- **Widened existing test fixtures in `detail-charts-logic.test.ts` to satisfy the full `WebStorage` shape** rather than keeping the narrower `Pick<Storage, 'getItem'>`/`Pick<Storage, 'setItem'>` per-function signatures the plan's Task 3 automated verify script explicitly checks for (`WebStorage \| null` must appear literally). This was a Rule 1/3 auto-fix: the plan's own widening instruction, taken literally, broke 7 pre-existing test fixtures that only implemented one of the two methods; adding the missing method (matching each fixture's own throw/no-op intent) was the minimal fix that satisfies both the plan's literal signature requirement and the pre-existing tests' original behavior.
- **Ran a quote-style-agnostic version of Task 1's automated verify script** rather than the plan's literal `/from ".\/storage.js"/` (double-quote) regex, because this codebase's import convention is single-quoted throughout (222 single-quoted vs. 5 double-quoted import statements repo-wide, confirmed by grep) — including plan 22-10's own new `storage.ts` consumer imports. Changing the codebase's quote style to satisfy a plan script's regex would have been the wrong fix; the corrected check (`/from ['"]\.\/storage\.js['"]/`) proves the same substantive claim (theme.ts imports from `./storage.js`) without depending on an arbitrary quote character.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `nav.ts` header claim split across two source lines defeated the plan's single-line regex**

- **Found during:** Task 2 verification
- **Issue:** The plan's automated verify script checks for the literal substring `never touches localStorage directly` in `nav.ts`'s header comment via a regex that cannot match across a newline. My first two header-comment rewrites wrapped the phrase across two `/** ... */` lines (matching the file's existing 80-ish-column prose wrapping style), which broke the check even though the claim itself was correct and intact.
- **Fix:** Rewrapped the comment so the exact phrase `never touches localStorage directly` sits on one physical line, moving the wrap point to fall after "directly." instead of mid-phrase.
- **Files modified:** `src/dashboard/nav.ts`
- **Commit:** `61b381e`

**2. [Rule 3 - Blocking] Widening `detail-charts-logic`'s storage parameters to the full `WebStorage` shape broke 7 pre-existing test fixtures**

- **Found during:** Task 3 GREEN implementation, caught by `tsc --noEmit`
- **Issue:** The plan's Task 3 action explicitly instructs widening `readStoredOverlayConfig`/`writeStoredOverlayConfig` to `WebStorage | null` (both `getItem` and `setItem` required), but the file's existing tests passed bare object literals implementing only the one method each function actually calls (matching the OLD `Pick<Storage, 'getItem'>` / `Pick<Storage, 'setItem'>` signatures). This is a structural consequence of the plan's own literal-signature requirement, not a new bug introduced by this plan's logic.
- **Fix:** Added the missing method to each of the 7 affected fixtures, using a throw (for fixtures under an `it('... when X throws')` case) or a no-op/return-null stub (for fixtures where the method isn't exercised) so each fixture's original intent (what happens when the METHOD UNDER TEST throws/returns X) is unchanged.
- **Files modified:** `src/dashboard/views/detail-charts-logic.test.ts`
- **Commit:** `568ba89`

### Corrected verify-script assumptions (not code changes)

**3. [Rule 1 - Bug in the plan's own verify script] Task 1's import-quote regex assumed double quotes; codebase convention is single quotes**

- **Found during:** Task 1 verification
- **Issue:** `/from ".\/storage.js"/` cannot match `import { resolveStorage } from './storage.js';` (single-quoted, this repo's convention — 222:5 single-vs-double import statements repo-wide).
- **Fix:** Ran the equivalent check with a quote-agnostic regex (`/from ['"]\.\/storage\.js['"]/`) instead of changing the codebase's quote style. No source file was altered to satisfy this — it only affected how I confirmed the acceptance criterion locally.
- **Files modified:** None (verification-only).

## Issues Encountered

**Environmental, not a regression (documented in `deferred-items.md`, not fixed):** `npm run verify-dashboard`, the last command in Task 3's chained verify script, fails in this fresh worktree with `FATAL: dist/widgets is not fully built. Missing: dist/widgets/data/dashboard/index.json`. Root cause is the same class of gap 22-10 already logged for `data/stats/`: `data/dashboard/` is gitignored, produced by `npm run compute-dashboard-index`, which itself reads `data/stats/best-efforts.json`/`gear-aggregate.json` — files confirmed absent in this worktree and never committed to `master` (only present in `gh-pages` deploy commits, checked via `git log --all`). Generating it would require running the full stats pipeline, well outside this plan's `files_modified`. Verification substitute used instead: `npm run build-widgets` (the step that would actually surface a TypeScript or CSS regression from this plan's changes) exits 0 with zero `css-syntax-error`; `npx tsc --noEmit -p tsconfig.json` exits 0; `npm test` shows exactly the same 5 pre-existing `data/stats/`-dependent `ENOENT` failures as 22-10 (1160 passed, 4 more than 22-10's 1156 — the new BL-03 test cases — 0 newly failing); and the BL-03 repo-wide source guard added in this plan's Task 3 is itself a `vitest` assertion (not a build artifact) that independently proves the invariant `verify-dashboard` would otherwise be asked to observe at runtime.

Per the orchestrator's own note to this executor: "The orchestrator re-runs the full suite on the main checkout (where `data/stats/` exists) after merge; it passed 1245/1245 there before your dispatch." `verify-dashboard` was not explicitly named in that note (only the 5 `npm test` suites were), so this `data/dashboard/index.json` gap is logged here as a new — but same-root-cause — environmental finding for the orchestrator's awareness, not assumed pre-cleared.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- BL-03 is closed app-wide: `resolveStorage` is the only storage-global dereference in `src/dashboard/`, proven by a repo-wide test rather than by grep or by trust. All six previously-unguarded sites — the four originally named plus the two `nav.ts` sites GC-5i required — resolve through it.
- **This plan discharges no browser claim**, per its own `<verification>` section. Whether a real blocked-site-data browser now boots correctly is decided entirely by plan `22-12`'s row **R22**, which is mandatory this round and may not be waived or declined.
- **No requirement is ticked by this plan**, matching its stated success criterion — `CAL-01` and all other Phase 22 requirements remain gated on their own rows in `22-12`.
- `npm run verify-dashboard`'s inability to run in this worktree (see Issues Encountered) is purely a local-checkout data-generation gap, not a code defect from this plan; it does not block plan 22-12's browser checkpoint, which stages its own build separately.

---
*Phase: 22-calendar-week-start-totals*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: src/dashboard/theme.ts
- FOUND: src/dashboard/theme.test.ts
- FOUND: src/dashboard/main.ts
- FOUND: src/dashboard/nav.ts
- FOUND: src/dashboard/views/detail-charts.ts
- FOUND: src/dashboard/views/detail-charts-logic.ts
- FOUND: src/dashboard/views/detail-charts-logic.test.ts
- FOUND: src/dashboard/storage.test.ts
- FOUND: .planning/phases/22-calendar-week-start-totals/deferred-items.md
- FOUND commit: 20e4ed2 (Task 1 RED)
- FOUND commit: 327cd2a (Task 1 GREEN)
- FOUND commit: 61b381e (Task 2)
- FOUND commit: 523b41e (Task 3 RED)
- FOUND commit: 568ba89 (Task 3 GREEN)
- FOUND commit: 9376e82 (SUMMARY.md)
