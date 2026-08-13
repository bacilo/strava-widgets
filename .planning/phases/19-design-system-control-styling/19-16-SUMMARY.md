---
phase: 19-design-system-control-styling
plan: 16
subsystem: ui
tags: [css, comments, stylesheet-hygiene, sticky-positioning, documentation-truth]

# Dependency graph
requires:
  - phase: 19-design-system-control-styling
    provides: "Plan 19-14's H1 fix (position:sticky moved from .app-nav to #app-nav-root), confirmed on rendered evidence by Probe F; plan 19-15's mutation-verified guard-layer test hardening"
provides:
  - "A sticky-layer ladder comment in styles.css whose rung-4 label, stickiness claim and scope statement match what plan 19-14 shipped and what Round 4's Probe F actually measured"
  - "A stylesheet with zero foreign-file line-number citations, replaced with file-name-plus-construct-name references that survive unrelated edits"
  - "Three dated, reasoned deferral entries in deferred-items.md (WR-03 radius literals, R3-IN-05 narrative relocation, row 16 spacing remark)"
  - "A complete disposition audit of all eleven Round 3 code-review findings"
affects: ["19-17"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comment truth discipline: every rendering claim in a source comment either cites a dated probe or is explicitly marked spec-derived/unobserved"

key-files:
  created: []
  modified:
    - src/dashboard/styles.css
    - .planning/phases/19-design-system-control-styling/deferred-items.md

key-decisions:
  - "The stickiness claim took the evidence branch (not the hedge branch): both Probe F runs from 19-GAP7-DIAGNOSIS.md met the sy>=400, top<=1 pass condition, so the ladder comment now states the nav remaining on screen as a dated, cited fact rather than a hedged intention."
  - "The paint-order claim (a focused control painting over the nav) stays hedged in both directions: GAP 6 records the z-index:20 declaration as shipped but its rendered effect as unconfirmed, and the comment now names plan 19-17's row 21 as the observation that will settle it."
  - "WR-03 (radius literals) deferred rather than fixed, because the literal values currently equal the token values (verifier-confirmed, not a rendering defect) and fixing ten selectors immediately before the gate checkpoint would add ten more rendered changes needing their own honestly-discharged checkpoint rows."
  - "R3-IN-05's narrative-relocation recommendation deferred as maintainability work; only the actively false/rotting content it flagged (the disproven stickiness claim, the cross-file line citations) was fixed this round."

patterns-established:
  - "A same-file stale line-number citation (the :focus-visible comment's '(line ~996)' pointer, which had already rotted to point at the wrong rule) was found and fixed alongside the plan-named .ts citations, on the same truth-discipline reasoning."

requirements-completed: []  # UI-02 intentionally NOT marked complete — this is a comment/documentation plan; UI-02's closure depends on plan 19-17's rendered checkpoint (Probe G, row 21), per this plan's explicit instruction and the 19-15 precedent.

# Metrics
duration: 14min
completed: 2026-08-13
---

# Phase 19 Plan 16: Sticky-Layer Comment Truth Repair Summary

**Corrected the sticky-layer ladder comment's disproven rung-4 stickiness claim to cite dated Probe F evidence, hedged the still-unconfirmed paint-order claim, added a spec-derived descendant-containment scope statement, stripped all rotting cross-file line-number citations, and recorded three dated deferrals with a full eleven-finding Round 3 disposition audit.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-13T14:52:00+02:00
- **Completed:** 2026-08-13T14:56:00+02:00
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- The ladder comment no longer states as settled fact that ".app-nav is `position: sticky`... and every route scrolls its content underneath it" — a claim `19-VALIDATION.md` row 18 recorded FAIL against on Round 3. It now attributes the (now-true) claim to `#app-nav-root`, dated and cited to Probe F.
- The paint-order claim (a focused control painting over the nav before `z-index: 20`) is explicitly hedged as unconfirmed, naming GAP 6 and plan 19-17's row 21 as the observation that will settle it — rather than silently repeating a claim nobody has watched happen.
- Added an explicit scope statement: the ladder governs sibling/cousin ordering within the root stacking context between exactly its four named rules, with a spec-derived (marked unobserved) sentence stating a `:focus-visible` ring on a descendant of a sticky rung is outside the ladder entirely.
- Removed all twelve `{file}.ts:{number}` citations from the stylesheet (trends.ts, calendar.ts, list.ts, detail-charts.ts sites), keeping every rationale sentence and every file-name reference — plus one additional same-file citation found already rotted (a `(line ~996)` pointer that no longer pointed at `.records-jump`).
- Recorded three dated, reasoned deferral entries and cross-checked all eleven Round 3 finding IDs against their actual disposition (see table below) — no finding was silently dropped.

## Task Commits

1. **Task 1: Correct the sticky-layer ladder comment** - `9ef5465` (docs)
2. **Task 2: Strip rotting foreign line-number citations** - `21393be` (docs)
3. **Task 3: Record deliberate deferrals with reasoning** - `b11de39` (docs)

**Plan metadata:** committed with this SUMMARY (see final commit below)

## Files Created/Modified

- `src/dashboard/styles.css` - Corrected sticky-layer ladder comment (rung-4 label already correct from 19-14; stickiness claim, paint-order claim, and scope statement all rewritten); narrowed `.splits-table__km`'s comment to the sibling-cell case; removed all foreign `.ts:{line}` citations and one stale same-file citation
- `.planning/phases/19-design-system-control-styling/deferred-items.md` - Three new dated entries (WR-03, R3-IN-05 remainder, row 16 spacing remark)

## Which branch the stickiness claim took, and why

**Evidence branch taken.** `19-GAP7-DIAGNOSIS.md` § Fix confirmation (Round 4) records both Probe F runs meeting the stated pass condition (`sy` at or above 400, both `rootTop` and `navTop` at or below 1):

- `#/list`: `{"route":"#/list","sy":600,"rootTop":0,"navTop":0,"rootPos":"sticky","navPos":"static"}`
- `#/records`: `{"route":"#/records","sy":600,"rootTop":0,"navTop":0,"rootPos":"sticky","navPos":"static"}`

Both dated 2026-08-13. `rootPos: "sticky"` with `navPos: "static"` also independently confirms rung 4 lives on `#app-nav-root` alone — no duplicate declaration on `.app-nav`. The ladder comment now states the nav remains on screen with this citation attached, rather than the disproven unhedged claim it previously carried.

## Before/after wording of the three corrected claims

**1. Rung-4 stickiness claim.**
- Before: *".app-nav is `position: sticky; top: 0` with opaque `background: var(--surface)`, and every route scrolls its content underneath it."*
- After: *"`#app-nav-root` carries `position: sticky; top: 0; z-index: 20` (this rule), moved here from `.app-nav` by plan 19-14 to fix GAP 7 ... Confirmed, not merely intended: Probe F (19-GAP7-DIAGNOSIS.md, § Fix confirmation (Round 4)) recorded `rootTop: 0` with `rootPos: "sticky"` and `navPos: "static"` after a 600px scroll on both `#/list` and `#/records`, dated 2026-08-13 — the nav remains on screen while each route's content scrolls beneath it."*

**2. Paint-order claim.**
- Before: *"with no `z-index` here, a focused control scrolled under the nav painted OVER the opaque global chrome on every route."* (stated as fact)
- After: *"a focused control scrolled under the nav would paint OVER the opaque chrome, per that spec ordering alone. That collision has never been observed on a rendered page: GAP 6 (19-VALIDATION.md) records the `z-index: 20` declaration as shipped but its paint-order effect as unconfirmed ... Plan 19-17's row 21 is the first observation planned to settle it."*

**3. Scope of the ordering.**
- Before: no scope statement — the ladder was presented as a single, unqualified total order.
- After: *"This ordering governs sibling and cousin ordering, within the root stacking context, between exactly these four rules — nothing more ... A `:focus-visible` ring on a DESCENDANT of a sticky rung ... is contained by that ancestor's own stacking context and never reaches rung 1 at all ... That containment is spec-derived from CSS 2.1's stacking-context rules (R3-WR-03, INFERRED-ONLY) and has not been measured on a rendered page."*

The `.splits-table__km` comment was correspondingly narrowed to state it covers "a focusable SIBLING cell elsewhere in `.splits-scroll`" only, explicitly excluding a focusable element added directly inside `.splits-table__km` itself.

## Comment line count before and after (Task 2)

`git diff --stat` for the Task 2 commit (`21393be`) reports 17 insertions, 16 deletions on `src/dashboard/styles.css` — a net +1 line. The delta is entirely accounted for by:
- 11 removed `.ts:{number}` citations replaced with bare `.ts` file-name references (net zero line-count change per site — same line, shorter content)
- 1 removed same-file `(line ~996)` citation replaced with a section reference (net zero line-count change — same line)
- 1 net additional line from the `trends.ts:225,815,819,882` comma-list citation being rephrased as "four `trends.ts` call sites" (a slightly longer clause that wrapped to one more line)

No rationale sentence was deleted; every citation site kept its file name and, where the line number was the only identifying detail, gained the construct's own name instead (e.g. "the multi-run day picker's 'Close' button", "the month-nav '‹ {month}' button").

## Disposition of all eleven Round 3 finding IDs

| Finding | Disposition |
|---|---|
| R3-CR-01 | Closed in plan 19-15 (`assertNotAtRuleScoped` computes at-rule block ranges by brace matching; mutation-verified) |
| R3-CR-02 | Closed in plan 19-15 (hover-rule guard now asserts head shape, not just substring tokens; mutation-verified) |
| R3-WR-01 | Closed in plan 19-14 (ladder test extended to pin `position: sticky`/`relative` on all four rungs, not just `z-index` numbers) |
| R3-WR-02 | Closed in plan 19-15 (`bodyForSelectorListToken`/`extractNumericDeclaration` made last-wins, matching CSS cascade) |
| R3-WR-03 | Closed in this plan, 19-16, Task 1 (ladder comment scoped to sibling/cousin ordering within the root stacking context; descendant-containment case stated explicitly, marked spec-derived/INFERRED-ONLY) |
| R3-WR-04 | Closed in this plan, 19-16, Task 1 (disproven unhedged stickiness claim replaced with a dated Probe F citation; paint-order claim hedged pending row 21) |
| R3-IN-01 | Closed in plan 19-15 (`extractNumericDeclaration` now escapes and anchors its regex) |
| R3-IN-02 | Closed in plan 19-15 (all four ladder rungs read through `bodyForSelectorListToken` uniformly) |
| R3-IN-03 | Closed in plan 19-15 (`RULE_SCANNER()` factory and `declarationFragments()` helper deduplicate the scanner/idiom) |
| R3-IN-04 | Closed in plan 19-15 (the CR-02 test's duplicate assertion now states its coupling in one clause, referencing the original) |
| R3-IN-05 | Partially closed in this plan, 19-16, Task 2 (rotting cross-file line-number citations removed; disproven stickiness claim already covered by R3-WR-04's closure). Remainder — wholesale relocation of the ~110-line review-round narrative out of `styles.css` — deferred; see `deferred-items.md` |

All eleven findings have a stated disposition. No finding appears with neither a closure nor a deferral.

## Confirmation that no CSS declaration changed

Every task's verification gate ran the same `git diff --unified=0` filter (selector/declaration-shaped added or removed lines, excluding comment lines) and returned zero matches across all three commits. `npx vitest run src/dashboard/styles.test.ts` stayed green throughout (58/58), including the `cssNoComments` no-stray-`*/` check and the `esbuild transformSync` zero-warnings check. `git diff d9b3aaf HEAD -- src/dashboard/styles.css` before this plan's commits and after both start/end at the same declaration set — only comment text moved.

**Platform note (not a defect):** the plan's own verify commands pipe through `wc -l | grep -qx '0'` to assert zero matches. On this macOS/BSD environment, `wc -l` right-pads its count with leading spaces (e.g. `"       0"`), which fails `grep -qx '0'`'s exact-match even when the count is genuinely zero. Confirmed via `| tr -d ' ' | grep -qx '0'` and by inspecting the raw (empty) match output directly — the actual condition (zero declaration-shaped lines) held in every case. This is an environment-specific shell quirk in the plan's verify script, not a content problem; GNU `wc -l` (Linux CI) does not pad and the literal command as written would pass there unmodified.

## Decisions Made

- Took the evidence branch for the stickiness claim (both Probe F runs pass), not the hedge branch — see "Which branch" section above.
- Kept the paint-order claim hedged in both directions rather than assuming it now holds just because the nav does — GAP 6 is explicit that this is unconfirmed, and only plan 19-17's row 21 (a human observation) can settle it.
- Fixed the same-file `(line ~996)` citation in the `:focus-visible` comment (not named in the plan's Task 2 read_first list) because it had already rotted — it pointed at `.pace-bar__fill`, not `.records-jump` — and the plan's comment_truth_discipline instructs fixing additional discovered rot within scope rather than leaving it silently wrong.
- Deferred WR-03 (radius literals) and the R3-IN-05 narrative-relocation remainder rather than fixing them, per the plan's explicit Task 3 scope — both are documented with dated reasoning and a named re-entry trigger in `deferred-items.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, extended truth-discipline scope] Fixed a second, same-file stale line-number citation**
- **Found during:** Task 2 verification (grepping for all `.ts:` citations, then checking the `:focus-visible` comment's own internal `(line ~996)` pointer for correctness)
- **Issue:** The `:focus-visible` comment cited `.records-jump`'s `z-index: 10` as being "at line ~996" — but line 996 in the current file is `.pace-bar__fill`, not `.records-jump` (which is now at line 1093). This citation had already rotted from an earlier, unrelated edit to the file, exactly the failure mode R3-IN-05 warns about, just within the same file rather than a foreign `.ts` file.
- **Fix:** Replaced `(line ~996)` with `(styles.css, § Records sticky jump list)`, matching the section-reference convention the ladder comment already uses for its own cross-references.
- **Files modified:** `src/dashboard/styles.css`
- **Verification:** `grep -n "line ~996"` returns nothing; `npx vitest run src/dashboard/styles.test.ts` stays green; `git diff` selector/declaration filter stays at zero.
- **Committed in:** `21393be` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, truth-discipline scope extension)
**Impact on plan:** In scope of the plan's own stated intent (comment truth discipline); no CSS behavior changed; documented rather than silently expanding scope.

## Issues Encountered

None beyond the platform `wc -l` padding quirk noted above under "Confirmation that no CSS declaration changed" — verified not to reflect an actual content problem.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `styles.css`'s comments now agree with what has actually been measured (Probe F) and clearly flag what has not (the paint-order claim, the descendant-containment case).
- Plan 19-17 can proceed directly to its Probe G re-verification (row 20, testing the nav-stays-on-screen premise) and row 21 (the paint-order question this plan's comment explicitly named as unsettled) without any stylesheet-comment cleanup blocking it.
- WR-03 (radius literals) and the R3-IN-05 narrative-relocation remainder are recorded in `deferred-items.md` with re-entry triggers, not silently dropped.
- UI-02 remains open, as intended — this plan is documentation-only and does not discharge the rendered-checkpoint requirement plan 19-17 owns.

---
*Phase: 19-design-system-control-styling*
*Completed: 2026-08-13*
