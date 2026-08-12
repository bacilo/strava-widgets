---
phase: 19-design-system-control-styling
plan: 08
subsystem: styling
tags: [css, testing, selector-parsing, gap-closure]

# Dependency graph
requires:
  - phase: 19-design-system-control-styling (plan 07)
    provides: The stacking-context fix and mutation-checked assertions this plan hardens the test file's own selector parsing underneath
provides:
  - "A depth-aware splitTopLevelSelectors helper, closing the last known false-pass mechanism (T-19G-FALSEGREEN-11) in styles.test.ts's own selector-list parsing"
  - "Direct self-tests for splitTopLevelSelectors, independent of any downstream stylesheet assertion (T-19G-FALSEGREEN-12)"
  - "A written, in-file audit of what each of the four test helpers proves and what class of false pass it cannot rule out (T-19G-FALSEGREEN-13, accepted risk documented)"
affects: [19-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Depth-aware comma splitting for CSS selector lists in test helpers: walk the head character by character, track parenthesis depth, break only on a comma at depth 0 — a naive head.split(',') collides with commas nested inside :not()/:where() argument lists"
    - "Helper self-tests derive real-world fixtures (the shared hover head) from the actual source file at test time rather than pasting a literal copy, so the test tracks the real selector if it is ever edited"

key-files:
  created: []
  modified:
    - src/dashboard/styles.test.ts

key-decisions:
  - "Extended the fix to bodyForSelectorListToken as well as selectorListDeclares, even though the plan's groundwork singled out selectorListDeclares. Both helpers did the identical naive head.split(',').map(s => s.trim()), and the acceptance criteria's grep -c \"head.split(',')\" == 0 check is whole-file, not scoped to one function — leaving the twin instance in bodyForSelectorListToken would have left the same collision class reachable through a second helper and failed the acceptance gate. Documented here as a Rule 1/Rule 2 auto-fix: same bug, same fix, discovered while satisfying the plan's own literal acceptance criterion."

requirements-completed: [UI-02]

# Metrics
duration: 30min
completed: 2026-08-12
---

# Phase 19 Plan 08: Depth-Aware Selector Splitting & Test-Helper Audit Summary

**Replaced `selectorListDeclares`'s (and `bodyForSelectorListToken`'s) naive `head.split(',')` with a parenthesis-depth-aware `splitTopLevelSelectors`, demonstrated the exact false pass the naive splitter was capable of under a verified mutation, added direct self-tests for the new helper, and wrote an honest in-file audit of what each of the four test helpers in `styles.test.ts` can and cannot prove.**

## Performance

- **Duration:** 30 min
- **Tasks:** 2
- **Files modified:** 1 (`src/dashboard/styles.test.ts`)

## Accomplishments

- `splitTopLevelSelectors(head: string): string[]` added — walks a rule head character by character, tracking parenthesis depth, and breaks only on a comma at depth 0. Used in place of the naive split in both `selectorListDeclares` and `bodyForSelectorListToken` (see Deviations).
- The exact false pass WR-03 predicted was reproduced and recorded, not merely argued: under the verified mutation (real `:disabled, [aria-disabled="true"]` rule deleted, `opacity: 0.6` added to the shared hover rule's body), the naive splitter still returned `true` for `[aria-disabled="true"] declares opacity: 0.6`, while the depth-aware splitter correctly returned `false`.
- A dedicated `splitTopLevelSelectors — self-tests` describe block tests the helper on its own terms: a plain multi-selector list, the real shared hover head read live from `styles.css`, nested parentheses inside `:not(:is(...))`, and empty/single-selector heads.
- The Phase 19 banner comment (`styles.test.ts`, above the `Phase 19 control baseline` block) now carries a per-helper audit — `declarationsFor`, `selectorListDeclares`, `ruleWithHeadContaining`, `splitTopLevelSelectors` — each with one line on what it proves and what class of false pass it cannot rule out, plus an explicit pointer to plan 19-06's parse-level block as the layer that mitigates residual substring risk.
- `npm test`: **919/919 passing** (915 baseline at plan 19-07's close + 4 new self-tests). Delta from the 909 baseline at 19-05: **+10**.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make selectorListDeclares parenthesis-aware, proven by the false-pass mutation** - `5fe876e` (fix)
2. **Task 2: Self-test the splitter and record what the helper set still cannot catch** - `71a5a50` (test)

**Plan metadata:** this SUMMARY, committed by the executor immediately after this file (worktree mode — STATE.md/ROADMAP.md excluded, owned by the orchestrator).

## Files Modified

- `src/dashboard/styles.test.ts` — added `splitTopLevelSelectors` (with a docstring naming the concrete collision it prevents, in the style of `ruleWithHeadContaining`'s precedent, referencing WR-03); switched `selectorListDeclares` and `bodyForSelectorListToken` from `head.split(',').map(s => s.trim())` to `splitTopLevelSelectors(head)`; added a `splitTopLevelSelectors — self-tests` describe block (4 cases); extended the Phase 19 banner comment with the four-helper audit and an explicit statement of the 40-assertion scope decision.

## `splitTopLevelSelectors` As Written

```ts
function splitTopLevelSelectors(head: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of head) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts;
}
```

Used in two call sites: `selectorListDeclares` (line ~101) and `bodyForSelectorListToken` (line ~125). Both previously did the identical naive split.

## Mutation-Check Transcript (Task 1 — Load-Bearing Evidence)

**CSS mutation applied** (both halves, per `<groundwork>`):
1. Deleted the real `:disabled, [aria-disabled="true"] { color: var(--text-secondary); opacity: 0.6; cursor: default; }` rule (was `src/dashboard/styles.css` lines 1300-1305).
2. Added `opacity: 0.6;` to the shared hover rule's body — confirmed by grep that the edited rule's head contains `:where(:not(` (`button:where(:not(\n  :disabled, [aria-disabled="true"], .pagination__button--current, ...\n)):hover`), not `.activity-table tbody tr:hover` (a distinct, earlier rule with a byte-identical `background: color-mix(...)` declaration that a naive string replace would have hit instead).

**Observation 1 — depth-aware splitter, mutated file (the new, correct red):**
```
FAIL src/dashboard/styles.test.ts > styles.css — Phase 19 disabled treatment > :disabled declares the muted treatment
AssertionError: expected false to be true // Object.is equality

FAIL src/dashboard/styles.test.ts > styles.css — Phase 19 disabled treatment > [aria-disabled="true"] declares opacity: 0.6
AssertionError: expected false to be true // Object.is equality

Tests 2 failed | 44 passed (46)
```
Both disabled-treatment assertions correctly fail — the depth-aware splitter never lets the hover rule's nested `[aria-disabled="true"]` fragment stand in for a real top-level selector, so with the real rule deleted, both assertions report the true state: the rule is gone.

**Observation 2 — naive splitter temporarily restored, same mutated file (the false pass, demonstrated):**
```
FAIL src/dashboard/styles.test.ts > styles.css — Phase 19 disabled treatment > :disabled declares the muted treatment
AssertionError: expected false to be true // Object.is equality

Tests 1 failed | 45 passed (46)
```
Only `:disabled declares the muted treatment` fails. **`[aria-disabled="true"] declares opacity: 0.6` passes** — incorrectly — because `head.split(',')` on the hover rule's multi-line `:where(:not(...))` argument list produces the standalone fragment `[aria-disabled="true"]` (byte-identical to the needle), and the hover rule's body now contains the mutated-in `opacity: 0.6`, satisfying `selectorListDeclares`'s check on the wrong rule entirely. **This is the false pass the whole task exists to close, observed rather than argued.**

**Revert:** naive split removed, depth-aware split restored; both halves of the CSS mutation reverted. `git status --porcelain src/dashboard/styles.css` returned empty. Full suite re-run: `npx vitest run src/dashboard/styles.test.ts` → 46/46 passing; `npm test` → 915/915 passing (unchanged from 19-07's close, confirming no regression from the revert).

## Self-Test Cases (Task 2)

Four cases in the `splitTopLevelSelectors — self-tests` describe block, all passing:

1. **Plain multi-selector list:** `'.a, .b, .c'` → `['.a', '.b', '.c']`.
2. **Real shared hover head, read live from `styles.css`** (not pasted): matched via `cssNoComments.match(/([^{}]*:where\(:not\([^{}]*)\{/)`, split, asserted to produce exactly 1 top-level selector and to never contain `[aria-disabled="true"]` as a standalone element.
3. **Nested parentheses inside `:not(:is(...))` stay whole:** `'.a:not(:is(.b, .c)), .d'` → `['.a:not(:is(.b, .c))', '.d']`.
4. **No spurious empty parts:** `'.solo'` → `['.solo']`; `'  .solo  '` → `['.solo']` (whitespace trimmed); `''` → `['']` (one empty part, not multiple).

## Helper Audit Text Added to the Banner

Added to the comment block above `describe('styles.css — Phase 19 control baseline', ...)`. Full text (verbatim, condensed for this summary — see `src/dashboard/styles.test.ts` for the exact in-file wording):

- **`declarationsFor`** — proves a rule with this exact selector exists and returns its body. Cannot rule out a body edit that preserves the substring an assertion checks while changing the declaration's actual meaning (e.g. an added `!important`, or the same property repeated later in the body with a different cascade-winning value).
- **`selectorListDeclares`** (now depth-aware) — proves some rule whose top-level selector list contains `needle` also contains `declaration` as a body substring. Cannot rule out a coincidental substring match inside an unrelated declaration's value — it checks `.includes()` on the whole body, not that `declaration` is a distinct, whole `property: value` pair.
- **`ruleWithHeadContaining`** — proves some rule's head contains `needle` as a raw substring; deliberately does not parse selector structure. Cannot rule out matching the wrong rule if `needle` is short/generic enough to appear in an unrelated head, or missing the intended rule if `cssNoComments`'s comment-stripping is ever wrong.
- **`splitTopLevelSelectors`** — proves a comma nested inside parentheses is never mistaken for a selector-list boundary. Cannot rule out a false split on an attribute selector containing a literal comma inside its own quoted value (e.g. `[data-x="a,b"]`) — a construct absent from this stylesheet today, untested by the self-tests above.

All four operate on stylesheet TEXT, never a rendered page. The audit states GAP 1 proved text-level agreement is insufficient on its own, and names plan 19-06's parse-level block (`styles.css — Phase 19 radius tokens (parse level)`, using esbuild's real CSS parser) as the layer a future claim about actual parsing — not just character presence — belongs in.

**Scope statement (T-19G-FALSEGREEN-13, accepted, not eliminated):** the banner states plainly that the 40 pre-existing Phase 19 substring assertions were not individually rewritten, because doing so is out of scope for a gap-closure pass and would put a large unreviewed diff in front of the phase gate for defects that are theoretical here, not observed — the residual risk is mitigated in depth (not eliminated) by the parse-level block's independent check on the one property class GAP 1 actually broke.

## No Test Dependency Added

`git diff package.json` is empty for this plan — no new dependency was installed or referenced.

## Deviations from Plan

**1. [Rule 1/Rule 2 — same bug via a second helper] Also fixed `bodyForSelectorListToken`'s identical naive split.**
- **Found during:** Task 1, while verifying the acceptance criterion `grep -c "head.split(',')" src/dashboard/styles.test.ts` returns `0`.
- **Issue:** `bodyForSelectorListToken` (added by plan 19-07 for the numeric z-index comparison) does the exact same `head.split(',').map((s) => s.trim())` as `selectorListDeclares` did. The plan's `<groundwork>` and scope note discuss only `selectorListDeclares`, but the acceptance criterion's grep is whole-file, not scoped to one function — and leaving this instance in place would have left the identical collision mechanism reachable through a second, structurally identical helper (it is not currently exploitable against any live needle, but neither was the mutation obvious before WR-03 found it).
- **Fix:** Switched `bodyForSelectorListToken` to use `splitTopLevelSelectors(head)` as well, same as `selectorListDeclares`.
- **Files modified:** `src/dashboard/styles.test.ts`
- **Commit:** `5fe876e`

No other deviations — the rest of the plan executed exactly as written, using the verified mutation recipe from `<groundwork>` without needing to invent an alternative.

## Issues Encountered

None. The mutation-check transcript matched the plan's predicted false pass and correct red on the first attempt for both the depth-aware and naive splitter runs.

## User Setup Required

None — no external service configuration required. `node_modules` was installed fresh in this worktree (gitignored, not committed); `data/stats` and `data/dashboard` were copied in from the main checkout to allow an honest `npm test` run, per the wave-8 worktree setup precedent (not committed, gitignored).

## Next Phase Readiness

- T-19G-FALSEGREEN-11 and T-19G-FALSEGREEN-12 are closed: the depth-aware splitter is in place, mutation-verified, and self-tested independently of any downstream stylesheet assertion.
- T-19G-FALSEGREEN-13 is accepted and documented in the file itself, not silently unexamined — the residual substring risk across 40 pre-existing assertions is a recorded position, mitigated in depth by plan 19-06's parse-level block, not eliminated.
- No blockers identified for plan 19-09.

## Self-Check: PASSED

- FOUND: src/dashboard/styles.test.ts
- FOUND commit: 5fe876e (Task 1)
- FOUND commit: 71a5a50 (Task 2)

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-12*
