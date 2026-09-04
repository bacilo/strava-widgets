# Deferred Items — Phase 25

Out-of-scope discoveries logged during plan execution, per the executor's scope-boundary rule
(only auto-fix issues directly caused by the current task's changes).

## From 25-01 (Task 3)

**Pre-existing NUL byte in `gear-aggregate-logic.ts`'s `unknownKey` literal.**

`gear-aggregate-logic.ts`'s `unknownKey = ' unknown'` internal map key (intended as a leading
space, per its own comment "internal-only key, never exposed; sorts before any real label")
actually contains a literal NUL byte (`\x00`) instead of a space character. Confirmed present
in the commit immediately preceding this plan's Task 1 (`git show <pre-task-1-commit>:src/analytics/gear-aggregate-logic.ts`
via python3 byte-level read) — not introduced by any task in this plan.

Functionally harmless: a NUL byte (char code 0) sorts before any printable character in string
comparison, same as a space (char code 32) would, so `unknownKey`'s "sorts before any real
label" invariant still holds and all tests pass. The only externally-visible effect is that
`file`/`git diff` classify `gear-aggregate-logic.ts` as binary (`application/octet-stream`),
which produces a `Bin X -> Y bytes` diff stat instead of a normal line diff for any commit that
touches this file — cosmetic only, does not affect `git blame`, `git log -p` correctness, or
runtime behavior.

Not fixed here — out of scope for FIX-02/D-12/D-13 (Task 3 only widens the Unknown-bucket
predicate; it does not touch the `unknownKey` literal). Worth a one-line fix in a future
low-risk cleanup plan: replace the NUL byte with an actual space character.

## From plan 25-02

- **`chartjs-plugin-zoom` missing from this worktree's `node_modules`** (found during Task 3's whole-suite `npx vitest run` regression check). `node_modules/chartjs-plugin-zoom/` does not exist even though the package is declared in `package.json`/`package-lock.json` — this worktree's `node_modules` has only 2 top-level entries, an incomplete install unrelated to plan 25-02's scope (`src/compute-all-stats-steps.ts`, `src/compute-all-stats-steps.test.ts`, `src/index.ts`, `.github/workflows/daily-refresh.yml`). Causes one test file (a Trends-chart plugin-source test, sibling of `src/dashboard/theme.test.ts`) to fail at collection/import time. Package-manager installs are excluded from Rule 3 auto-fix, so this was left unfixed. All other 1,505 tests pass (11 skipped). Likely resolves with a full `npm ci` in this worktree or on merge back to a checkout with a complete install.

# Phase 25 — Deferred Items

## 25-05: `npx vitest run src/dashboard` full-suite failures are the same recurring worktree environment gap (not caused by this plan)

**Logged:** 2026-09-04, plan 25-05, Task 1

`npx vitest run src/dashboard` in this plan's git worktree
(`.claude/worktrees/agent-aeffe44762ffeef91`) reports 6 failed test files / 29 passed / **0
assertion failures** (991/991 executed tests pass):

- `src/dashboard/views/records-logic.test.ts`
- `src/dashboard/views/trends-cadence-hr-logic.test.ts`
- `src/dashboard/views/trends-gear-logic.test.ts`
- `src/dashboard/views/trends-training-load-logic.test.ts`
- `src/dashboard/views/trends-yoy-logic.test.ts`
- `src/dashboard/views/trends-zoom-logic.test.ts` — `ENOENT` on
  `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js` (a `new
  URL('../../../node_modules/...', import.meta.url)`-relative path read from the test file, not
  a bare `import`)

**Root cause (identical to the pattern documented across Phases 21/22/24's own
`deferred-items.md`):** this worktree's own `node_modules/` is effectively empty (only Vite's
`.vite`/`.vite-temp` caches). Node's module resolution walks up to the main repo's
`node_modules/` for bare `import` specifiers (which is why `vitest`/`tsc` themselves run fine),
but these 6 test files build explicit relative paths (`new URL('../../../node_modules/...',
import.meta.url)` or gitignored `data/stats/*.json` reads) that resolve inside the worktree
itself and find nothing there.

**Why out of scope for plan 25-05:** None of the 6 failing files import or reference
`src/dashboard/theme-bootstrap-parity.test.ts`, `src/dashboard/index.html`, or
`src/dashboard/theme.ts` — the only files this plan's two tasks touch (`index.html` only
temporarily, per Task 2, and restored byte-identical). The failure mode (missing gitignored
`node_modules` package under a relative path) is identical with or without this plan's changes,
and is reproducible on a clean worktree checkout regardless.

**Verified in-scope tests are clean:**
- `npx vitest run src/dashboard/theme-bootstrap-parity.test.ts` — 16/16 pass (this plan's new
  file).
- `npx tsc --noEmit` — exits 0.
- `npx vitest run src/dashboard`'s own tally: **0 assertion failures**, 991/991 executed tests
  pass; the 6 file-level failures are all pre-existing `ENOENT` import errors from a
  gitignored/absent `node_modules` package, not from this plan's changes.

**Disposition:** Not fixed. Logged per the Scope Boundary rule (only auto-fix issues directly
caused by the current task's changes) and consistent with the identical disposition recorded
across Phase 21/22/24's `deferred-items.md` entries for the same recurring worktree-environment
gap. Left for the orchestrator's merge-back into the main checkout, where `node_modules` is fully
installed and `npx vitest run src/dashboard` is expected to run fully green.

## From plan 25-05 — `npx vitest run src/dashboard` full-suite failures are the same recurring worktree environment gap (not caused by this plan)

**Logged:** 2026-09-04, plan 25-05, Task 1

`npx vitest run src/dashboard` in this plan's git worktree
(`.claude/worktrees/agent-aeffe44762ffeef91`) reports 6 failed test files / 29 passed / **0
assertion failures** (991/991 executed tests pass):

- `src/dashboard/views/records-logic.test.ts`
- `src/dashboard/views/trends-cadence-hr-logic.test.ts`
- `src/dashboard/views/trends-gear-logic.test.ts`
- `src/dashboard/views/trends-training-load-logic.test.ts`
- `src/dashboard/views/trends-yoy-logic.test.ts`
- `src/dashboard/views/trends-zoom-logic.test.ts` — `ENOENT` on
  `node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js` (a `new
  URL('../../../node_modules/...', import.meta.url)`-relative path read from the test file, not
  a bare `import`)

**Root cause (identical to the pattern documented across Phases 21/22/24's own
`deferred-items.md`):** this worktree's own `node_modules/` is effectively empty (only Vite's
`.vite`/`.vite-temp` caches). Node's module resolution walks up to the main repo's
`node_modules/` for bare `import` specifiers (which is why `vitest`/`tsc` themselves run fine),
but these 6 test files build explicit relative paths (`new URL('../../../node_modules/...',
import.meta.url)` or gitignored `data/stats/*.json` reads) that resolve inside the worktree
itself and find nothing there.

**Why out of scope for plan 25-05:** None of the 6 failing files import or reference
`src/dashboard/theme-bootstrap-parity.test.ts`, `src/dashboard/index.html`, or
`src/dashboard/theme.ts` — the only files this plan's two tasks touch (`index.html` only
temporarily, per Task 2, and restored byte-identical). The failure mode (missing gitignored
`node_modules` package under a relative path) is identical with or without this plan's changes,
and is reproducible on a clean worktree checkout regardless.

**Verified in-scope tests are clean:**
- `npx vitest run src/dashboard/theme-bootstrap-parity.test.ts` — 16/16 pass (this plan's new
  file).
- `npx tsc --noEmit` — exits 0.
- `npx vitest run src/dashboard`'s own tally: **0 assertion failures**, 991/991 executed tests
  pass; the 6 file-level failures are all pre-existing `ENOENT` import errors from a
  gitignored/absent `node_modules` package, not from this plan's changes.

**Disposition:** Not fixed. Logged per the Scope Boundary rule (only auto-fix issues directly
caused by the current task's changes) and consistent with the identical disposition recorded
across Phase 21/22/24's `deferred-items.md` entries for the same recurring worktree-environment
gap. Left for the orchestrator's merge-back into the main checkout, where `node_modules` is fully
installed and `npx vitest run src/dashboard` is expected to run fully green.

---

## Theme toggle iconography — state convention vs. action convention (plan 25-07, Round 1, R1)

**Raised by:** the developer, during plan 25-07's Round 1 human checkpoint (2026-09-04), while
giving the R1 legibility judgment.

**Verbatim:** "Toggle is 'sun' when light and 'moon' when dark. Indicating the current state. This
is totally fine with my but wondering whether common practice would be the opposite (indicating
'touch here to go dark/light'). Or pehraps the light is the 'moon' mode so we can have brightness
when dark. I'm totally fine with this maybe more asking a question."

**Nature:** a question about UI convention, explicitly framed by the developer as not a fault.
Both conventions are in common use: showing **current state** (what this dashboard does — sun while
in light mode) matches macOS/iOS-style system chrome, while showing the **target action** (sun
meaning "click for light") is also widespread. Neither is canonical. The state convention tends to
read better when the control sits among other status-ish chrome, the action convention when the
control is isolated and reads as a button.

**Disposition:** Not changed. Two independent reasons:
1. It is not a defect, so it does not affect R1's verdict (PASS) or any requirement's disposition.
2. The house rule since plan 16-09 forbids patching anything surfaced during a checkpoint round —
   no fix under checkpoint pressure, even a trivial or cosmetic one.

**If it is ever picked up:** it is a `src/dashboard` presentation change only, touching the toggle's
glyph selection; it does not touch `theme.ts`'s mode resolution, the `cycleThemeMode` sequence
(`light -> dark -> auto`), or the inline pre-paint bootstrap, so it is independent of VER-01's
verification surface and of plan 25-05's `node:vm` parity pin. Worth pairing with a decision about
whether the `'auto'` mode needs its own distinct glyph, which the current two-glyph scheme does not
express.
