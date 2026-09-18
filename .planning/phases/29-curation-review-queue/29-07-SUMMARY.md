---
phase: 29-curation-review-queue
plan: 07
subsystem: curation
tags: [curation, review-queue, nav-injection, source-structure-guard, tdd-style-pin]

# Dependency graph
requires:
  - phase: 29-curation-review-queue plan 05
    provides: "scripts/curate-queue/index.ts (the queue page browser client), scripts/curate-queue/derive-flagged.mjs, scripts/curate-queue/format.mjs — this plan pins their structure, never edits derive-flagged.mjs or format.mjs"
  - phase: 24-local-curation-mode
    provides: "scripts/curate-overlay/index.ts's existing module-scope 'dashboard:best-efforts-mounted' listener and scripts/curate-overlay.test.mjs's stripComments/describe-block shape, both extended by this plan"
provides:
  - "scripts/curate-overlay/index.ts — a second module-scope DOMContentLoaded listener injecting a 'Review queue' nav link (D-07), reachable from every curate-served dashboard page"
  - "scripts/curate-overlay.test.mjs — the listener-count pin corrected to an exact, named count of two, plus a new D-07 block pinning the queue route/link-text/selector literals"
  - "scripts/curate-queue.test.mjs — a new source-structure guard for the queue client, pinning D-10 (transport reuse), D-08 (read-only mirrored JSON), D-09/OD-3 (zero styling), D-01 (no guard-literal re-filtering) and D-04 (no pace-quality signal), plus the D-01 structural-absence check over the four publish-pipeline config files"
affects:
  - "plan 29-08 (human browser checkpoint) — the nav link this plan builds is the actual entry-point gesture that checkpoint exercises; the source guards here are static evidence, not a substitute for it"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exact-named-count listener pin: an addEventListener( count assertion alone would pass a swap of one listener for another with the same total; naming both expected event strings closes that hole, proven by a scratch third listener making the count assertion fail on its own (3 != 2)"
    - "Scratch-reimplementation discrimination proof, mirrored a second time: Phase 24/29-05 already established watching a structural guard fail against a planted defect before trusting it green; this plan applies the same discipline to a brand-new guard file (curate-queue.test.mjs) rather than only an edited one"

key-files:
  created:
    - scripts/curate-queue.test.mjs
  modified:
    - scripts/curate-overlay/index.ts
    - scripts/curate-overlay.test.mjs

key-decisions:
  - "Docblock prose describing the new listener's rationale had to avoid the literal token 'MutationObserver' (first draft used it in a sentence and immediately self-tripped the file's own forbidden-API grep, returning 1 instead of 0) — reworded to describe the discipline without the literal name, following the same pattern 29-05-SUMMARY.md already documented for innerHTML/className"
  - "The nav link's href and text are written as plain literal strings ('/__curate/queue', 'Review queue') rather than built from the existing CURATE_PREFIX constant — Task 2's D-07 test block asserts the literal quoted substring '/__curate/queue' is present in the stripped source, which a template-literal construction (as CURATE_PREFIX's existing exclusions/recompute URLs already are) would not satisfy; this mirrors 29-05-SUMMARY.md's Deviation 3, where the same template-literal-vs-literal-substring gap was already found and worked around on the read side"
  - "Task 3's D-09 className-count assertion counts `className\\s*=` occurrences rather than an exact-string match on `className = 'curate-`, since the queue client's one real assignment is `main.className = 'curate-queue'` — a different literal shape than the overlay's own `'curate-` prefix convention. Confirmed exactly 1 via the live source before writing the assertion, not inferred from the plan text alone."

patterns-established:
  - "A guard file created new in this plan (not just an edited existing one) still gets its own discrimination proof before being trusted — the meta-test proves the stripper, and the scratch scratchDirectWrite() edit proves the D-10 block, both executed and reverted with a git diff --stat check before the file was ever staged."

requirements-completed: []

# Metrics
duration: "~25min"
completed: 2026-09-18
---

# Phase 29 Plan 07: Nav-Link Injection & Queue Client Source Guard Summary

A "Review queue" link the overlay injects into the live dashboard nav DOM on every curate-served page (D-07), plus a collected, demonstrably-failable source-structure guard (`scripts/curate-queue.test.mjs`) pinning the queue client's transport-reuse, read-only-mirrored-JSON, zero-styling and structural-absence guarantees.

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-18T11:50:00Z (approx, after worktree branch check + node_modules symlink)
- **Completed:** 2026-09-18T12:15:00Z
- **Tasks:** 3
- **Files modified:** 3 (`scripts/curate-overlay/index.ts`, `scripts/curate-overlay.test.mjs`, `scripts/curate-queue.test.mjs`)

## Accomplishments

- Task 1 added a second module-scope `DOMContentLoaded` listener to `scripts/curate-overlay/index.ts` that finds `#app-nav-root .app-nav__links`, no-ops silently when the nav root is absent or a `/__curate/queue` link is already present, and otherwise appends `<li><a class="app-nav__link" href="/__curate/queue">Review queue</a></li>` via `createElement`/`textContent`/`appendChild` only. Extended the module docblock to document D-07's rationale and the verified script-ordering guarantee (classic script before deferred module script's `createNav(...)`, both before `DOMContentLoaded`) — worded to avoid the literal `MutationObserver` token the file's own forbidden-API guard scans for.
- Task 2 observed the pre-existing one-listener pin fail RED (`expected 2 to be 1`) immediately after Task 1 landed, then updated it to an exact-count-of-two assertion that also names both expected listeners (`'dashboard:best-efforts-mounted'` and `'DOMContentLoaded'`), added a new `D-07` describe block pinning the queue route, link text, and nav selector literals, and proved the updated pin still discriminates by adding a scratch third `click` listener (count went to 3, assertion failed with `expected 3 to be 2`), then reverting it (confirmed 14/14 green, `git diff --stat` on `index.ts` clean).
- Task 3 created `scripts/curate-queue.test.mjs`, mirroring `curate-overlay.test.mjs`'s shape: a leading meta-test proving `stripComments` removes a forbidden token from both `//` and `/* */` comment forms, then six blocks (D-10/CUR-02 transport reuse, D-08 read-only mirrored JSON, D-09/OD-3 zero styling, D-01 no guard-literal re-filtering, D-04 no pace-quality signal, D-01 structural absence over the four publish-pipeline config files). Proved the D-10 block discriminates by temporarily replacing the transport import's effect with a scratch `fetch('/__curate/exclusions/' + id)` call (assertion failed: `expected true to be false`), then reverting it (confirmed 12/12 green, `index.ts` diff-clean).

## Task Commits

Each task was committed atomically:

1. **Task 1: Inject the "Review queue" nav link (D-07)** — `83eefdb8` (feat)
2. **Task 2: Update the overlay's source guard honestly** — `8caee917` (test)
3. **Task 3: Source-structure guard for the queue client** — `51836be8` (test)

No plan-metadata commit in this worktree — SUMMARY.md is committed separately per worktree-mode instructions (STATE.md/ROADMAP.md are excluded; the orchestrator owns those writes after merge).

## Files Created/Modified

- `scripts/curate-overlay/index.ts` — added the module-scope `DOMContentLoaded` nav-link injector (never-throw on missing nav, no-op on double-mount) and extended the module docblock.
- `scripts/curate-overlay.test.mjs` — corrected the listener-count pin to an exact, named count of two; added a `D-07` block pinning the queue route, link text and nav selector literals.
- `scripts/curate-queue.test.mjs` (new, 133 lines) — the queue client's source-structure guard: stripper meta-test plus D-10/D-08/D-09/D-01/D-04 and the D-01 structural-absence block.

## Decisions Made

- **MutationObserver named in prose broke the file's own guard:** the first docblock draft for Task 1 spelled out "the listener choice over a `MutationObserver` rests on..." — this made `grep -c "MutationObserver\|setInterval\|setTimeout" scripts/curate-overlay/index.ts` return 1 instead of the required 0, since the acceptance criteria greps raw source including comments. Reworded to describe the discipline ("a DOM watcher of any kind") without the literal token, following the same avoidance pattern 29-05-SUMMARY.md already documented for `innerHTML`/`className`.
- **Nav link href/text as plain literals, not built via `CURATE_PREFIX`:** Task 2's D-07 block requires the stripped source to contain the literal quoted substring `'/__curate/queue'`. The existing `CURATE_PREFIX` constant (used for the write transport's own URLs) is interpolated via template literals, which esbuild does not fold into a matching literal substring in the bundle (the exact issue 29-05-SUMMARY.md's Deviation 3 already documented on the read side). Writing `link.href = '/__curate/queue';` as a plain string literal satisfies the test directly and keeps the two constructions (transport URLs vs. this one nav href) independently readable.
- **`className\s*=` regex over an exact `className = 'curate-` string match:** the queue client's one real class assignment is `main.className = 'curate-queue'`, spelled differently from the overlay's own `'curate-` prefix convention pinned in `curate-overlay.test.mjs`. Verified via direct grep (count = 1) before writing the assertion as a general `className\s*=` occurrence count, rather than assuming the overlay's exact string shape transfers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the plan's own action text] Literal `MutationObserver` token in new docblock prose self-tripped the forbidden-API guard**
- **Found during:** Task 1 acceptance-criteria run
- **Issue:** `grep -c "MutationObserver\|setInterval\|setTimeout" scripts/curate-overlay/index.ts` returned 1 (required 0) because the new docblock sentence explaining the D-07 rationale spelled out `MutationObserver` by name — exactly the collision 29-05-SUMMARY.md already documented for other forbidden-API literals appearing in prose rather than code.
- **Fix:** Reworded the sentence to describe the discipline ("a DOM watcher of any kind") without the literal token.
- **Files modified:** `scripts/curate-overlay/index.ts`
- **Verification:** Re-ran the grep: `0`. Bundle still contains `Review queue` (esbuild exit 0).
- **Committed in:** `83eefdb8` (Task 1's own commit — caught before commit, not a follow-up fix)

None of the other deviation rules applied; the remaining acceptance criteria and discrimination checks matched the plan's action text exactly on first attempt.

## Issues Encountered

- **Fresh-worktree `node_modules` absent (same as every prior wave in this worktree).** Symlinked `node_modules` from the primary checkout (`/Users/pedf/workspace/strava-widgets/node_modules`) — read-only reference, gitignored, never committed.
- **`npm test` exits 1** in this worktree due to the same 10 pre-existing failing files documented in `29-05-SUMMARY.md` and `29-04-SUMMARY.md` (`ENOENT` on `data/stats/*.json` / `data/dashboard/index.json` / `dist/widgets/...` — a fresh worktree's partially-mirrored `data/`/`dist/` tree, an environment limitation unrelated to this plan). All three of this plan's own test files (`scripts/curate-overlay.test.mjs` 14/14, `scripts/curate-queue.test.mjs` 12/12) and the two Wave 3 files this plan depends on (`scripts/curate-queue/format.test.mjs` 13/13, `scripts/curate-queue/derive-flagged.test.mjs` 25/25) all pass green in the full run. 2206 of 2241 total tests pass (35 skipped, 0 new failures); the orchestrator re-runs the full suite on the primary checkout after merge, per the environment notes given to this agent.
- No other issues. `git diff --stat src/` is empty (D-06 held throughout).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both source guards (`scripts/curate-overlay.test.mjs`'s updated listener pin plus new D-07 block, and the new `scripts/curate-queue.test.mjs`) are collected by `vitest run` and pass green (14/14 and 12/12 respectively), each discrimination-proven by a scratch edit before being trusted.
- CUR-01 and CUR-02 are **not** ticked by this plan (`requirements-completed: []`) — per this project's established convention (Phase 19/24/25/29-05 precedent), a requirement ticks only after plan 29-08's real browser checkpoint confirms the nav link is actually reachable and clickable in a running `npm run curate` session, not at a plan that only builds the injector and pins its source shape.
- No blockers for plan 29-08. The nav link is source-complete and its href/text/selector are pinned; the checkpoint's job is to click it from a real dashboard page and confirm it lands on `/__curate/queue`.
- Confirmed unmodified by this plan, per the sibling-agent boundary in this agent's instructions: `scripts/curate-server.mjs` and `scripts/curate-server.test.mjs` were not read or touched.

---
*Phase: 29-curation-review-queue*
*Completed: 2026-09-18*

## Self-Check: PASSED

- `scripts/curate-overlay/index.ts` — FOUND
- `scripts/curate-overlay.test.mjs` — FOUND
- `scripts/curate-queue.test.mjs` — FOUND
- `.planning/phases/29-curation-review-queue/29-07-SUMMARY.md` — FOUND
- Task 1 commit `83eefdb8` — FOUND
- Task 2 commit `8caee917` — FOUND
- Task 3 commit `51836be8` — FOUND
- SUMMARY commit `f9f21928` — FOUND
- `npx vitest run scripts/curate-overlay.test.mjs` → 14/14 passed
- `npx vitest run scripts/curate-queue.test.mjs` → 12/12 passed, `Test Files 1 passed`
- `npm test` → 2206 passed, 0 new failures (10 pre-existing fresh-worktree ENOENT failures, unrelated to this plan)
- `git diff --stat src/` → empty (D-06 held)
