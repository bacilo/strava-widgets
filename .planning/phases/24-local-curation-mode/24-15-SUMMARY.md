---
phase: 24-local-curation-mode
plan: 15
subsystem: build
tags: [tdd, security, dos, symlink, tarpit, curation-guard, vitest]

# Dependency graph
requires:
  - phase: 24-local-curation-mode
    provides: "curation-guard.mjs's UNSCANNED_EXTENSIONS skip-list inversion (24-11, closing GAP-24-02)"
provides:
  - "findCurationArtifacts's walk reports non-regular and unreadable entries as violations instead of throwing or hanging"
  - "an entry.isFile() gate ordered before the UNSCANNED_EXTENSIONS skip, so a .json-named symlink cannot smuggle past the scan"
  - "a readFileSync try/catch that converts EACCES (and any other read failure) into an attributed violation"
  - "an attributed '✗ Curation-artifact guard failed: <path> — not a regular file' operator message, replacing the prior unattributed 'Widget build failed: ENOENT/EISDIR'"
affects: [24-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isFile() gate before a content-scan read, ordered before extension-based skips, so an exemption cannot be used to bypass a type check"
    - "readFileSync wrapped in try/catch inside a pure scanner function, converting read failures into returned violations rather than thrown exceptions"

key-files:
  created: []
  modified:
    - scripts/lib/curation-guard.mjs
    - scripts/lib/curation-guard.test.mjs
    - .planning/phases/24-local-curation-mode/deferred-items.md

key-decisions:
  - "FIFO case has no pre-fix RED run (D-11's one documented exception) — a pre-fix readFileSync on a FIFO blocks forever, which is the defect itself; disclosed explicitly in the test name and here"
  - "Docblock amendment corrected mid-task: initial wording used the literal string entry.isFile() in prose, which broke Task 2's grep -c 'entry.isFile()' == 1 acceptance criterion; reworded to a paraphrase so the source-code gate is the only match"

patterns-established:
  - "A non-regular-entry gate (isFile) must be ordered strictly before any extension-based exemption, with a test pinning that relative order in the source (not just behavior), so a future exemption change cannot silently reopen the bypass"

requirements-completed: [CUR-01]

# Metrics
duration: ~15min
completed: 2026-09-02
---

# Phase 24 Plan 15: Guard curation-guard.mjs against non-regular and unreadable entries (WR-14) Summary

**Added an `entry.isFile()` gate and a `readFileSync` try/catch to `findCurationArtifacts`'s walk, converting four throw classes (ENOENT/EISDIR/EACCES) and one hang class (FIFO) into reported violations, then proved the operator-facing message changed from an unattributed `Widget build failed: ENOENT` to an attributed `✗ Curation-artifact guard failed: <path>` against the real `dist/widgets` tree.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-09-02
- **Tasks:** 2
- **Files modified:** 3 (2 source/test files + 1 deferred-items log)

## Accomplishments

- Closed **WR-14**: the curation-guard's walk no longer throws on a dangling symlink (`ENOENT`), a symlink to a directory (`EISDIR`), or a mode-000 file (`EACCES`), and no longer hangs forever on a FIFO — all five classes now return a violation from the pure `findCurationArtifacts` function.
- Pinned the `isFile()` gate's position strictly BEFORE the `UNSCANNED_EXTENSIONS` skip in source order (via an `awk` acceptance check and a `.json`-named-symlink test), so the load-bearing `.json` exemption can never be used to smuggle a non-regular entry past the scan.
- Proved the build-level operator message live against the real `dist/widgets` publish tree: the same planted symlink that previously crashed the build with an unattributed `Widget build failed: ENOENT/EISDIR` now produces an attributed `✗ Curation-artifact guard failed: <path> — not a regular file` line, and the guard's baseline/clean-rerun asset filenames matched exactly.
- Closes **GAP-24-05 item 2** (of the amended three-item round).

## Task Commits

Each task was committed atomically:

1. **Task 1: Plant every WR-14 class as a failing test, observe RED, then add the isFile gate and read try/catch** - `8a1ec56` (fix, tdd)
2. **Task 2: Prove the operator-facing message at the build level in the REAL dist/widgets** - `049d346` (docs — no functional source change; also folds in a self-inflicted docblock-grep-collision fix)

_Note: Task 2's own module diff is a fix (the docblock-wording correction found via its own acceptance check), committed under a `docs` prefix because the task's primary deliverable is proof/documentation, not new behavior — the module's behavior is byte-identical before and after the docblock reword._

## Files Created/Modified

- `scripts/lib/curation-guard.mjs` - Added the `entry.isFile()` gate (reason: `not a regular file — the published bundle must contain only regular files and directories`) and a `readFileSync` try/catch (reason: `could not be read for scanning (${error.code ?? error.message}) — an unscannable file cannot be certified free of the "${CURATE_MARKER}" marker`), both ordered between the `.curate-dist` name check and the `UNSCANNED_EXTENSIONS` skip. Amended the docblock's deviation 3 to state that `latin1` makes the decode total but not the read, and that non-regular/unreadable entries are now reported rather than read.
- `scripts/lib/curation-guard.test.mjs` - Added a `describe('WR-14 — non-regular and unreadable entries are reported, never thrown', …)` block with 6 tests covering cases (a)-(e) and (g); updated the shared `afterEach` to `chmodSync(…, 0o600)` a mode-000 fixture before removal.
- `.planning/phases/24-local-curation-mode/deferred-items.md` - Logged the recurring pre-existing worktree data gap (see Deviations below), matching the pattern already logged for plans 24-01, 24-02, 24-12 and 24-13.

## Verbatim RED Observations (D-11, Task 1c)

Run against the still-unmodified (pre-fix) module, `npx vitest run scripts/lib/curation-guard.test.mjs`:

**(a) Dangling symlink:**
```
Error: ENOENT: no such file or directory, open '/var/folders/.../curation-guard-wr14-nGqUiX/wr14-dangling.js'
 ❯ walk scripts/lib/curation-guard.mjs:124:35
```

**(b) Symlink to a directory:**
```
Error: EISDIR: illegal operation on a directory, read
 ❯ walk scripts/lib/curation-guard.mjs:124:35
```

**(c) Mode-000 regular file:**
```
Error: EACCES: permission denied, open '/var/folders/.../curation-guard-wr14-8EfX3J/wr14-secret.js'
 ❯ walk scripts/lib/curation-guard.mjs:124:35
```

**(d) `.json`-named dangling symlink (silent-skip form, not a throw):**
```
AssertionError: expected false to be true // Object.is equality
- Expected: true
+ Received: false
```
(The pre-fix module silently returns `[]` for this fixture — the `.json` extension skip fires before any read is attempted, since there is no `isFile()` gate to catch it first.)

**(e) FIFO — no RED run taken.** Per D-11's one documented exception: a pre-fix `readFileSync` on a FIFO blocks until a writer appears, which is the defect itself; running it against the pre-fix module would hang the suite rather than fail it. Disclosed in the test name (`… — POST-FIX ONLY, no pre-fix RED run was taken …`) and here. This was confirmed the hard way: the FIRST attempt at Task 1c ran the full WR-14 block (all six tests, FIFO not yet skipped) against the pre-fix module in one `npx vitest run` invocation. It hung indefinitely with no test-level output at all (the run buffers until each file completes) and had to be killed via `kill -9` on the vitest worker/CLI processes. The RED capture used for the four verbatim observations above came from a second run with the FIFO test temporarily `.skip`-ped for that one invocation only, then un-skipped again before the fix was applied.

**GREEN confirmation:** after applying the fix, `npx vitest run scripts/lib/curation-guard.test.mjs` reported 21 passed / 1 skipped (the real-dist/widgets regression case self-skips until a build exists) before Task 2's build, and 22/22 passed after Task 2 produced a real `dist/widgets/index.html`. `npm test`'s WR-14-relevant tally: 0 assertion failures in `curation-guard.test.mjs` in either run. `npx tsc --noEmit` exits 0 both before and after.

## Verbatim Build-Level Evidence (Task 2)

Baseline (`npm run build-widgets`, exit 0) recorded `assets/index-B1uN9-48.js` and `assets/index-B573RjUr.css`.

**PRE-fix, fixture 1 (dangling symlink at `dist/widgets/assets/wr14-dangling.js`):**
```
Widget build failed: Error: ENOENT: no such file or directory, open '.../dist/widgets/assets/wr14-dangling.js'
```
Exit 1. Names neither the curation guard nor an attributed reason — only the raw Node error.

**PRE-fix, fixture 2 (`ln -s . dist/widgets/assets/wr14-dirlink.js`, target = containing directory):**
```
Widget build failed: Error: EISDIR: illegal operation on a directory, read
```
Exit 1. Same unattributed shape.

**POST-fix, fixture 1 (same symlink, replayed):**
```
✗ Curation-artifact guard failed: /Users/.../dist/widgets/assets/wr14-dangling.js — not a regular file — the published bundle must contain only regular files and directories
```
Exit 1 — now attributed to both the guard and the exact path.

**POST-fix, fixture 2 (same symlink, replayed):**
```
✗ Curation-artifact guard failed: /Users/.../dist/widgets/assets/wr14-dirlink.js — not a regular file — the published bundle must contain only regular files and directories
```
Exit 1 — same attributed shape.

**Clean re-run** (both fixtures removed, confirmed absent via `find`): exit 0, `✓ Curation-artifact scan: dist/widgets tree scanned, no curation-mode artifacts found.`, and `dist/widgets/index.html` reproduced the identical `assets/index-B1uN9-48.js` / `assets/index-B573RjUr.css` filenames recorded at baseline.

**Integrity:** `cmp scripts/lib/curation-guard.mjs "$SCRATCH/curation-guard.post-fix.mjs"` reported byte-identical at the point Task 2's build-proof script finished (both were Task 1's committed module). The docblock-wording fix described in Deviations #1 was made afterward, directly against the working tree, as its own edit — not swapped through the scratch copy — so it did not disturb Task 2's plant/restore/verify cycle. `find dist/widgets \( -name 'wr14-dangling.js' -o -name 'wr14-dirlink.js' \)` returned nothing. No scratch copy remains under the repository (`find . -name 'curation-guard.*-fix.mjs' -not -path './node_modules/*'` returned nothing).

## Decisions Made

- Task 2's commit is prefixed `docs` rather than `fix`, since its primary deliverable is the live proof/evidence trail, not new source behavior — the one actual code change folded into that commit (the docblock reword) leaves runtime behavior byte-for-byte identical to Task 1's commit.
- `UNSCANNED_EXTENSIONS` was left exactly `['.json']` — not touched, per house rule 4. WR-15 (the `.json` exemption being extension-scoped, not path-scoped) and IN-13 (`respond500` dereferencing `error.message`) were deliberately left alone, per house rule 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, self-inflicted during this plan] Docblock amendment collided with Task 2's own acceptance criterion**
- **Found during:** Task 2 verification (`grep -c 'entry.isFile()' scripts/lib/curation-guard.mjs` returned `2`, not the required `1`)
- **Issue:** Task 1's docblock amendment (required by its own action item (e)) used the literal prose string `` `entry.isFile()` `` to describe the new gate, which is indistinguishable from the source-code occurrence to a literal `grep -c` count.
- **Fix:** Reworded the docblock sentence to `a "must be a regular file" gate` — no functional change, same rationale conveyed, source-code gate remains the sole match.
- **Files modified:** `scripts/lib/curation-guard.mjs`
- **Verification:** `grep -c 'entry.isFile()'` now returns `1`; `grep -c 'if (!entry.isFile())'` returns `1`; the ordering `awk` check still exits `0`; `npx vitest run scripts/lib/curation-guard.test.mjs` still 22/22; `npx tsc --noEmit` exits `0`.
- **Committed in:** `049d346` (part of Task 2's commit)

**2. [Scope boundary, logged not fixed] `npm test` has pre-existing failing files unrelated to this plan**
- **Found during:** Task 2's `npm test` run (step g)
- **Issue:** Same recurring worktree environment gap documented in this phase's `deferred-items.md` for plans 24-01, 24-02, 24-12 and 24-13: `data/stats/*.json` and `data/dashboard/index.json` are gitignored generated artifacts absent from this fresh worktree checkout, and `node_modules/chartjs-plugin-zoom/dist/...` is absent too. Before Task 2's build, this surfaced as 6 file-level `ENOENT` import failures with 0 assertion failures (`records-logic.test.ts` + 4 `trends-*-logic.test.ts` siblings + `trends-zoom-logic.test.ts`). Task 2's own action requires a REAL `npm run build-widgets` against the real `dist/widgets` tree (the deliverable is the operator-facing build message, not a unit assertion), which produces `dist/widgets/index.html` as a side effect — that un-skips `scripts/verify-dashboard-publish-guard.test.mjs`'s `describe.skipIf`, whose own `main()` invocation then FATALs on the still-missing `dist/widgets/data/dashboard/index.json` (4 more assertion failures), reproducing 24-12's exact entry.
- **Fix:** Not fixed — out of scope per the Scope Boundary rule (none of the failing files touch `scripts/lib/curation-guard.mjs` or `scripts/lib/curation-guard.test.mjs`). Logged in `.planning/phases/24-local-curation-mode/deferred-items.md` under a new `## 24-15:` heading.
- **Files modified:** `.planning/phases/24-local-curation-mode/deferred-items.md`
- **Committed in:** `049d346`

---

**Total deviations:** 2 (1 self-fixed bug, 1 scope-boundary log entry)
**Impact on plan:** No scope creep. The docblock fix was necessary for the plan's own literal acceptance criterion. The npm-test gap is the fourth confirmed instance of an already-tracked, pre-existing, unrelated worktree data gap — expected to resolve at merge-back into the main checkout, per 24-12/24-13 precedent.

## Issues Encountered

- The RED-observation run (Task 1c) initially attempted to run the full WR-14 describe block including the FIFO case against the pre-fix module in one `npx vitest run` invocation; this hung indefinitely (the defect the FIFO case exists to prove) and had to be killed via `kill -9` on the vitest worker processes. Resolved by temporarily `.skip`-ing the FIFO test for the RED capture only (D-11's own documented exception for this case), then restoring it before the fix was applied, so the GREEN run exercises all five classes including the FIFO one.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

WR-14 is closed. Two items remain in the amended GAP-24-05 round: item 1 (browser-row coverage of the WR-05 live-document mirror direction, plan 24-16) and item 3 (WR-17, `buildPrBadgeLabels` call-site binding pin — also plan 24-16, per STATE.md's wave assignment: 24-15 and 24-16 are disjoint-file, parallel-safe wave-9 plans; 24-17 is the wave-10 blocking disposition plan). No blockers for 24-16 or 24-17 introduced by this plan — `scripts/lib/curation-guard.mjs` and `scripts/lib/curation-guard.test.mjs` are not in 24-16's or 24-17's file scope.

---
*Phase: 24-local-curation-mode*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: `scripts/lib/curation-guard.mjs`
- FOUND: `scripts/lib/curation-guard.test.mjs`
- FOUND: `.planning/phases/24-local-curation-mode/24-15-SUMMARY.md`
- FOUND: `.planning/phases/24-local-curation-mode/deferred-items.md`
- FOUND: commit `8a1ec56` (Task 1)
- FOUND: commit `049d346` (Task 2)
- FOUND: commit `f344e2a` (this summary)
