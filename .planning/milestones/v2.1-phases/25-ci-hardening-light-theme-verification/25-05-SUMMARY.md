---
phase: 25-ci-hardening-light-theme-verification
plan: 05
subsystem: testing
tags: [vitest, node:vm, theme, dashboard, tdd-style-pin]

# Dependency graph
requires:
  - phase: 25-ci-hardening-light-theme-verification (earlier waves)
    provides: theme.ts's resolveEffectiveTheme/parseThemeMode/THEME_STORAGE_KEY (already shipped, unchanged by this plan)
provides:
  - "D-06: a node:vm behavioural parity pin proving index.html's inline pre-paint theme bootstrap resolves theme identically to theme.ts's resolveEffectiveTheme across all six (mode, prefersDark) combinations"
  - "A structural allow-list literal check (raw === 'light'/'dark'/'auto' all present in the extracted source) that closes a real coincidental-default blind spot discovered during mutation testing"
  - "Proof, via three deliberate source mutations and restoration, that the pin actually fails when the bootstrap diverges from theme.ts"
affects: [25-07 (VER-01 human checkpoint — this pin is a prerequisite structural item that makes that round's evidence mean something)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "node:vm sandbox execution of a first-party inline <script> block extracted from a static HTML file, for genuine behavioural parity testing without a DOM/jsdom dependency"
    - "Structural (source-text) assertions kept alongside behavioural ones specifically to catch coincidental-default blind spots that pure behavioural testing cannot observe"

key-files:
  created:
    - src/dashboard/theme-bootstrap-parity.test.ts
  modified: []

key-decisions:
  - "Mutation B (removing || raw === 'auto' from the allow-list) initially passed all 16 tests — a genuine blind spot, since `mode` already defaults to 'auto' before the allow-list check runs, so the explicit check and the fallback default are behaviourally indistinguishable through output alone. Per the plan's own contingency instruction, strengthened the pin with a structural assertion (RESEARCH.md Pattern 6 Option B) rather than accepting a passing mutation."

patterns-established:
  - "node:vm sandbox pin: extractInlineBootstrap(html) + runBootstrap({storedValue, prefersDark, throwOnGet}), hoisted script parse at module scope so a malformed source fails every test loudly"

requirements-completed: []  # VER-01 stays with plan 25-07's human checkpoint; this plan is prerequisite structural work only, per the plan's own frontmatter (no requirements field consumed here beyond D-06 must_haves)

# Metrics
duration: ~12min
completed: 2026-09-04
---

# Phase 25 Plan 05: D-06 Theme-Bootstrap Parity Pin Summary

**node:vm behavioural parity pin proving index.html's inline pre-paint theme bootstrap matches theme.ts's resolveEffectiveTheme across all six mode/prefersDark combinations, with a mutation-testing-discovered strengthening of the allow-list check**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-09-04
- **Tasks:** 2 completed
- **Files modified:** 1 (src/dashboard/theme-bootstrap-parity.test.ts); src/dashboard/index.html was temporarily mutated three times and restored byte-identical (no net change)

## Accomplishments

- Landed D-06: `src/dashboard/theme-bootstrap-parity.test.ts` extracts the real inline `<script>` bootstrap from `index.html` via `readFileSync(new URL('./index.html', import.meta.url), 'utf8')` + regex, and executes it in a `node:vm` sandbox (`vm.createContext` + `vm.runInContext`) with stubbed `localStorage`/`window.matchMedia`/`document.documentElement.setAttribute` — zero new dependencies, no jsdom.
- All six `(mode, prefersDark)` combinations assert BOTH against the real imported `resolveEffectiveTheme` from `theme.ts` AND the literal expected value, proving genuine cross-implementation parity rather than the bootstrap and `theme.ts` being wrong in the same way.
- The T-16-TH-01 allow-list tamper guard is pinned: out-of-allowlist values (`'system'`, `'Light'`, `''`, `'{}'`), `storedValue: null`, and a throwing `localStorage.getItem` all fall back to auto-equivalent behaviour rather than leaving the document unthemed.
- Proved the pin is load-bearing by three deliberate mutations to the real `src/dashboard/index.html`, each run, observed failing, and restored — see Mutation proofs below.
- Discovered and closed a genuine blind spot in Mutation B: dropping `'auto'` from the allow-list condition has zero observable behavioural effect (since `mode` already defaults to `'auto'`), so a pure-behavioural pin cannot catch it. Strengthened the pin with a structural source-text assertion per the plan's own contingency instruction and RESEARCH.md Pattern 6 Option B.

## Task Commits

1. **Task 1: Write the node:vm behavioural parity pin (D-06)** - `7480363` (test)
2. **Task 2: Prove the pin is load-bearing by deliberate mutation, then restore index.html byte-identical** - `5578cf4` (test)

_No separate plan-metadata commit — worktree mode; the orchestrator commits SUMMARY.md after merge-back._

## Files Created/Modified

- `src/dashboard/theme-bootstrap-parity.test.ts` - node:vm behavioural parity pin: `extractInlineBootstrap`, `runBootstrap`, 17 test cases across three describe blocks (behavioural parity, allow-list/robustness, pre-paint position)
- `.planning/phases/25-ci-hardening-light-theme-verification/deferred-items.md` - logged a pre-existing worktree `node_modules` gap (6 unrelated `trends-*`/`records-logic` test files fail on `ENOENT` for a gitignored `node_modules` package), consistent with the identical pattern documented in Phases 21/22/24
- `src/dashboard/index.html` - temporarily mutated three times during Task 2's proof, restored byte-identical each time; net diff is empty (`git diff --exit-code` exits 0)

## Mutation proofs (A/B/C)

Pre-mutation snapshot (also the post-restoration digest, confirmed identical after every mutation):
```
sha256: 6b763be60eb592fa2600933eee9a9a843d3d885d63cdcd3adec1a62b92a5aef2
```

### Mutation A — behavioural (inverted the auto branch)

**Edit applied:**
```diff
- effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
+ effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
```

**Result:** 8 of 16 cases failed (8 passed), including exactly the two named `'auto'` parity cases — the discriminator that proves the pin is behavioural, since a source-text-only pin would still have passed this mutation (the allow-list literals and key names are untouched).

**Verbatim failures:**
```
FAIL > inline theme bootstrap — behavioural parity with theme.ts (D-06) > 'auto' with system preferring dark resolves to 'dark'
AssertionError: expected 'light' to be 'dark' // Object.is equality
Expected: "dark"
Received: "light"

FAIL > inline theme bootstrap — behavioural parity with theme.ts (D-06) > 'auto' with system preferring light resolves to 'light'
AssertionError: expected 'dark' to be 'light' // Object.is equality
Expected: "light"
Received: "dark"
```
Plus 6 more failures in the allow-list/robustness block (every case that resolves through the `auto` branch): stored values `"system"`, `"Light"`, `""`, `"{}"`, `storedValue: null`, and the `throwOnGet: true` case — all of which route through the now-inverted `auto` branch.

**Restoration:** `git checkout -- src/dashboard/index.html`; sha256 confirmed `6b763be6...92a5aef2` (matches snapshot); `theme-bootstrap-parity.test.ts` back to 16/16 green.

### Mutation B — the T-16-TH-01 allow-list (removed `|| raw === 'auto'`)

**Edit applied:**
```diff
- if (raw === 'light' || raw === 'dark' || raw === 'auto') {
+ if (raw === 'light' || raw === 'dark') {
```

**Result:** initially **passed all 16 cases** — a real blind spot, not a false negative. Root cause: `var mode = 'auto';` is the IIFE's own default, set *before* the allow-list check runs. Dropping the explicit `raw === 'auto'` clause means a stored `'auto'` value simply fails the (now two-way) condition and `mode` falls through to its already-`'auto'` default — behaviourally identical output either way. No behavioural-only test can observe this divergence, because there is none to observe at the output level.

Per Task 2's own contingency instruction ("If it does NOT fail, the pin has a blind spot: strengthen the pin in Task 1's file so it does, then re-run. Do not accept a passing mutation."), added a structural assertion to `theme-bootstrap-parity.test.ts`'s allow-list describe block, per RESEARCH.md Pattern 6 Option B's recommendation to keep a source-text check alongside the behavioural ones for exactly this class of gap:
```typescript
it("the allow-list literally checks all three of 'light', 'dark' and 'auto' — not two plus a coincidental default", () => {
  expect(bootstrapScript).toMatch(/raw === 'light'/);
  expect(bootstrapScript).toMatch(/raw === 'dark'/);
  expect(bootstrapScript).toMatch(/raw === 'auto'/);
});
```

**Verbatim failure after strengthening (re-run against the still-mutated index.html):**
```
FAIL > inline theme bootstrap — allow-list and robustness (T-16-TH-01) > the allow-list literally checks all three of 'light', 'dark' and 'auto' — not two plus a coincidental default
AssertionError: expected "(function () { var STORAGE_KEY = …" to match /raw === 'auto'/
```
1 of 17 cases failed (16 passed) — exactly the new structural check, confirming the strengthening closes the blind spot.

**Restoration:** `git checkout -- src/dashboard/index.html`; sha256 confirmed `6b763be6...92a5aef2` (matches snapshot); `theme-bootstrap-parity.test.ts` back to 17/17 green (16 original + 1 new structural check, all passing against the real, un-mutated source).

### Mutation C — pre-paint position (moved the stylesheet link before the script)

**Edit applied:** relocated `<link rel="stylesheet" href="./styles.css">` to immediately before the `<script>` block (previously immediately after it).

**Result:** the pre-paint position assertion failed as expected; the "both tags present" check (asserting `>= 0`) still passed since both tags remain in the document, just reordered.

**Verbatim failure:**
```
FAIL > inline theme bootstrap — pre-paint position > the inline <script> appears before the stylesheet <link>, because a deferred module script does not run until after HTML parsing, which would let the page paint the wrong theme first
AssertionError: expected 2170 to be less than 2124
```
1 of 17 cases failed (16 passed) — exactly the script-before-stylesheet position check.

**Restoration:** `git checkout -- src/dashboard/index.html`; sha256 confirmed `6b763be6...92a5aef2` (matches snapshot); `theme-bootstrap-parity.test.ts` back to 17/17 green.

## Restoration

- **Before any mutation (Task 2 start):** `sha256: 6b763be60eb592fa2600933eee9a9a843d3d885d63cdcd3adec1a62b92a5aef2`
- **After Mutation A restore:** `sha256: 6b763be60eb592fa2600933eee9a9a843d3d885d63cdcd3adec1a62b92a5aef2` (match)
- **After Mutation B restore:** `sha256: 6b763be60eb592fa2600933eee9a9a843d3d885d63cdcd3adec1a62b92a5aef2` (match)
- **After Mutation C restore (final state):** `sha256: 6b763be60eb592fa2600933eee9a9a843d3d885d63cdcd3adec1a62b92a5aef2` (match)
- `git diff --exit-code src/dashboard/index.html` — exits 0 (no tracked diff)
- `git status --short` — clean after Task 2's commit

## Decisions Made

- **Mutation B's blind spot was closed by strengthening the pin, not by weakening the mutation's claim.** The plan explicitly anticipated this possibility ("If it does NOT fail, the pin has a blind spot: strengthen the pin in Task 1's file so it does, then re-run. Do not accept a passing mutation.") and RESEARCH.md Pattern 6 Option B independently recommended keeping a source-text check alongside the behavioural ones. Added one structural assertion (`raw === 'light'`/`'dark'`/`'auto'` all present in the extracted script text) rather than, e.g., changing the bootstrap's own default-handling logic (which would be an unrelated architectural change out of this plan's scope, and the bootstrap's actual behaviour — falling back to auto via either path — is correct).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docblock's own prose accidentally tripped an acceptance-criteria grep**
- **Found during:** Task 1, running the acceptance-criteria check `grep -c "jsdom\|happy-dom\|puppeteer\|playwright" ...` returns 0
- **Issue:** The docblock's "no DOM/CSSOM... no jsdom installed" prose literally contained the substring `jsdom`, which the acceptance criterion greps for to confirm zero headless-browser dependency reference in this file. The check is meant to catch an accidental `import`/reference to a headless-DOM package, not descriptive prose, but the literal grep doesn't distinguish the two.
- **Fix:** Reworded to "no DOM-emulation library installed" — same meaning, no longer contains the literal substring.
- **Files modified:** src/dashboard/theme-bootstrap-parity.test.ts
- **Verification:** `grep -c "jsdom\|happy-dom\|puppeteer\|playwright" src/dashboard/theme-bootstrap-parity.test.ts` returns 0; all 16 (then 17) tests still pass.
- **Committed in:** 7480363 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Strengthened the allow-list pin after Mutation B exposed a coincidental-default blind spot**
- **Found during:** Task 2, running Mutation B
- **Issue:** Removing `|| raw === 'auto'` from the allow-list condition produced zero observable behavioural change (see Mutation B write-up above), so the pin as written from Task 1 could not catch a real regression in the allow-list check — a gap in the T-16-TH-01 mitigation's own test coverage, which the plan's threat register (T-25-12) explicitly calls load-bearing.
- **Fix:** Added a structural assertion on the extracted script source confirming all three allow-list literals (`raw === 'light'`, `raw === 'dark'`, `raw === 'auto'`) are present, per RESEARCH.md Pattern 6 Option B.
- **Files modified:** src/dashboard/theme-bootstrap-parity.test.ts
- **Verification:** re-ran against the still-mutated index.html — 1/17 failed (exactly the new check); re-ran against the restored index.html — 17/17 pass.
- **Committed in:** 5578cf4 (Task 2 commit)

**3. [Rule 3 - Blocking, out of scope] Pre-existing worktree `node_modules` gap affecting 6 unrelated test files**
- **Found during:** Task 1, running `npx vitest run src/dashboard` as an acceptance-criteria check
- **Issue:** This worktree's own `node_modules/` has no real package install (only Vite caches); 6 `trends-*`/`records-logic` test files construct a relative `new URL('../../../node_modules/chartjs-plugin-zoom/...', import.meta.url)` path that resolves inside the worktree and finds nothing. This is the identical, previously-documented pattern from Phases 21/22/24's own `deferred-items.md` entries.
- **Fix:** Not fixed — out of scope per the Scope Boundary rule (none of the 6 failing files reference `theme-bootstrap-parity.test.ts`, `index.html`, or `theme.ts`). Logged to `.planning/phases/25-ci-hardening-light-theme-verification/deferred-items.md`.
- **Files modified:** .planning/phases/25-ci-hardening-light-theme-verification/deferred-items.md (new)
- **Verification:** `npx vitest run src/dashboard` tally: 0 assertion failures, 991/991 executed tests pass; only the 6 pre-existing file-level ENOENT failures, unrelated to this plan's changes.
- **Committed in:** 7480363 (Task 1 commit, alongside the new test file)

---

**Total deviations:** 3 auto-fixed (1 bug in test-file prose, 1 missing-critical test-coverage strengthening, 1 out-of-scope pre-existing infra gap logged not fixed)
**Impact on plan:** All three necessary for correctness of the acceptance criteria and the pin's own load-bearing claim. No scope creep — the strengthening stayed inside Task 1's file exactly as Task 2's own contingency instruction anticipated.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- D-06 is discharged: behavioural parity pinned across all six `(mode, prefersDark)` combinations, the `'light' | 'dark' | 'auto'` allow-list pinned both behaviourally and structurally, and the script-before-stylesheet position pinned.
- Zero new dependencies added (`node:vm` is a Node built-in); `git diff package.json package-lock.json` is empty.
- `src/dashboard/index.html` is byte-identical to its pre-plan state (sha256 confirmed four times: initial snapshot plus after each of the three mutation restorations).
- This plan is prerequisite structural work for plan 25-07's VER-01 human browser checkpoint (per the plan's own objective) — the pin now makes that round's evidence about the inline bootstrap mean something, since the inline copy had zero test coverage before this plan.
- The pre-existing worktree `node_modules` gap (6 unrelated test files) is logged in `deferred-items.md`, consistent with prior-phase entries, and expected to resolve automatically on merge-back into the main checkout where `node_modules` is fully installed.

---
*Phase: 25-ci-hardening-light-theme-verification*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: src/dashboard/theme-bootstrap-parity.test.ts
- FOUND: .planning/phases/25-ci-hardening-light-theme-verification/deferred-items.md
- FOUND: .planning/phases/25-ci-hardening-light-theme-verification/25-05-SUMMARY.md
- FOUND: commit 7480363 (Task 1)
- FOUND: commit 5578cf4 (Task 2)
- FOUND: commit eaccef27 (SUMMARY.md commit)
