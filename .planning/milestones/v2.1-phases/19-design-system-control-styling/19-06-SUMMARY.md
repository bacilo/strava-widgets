---
phase: 19-design-system-control-styling
plan: 06
subsystem: testing
tags: [css, esbuild, vitest, parse-validation, design-tokens]

# Dependency graph
requires:
  - phase: 19-design-system-control-styling (plans 01-05)
    provides: The design-token pass (spacing/radius/focus-ring/control-styling) that shipped the defect this plan closes, plus the styles.test.ts helpers (declarationsFor, selectorListDeclares) this plan builds on
provides:
  - "--radius-control restored to the parsed stylesheet (comment defect fixed)"
  - "A parse-level test gate (esbuild transformSync + anchored :root declaration match + comment hygiene) that observes the PARSED stylesheet, not just its source text"
  - ".segmented migrated onto var(--radius-control), matching its end children (WR-01)"
  - "19-VALIDATION.md constraint fact 2 reconciled with the new esbuild devDependency"
affects: [19-07, 19-08, 19-09]

# Tech tracking
tech-stack:
  added: ["esbuild@^0.27.3 (devDependency, already resolved transitively via vite)"]
  patterns:
    - "Parse-level test gate: esbuild transformSync({loader:'css'}).warnings.length === 0 catches CSS syntax errors invisible to substring assertions"
    - "Anchored declaration-name match (^--token-name\\s*:) on ;-split :root fragments, not .toContain() or fragment-count, to discriminate a swallowed declaration from a present one"
    - "Gate-command hygiene: delete stale log, redirect (not pipe) build output, capture exit status into a variable, require both status and grep negation — never `cmd | tee log; ! grep`"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - src/dashboard/styles.test.ts
    - package.json
    - package-lock.json
    - .planning/phases/19-design-system-control-styling/19-VALIDATION.md

key-decisions:
  - "GD-01: declared esbuild@^0.27.3 as an explicit devDependency rather than depending on it transitively via vite, so a future Rolldown migration turns a silent gate disappearance into an explicit dependency-resolution failure. Zero packages were downloaded — esbuild 0.27.3 was already resolved in package-lock.json as vite's dependency."
  - "Two of the three new parse-level assertions are dependency-free (anchored :root declaration match, comment-hygiene check), so GAP 1's class stays covered even if the esbuild gate is ever lost."

patterns-established:
  - "Parse-level test gate pattern for stylesheet regression tests: verify the PARSED result (esbuild transformSync warnings, anchored declaration matching) in addition to source-text substring assertions, since source text can be correct while parsing silently discards a declaration."

requirements-completed: [UI-01, UI-02]

# Metrics
duration: 35min
completed: 2026-08-12
---

# Phase 19 Plan 06: Parse-Level Radius Gate & Comment Fix Summary

**Restored `--radius-control` to the parsed stylesheet by fixing a comment that silently terminated early, and replaced the text-substring test gate with a parse-level one (esbuild `transformSync` + anchored `:root` declaration match + comment hygiene) that was watched failing against the live defect before it was allowed to pass.**

## Performance

- **Duration:** 35 min
- **Tasks:** 3
- **Files modified:** 5 (`package.json`, `package-lock.json`, `src/dashboard/styles.css`, `src/dashboard/styles.test.ts`, `19-VALIDATION.md`)

## Accomplishments

- GAP 1 closed: the stray `*/` inside the Phase 19 radius-scale comment (`--space-*/--zone-*/--load-*`) that silently discarded `--radius-control` from the parsed stylesheet is fixed
- A parse-level `describe` block (`Phase 19 radius tokens (parse level)`) with three independent assertions — esbuild whole-file zero-warnings, anchored `:root` declaration-name match, comment-hygiene (`no stray */`) — was observed **failing against the live, unmodified defect** before the fix landed, and mutation-checked afterward by reintroducing the defect
- WR-01 closed: `.segmented`'s literal `border-radius: 4px` migrated onto `var(--radius-control)`, matching its end children
- `19-VALIDATION.md` constraint fact 2 reconciled: states that gap closure declared exactly one devDependency (`esbuild`) and downloaded zero packages, distinct claims that were previously conflated into "none was installed"

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare esbuild, build the whole-file parse gate, watch it fail against the live defect, fix the comment, reconcile the constraint record** - `c2ae020` (fix)
2. **Task 2: Add the two dependency-free parse assertions and mutation-check all three** - `37597af` (test)
3. **Task 3: Migrate `.segmented`'s literal corner radius onto the token (WR-01)** - `fd5fdfd` (fix)

**Plan metadata:** commit pending (this SUMMARY + updated docs, committed by the executor immediately after this file).

## Files Created/Modified

- `package.json` - added `"esbuild": "^0.27.3"` to `devDependencies`, alphabetically ordered
- `package-lock.json` - added the `devDependencies` reference; zero new `node_modules/*` entries
- `src/dashboard/styles.css` - fixed the early-terminating comment at lines 55-57; migrated `.segmented`'s `border-radius` from a literal `4px` to `var(--radius-control)`
- `src/dashboard/styles.test.ts` - imported `esbuild`; added the `Phase 19 radius tokens (parse level)` describe block with four assertions total (esbuild zero-warnings, anchored `:root` declaration match, comment hygiene, `.segmented` token usage); documented why the comment-stripping regex must stay non-greedy
- `.planning/phases/19-design-system-control-styling/19-VALIDATION.md` - amended constraint fact 2 to name esbuild, distinguish declared-vs-downloaded, and supersede the `19-RESEARCH.md` prediction

## Verbatim RED Output (Task 1 Step 3, against the unmodified/broken styles.css)

```
FAIL src/dashboard/styles.test.ts > styles.css — Phase 19 radius tokens (parse level) > the whole file has zero CSS syntax warnings under a real parser
AssertionError: esbuild reported 1 warning(s) parsing styles.css: [{"id":"css-syntax-error","location":{"column":59,"file":"<stdin>","length":0,"line":56,"lineText":"     so declared only here, following the --space-*/--zone-*/--load-*","namespace":"","suggestion":":"},"notes":[],"pluginName":"","text":"Expected \":\""}]: expected [ { detail: undefined, …(5) } ] to have a length of +0 but got 1

 ❯ src/dashboard/styles.test.ts:360:7
    358|       result.warnings,
    359|       `esbuild reported ${result.warnings.length} warning(s) parsing s…
    360|     ).toHaveLength(0);
    Tests  1 failed | 40 passed (41)
```

## Post-fix `build-widgets` line (Task 1 Step 5, matching before/after pair)

Before the fix, `npm run build-widgets` emitted (per 19-05-SUMMARY.md / 19-VALIDATION.md's Gap-Closure Record): `▲ [WARNING] Expected ":" [css-syntax-error]` at `<stdin>:56:59`.

After the fix, the full redirect-and-capture gate (`rm -f /tmp/bw.log && npx vitest run src/dashboard/styles.test.ts && npm test && npm run build-widgets > /tmp/bw.log 2>&1; BW=$?; ... test $BW -eq 0 && ! grep -q 'css-syntax-error' /tmp/bw.log`) exited 0. `grep -c 'css-syntax-error' /tmp/bw.log` returns `0`. Build log tail:

```
Building dashboard SPA...
✓ Built dashboard SPA (index.html)

Widget library build complete!
Output: dist/widgets/ (widgets, pages, and the dashboard SPA)
BW_EXIT=0
```

## GD-01 Lockfile Evidence

`npm ls esbuild`:
```
strava-analytics@1.0.0 /Users/pedf/workspace/strava-widgets/.claude/worktrees/agent-a2e3d92b3c3e40e33
├── esbuild@0.27.3
└─┬ vite@7.3.1
  └── esbuild@0.27.3 deduped
```

`git diff package-lock.json | grep -c '^+ *"node_modules/'` returns `0` — the only lockfile change is the `devDependencies` reference itself:
```
+        "esbuild": "^0.27.3",
```

## 19-VALIDATION.md Constraint Fact 2, Amended Text (in full)

> 2. **Amended by plan 19-06 (GD-01).** The substantive constraint stands and was honored: no DOM, CSSOM or rendering environment was authorized or added — jsdom, happy-dom, `@testing-library/*`, puppeteer and playwright are all still absent, and nothing added by gap closure can discharge a Manual-Only row that a human did not observe. What changed is narrower than that: gap closure declared exactly one new `devDependency`, `esbuild@^0.27.3`, for whole-file CSS parse validation (see plan 19-06, decision GD-01). Zero packages were downloaded to add it — esbuild 0.27.3 was already resolved in `package-lock.json` with a registry URL and an integrity hash as `vite`'s own dependency, so what changed is that it became explicitly *declared*, not that anything was newly *downloaded*; keep that distinction exact. This amendment supersedes `19-RESEARCH.md` § Package Legitimacy Audit's prediction of "no new `package.json` dependency, no new `devDependency`" for this phase, which is inaccurate as written from this plan onward.

This explicitly distinguishes *declared* (grew by one) from *downloaded* (unchanged at zero), and names the superseded `19-RESEARCH.md` prediction. The frontmatter `nyquist_compliant: false` and the 13-row Manual-Only Verifications table were left untouched (verified by a scoped check that fails loudly if either is disturbed).

## Mutation-Check Transcript (Task 2 — all three assertions in the parse-level block)

Reintroduced the defect (`--space-*/--zone-*/--load-*` restored in the comment at `styles.css:56`), ran `npx vitest run src/dashboard/styles.test.ts`. All three assertions in the parse-level block failed:

```
× the whole file has zero CSS syntax warnings under a real parser
  AssertionError: esbuild reported 1 warning(s) parsing styles.css: [{"id":"css-syntax-error", ... "text":"Expected \":\""}]: expected [ { detail: undefined, …(5) } ] to have a length of +0 but got 1

× --radius-control and --radius-panel are anchored, reachable :root declarations
  AssertionError: --radius-control is not an anchored :root declaration in the parsed fragment list: expected false to be true

× comment stripping leaves no stray */ — no comment terminated early
  AssertionError: expected '\n\n:root {\n  \n  --bg: #ffffff;\n  …' not to contain '*/'
```

`Tests 3 failed | 40 passed (43)`. Confirmed the pre-existing source-text-layer assertion **`:root declares both radius tokens` stayed green** throughout this mutation (visible in the passing list) — that contrast (source text always correct, parse result silently wrong, only the new layer catches it) is the whole point of this plan. Reverted the CSS to the fixed comment afterward; `git status --porcelain src/dashboard/styles.css` returned empty and `npx vitest run` returned to 43/43 passing.

## Mutation-Check Result (Task 3 — `.segmented` regression assertion)

Reverted `.segmented`'s `border-radius` to the literal `4px`, ran `npx vitest run src/dashboard/styles.test.ts`:

```
× .segmented derives its own corner radius from --radius-control, not a literal
  AssertionError: expected '\n  display: inline-flex;\n  border: …' to contain 'border-radius: var(--radius-control)'

- border-radius: var(--radius-control)
+ (not present — literal border-radius: 4px found instead)
```

Restored `var(--radius-control)`; assertion returned to green.

## Before/After Counts

| Metric | Before (pre-plan) | After |
|---|---|---|
| `grep -c 'border-radius: 4px' src/dashboard/styles.css` | 5 | **4** (lines 288, 480, 575, 654 — unchanged, out of WR-01 scope) |
| `grep -c 'var(--radius-control)' src/dashboard/styles.css` | 4 | **5** |
| `npm test` passing count | 909 (baseline, per 19-05-SUMMARY.md; 828 in this fresh worktree before the gitignored `data/stats`/`data/dashboard` fixtures were copied over — see Deviations) | **913** (909 + 4 new assertions: esbuild zero-warnings, anchored `:root` match, comment hygiene, `.segmented` token check) |

## Decisions Made

- **GD-01 (declared esbuild as an explicit devDependency).** Followed exactly as specified in the plan. Rationale: a transitively-available parser (via vite) is fragile against a future Rolldown migration; an explicit declaration turns a silent disappearance into a resolution failure. Zero packages downloaded — asserted via `git diff package-lock.json` (0 new `node_modules/*` entries) and `npm ls esbuild` (single copy, deduped under vite).
- **Task boundaries split exactly as the plan specifies**: Task 1 adds only the esbuild-warnings assertion (observed RED before the CSS fix); Task 2 adds the two dependency-free assertions (Assertion A anchored-match, Assertion B comment-hygiene) and mutation-checks all three together; Task 3 adds the `.segmented` token-usage assertion and its own isolated mutation-check. This kept each commit's diff scoped to exactly the files the plan's `<files>` list for that task names.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing gitignored data fixtures blocked `npm test`'s 909-baseline criterion**
- **Found during:** Task 1 Step 5 (`npm test` after the comment fix)
- **Issue:** Five test files (`trends-training-load-logic`, `trends-yoy-logic`, and others) `readFileSync` gitignored files under `data/stats/` and `data/dashboard/` that do not exist in a fresh worktree checkout — worktrees don't inherit a parent checkout's untracked/gitignored files, producing `ENOENT` failures unrelated to any Phase 19 change. This is the same worktree-environment gap plan 19-04 documented and fixed (see `19-04-SUMMARY.md`).
- **Fix:** Copied `data/stats/` and `data/dashboard/` from the main repo checkout into this worktree (not committed — both remain gitignored).
- **Files modified:** none tracked; two gitignored directories populated locally
- **Verification:** `npm test` went from 41 files/828 passed (with the 5 ENOENT failures) to 46 files/910 passed immediately after the copy (before Task 2/3's additional assertions), matching the established 909-baseline + Task 1's one new assertion.
- **Committed in:** N/A (gitignored, not committed)

---

**Total deviations:** 1 auto-fixed (blocking-issue workaround for a worktree-local environment gap, matching prior-plan precedent)
**Impact on plan:** Necessary to honestly verify the plan's own `npm test` baseline criterion rather than skip it. No scope creep — no tracked file was touched by this deviation.

## Issues Encountered

None beyond the documented deviation. Every RED/GREEN observation and mutation-check matched the plan's `<groundwork>` predictions exactly (esbuild warning text, line/column, anchored-match failure message, comment-hygiene failure message).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `--radius-control` now resolves in a real CSS parse; all five rules that reference it (input/select/textarea baseline, button baseline, both `.segmented__option` end-child radii, and now `.segmented` itself) render the intended 4px corner instead of falling back to 0.
- The parse-level gate is in place and proven with teeth (observed RED against the real, shipped defect) for plans 19-07/19-08/19-09 to build on if further CSS-parse-adjacent gaps surface.
- `19-VALIDATION.md`'s constraint record is now internally consistent; `nyquist_compliant: false` and the phase gate remain open pending the rest of gap closure (19-07 GAP 2 focus-ring occlusion, 19-09 checkpoint re-verification) — this plan does not close the phase gate by itself.
- No blockers identified for 19-07/19-08/19-09.

## Self-Check: PASSED

- FOUND: src/dashboard/styles.css
- FOUND: src/dashboard/styles.test.ts
- FOUND: .planning/phases/19-design-system-control-styling/19-VALIDATION.md
- FOUND: .planning/phases/19-design-system-control-styling/19-06-SUMMARY.md
- FOUND commit: c2ae020 (Task 1)
- FOUND commit: 37597af (Task 2)
- FOUND commit: fd5fdfd (Task 3)
- FOUND commit: f42c0f7 (docs: SUMMARY)

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-12*
