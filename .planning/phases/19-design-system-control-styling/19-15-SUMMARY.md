---
phase: 19-design-system-control-styling
plan: 15
subsystem: testing
tags: [vitest, css-guard-testing, mutation-testing, regex-parsing]

requires:
  - phase: 19-design-system-control-styling
    provides: "19-14's H1 fix (sticky rung moved to #app-nav-root) and its four-rung ladder assertion, which this plan's helper changes had to keep targeting correctly"
provides:
  - "Offset-based at-rule rejection (AT_RULE_RANGES / assertNotAtRuleScoped) that catches a rule nested anywhere inside an @media block, not only the unreachable prelude case"
  - "Last-wins bodyForSelectorListToken and extractNumericDeclaration, matching how the CSS cascade actually resolves a redeclared selector or property"
  - "A head-shape hover assertion that fails when :hover or the button scope is removed, not just when one of the eight exclusion tokens is deleted"
  - "One RULE_SCANNER factory and one declarationFragments helper replacing three duplicated copies of each"
  - "A helper-audit comment whose every claim is true of the code, with the two omitted cascade blind spots documented and the false at-rule guarantee removed"
affects: [19-16, 19-17, future-css-guard-work]

tech-stack:
  added: []
  patterns:
    - "Offset-based range rejection (brace-matched AT_RULE_RANGES) instead of head-text pattern matching, for guards that must reject a match by WHERE it resolves, not what its head looks like"
    - "Last-wins collection (collect every candidate, keep the last) as the correct helper semantics for anything reading a CSS cascade property from source text"
    - "Head-shape assertions (anchored startsWith/endsWith plus a parsed argument list) instead of toContain() substring checks, for guards where the substring check cannot distinguish head structure from body content"

key-files:
  created: []
  modified:
    - src/dashboard/styles.test.ts

key-decisions:
  - "Kept Task 1's inherited (uncommitted, unreviewed) substrate work after a full line-by-line audit against the plan and 19-REVIEW-round3.md's proposed fixes — found materially correct and complete, so salvaged rather than rewritten"
  - "Changed ruleWithHeadContaining's return shape from head+body to head+'{'+body+'}' to fix a real defect in the review's own proposed hover-assertion snippet (rule.indexOf('{') assumed a brace was present in the return value; it never was) — safe because this helper has exactly one caller in the whole file"
  - "Switched the ladder test's .app-nav not-sticky check (a fifth assertion beyond the four rungs, added by 19-14) from declarationsFor to bodyForSelectorListToken alongside the .records-jump fix, for full within-test helper consistency, after confirming it is behaviour-preserving via needle enumeration"

patterns-established:
  - "For any future helper-audit rewrite: keep a hard length budget in mind if downstream tooling slices the comment block by character offset (this plan's own verify script sliced 6000 chars from the audit's start and required 'GAP 1' inside that slice — two draft paragraphs had to be trimmed to fit)"

requirements-completed: [UI-02]

duration: recovery session (original agent killed mid-stream before any commit; this session audited inherited work, completed remaining tasks, and ran the full gate)
completed: 2026-08-13
---

# Phase 19 Plan 15: Close Round 3's Guard-Layer False Greens Summary

**Hardened the at-rule/cascade helper substrate to offset-based rejection and last-wins semantics, replaced the widened-but-mutation-blind hover assertion with a head-shape guard, and corrected the helper-audit comment's two false or incomplete guarantees — recovered from a killed prior run whose uncommitted Task 1 work was audited and kept.**

## Performance

- **Tasks:** 3/3 completed
- **Files modified:** 1 (`src/dashboard/styles.test.ts`)
- **Test count:** 52 (round 3 baseline) → 58 (+6 self-tests, all net-new)
- **Full suite:** 46 files / 927 tests (baseline 46/921 + 6)

## Recovery Note (read this first)

A prior executor run for this plan was killed mid-stream by an API error. It committed
**nothing** — `git log --grep="19-15"` was empty and HEAD was still `d9b3aaf` (19-14's last
commit) when this recovery session started. It left one uncommitted, unreviewed change:
`src/dashboard/styles.test.ts`, +221/-54, already passing at 58/58. Its last narration line
("Now remove the flawed synthetic at-rule self-test and adjust wording") suggested unfinished,
self-critical work in flight.

I read the full uncommitted diff and audited it line by line against `19-15-PLAN.md`'s Task 1
requirements and `19-REVIEW-round3.md`'s proposed fixes (R3-CR-01, R3-WR-02, R3-IN-01,
R3-IN-03) before touching anything else. Findings:

- The inherited work correctly implemented `AT_RULE_RANGES` (brace-matched, computed once),
  `assertNotAtRuleScoped` (offset rejection replacing the old head-only check), last-wins
  `bodyForSelectorListToken` and `extractNumericDeclaration` (escaped, anchored, `matchAll`),
  and the `RULE_SCANNER`/`declarationFragments` consolidation — matching Task 1's action text
  and the review's proposed snippets essentially verbatim, with correct docstrings.
- I found **no leftover "flawed synthetic at-rule self-test"** anywhere in the file. The
  describe block present (`AT_RULE_RANGES / assertNotAtRuleScoped / last-wins — self-tests`)
  contains exactly the six cases the plan's Task 1 action text enumerates, no more, no fewer —
  whatever the dead agent judged flawed appears to have already been removed before it was
  killed, or its narration referred to a draft that never reached disk. I did not find or
  invent a defect here; verified via `grep -n "synthetic"` and a full read of the describe
  block.
- I re-ran and newly recorded (this session, terminal output below) every mutation Task 1's
  acceptance criteria require, since none of that evidence existed before (nothing was
  committed, and no prior SUMMARY exists for this plan).

Conclusion: **salvaged, not rewritten**, for Task 1. This is the harder, more thorough form of
salvage the user asked for — full audit, not "it passes so keep it."

## Accomplishments

- Closed R3-CR-01: `bodyForSelectorListToken` and `ruleWithHeadContaining` now reject a match
  by its OFFSET falling inside a brace-matched at-rule range, catching a rule nested anywhere
  inside `@media` — not only the unreachable prelude-head case the old guard covered.
- Closed R3-WR-02: `bodyForSelectorListToken` and `extractNumericDeclaration` are now
  last-wins, matching the CSS cascade, with `extractNumericDeclaration` also escaped
  (R3-IN-01) and anchored to a declaration boundary.
- Closed R3-IN-03: one `RULE_SCANNER()` factory and one `declarationFragments()` helper
  replace three duplicated copies of each.
- Closed R3-CR-02: the shared hover rule's guard now asserts the head's shape (anchored
  `button:where(:not(` prefix, anchored `)):hover` suffix, `:not()` argument parsed and
  compared as an ordered list) instead of eight independent substring checks on head+body —
  and fails on both mutations the review proved it survived (removing `:hover`, widening
  `button` to `*`), while still failing when any one of the eight exclusion tokens is removed.
- Closed R3-IN-02: all four ladder rungs (plus the fifth `.app-nav` not-sticky check) now read
  through `bodyForSelectorListToken` uniformly, instead of `.records-jump` alone using
  `declarationsFor`.
- Closed R3-IN-04: the CR-02 test's duplicate radius assertion states in one clause that it
  deliberately duplicates the button-baseline test.
- Corrected the helper-audit comment: removed the false "guarded — throws rather than
  silently returning the wrong block's body" claim, documented both R3-WR-02 blind spots and
  their last-wins resolution (naming the `.segmented__option` cancellation case), named the
  substrate consolidation, and extended the closing paragraph with Round 4's own
  documented-but-false-guard mechanism, citing `19-REVIEW-round3.md`.

## Task Commits

1. **Task 1: Harden the helper substrate** — `722b640` (test) — audited-and-kept inherited work
2. **Task 2: Replace the hover assertion with a head-shape guard; R3-IN-02/R3-IN-04** — `fb5c888` (test)
3. **Task 3: Correct the helper-audit comment** — `7b231c0` (docs)

No separate plan-metadata commit was made yet — this SUMMARY, STATE.md, and ROADMAP.md are
committed together after this document (see final commit below).

_Note on TDD staging: both Task 1 and Task 2 carry `tdd="true"`, but this plan's actual unit of
work is test-helper code that guards already-correct, already-shipped CSS — there is no
separate "production code" to red/green against; the mutation-execute-revert cycle documented
below IS this plan's acceptance mechanism, in place of a literal failing-test-first commit.
Task 1's commit represents already-passing, audited-and-kept work (nothing to stage red against
retroactively without discarding correct code); Task 2's commit was built incrementally with
mutations run and reverted before the commit, not after. All `test(...)` commit types were used
per the file-type convention (test-only changes) rather than a strict RED/GREEN split._

## Files Created/Modified

- `src/dashboard/styles.test.ts` — the only file touched, across all three tasks. `styles.css`
  is byte-identical to its state at the end of plan 19-14 (`git diff d9b3aaf HEAD -- src/dashboard/styles.css` is empty), confirmed after every mutation was reverted.

## Task 1 — Needle Enumeration (required by plan)

Every real (non-synthetic) needle passed to `bodyForSelectorListToken` anywhere in this file,
enumerated with a standalone re-implementation script run against the real stylesheet outside
the test file (same `splitTopLevelSelectors`, `RULE_SCANNER`, `AT_RULE_RANGES`,
`isAtRuleScoped` logic, copied verbatim):

| Needle | Total regex matches | Valid (non-at-rule-scoped) matches | Changed under last-wins? |
|---|---|---|---|
| `.app-nav[data-open="true"] .app-nav__links` | 1 | 0 | N/A — throws (media-nested only, the R3-CR-01 proof case) |
| `.app-nav__toggle` | 2 | 1 | No |
| `:disabled:focus-visible` | 1 | 1 | No |
| `.segmented__option` | 1 | 1 | No |
| `#app-nav-root` | 1 | 1 | No |
| `.records-jump` | 1 | 1 | No |
| `.splits-table__km` | 1 | 1 | No |
| `:focus-visible` | 1 | 1 | No |
| `.app-nav` | 1 | 1 | No |

Every real needle resolves to exactly one valid (non-at-rule-scoped) match today, so **the set
of assertions whose meaning changed under last-wins is empty** — last-wins is behaviour-
preserving for every existing assertion in this file, exactly as Task 1 expected.

## Mutations Executed and Recorded (7 total, all reverted, stylesheet confirmed byte-identical after each)

### 1. Media-nested-only selector throws (R3-CR-01, Task 1)

Self-test assertion (part of the 58 passing): `bodyForSelectorListToken('.app-nav[data-open="true"]
.app-nav__links')` expects `toThrow(/at-rule block/)`.

Review's original executed output (before this plan, quoted from `19-REVIEW-round3.md`):
```
bodyForSelectorListToken('.app-nav[data-open="true"] .app-nav__links')
  -> RESOLVED (no throw). body = "display: flex;\n    flex-direction: column;"
```
Now: throws `Match for ".app-nav[data-open=\"true\"] .app-nav__links" resolves inside an
at-rule block...`. Confirmed passing in the 58/58 run.

### 2. Cascade override on the rung-4 selector (R3-WR-02, Task 1)

Command: appended `#app-nav-root { z-index: 0; }` to the end of `styles.css` (the plan's
literal mutation, `.app-nav { z-index: 0; }`, updated to the post-19-14 rung-4 selector,
`#app-nav-root`, per the plan's own "or, after 19-14, the equivalent override" instruction).

Failure observed:
```
FAIL src/dashboard/styles.test.ts > styles.css — Phase 19 focus ring > the sticky-layer ladder
(#app-nav-root > .records-jump > .splits-table__km > :focus-visible) holds numerically and in order
AssertionError: expected +0 to be 20 // Object.is equality
- 20
+ 0
```
Reverted (`cp` from a pre-mutation backup); re-ran: `58 passed`, `git status --porcelain
src/dashboard/styles.css` empty.

### 3. Within-body duplicate z-index (R3-WR-02, Task 1)

Command: mutated `#app-nav-root`'s body to declare `z-index: 20;` then `z-index: 0;` (two
declarations, same rule).

Failure observed: identical shape to mutation 2 —
```
AssertionError: expected +0 to be 20 // Object.is equality
- 20
+ 0
```
Reverted; re-ran: `58 passed`, stylesheet clean.

### 4. Removed `:hover` from the shared hover rule's head (R3-CR-02, Task 2)

Command: changed `button:where(:not(...)):hover {` to `button:where(:not(...)) {`.

Failure observed:
```
FAIL ... the shared hover rule is button-scoped, hover-gated, and excludes all eight tokens
AssertionError: expected false to be true // Object.is equality
```
(the `endsWith(')):hover')` check). Reverted; re-ran: `58 passed`, stylesheet clean.

### 5. Widened `button` scope to `*` (R3-CR-02, Task 2)

Command: changed the rule's selector prefix from `button:where(:not(` to `*:where(:not(`.

Failure observed:
```
FAIL ... the shared hover rule is button-scoped, hover-gated, and excludes all eight tokens
AssertionError: expected false to be true // Object.is equality
```
(the `startsWith('button:where(:not(')` check, at the `*:where(...)` line). Reverted; re-ran:
`58 passed`, stylesheet clean.

### 6. Deleted `.calendar-day--tint-3` from the exclusion list (WR-01 coverage check, Task 2)

Command: removed `.calendar-day--tint-3,` from the `:not()` argument list.

Failure observed (`toEqual` diff on the parsed selector list):
```
- Expected
+ Received
   ".calendar-day--tint-2",
-  ".calendar-day--tint-3",
   ".calendar-day--tint-4",
```
Reverted; re-ran: `58 passed`, stylesheet byte-identical to backup (`diff` confirmed).

### 7. Re-verification: deleted `position: sticky` from `.records-jump` (upstream_context requirement, Task 2)

Not one of the plan's three named Task 2 mutations, but run to satisfy the recovery brief's
explicit instruction to re-verify the 19-14 ladder assertion still targets the intended rule
after switching `.records-jump` from `declarationsFor` to `bodyForSelectorListToken`.

Command: changed `.records-jump { position: sticky; ...}` to `.records-jump { position: static;
...}`.

Failure observed:
```
FAIL ... the sticky-layer ladder ... holds numerically and in order
AssertionError: expected '\n  position: static;\n  z-index: 10;…' to contain 'position: sticky'
```
— confirming the switched helper call still resolves to `.records-jump`'s own rule body
(the mutated text appears in the failure diff), not a stale or wrong rule. Reverted; re-ran:
`58 passed`, stylesheet clean, tsc clean.

## Task 3 — Traceability (audit claim → implementing line)

- **Claim:** "`AT_RULE_RANGES` now computes every at-rule block's `[start, end)` offset once by
  brace matching over `cssNoComments`, and `assertNotAtRuleScoped` rejects a match whose OFFSET
  falls inside any range."
  **Implementing lines:** `const AT_RULE_RANGES` at `src/dashboard/styles.test.ts:159`
  (brace-matching loop); `function assertNotAtRuleScoped` at `:209` (the `AT_RULE_RANGES.some`
  offset check).

- **Claim:** "Both are now last-wins: `bodyForSelectorListToken` returns the last
  non-at-rule-scoped candidate's body; `extractNumericDeclaration` uses `matchAll` and returns
  the final match, anchored to a declaration boundary, `property` escaped like
  `declarationsFor` escapes `selector`."
  **Implementing lines:** `function bodyForSelectorListToken` at `:254`, its `return lastBody as
  string` at `:279` (the loop above it keeps overwriting `lastBody` on every valid match, so the
  last one wins); `function extractNumericDeclaration` at `:299`, its `return
  Number(matches[matches.length - 1][1])` at `:305`.

- **Claim:** "Both are now single points of correction, `RULE_SCANNER()` ... and
  `declarationFragments(body)`."
  **Implementing lines:** `function RULE_SCANNER` at `:103`; `function declarationFragments` at
  `:113`; both are the only definitions of their respective logic in the file (confirmed by the
  Task 1 verify script's scanner-literal-count check, which requires the regex literal to
  appear at most once).

## Decisions Made

- **Kept Task 1's inherited work after full audit** rather than rewriting it, per the recovery
  brief's instruction that salvage requires a real audit, not a rubber stamp. The audit found
  the substrate implementation correct and complete against both the plan's action text and the
  review's proposed fix snippets; I found nothing to fix in it beyond confirming the mutation
  evidence, which did not exist yet (nothing had been committed).
- **Changed `ruleWithHeadContaining`'s return shape** from `head + body` to `head + '{' + body +
  '}'`. This was necessary because the review's own proposed hover-assertion code (`const head =
  rule.slice(0, rule.indexOf('{') === -1 ? rule.length : rule.indexOf('{'))`) assumes the
  returned string contains a brace; the actual implementation never included one, so
  `rule.indexOf('{')` was always `-1` and the "head" it sliced out was actually the entire
  rule (head + body). This is a Rule 1 (auto-fix bugs) correction — the plan's own action text
  and the review's own fix snippet both had this latent defect. Verified safe: `grep -n
  "ruleWithHeadContaining("` shows exactly one call site in the whole file (the hover test
  itself), so changing the return contract could not affect any other assertion. Docstring
  updated to describe the new contract and why it exists.
- **Switched the `.app-nav` not-sticky check (a fifth ladder-adjacent assertion added by 19-14,
  not one of R3-IN-02's originally named four rungs) to `bodyForSelectorListToken`** alongside
  the `.records-jump` fix, for uniformity within the same test function. Confirmed
  behaviour-preserving via the needle enumeration table above (`.app-nav` resolves to exactly
  one valid match).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ruleWithHeadContaining`'s return shape did not support the plan's own proposed head-extraction approach**
- **Found during:** Task 2, while implementing the head-shape hover assertion
- **Issue:** The plan's `<action>` text and `19-REVIEW-round3.md`'s R3-CR-02 fix snippet both
  slice the head out of `ruleWithHeadContaining`'s return value at its first `{`, but the
  actual helper returned `head + body` with the brace stripped — `indexOf('{')` was always
  `-1`, so the "head" computed was the entire rule text (head and body concatenated), and the
  `endsWith(')):hover')` check failed even on unmutated CSS.
- **Fix:** Changed the return value to `` `${head}{${body}}` ``, preserving the brace boundary
  so the plan's slicing approach works as written. Verified this helper has exactly one call
  site (the hover test) before making the change, so no other assertion could regress.
- **Files modified:** `src/dashboard/styles.test.ts`
- **Verification:** All 58 tests pass; the three required Task 2 mutations correctly fail
  against this corrected helper (see mutations 4-6 above).
- **Committed in:** `fb5c888` (Task 2 commit)

**2. [Rule 3 - Blocking, verify-script constraint] Trimmed two audit paragraphs to fit the plan's 6000-character slice window**
- **Found during:** Task 3, running the plan's own verify script
- **Issue:** The plan's Task 3 verify script slices exactly 6000 characters from the audit
  comment's start (`t.indexOf('// - selectorListDeclares')`) and requires the string `"GAP 1"`
  to appear inside that slice. My first draft of the new "Cascade order" and "Substrate
  consolidation" paragraphs pushed the `GAP 1` reference (in the pre-existing closing
  paragraph) to offset 6333 — outside the window.
- **Fix:** Trimmed both new paragraphs (removed redundant restatement, shortened phrasing)
  without removing any required content, bringing the `GAP 1` offset to 5935.
- **Files modified:** `src/dashboard/styles.test.ts`
- **Verification:** Re-ran the plan's verify script; passed. All acceptance-criteria content
  (both blind spots, both helper names, the `.segmented__option` case, the Round 4 citation)
  is still present.
- **Committed in:** `7b231c0` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3)
**Impact on plan:** Both were necessary corrections to defects in the plan's own proposed code
snippet / verify-script interaction with the audit's required content, discovered while
implementing exactly what the plan specified. No scope creep — no additional CSS changes, no
additional test assertions beyond what the plan's acceptance criteria required.

## Issues Encountered

None beyond the two deviations documented above. The recovery audit itself (reading the full
uncommitted diff against the plan and the review before touching anything) surfaced no defects
in the inherited Task 1 work — it was correct as found.

## Full Gate Verification

- `npm test` (vitest run, full suite): **46 files / 927 tests passed** (baseline before this
  plan: 46 files / 921 tests — the +6 delta is exactly this plan's new self-test describe
  block, no other file changed).
- `npx tsc --noEmit`: clean, exit 0.
- `npm run build-widgets`: exit 0, zero `css-syntax-error`, zero new warnings (the pre-existing
  `<script>... can't be bundled without type="module">` notes for the standalone map/route
  pages are unrelated informational esbuild output, present before this plan too).
- `npm run verify-dashboard`: **37/37 checks passed**, exit 0.
- `git diff d9b3aaf HEAD -- src/dashboard/styles.css`: empty — the stylesheet is byte-identical
  to its state at the end of plan 19-14, confirmed after every one of the 7 mutations above was
  reverted.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The at-rule and cascade blind spots Round 3 found in this file's guard layer (R3-CR-01,
  R3-WR-02) are closed, with mutation evidence recorded above rather than inferred.
- The hover assertion (R3-CR-02) now fails under both mutations the review proved it survived,
  without losing the eight-token WR-01 coverage.
- R3-IN-01 through R3-IN-04 are all closed.
- Remaining open Round 3 findings **not** in this plan's scope: R3-WR-03 (the sticky-layer
  ladder comment's total-order claim does not describe a focused descendant of a sticky rung —
  no test change required per the review, a `styles.css` comment scoping fix) and R3-WR-04 (the
  `.app-nav` ladder comment states a disproven rendered claim as settled fact — also a
  `styles.css` comment fix). Both are explicitly out of scope here: this plan's constraint
  section required `git status --porcelain src/dashboard/styles.css` to stay empty throughout,
  and the plan's own text says "Plan 19-16 owns the stylesheet's comments." Plan 19-16 should
  pick these up.
- `requirements-completed: [UI-02]` reflects this plan closing the guard-layer findings that
  were blocking UI-02's re-verification confidence; it does not by itself re-run the rendered
  Probe G re-verification plan 19-17 is scoped to do.

## Self-Check

Verified before finalizing:

- Commits: `722b640` FOUND, `fb5c888` FOUND, `7b231c0` FOUND (`git log --oneline --all`).
- File: `src/dashboard/styles.test.ts` FOUND.
- This file: `.planning/phases/19-design-system-control-styling/19-15-SUMMARY.md` FOUND.
- Task 3 traceability line citations re-checked against the current file via `sed -n
  '103p;113p;159p;209p;254p;279p;299p;305p'`: all eight lines match the claimed content
  (`RULE_SCANNER`, `declarationFragments`, `AT_RULE_RANGES`, `assertNotAtRuleScoped`,
  `bodyForSelectorListToken`, `return lastBody as string`, `extractNumericDeclaration`,
  `return Number(matches[matches.length - 1][1])`).
- `git diff d9b3aaf HEAD -- src/dashboard/styles.css` re-confirmed empty at time of writing.
- Full gate (`npm test`, `npx tsc --noEmit`, `npm run build-widgets`, `npm run
  verify-dashboard`) re-confirmed passing at time of writing (927/927, clean, clean, 37/37).

## Self-Check: PASSED
