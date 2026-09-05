# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

> Started at the v2.1 close (2026-09-05). Milestones v1.0-v2.0 shipped before this file existed and
> have no retrospective section; the Cross-Milestone Trends tables below carry what could be
> reconstructed from `MILESTONES.md` and git, and are marked where a figure is unavailable rather
> than estimated.

## Milestone: v2.1 — Interface Polish

**Shipped:** 2026-09-05
**Phases:** 7 (19-25) | **Plans:** 103 | **Tasks:** 250 | **Duration:** 24 days (2026-08-12 → 2026-09-05)

### What Was Built

- **Design system pass** (Phase 19) — a bare `input, select, textarea` selector reaching all 13
  control-creation sites and a bare `button {}` baseline reaching all 31 button sites, under a
  two-tone `box-shadow` focus ring that stays visible against the `--accent-strong` active fills the
  old accent-only `outline` vanished into. Plus the stylesheet's first-ever `:disabled` rule.
- **Row-click interaction pattern** (Phase 20) — every activity row on every screen became a real
  `<a>` with one keyboard stop on the Date cell, redundant "View Activity" CTAs deleted, and
  modifier-click, middle-click, drag-select and double-click all handed back to the browser through a
  shared `shouldNavigateOnRowClick` predicate consulted from both the row listener and each cell anchor.
- **Overview rebuild** (Phase 21) — Recent PRs and Recent Activities moved onto the same
  `renderActivityRow` as the Activities list (made multi-surface-safe with an `idPrefix`), plus an
  all-time/this-year records scope control, distance and hours this year, and the Current Streak
  `ended {date}` sub-label — a two-layer fix, since `streak-utils.ts` only populated
  `currentStreakStart` while a streak was live.
- **Calendar week start & totals** (Phase 22) — `buildMonthGrid`'s hard-coded Sunday-first padding
  became a required `WeekStart` parameter, with per-week totals at the end of each row and a
  compaction breakpoint that ended up at 640px rather than 380px.
- **Trends zoom & pan** (Phase 23) — gesture and keyboard-reachable zoom/pan on taller bands without
  disturbing the five-tab structure, granularity toggle or canvas lifecycle.
- **Local curation mode** (Phase 24) — `npm run curate` serves the dashboard from a localhost-only
  Node server with an inline whole-activity PR-exclusion tickbox, the write path proven absent from
  the published bundle by two independent guards.
- **CI hardening** (Phase 25) — the nightly workflow's eight hand-maintained compute steps collapsed
  onto one `COMPUTE_ALL_STATS_STEPS` source of truth (proven by a live dispatched run), the publish
  verifier asserting six documents by name, a `gear-aggregate-logic.ts` crash degraded into the
  Unknown bucket, and v2.0's three deferred Phase 16 theme items finally discharged against production.

### What Worked

- **Mandatory human browser checkpoint at the end of every phase.** Decided in the milestone charter
  because automated gates had shipped rendering defects three times in this project. It earned its
  cost immediately: phases 19, 20, 21, 22 and 23 each had defects that only a rendered observation
  found, and there is no jsdom or headless browser in the repo for them to have been caught by.
- **Mutation-proving every guard before letting it pass.** Watching an assertion fail against the real
  defect, then pass, repeatedly caught guards that could not fail at all — a case-blind `tabindex`
  scan, four first-rule-wins CSS assertions, an at-rule range check with a latent source-parameter
  bug, and a naive `head.split(',')` selector splitter. This became the milestone's most load-bearing
  habit and is the main reason the test count nearly doubled.
- **Forcing duplicated derivations through one exported function.** Phase 24's header-badge/panel-row
  divergence only closed once both paths went through a single `resolveExcluded`; a divergence
  mutation was demonstrated to pass `tsc --noEmit` while failing the seam tests.
- **Measuring a mechanism before drafting a checkpoint row.** Phase 25's GAP-25-01 was closed by
  sweeping three capture candidates against production's real 612ms first paint and proving the winner
  could report white on a stripped-bootstrap negative control — rather than by restating a sound
  inference, which was explicitly rejected as a closure route.

### What Was Inefficient

- **Gap-closure rounds dominated the plan count.** 103 plans for 25 requirements. Phase 19 needed four
  rounds, Phase 20 five, Phase 22 four, Phase 24 four. Almost none of that was feature work — it was
  producing evidence that a feature already written actually behaved as claimed.
- **Requirements were ticked before verification ran, then reverted.** CAL-01 and CAL-02 were each
  ticked, reverted, and re-ticked. CUR-01 was ticked prematurely after Round 2 and had to be reopened
  when the code review landed afterwards. The tick-then-verify ordering generated real rework.
- **A verification report went stale for 17 days and blocked the close.** `22-VERIFICATION.md` was the
  report that *triggered* Phase 22's Round 4 work and was never re-run after that work landed, so it
  still described a pre-Round-4 world — including a central premise (a 380px-scoped fix) that the
  Round 4 code had already made false. Nothing in the workflow noticed.
- **`REQUIREMENTS.md` silently contradicted itself.** The checkbox entries recorded the Round 4
  re-tick while the phase-map rows twelve lines later still read "Pending". Caught only by reading
  both halves at close; left alone it would have frozen two requirements as Pending in the archive
  permanently.
- **`audit-open` false positives carried across two milestone closes.** The quick task
  `1-fix-daily-widget-refresh-github-actions-` has a complete SUMMARY and simply lacks a `status:`
  frontmatter field; it was miscounted as open at the v2.0 close and again at v2.1's.

### Patterns Established

- An assertion that has not been watched failing is not evidence. Mutation-prove or don't claim it.
- Checkpoint rows must assert **reachable extent** against an independently-derived value, not that two
  internal values agree with each other. Phase 23's CR-01 survived three clean browser rounds because
  every row that touched the path only checked self-consistency.
- A checkpoint row can be **unsatisfiable** — its own mandated setup can destroy the discriminator it
  exists to test (Phase 24's R19 and R26). Check reachability in both directions before blaming the code.
- An **unsplittable row is a planning defect, not a verdict**. Phase 25 split R6 into R6a/R6b/R6c so
  two requirements could close on their own evidence instead of being held hostage by a third's
  missing dispatch.
- Duplicated logic defeats checkpoints. Force both derivations through one exported function.
- Record evidentiary shortfalls **verbatim** rather than laundering a thin PASS into an observed one.

### Key Lessons

1. **Verification must re-run after the gap-closure it triggered.** The single largest process failure
   this milestone. A `gaps_found` report is an input to a closure round, not a standing verdict, and
   nothing re-derives it automatically once that round lands.
2. **Tick requirements after verification, not before.** Three requirements were ticked, reverted and
   re-ticked. The rework was entirely self-inflicted by ordering.
3. **Two records of the same fact will drift.** `REQUIREMENTS.md` holds requirement status in both a
   checkbox list and a traceability table, and they disagreed silently. Either derive one from the
   other or check them against each other at every gate.
4. **Evidence, not features, is the cost driver on visual work.** 103 plans delivered 25 requirements;
   the ratio is almost entirely gap-closure rounds producing rendered observations.
5. **A green automated gate proves less than it appears to on rendering work.** This project has now
   shipped rendering defects behind fully green gates four times counting Phase 23's CR-01, which
   passed 592/592 tests, clean `tsc`, and three clean human browser rounds.
6. **Developer-authority closures should be counted, not just recorded.** Phase 22's R26 and R27 closed
   without their own mandated observations. Retaining the shortfall verbatim is the right call, but two
   of the milestone's closures rest on assertion rather than observation and that should be visible.

### Cost Observations

- Model mix, per-session counts and token spend were not instrumented during v2.1 — not reconstructible
  from the artifacts, and deliberately left blank rather than estimated.
- Structural proxy for effort: 103 plans across 7 phases, of which roughly 60 were gap-closure or
  guard-hardening rather than first-pass feature work.
- Tests grew 884 → 1,617 (+83%) across 63 files with almost no new product surface. That cost bought
  guard layers, and it is what the mutation-proving habit actually looks like on the invoice.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Duration | Key Change |
|-----------|--------|-------|----------|------------|
| v1.0 MVP | 4 | 9 | 1 day | Initial pipeline, widgets, CI |
| v1.1 Geographic | 5 | 10 | 3 days | Offline geocoding; Custom Elements migration |
| v1.2 Maps & Geo Fix | 4 | 11 | 2 days | GeoNames migration; Leaflet map widgets |
| v2.0 Training Dashboard | 5 | 56 | 3 days | Dashboard SPA; first milestone audit; privacy guards |
| v2.1 Interface Polish | 7 | 103 | 24 days | Human browser checkpoint per phase; mutation-proved guards; gap-closure rounds became the dominant unit of work |

### Cumulative Quality

| Milestone | Tests | Non-test LOC (src/) | Notes |
|-----------|-------|---------------------|-------|
| v1.0 | not recorded | 3,844 | — |
| v1.1 | not recorded | 6,702 | — |
| v1.2 | not recorded | 9,148 | — |
| v2.0 | 884 | 26,430 | Two-layer publish guard introduced |
| v2.1 | 1,617 (63 files) | 29,955 | +83% tests on +13% source — guard layers, not features |

### Top Lessons (Verified Across Milestones)

1. **A green automated gate does not prove a rendering claim.** Established in v2.0 (Phase 16's black
   page behind 15/15 checks; Phase 17's two defects behind 592/592 tests) and re-confirmed in v2.1 by
   Phase 23's CR-01, which additionally survived three clean *human* rounds because no row tested
   reachable extent.
2. **Unverified items carry across milestone boundaries unless something forces them closed.** Phase 16's
   theme/first-paint items were deferred at the v2.0 close and only discharged a milestone later, by
   Phase 25's VER-01 — after two intervening phases ran human checkpoints on the same shell without
   discharging them.
3. **`audit-open` output needs triage, not tallying.** The same false positive was counted as open debt
   at two consecutive milestone closes; v2.0's audit repeated an error of the same class on a todo file
   that had actually shipped in Phase 16.
