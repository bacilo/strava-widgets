---
phase: 25-ci-hardening-light-theme-verification
plan: 04
subsystem: testing
tags: [vitest, fs, error-handling, curation-guard, fail-closed]

# Dependency graph
requires:
  - phase: 24-local-curation-mode
    provides: findCurationArtifacts (curation-guard.mjs), the readFileSync try/catch shape this plan mirrors, and the WR-14 fixture family this plan extends
provides:
  - "walk()'s readdirSync guarded against EACCES/ENOENT-class throws, converting them into attributed violations instead of an uncaught crash"
  - "the mode-000-directory fixture (case (f)) closing the WR-19 gap in curation-guard.test.mjs's regression coverage"
  - "WR-19 closed in .planning/todos/completed/; IN-17/IN-18 split into their own pending todo"
affects: [25-ci-hardening-light-theme-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "readdirSync hoisted out of a for...of header into a try/catch-guarded assignment, mirroring the existing readFileSync catch shape, so a directory-list failure reports the SAME way a file-read failure does"

key-files:
  created: []
  modified:
    - scripts/lib/curation-guard.mjs
    - scripts/lib/curation-guard.test.mjs
    - .planning/todos/completed/2026-09-02-wr19-curation-guard-directory-eacces.md
    - .planning/todos/pending/2026-09-02-in17-in18-curation-guard-cosmetics.md

key-decisions:
  - "No architectural change needed — the fix is the directory-shaped mirror of the existing WR-14 file-read try/catch, applied at the one remaining unguarded readdirSync call"

patterns-established:
  - "A directory-list failure and a file-read failure inside the same walk() now read as one defensive pattern applied twice: hoist the fs call out of any loop/comprehension header, try/catch it, push a violation object shaped { path, reason }, and only then continue/return — never swallow-and-continue-as-clean"

requirements-completed: []  # WR-19 is a folded todo, not CI-02. This plan does not discharge CI-02.

duration: ~25min
completed: 2026-09-04
---

# Phase 25 Plan 04: Directory-shaped EACCES guard for the curation-artifact scanner Summary

**`findCurationArtifacts`'s `walk()` no longer throws an uncaught EACCES on an unreadable directory — it reports an attributed violation and stays fail-closed, closing the folded todo WR-19.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-04
- **Tasks:** 3 (Task 1 RED fixture, Task 2 GREEN fix, Task 3 todo closure)
- **Files modified:** 4 (curation-guard.mjs, curation-guard.test.mjs, 1 todo moved, 1 todo created)

## Accomplishments

- `walk(dir)`'s `readdirSync(dir, { withFileTypes: true })` is hoisted out of the `for...of` header into a guarded assignment; a throw is caught, converted into `violations.push({ path: dir, reason: 'could not be listed (...) — ...' })`, and the function returns without descending — mirroring the existing `readFileSync` catch's shape and wording exactly, per the plan's interfaces block.
- A new fixture (`curation-guard.test.mjs` case (f)) plants a mode-000 directory with an ordinary file inside it (planted BEFORE the chmod, so the failure is provably on listing, not content) and was observed throwing an UNCAUGHT `EACCES: permission denied, scandir` against the unfixed guard — the D-11 RED precedent — before flipping green against the fix.
- Fail-closed proof: a planted mode-000 directory under the REAL `dist/widgets` tree made `npm run build-widgets` exit 1, naming that directory via `✗ Curation-artifact guard failed: ... — could not be listed (EACCES) ...`; after `chmod 0700` + `rm -rf` the build returned to exit 0.
- WR-19 moved to `.planning/todos/completed/` via `git mv` (history preserved, confirmed by `git log --follow`), with a dated resolution section recording the fix commit, fixture name, and the verbatim pre-fix RED text. IN-17/IN-18, raised by the same wave-9 review, were split into a new pending todo (`2026-09-02-in17-in18-curation-guard-cosmetics.md`) before the move, so they were not silently closed alongside WR-19 — per `25-CONTEXT.md`'s Deferred Ideas.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the mode-000-directory fixture and observe it RED** - `56e31c19` (test)
2. **Task 2: Wrap walk()'s readdirSync in the sibling try/catch** - `b20af51a` (feat)
3. **Task 3: Close the WR-19 todo** - `ea6ee8d8` (docs), corrected by `92ce3de3` (fix) — see Deviations

_No TDD REFACTOR commit was needed — the GREEN implementation matched the sibling pattern with no follow-up cleanup._

## Files Created/Modified

- `scripts/lib/curation-guard.mjs` - `walk()`'s `readdirSync` hoisted into a try/catch; catch pushes a `could not be listed (...)` violation naming the directory and returns; module docblock extended to cite WR-19
- `scripts/lib/curation-guard.test.mjs` - new case (f) mode-000-directory fixture in the WR-14 describe block; that block's `afterEach` extended to restore `0o700` on the new fixture path before recursive removal
- `.planning/todos/completed/2026-09-02-wr19-curation-guard-directory-eacces.md` - moved from `pending/` via `git mv`, with an appended dated resolution section
- `.planning/todos/pending/2026-09-02-in17-in18-curation-guard-cosmetics.md` - new file, split out of the WR-19 trailer, carrying IN-17/IN-18 verbatim plus the deferral note

## D-11 RED observation

Task 1's fixture, run against the unfixed guard (before Task 2's change to `curation-guard.mjs`), produced an UNCAUGHT throw — not a clean assertion mismatch:

```
FAIL scripts/lib/curation-guard.test.mjs > WR-14 — non-regular and unreadable entries are reported, never thrown > (f) mode-000 directory: reported via the readdir try/catch, citing EACCES (WR-19) — the directory-shaped sibling of case (c)
Error: EACCES: permission denied, scandir '/var/folders/lr/1kcx1pmd27sg98ghw6nmwf2m0000gn/T/curation-guard-wr14-AbMufq/wr19-locked-dir'
 ❯ walk scripts/lib/curation-guard.mjs:83:36
    81|
    82|  function walk(dir) {
    83|    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      |                                   ^
    84|      const entryPath = resolve(dir, entry.name);
 ❯ walk scripts/lib/curation-guard.mjs:101:9
 ❯ findCurationArtifacts scripts/lib/curation-guard.mjs:175:3
 ❯ scripts/lib/curation-guard.test.mjs:289:45

 Test Files  1 failed (1)
      Tests  1 failed | 21 passed | 1 skipped (23)
```

Exactly one test failed (the new fixture); cases (a)-(e) and (g), plus every other test in the file, were unregressed. `git diff --name-only` at that point showed only `curation-guard.test.mjs` modified — `curation-guard.mjs` was untouched, per D-11's precedent that a guard only counts once observed red against the unfixed code.

Post-fix (Task 2): `npx vitest run scripts/lib/curation-guard.test.mjs` — 22 passed / 1 skipped (the whole-tree regression test, `describe.skipIf(!existsSync(DIST_WIDGETS_INDEX_HTML))`, was skipped only because `dist/widgets/index.html` did not yet exist at that point in the run; it passed once the tree existed later in the session).

## Fail-closed proof

A mode-000 directory was planted directly under the real `dist/widgets` tree (not a fixture/tmpdir) and `npm run build-widgets` run against it:

**Before cleanup — exit 1, attributed:**
```
✗ Curation-artifact guard failed: /Users/pedf/workspace/strava-widgets/.claude/worktrees/agent-abc376340f858ac00/dist/widgets/wr19-negative-check — could not be listed (EACCES) — an unreadable directory cannot be certified free of the "__curate" marker
```
(confirmed via a separate `echo $?` capture: `REAL_EXIT_CODE=1`)

**After `chmod 0700` + `rm -rf` cleanup — exit 0, clean:**
```
✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.

Widget library build complete!
Output: dist/widgets/ (widgets, pages, and the dashboard SPA)
```
(`REAL_EXIT_CODE=0`)

This is the operator-experience improvement WR-19 exists for: the crash is now attributed to the specific unreadable directory, not an unattributed `Widget build failed: EACCES`.

## Decisions Made

None - followed the plan's interfaces block exactly (the fix is a direct structural mirror of the existing `readFileSync` try/catch, per the plan's explicit "do not re-derive" instruction).

## Deviations from Plan

**1. [Documentation note, not a deviation requiring a fix] `dist/widgets` does not currently publish 22 `.d.ts` files in this worktree's build.**
- **Found during:** Task 2's whole-tree verification step
- **Observation:** The plan's acceptance criteria (echoing `24-11-SUMMARY.md`'s historical count) expected "22 `.d.ts` files still scanned, zero violations." A fresh `npm run build-widgets` in this worktree produced 0 `.d.ts` files (`find dist/widgets -name "*.d.ts" | wc -l` → 0); the tree instead contains 3760 `.json`, 18 `.js`, 6 `.html`, and 2 `.css` files. No `.d.ts` generation step exists anywhere in `build-widgets.mjs`, `vite.config.ts`, or `vite.config.pages.ts` — this is an environmental/build-state discrepancy pre-dating this plan, not something Task 2's restructure caused or could have caused (the restructured code path runs identically regardless of file extension mix).
- **Action taken:** None — out of scope for WR-19 (a directory-listing EACCES defect), not a Rule 1-3 trigger (nothing is broken; the guard scans whatever files exist and correctly returns `[]`). Documented here rather than fixed, per the scope-boundary rule.
- **Verification:** `npm run build-widgets` still exits 0 with the green `✓ Curation-artifact scan` line, proving the restructure did not change whole-tree behavior for whatever file set the tree actually contains.
- **Files modified:** None.

**2. [Rule 1 - Bug] Task 3's commit `ea6ee8d8` did not contain the file content it was staged from**
- **Found during:** Post-plan self-verification pass, after all three task commits and the SUMMARY commit
- **Issue:** `git mv` staged the WR-19 todo's rename, and the two `Edit` calls that (a) appended the dated resolution section and (b) reworded the IN-17/IN-18 trailer to remove the literal strings both reported success and were confirmed on disk via `grep -c` immediately afterward. `git status --short` was clean after the `ea6ee8d8` commit. However, a later `git status --short` (after the SUMMARY commits) unexpectedly showed the completed todo file as modified again, and `git show ea6ee8d8:<path>` proved the committed blob still carried the PRE-edit trailer (including the literal `IN-17`/`IN-18` strings the acceptance criterion required to be absent) — the resolution section was entirely missing from that commit's tree, despite being present and correctly edited on disk both before and after.
- **Fix:** Re-staged and committed the correct on-disk content in a new commit (`92ce3de3`), which `git show HEAD:<path>` confirms now matches the intended resolution section, with zero `IN-17`/`IN-18` string matches.
- **Files modified:** `.planning/todos/completed/2026-09-02-wr19-curation-guard-directory-eacces.md`
- **Verification:** `grep -c "IN-17\|IN-18" .planning/todos/completed/2026-09-02-wr19-curation-guard-directory-eacces.md` → 0; `git show HEAD:<path> | grep -c "Closed 2026-09-04"` → 1; `git status --short` clean; `git log --follow --oneline -1 -- <path>` still resolves to the corrected commit, confirming rename history survived the correction.
- **Committed in:** `92ce3de3`

---

**Total deviations:** 1 auto-fixed (Rule 1 — a commit whose tree silently diverged from its intended content); 1 documentation-only observation (no code or scope impact).
**Impact on plan:** The Rule 1 fix was necessary to satisfy Task 3's own acceptance criterion (zero `IN-17`/`IN-18` matches in the completed file) and to keep the completed todo consistent with this SUMMARY's account. No scope creep — same file, same intended content, just re-committed correctly. The `.d.ts` count discrepancy does not affect WR-19's fix, its fixture, or its fail-closed proof, all three of which are verified above against whatever the real tree currently contains.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WR-19 is fully closed; the curation guard's two `readFileSync`/`readdirSync` sites now share one defensive pattern, both fail-closed, both attributed.
- IN-17/IN-18 remain open and pending, as `25-CONTEXT.md`'s Deferred Ideas requires — no action needed from this phase.
- `requirements-completed` is intentionally empty; CI-02 is untouched by this plan and stays wherever plan 25-03 left it.
- The `.d.ts`-count discrepancy noted above is worth a glance if a future plan's acceptance criteria assumes a specific `dist/widgets` file census — it is environment-dependent, not code-dependent.

---
*Phase: 25-ci-hardening-light-theme-verification*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: `scripts/lib/curation-guard.mjs`
- FOUND: `scripts/lib/curation-guard.test.mjs`
- FOUND: `.planning/todos/completed/2026-09-02-wr19-curation-guard-directory-eacces.md`
- FOUND: `.planning/todos/pending/2026-09-02-in17-in18-curation-guard-cosmetics.md`
- CONFIRMED: WR-19 no longer present in `.planning/todos/pending/`
- FOUND commit `56e31c19` (Task 1) in `git log`
- FOUND commit `b20af51a` (Task 2) in `git log`
- FOUND commit `ea6ee8d8` (Task 3) in `git log`
- FOUND commit `e53675f4` (SUMMARY.md) in `git log`
- FOUND commit `92ce3de3` (Rule 1 fix, restoring the WR-19 resolution section) in `git log`
- RE-VERIFIED: `git show HEAD:.planning/todos/completed/2026-09-02-wr19-curation-guard-directory-eacces.md` contains the resolution section and zero `IN-17`/`IN-18` matches; `git status --short` is clean
