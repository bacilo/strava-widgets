---
phase: 29-curation-review-queue
plan: 05
subsystem: curation
tags: [curation, review-queue, browser-client, esbuild, tdd]

# Dependency graph
requires:
  - phase: 29-curation-review-queue plan 04
    provides: "deriveFlaggedActivities/buildPrefillReason/summarizeQueue (scripts/curate-queue/derive-flagged.mjs), the D-01..D-05/D-11/D-12/PD-01 derivation this plan renders"
  - phase: 24-local-curation-mode
    provides: "saveExclusion/removeExclusion/runRecompute transport (scripts/curate-overlay/index.ts) and the mountCurationControls two-step-commit idiom (scripts/curate-overlay/exclusion-panel.ts) this plan copies and imports, never reimplements"
provides:
  - "scripts/curate-queue/format.mjs — formatPace/formatEffortDuration/formatActivityDate (duplicated from src/dashboard/views/list.ts, Pattern 3) plus a new activityDetailUrl returning the full mount-prefixed /strava-widgets/#/activity/<id> form"
  - "scripts/curate-queue/index.ts — the queue page's browser entry point: loads the three mirrored documents, derives and renders the flagged row set (D-12 row content, D-14 header counts), mounts the D-10/D-11/D-15 exclude/edit/remove control per row, and wires the D-13 page-level Recompute control"
affects:
  - "plan 29-06 (server wiring) — serves this file's esbuild bundle at /__curate/queue.js and the HTML shell at /__curate/queue"
  - "plan 29-07/29-08 (guards, browser checkpoint) — CUR-01/CUR-02's actual requirement tick depends on this client being reachable end-to-end and confirmed on a real page, not on this plan alone"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local formatter duplication (never import src/ from scripts/) — the same Pattern 3 discipline derive-flagged.mjs already established for this phase, now applied to the four date/pace/duration/url formatters"
    - "Transport-only reuse: every write crosses exclusively through imported saveExclusion/removeExclusion/runRecompute; the source file is grep-provably free of any /__curate/... literal and any location.reload call of its own"
    - "Single class-name-assignment chokepoint (createQueueMain) — both the normal render path and the DOMContentLoaded error-fallback path route through one function, so the D-09 zero-styling invariant holds structurally rather than by convention"

key-files:
  created:
    - scripts/curate-queue/format.mjs
    - scripts/curate-queue/format.test.mjs
    - scripts/curate-queue/index.ts
  modified: []

key-decisions:
  - "activityDetailUrl percent-encodes the activity id via encodeURIComponent, used for every row's anchor href instead of derive-flagged.mjs's own precomputed (unencoded) row.detailUrl field — defensive consistency with D-12's URL-building requirement, and exercises the formatter the plan's Interfaces section names as an index.ts import"
  - "The plan's Task 2 action text describes a single generic loadJson(url) helper, but Task 2's own acceptance criteria requires grep -c \"fetch('/strava-widgets/data/\" to equal exactly 3 in the source — unreachable through one parameterized helper, whose only fetch() call site is fetch(url). Implemented as three near-identical loadBestEffortsDoc/loadExclusionsDoc/loadIndexDoc functions instead, each with its own literal fetch(...) call and independent try/catch, preserving the never-throw discipline the prose describes while satisfying the literal grep the acceptance criteria actually runs"
  - "Recompute re-entry guard is a module-scope let recomputeInFlight boolean (per D-13's explicit instruction), not a disabled attribute — mirrors mountCurationControls's own rejection of disabled controls (Phase 19 CR-03 precedent)"

patterns-established:
  - "A file's own docblock/inline comments must avoid literally spelling out the forbidden-API names (innerHTML, className, etc.) a source-structure guard scans for — describing the same discipline in prose without the literal token keeps the guard's grep-based check meaningful instead of self-matching on documentation"

requirements-completed: []

# Metrics
duration: "~30min"
completed: 2026-09-18
---

# Phase 29 Plan 05: Queue Page Browser Client Summary

The review queue's browser entry point — three never-throw fetches, D-12's row content and D-14's header counts rendered via `createElement`/`textContent` only, and the D-10/D-11/D-15 exclude/edit/remove control plus the D-13 Recompute control wired exclusively through the imported overlay transport (zero reimplemented writes, zero `location.reload` of its own).

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-18T09:36:00Z (approx, worktree branch check + node_modules setup)
- **Completed:** 2026-09-18T09:43:29Z
- **Tasks:** 3
- **Files modified:** 3 (`scripts/curate-queue/format.mjs`, `scripts/curate-queue/format.test.mjs`, `scripts/curate-queue/index.ts`)

## Accomplishments

- Task 1 (TDD) duplicated `formatPace`/`formatEffortDuration`/`formatActivityDate`'s behavior from `src/dashboard/views/list.ts` into a zero-import `.mjs` module, plus a new `activityDetailUrl` returning the full mount-prefixed hash URL; observed RED first (module didn't exist — import error), then GREEN (13/13 assertions passing, `Test Files 1 passed` collection proof).
- Task 2 built the queue page controller: three literal, never-throw root-absolute fetches (best-efforts, exclusions, dashboard index), the derived row set rendered into `document.body` with D-12's exact row shape (date+name anchor, nested flagged-effort lines, excluded-state text) and D-14's header count, and a never-blank empty/degraded state for a zero-row set or a missing best-efforts document.
- Task 3 added the per-row `mountRowControls` (copying `mountCurationControls`'s tick-reveals-reason / confirm-before-destructive-untick / edit-in-place shape) and the page-level Recompute control, both routed exclusively through the imported `saveExclusion`/`removeExclusion`/`runRecompute` — confirmed by source-level grep (0 occurrences of any `/__curate/...` literal or `location.reload` in this file) and a corrected bundle-linkage check (see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 1: Local formatters, as a collected .mjs module (TDD)**
   - RED: `1dfb974f` (test)
   - GREEN: `f532da2a` (feat)
2. **Task 2: Queue page controller — data load, header, rows** - `32974ade` (feat)
3. **Task 3: Row exclusion control and the page Recompute control** - `4fc5093e` (feat)

No plan-metadata commit in this worktree — SUMMARY.md is committed separately per worktree-mode instructions (STATE.md/ROADMAP.md are excluded; the orchestrator owns those writes after merge).

_TDD task (Task 1) carries two commits (RED → GREEN); no REFACTOR commit was needed._

## Files Created/Modified

- `scripts/curate-queue/format.mjs` - Local, zero-import formatters: `formatPace`, `formatEffortDuration`, `formatActivityDate` (behavior duplicated from `src/dashboard/views/list.ts`, never imported — Pattern 3) plus a new `activityDetailUrl(activityId)` returning `/strava-widgets/#/activity/<percent-encoded-id>`.
- `scripts/curate-queue/format.test.mjs` - 13 behavioral assertions covering every `<behavior>` case in the plan, including the NaN/negative/unparseable degradation paths and an id needing percent-encoding.
- `scripts/curate-queue/index.ts` (362 lines) - The queue page controller: `loadBestEffortsDoc`/`loadExclusionsDoc`/`loadIndexDoc` (three independent never-throw fetches), `createQueueMain` (the sole class-name-assignment site), `appendEmptyState`, `mountRowControls` (D-10/D-11/D-15 per-row control), `buildRowElement` (D-12 row markup), `renderQueue` (D-14 header, D-13 Recompute wiring, orchestrates the whole render), and a single `DOMContentLoaded` listener wrapping the render in a catch that falls back to the same empty state.

## Decisions Made

- **`activityDetailUrl` over `row.detailUrl`:** `derive-flagged.mjs` already computes an (unencoded) `detailUrl` field on each row, but this plan's Interfaces section explicitly names `activityDetailUrl` as an `index.ts` import from `format.mjs`, and D-12 calls for a properly-built URL. Used `activityDetailUrl(row.activityId)` for every row's anchor `href` instead, which also percent-encodes — belt-and-suspenders over the two-source values, and exercises the formatter the plan asked to be built and imported.
- **Three literal fetch functions instead of one parameterized `loadJson(url)` helper:** the plan's Task 2 prose describes "One `loadJson(url)` helper," but Task 2's own acceptance criteria requires `grep -c "fetch('/strava-widgets/data/" scripts/curate-queue/index.ts` to equal exactly `3` — unreachable with a single helper whose only `fetch()` call site is `fetch(url)` (a variable, not a literal). Implemented as `loadBestEffortsDoc`/`loadExclusionsDoc`/`loadIndexDoc`, each with its own literal URL and independent try/catch, which satisfies the grep while preserving `loadExclusionState`'s never-throw discipline in all three.
- **`recomputeInFlight` as a module-scope `let`**, per D-13's explicit instruction, guarding re-entry by ignoring clicks rather than disabling the button — matches `mountCurationControls`'s established rejection of `disabled` controls (Phase 19 CR-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two literal-substring source-comment collisions with their own guard's grep patterns**
- **Found during:** Task 2 (first acceptance-criteria run)
- **Issue:** The file's own docblock prose named the forbidden DOM APIs (`` `innerHTML` ``, `` `insertAdjacentHTML` `` etc.) and the phrase "receives a `className`" verbatim in comments, so `grep -c "innerHTML\|insertAdjacentHTML\|outerHTML\|document.write"` and `grep -c "className"` matched the documentation itself, not just the (absent) code usage — inflating both counts past what the acceptance criteria allow (0 and exactly 1, respectively).
- **Fix:** Reworded both comment blocks to describe the same discipline without literally spelling the forbidden tokens (e.g. "no HTML-string assignment of any kind" instead of naming `innerHTML`; "receives a class name" instead of `` `className` ``).
- **Files modified:** `scripts/curate-queue/index.ts`
- **Verification:** Re-ran both greps: `innerHTML|insertAdjacentHTML|outerHTML|document.write` → 0, `className` → 1 (the single real assignment inside `createQueueMain`).
- **Committed in:** `32974ade` (Task 2's own commit — caught before commit, not a follow-up fix)

**2. [Rule 1 - Bug] A third instance of the same collision, introduced by Task 3's own new comment**
- **Found during:** Task 3 (acceptance-criteria run)
- **Issue:** A new Task 3 comment explaining the Recompute wiring wrote out the literal route path `/__curate/recompute`, which collided with the Task 2 acceptance criterion `grep -c "/__curate/exclusions\|/__curate/recompute" scripts/curate-queue/index.ts` returns `0` (no second write call site) — the comment made that check read `1` even though no actual fetch call was added.
- **Fix:** Reworded the comment to say "the existing recompute POST route" instead of spelling the literal path.
- **Files modified:** `scripts/curate-queue/index.ts`
- **Verification:** Re-ran the grep: `0`.
- **Committed in:** `4fc5093e` (Task 3's own commit)

**3. [Rule 1 - Bug in the plan's own verify script] Task 3's literal bundle-substring check is unsatisfiable given `curate-overlay/index.ts`'s existing (out-of-scope) structure**
- **Found during:** Task 3 verification
- **Issue:** Task 3's `<verify>` command checks the esbuild bundle for the literal substrings `/__curate/exclusions/` and `/__curate/recompute`. `curate-overlay/index.ts` (Phase 24, not in this plan's `files_modified`) builds its fetch URLs as `` `${CURATE_PREFIX}/exclusions/...}` `` and `` `${CURATE_PREFIX}/recompute` `` — esbuild's bundler does not fold the `CURATE_PREFIX` variable into the surrounding template-literal text (confirmed independent of any change in this plan, by bundling `curate-overlay/index.ts` alone, with and without `--minify`: neither literal substring appears in either output; `location.reload` does appear in both). This means the check as literally written would fail regardless of what this plan's own file contains, since the missing substrings originate entirely from a file this plan must not modify (D-10 requires importing the transport, never touching or reimplementing it).
- **Fix:** Verified the same underlying guarantee — the bundle genuinely contains the real transport's route construction and its `location.reload`, not a reimplementation — with a corrected check: `CURATE_PREFIX = "/__curate"` is present, plus regex matches for `` CURATE_PREFIX}/exclusions/ `` and `` CURATE_PREFIX}/recompute `` (accounting for the template-literal boundary esbuild preserves), plus the literal `location.reload`. All four passed. Combined with the source-level grep (`0` for both `/__curate/...` literals and `location.reload` in `index.ts` itself), this proves the same CUR-02 guarantee the plan's check intended.
- **Files modified:** None (verification-only; no source change was needed or made)
- **Verification:** See the corrected check's output in this session — `CURATE_PREFIX constant present: true`, `exclusions route suffix present: true`, `recompute route suffix present: true`, `location.reload present: true`.
- **Committed in:** N/A (deviation is documentation-only; no commit required beyond this SUMMARY)

## Issues Encountered

- **Fresh-worktree `node_modules` absent.** `npm install` failed on `sqlite3`'s native build (Xcode license not accepted on this machine, unrelated to this plan). Symlinked `node_modules` from the primary checkout (`/Users/pedf/workspace/strava-widgets/node_modules`) instead — read-only reference, nothing written to the primary checkout, and `node_modules/` is gitignored so this symlink is never committed.
- Full `npx vitest run` in this worktree shows the same 10 pre-existing failing files documented in `29-04-SUMMARY.md` (`ENOENT` on `data/stats/*.json` / `data/dashboard/index.json`, a fresh worktree's partially-mirrored `data/` tree) — none of them touch `scripts/curate-queue/`. All 2,193 other tests pass, 0 new failures introduced by this plan's files. `scripts/curate-queue/format.test.mjs` (13/13), `scripts/curate-queue/derive-flagged.test.mjs` (25/25) and `scripts/curate-overlay.test.mjs` (13/13, this plan's closest structural analog/guard) all green in isolation.

## User Setup Required

None - no external service configuration required. (Note for the next agent picking up this worktree or the merged tree: if `sqlite3`'s native module is needed for a script this plan doesn't touch, `sudo xcodebuild -license` must be accepted first on this machine — unrelated to this phase.)

## Next Phase Readiness

- `scripts/curate-queue/index.ts` and `scripts/curate-queue/format.mjs` are ready for plan 29-06 to serve: the bundle target is `/__curate/queue.js` (esbuild `--bundle --format=iife --target=es2020` over `scripts/curate-queue/index.ts`, mirroring `buildOverlay()`'s shape), and the page needs a `<main>`-mounting HTML shell linking the dashboard's built stylesheet plus a `<script src="/__curate/queue.js">` tag.
- CUR-01 and CUR-02 are **not** ticked by this plan (`requirements-completed: []`) — this client cannot be reached without plan 29-06's server routes, and per this project's established convention (Phase 19/24/25 precedent), a requirement ticks only after a real browser checkpoint confirms it, not at the plan that merely builds the client code. `.planning/REQUIREMENTS.md` still correctly shows CUR-01/CUR-02/CUR-03 as `Pending`.
- No blockers for plan 29-06. The three imports this plan's client needs (`deriveFlaggedActivities`/`summarizeQueue`/`buildPrefillReason` from plan 29-04; `saveExclusion`/`removeExclusion`/`runRecompute` from Phase 24's overlay) are all stable, already-shipped exports — no further changes to either module are needed by this plan.

---
*Phase: 29-curation-review-queue*
*Completed: 2026-09-18*

## Self-Check: PASSED

- `scripts/curate-queue/format.mjs` — FOUND
- `scripts/curate-queue/format.test.mjs` — FOUND
- `scripts/curate-queue/index.ts` — FOUND
- `.planning/phases/29-curation-review-queue/29-05-SUMMARY.md` — FOUND
- Task 1 RED commit `1dfb974f` — FOUND
- Task 1 GREEN commit `f532da2a` — FOUND
- Task 2 commit `32974ade` — FOUND
- Task 3 commit `4fc5093e` — FOUND
- `npx vitest run scripts/curate-queue/format.test.mjs` → 13/13 passed
- `npx esbuild scripts/curate-queue/index.ts --bundle --format=iife --target=es2020` → exits 0, no `innerHTML` in bundle
