---
phase: 25-ci-hardening-light-theme-verification
plan: 07
subsystem: verification
tags: [ver-01, human-checkpoint, browser, theme, prefers-color-scheme, phase-gate, gaps]

# Dependency graph
requires:
  - phase: 25-ci-hardening-light-theme-verification (waves 1-3)
    provides: the automated half this checkpoint's R6 cites (25-06's five-command gate and verify-dashboard count) and the theme-bootstrap parity pin (25-05) whose inference R2 declined to accept as observation
provides:
  - "A fully-run Round 1 checkpoint (R1-R6) in 25-VALIDATION.md with per-row verdicts, quoted evidence and the D-07 provenance split"
  - "VER-01's light-OS legibility (R1) and bidirectional live OS-follow (R3, R4) confirmed against the live production build"
  - "Cache-trap exclusion (R5) with a byte-identical cache-busted refetch and an asset match against the deployed gh-pages tree"
  - "GAP-25-01 and GAP-25-02, each stating the state a future row must hold simultaneously to discriminate"
  - "A withheld phase disposition: FIX-02, VER-01, CI-01 and CI-02 all left open, with FIX-02/CI-01/CI-02 REOPENED after having been ticked pre-checkpoint"
affects: [.planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/STATE.md, "/gsd-plan-phase 25 --gaps (the next step)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "performance.timeOrigin as a document-instance fingerprint: identical values across a before/after pair prove the same document persisted, which is a stronger no-reload proof than navigation type alone (nav type stays 'reload' across an in-document OS change and therefore cannot discriminate)"
    - "Capture-fidelity arithmetic as a first-class row outcome: comparing a captured frame's wall-clock timestamp against that navigation's own timeOrigin + first-paint.startTime, rather than assuming a screenshot taken 'right after' a reload is a first frame"
---

# Plan 25-07 — VER-01 Round 1 checkpoint and phase disposition

## What was done

Ran the phase's closing human checkpoint and set the disposition for all four requirements.
Task 1 (row drafting and reachability proof) had already been committed in a prior session
(`9bbcbb9f`); this execution resumed at Task 2 rather than re-running it.

**Task 2 — the round.** Six rows, run against `https://bacilo.github.io/strava-widgets/` (D-08)
with hard-reload discipline. Hybrid execution per D-07: the developer performed every macOS
System Settings appearance change by hand and made every human judgment; the agent performed all
instrumentation. No `osascript` was used for any recorded row.

**Task 3 — the disposition.** Applied the governing all-rows-PASS rule and wrote the result into
`25-VALIDATION.md`, `REQUIREMENTS.md`, `ROADMAP.md` and (by hand) `STATE.md`.

## Verdicts

| Row | Verdict | Decided by |
|-----|---------|-----------|
| R1 — light-OS legibility | **PASS** | `'auto'` / `false` / `'light'` quoted at one instant; developer verbatim: "looked at all 4. Legible. Toggle is visible." |
| R2 — first-paint flash | **BLOCKED** | Capture landed ~243 ms after `first-paint` |
| R3 — live-follow light→dark | **PASS** | `'light'`→`'dark'`, `#fff`→`#1a1a2e`, same document |
| R4 — live-follow dark→light | **PASS** | Reverse transition fired independently, same document |
| R5 — cache-trap exclusion | **PASS** | Byte-identical cache-busted refetch; asset matches deployed tree |
| R6 — automated-half confirmation | **BLOCKED** | Clause 3 (dispatched run id/conclusion) does not exist |

## Disposition

Nothing ticked. `VER-01` withheld by R2; `CI-01`, `CI-02` and `FIX-02` withheld by R6. The latter
three had been ticked by plans 25-01/25-02/25-03 **before** this checkpoint ran and are now
**reopened** in `REQUIREMENTS.md`, each with a dated paragraph naming the row that withheld it.
`nyquist_compliant` stays `false`; `25-VALIDATION.md` frontmatter `status: gaps_found`.

Two gaps opened: **GAP-25-01** (no capture mechanism beats first paint on this hardware) and
**GAP-25-02** (CI-01's live-run evidence absent, plus the recommended R6a/R6b/R6c row split).
Next step: `/gsd-plan-phase 25 --gaps`.

## Deviations and judgment calls

**Flip count reduced from four to two, at the developer's request.** The developer asked that
their involvement be cut to the essential minimum. The rows were re-sequenced so each appearance
change served two rows (Light→Dark supplied R3's transition and R2's dark-OS state; Dark→Light
supplied R4's). This changed row *ordering* only — every row still ran from its own
cleared-storage hard reload where it required one, the toggle was never clicked, and
`dashboard-theme` was quoted in the `null`/`'auto'` class at every instant. R1 needed no flip at
all (the machine was already in Light). Disclosed in `25-VALIDATION.md` § "Execution provenance".
The request did **not** extend to substituting `osascript` for the developer's hand — D-07 locks
that, and it was not done.

**R6 deliberately not split.** Splitting it into R6a/R6b/R6c mid-round would have let FIX-02 and
CI-02 tick on evidence that is genuinely green. It was not done: redesigning a row after seeing
its outcome, in order to obtain a tick, is the failure mode Checkpoint Row Discipline rule 3 and
the Phase 24 R19/R26 precedent exist to prevent. The split is recorded in GAP-25-02 as the
recommended shape for a *future* round, to be drafted before it is run.

**R2's ordering argument recorded but rejected.** The inline bootstrap completed at
`domInteractive` 287.9 ms, 324 ms before `first-paint` at 612 ms, and 25-05's `node:vm` pin
independently proves its logic. That is inference; criterion 4 asks for observed browser
behaviour. The three dispositions (BLOCKED / PASS-with-disclosure / attempt an iframe-proxy
capture) were put to the developer with the consequence stated up front — that BLOCKED withholds
every requirement and shuts the phase gate — and the developer chose BLOCKED.

**Nothing patched.** Per the house rule since plan 16-09, no defect or observation surfaced during
the round was fixed. The developer's question about the theme toggle's iconography (state
convention vs. action convention) is logged in `deferred-items.md` as a question, not a fault.

## Surprises

**The hidden-tab lag.** Both live-follow rows initially read as failures: after the OS flip,
`matchMedia('(prefers-color-scheme: dark)').matches` had already changed while `data-theme` and
the computed background had not. The tab was `visibilityState: "hidden"` — the developer must
leave the browser to reach System Settings, so a backgrounded tab is the *default* condition for
this class of row in this project. The DOM caught up on foregrounding, within the same document.
Chrome deferring style recalculation for hidden tabs, not an application defect. Recorded as
observed in R3's caveat table rather than smoothed away; future live-follow rounds should keep
the tab visible across the flip (second display or side-by-side windows).

**Production is not built from local `master`.** R5's asset check surfaced that `origin/gh-pages`
was built from `623046363`, which is `origin/master`'s HEAD, while local `master` carries all of
Phase 25 unpushed. This could have invalidated R1-R4. It does not:
`git diff 623046363..master -- src/dashboard/{theme.ts,index.html,styles.css,main.ts}` is empty —
Phase 25 touched analytics, CI and scripts, not the theme path. Disclosed in R5 so no future
reader mistakes "verified against production" for "verified against local master".

## Verification

- `grep -c "Round 1 Checkpoint (R1-R6)"` → 1; no row Verdict cell reads `pending`.
- `grep -c "Plans.*: TBD" .planning/ROADMAP.md` → 0.
- All four requirements in `REQUIREMENTS.md` are `[ ]` with dated 2026-09-04 paragraphs citing the
  deciding rows; status table reads `Withheld (R2 BLOCKED)` / `Withheld (R6 BLOCKED)`.
- **`STATE.md` plan counts verified BY HAND** (neither `state.planned-phase` nor `phase.complete`
  was invoked, so neither documented hazard fired): `progress.total_plans: 98` and
  `completed_plans: 92` still describe milestone v2.1 — 91 → 92 for this plan's execution —
  with `completed_phases: 6` unchanged because Phase 25's gate is withheld, and `percent: 86`
  phase-based.
