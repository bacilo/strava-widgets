---
phase: 20-row-click-interaction-pattern
plan: 18
subsystem: testing
tags: [manual-checkpoint, browser-verification, records, list, drag-select, double-click, focus-management]

# Dependency graph
requires:
  - phase: 20-row-click-interaction-pattern
    provides: "Plans 20-12 through 20-17 (D-12/D-13/D-14/D-15 implementation) — the focus-leak fix, the double-click refusal, and real cell anchors on both Records tables"
provides:
  - "Twelve individually-attributed Round 4 verdicts recorded in 20-VALIDATION.md, closing GAP 9 (R18/R19's original expectation) and GAP 10 (badge dataset gap)"
  - "A newly-found shipped defect, GAP 12: D-13's real cell anchors bypass D-12's drag-select guard and D-14's double-click guard on the Records PR-table cells"
  - "UX-02 marked Complete; UX-01 and UX-03 remain open pending a Round 5 fix"
affects: [21-overview-and-records-enhancements, any-future-round-5-plan-for-phase-20]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Twelve Round 4 rows recorded verbatim from the developer/agent's held-and-answered checkpoint: 8 PASS, 1 BLOCKED, 1 NOT EXERCISABLE, 2 FAIL"
  - "R31 and R32 are one defect class (GAP 12), not two: D-13's real anchors give the browser native drag/double-click handling that D-12's and D-14's row-level guards cannot intercept"
  - "No fix designed or applied for GAP 12 — recorded verbatim and left unpatched per the house rule in force since checkpoint 16-09"
  - "UX-02 closed (clean sweep of its four mapped rows); UX-01 and UX-03 stay open"

requirements-completed: [UX-02]

# Metrics
duration: 25min
completed: 2026-08-18
---

# Phase 20 Plan 18: Round 4 Checkpoint Verdicts Summary

**Round 4 browser checkpoint recorded FAIL — R23/R24 close GAP 9's original expectation, but D-13's real cell anchors introduce a new shipped defect (GAP 12) where drag-select and double-click navigation bypass D-12/D-14's row-level guards on the same Records cells.**

## Performance

- **Duration:** ~25 min (continuation from Task 1's commit `3c0972e`)
- **Started:** 2026-08-18T04:05:00Z (approx, continuation agent)
- **Completed:** 2026-08-18T04:22:39Z
- **Tasks:** 2 (Task 1 complete prior to this session; Task 2 completed this session)
- **Files modified:** 2 (`20-VALIDATION.md`, `REQUIREMENTS.md`)

## Accomplishments

- All twelve Round 4 rows (R22–R33) carry an individually-attributed `R4-VERDICT` token, a named observer, and the Required detail their own Test Instructions cell demanded (for PASS rows), enforced by the plan's own mechanical checks.
- GAP 9 (R18/R19's anchor-less-cell FAIL from Round 3) is closed on its Cmd/Ctrl+click half — R23 and R24 both PASS, confirming a genuine background tab opens on the correct activity for both the PR table and the PR-progression table.
- GAP 10 (no badge-carrying Overview row) is closed — R26 and R27 both PASS using the fixture-induced `No HR` badge on activity `i174109950`.
- A new shipped defect was found and recorded (GAP 12): D-13's real `<a>` cell anchors give the browser native drag-start and double-click-navigate behaviour, which bypasses D-12's drag-select guarantee (R31 FAIL) and D-14's double-click refusal (R32 FAIL) because both guards live in the row-level click listener, not on the anchors.
- UX-02 is now Complete (clean sweep of its four mapped rows). UX-01 and UX-03 remain open.

## Task Commits

Each task was committed atomically:

1. **Task 1: Full gate, production-shaped staging, badge fixture, twelve-row Round 4 agenda** - `3c0972e` (docs) — completed prior to this session
2. **Task 2: BLOCKING human browser checkpoint — twelve rows** - `d2927df` (docs) — the twelve verdicts, the Round 4 Checkpoint Outcome, Gap-Closure Record (GAP 12) and Evidence Quality sections, and the REQUIREMENTS.md update, all recorded this session

**Plan metadata:** commit pending (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `.planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md` — twelve Round 4 Observation cells filled with `R4-VERDICT` tokens, a `## Checkpoint Outcome (Round 4)` section, a `## Gap-Closure Record (Round 4)` section (GAP 12, plus explicit dispositions for GAP 9/10/11), and an `## Evidence Quality (Round 4)` section. Frontmatter `status` set to `blocked`, `round4_recorded` date added.
- `.planning/REQUIREMENTS.md` — UX-01 and UX-03 entries appended with Round 4 findings (still open); UX-02 checkbox ticked and entry marked CLOSED; Traceability table rows updated for all three.

## Decisions Made

- **R25 recorded BLOCKED, not a bespoke "PARTIAL" token.** The developer/agent's verdict was described as "PARTIAL" in the source report, but the plan's own four-state vocabulary (PASS/FAIL/BLOCKED/NOT EXERCISABLE) has no PARTIAL state. BLOCKED best matches the house rules' own definition ("the observation could not be produced for a dataset or environment reason") — the agent's tooling is scoped to its own browser tab group and cannot observe whether a second window opened. This mirrors the plan's own established practice (Round 3's R2 was recorded BLOCKED for an analogous partial-evidence situation).
- **R29 and R33 recorded PASS despite un-itemized detail.** The developer's verdict for both was an explicit PASS with the verbatim words "looks good," but neither answer individually confirmed every item its own Test Instructions cell required (underline status, per-item theme naming, per-table pointer/hover). Per the instruction to record every verdict exactly as stated, both are recorded PASS, with the itemization gap disclosed honestly in both the row's Observation cell and the Evidence Quality (Round 4) section — this is a caveat on the evidence's completeness, not a softened verdict.
- **GAP 12 opened for R31+R32 as a single shared-root-cause finding**, per the cross-row synthesis in the answered checkpoint: D-13's real cell anchors (plan 20-17) give the browser native gesture handling that defeats both D-12's drag-select guard and D-14's double-click guard, because those guards live in the row-level listener (`shouldNavigateOnRowClick` in `row-navigation.ts`) rather than on the anchors themselves. No fix is proposed or applied — a Round 5 planning round owns the reconciliation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's own Task 2 automated verify script contains a self-contradictory literal-string check**

- **Found during:** Task 2, while running the plan's bundled automated verification.
- **Issue:** The plan's action text instructs adding a section literally named `` `## Round 4 Gap-Closure Record` `` (matching, it says, "the same shape as Round 3's" — but Round 3's actual heading was `## Gap-Closure Record (Round 3)`, not `## Round N Gap-Closure Record`). The plan's own automated check independently asserts `s.split('## Round 4').length === 2` (exactly one occurrence of the literal substring `## Round 4` in the whole file, protecting Rounds 1-3 from tampering — threat T-20G4-C4-06) **and**, later, `if (fails > 0) { require /## Round 4 Gap-Closure Record/.test(s) }`. Because the required Gap-Closure-Record heading string itself begins with the literal substring `## Round 4`, satisfying the second check necessarily produces a second occurrence of that substring, which fails the first (and structurally prior) check. The two assertions cannot both be satisfied by any file content — this is a bug in the plan's own verify script, not a real content requirement.
- **Fix:** Named the Round 4 findings section `## Gap-Closure Record (Round 4)` — matching Round 3's actual established precedent format and preserving the single-split anti-tampering invariant (verified: `s.split('## Round 4').length === 2`, Rounds 1-3's 52/22/18 verdict-token counts unchanged). This means the plan's own literal-substring check for `## Round 4 Gap-Closure Record` will not match if re-run verbatim; every other check in Task 2's automated verify — the 12-row structure, per-row required-detail predicates, observer-phrase enforcement, theme-name enforcement, `## Evidence Quality (Round 4)` presence, and GAP 9/10/11 disposition presence — passes cleanly, confirmed by re-running the full script with only this one line's outcome differing.
- **Files modified:** `.planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md`
- **Verification:** Ran the plan's Task 2 automated verify script (both the full version, which throws on the contradictory line as expected, and a version with only that one line's assertion order-tested) — every other assertion in the script passes. `git status --porcelain src scripts data` confirmed empty throughout.
- **Committed in:** `d2927df`

---

**Total deviations:** 1 auto-fixed (Rule 1 — plan verify-script bug)
**Impact on plan:** No scope creep; the deviation is a naming choice inside the verification record itself, made to preserve the higher-priority anti-tampering invariant (an explicit named threat mitigation, T-20G4-C4-06) over a self-contradictory literal-string assertion. All twelve verdicts, the required per-row detail, the observer attribution, and the GAP disposition content are unaffected.

## Issues Encountered

None beyond the verify-script contradiction documented above.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — this plan modifies only planning/validation documentation, no application code.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes were introduced. This plan only records the outcome of a browser checkpoint into documentation.

## Next Phase Readiness

**Phase 20's success criterion 4 is NOT discharged.** Round 4 verdict: FAIL — 8 PASS / 1 BLOCKED / 1 NOT EXERCISABLE / 2 FAIL. The blocking issue is GAP 12: D-13's real Records-table cell anchors (plan 20-17) defeat both D-12's drag-select guarantee and D-14's double-click-refusal guarantee, because those guards are implemented in the row-level click listener rather than on the anchors the browser now natively handles. UX-01 and UX-03 stay open pending a Round 5 plan that reconciles D-13 with D-12/D-14 — no fix is designed or applied in this plan, per the house rule in force since checkpoint 16-09. R25 (Shift+click new-window observability) and R28 (D-12/D-13 disposition question) also remain outstanding and need a developer's-eyes re-test in that same or a subsequent round. UX-02 is now Complete and needs no further work.

---
*Phase: 20-row-click-interaction-pattern*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: `.planning/phases/20-row-click-interaction-pattern/20-VALIDATION.md`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: `.planning/phases/20-row-click-interaction-pattern/20-18-SUMMARY.md`
- FOUND: commit `3c0972e` (Task 1)
- FOUND: commit `d2927df` (Task 2)
- `git status --porcelain src scripts data` empty (exit 0)
