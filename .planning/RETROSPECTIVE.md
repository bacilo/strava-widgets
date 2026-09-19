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

## Milestone: v2.2 — Pace Data Quality

**Shipped:** 2026-09-19
**Phases:** 6 (26-31) | **Plans:** 69 | **Tasks:** 168 | **Duration:** 11 days (2026-09-08 → 2026-09-19)

### What Was Built

- **One gap-aware pace derivation** (Phase 26) — `derivePaceWithCoverage` with an adaptive window
  (`max(20, 2.5 × p90(advance interval))`) that clips at recording and pause gaps; chart band,
  histogram, caption and splits all read it; a single-source audit test proves nothing else computes
  pace and was shown catching a planted second implementation. Coverage sums to an exact identity
  verified across all 1,865 streams and is always on screen. A metadata-vs-stream cross-check flags
  the one archive activity whose metadata implies 1:53/km against a stream-derived 5:51/km.
- **Per-activity quality signals** (Phase 27) — five signals computed in CI onto every index row
  (schema version unchanged) plus a lazy evidence shard, badged with condition and measured value,
  one "any severe" filter. Composite severe rate measured at 299 of 1,890 (15.8%) and reported as a
  finding after the criterion's "under ~5%" proved jointly unsatisfiable with a locked cohort.
- **PR plausibility ceiling** (Phase 28) — strict three-pass `compute-best-efforts.ts`, per-distance
  ceiling `1.28 × p90` (min population 100) derived non-circularly, demote-and-flag never delete;
  32 ceiling demotions on the merged archive reconciled three ways; `28-DIFF.md` signed four times
  against its sha256 as it regenerated.
- **Curation review queue** (Phase 29) — `/__curate/queue` lists every demoted activity (47, equal
  to the independent recount) with the existing exclude control per row; every write imported from
  the Phase 24 transport; both publish guards shown red under a planted leak.
- **Elevation quality signal** (Phase 30) — three total altitude detectors (sub-ground 11, loop-gated
  closure drift 21, vertical rate 39) as a sixth signal structurally outside the severe composite;
  flag only, `data/streams/` byte-unchanged.
- **Tech-debt closure at the source** (Phase 31) — inserted from the close-out audit: deploy gate
  decoupled from the live exclusions file, `copyJsonTree` on content digest not mtime, recount and
  queue agree-or-fail-loudly on malformed exclusions, 3-dp demotion margin, five artifacts regenerated
  twice and proven idempotent, five stale figures corrected with provenance.

### What Worked

- **A classifier-independent recount per phase.** Phases 27, 28, 29 and 30 each shipped a standalone
  script that recomputes the phase's headline number from the *shipped* JSON with zero imports of
  the classifier. This is what caught Phase 28's CR-01 — the recount was made to sweep every effort
  itself and was shown FAILING on the pre-fix archive (31 vs 18) before the fix landed — and what let
  Phase 29's checkpoint compare a rendered extent (47) against three named decoys the header had to
  reject.
- **Two-run idempotence for every generated artifact.** Regenerating each calibration report twice
  and diffing is cheap, and it found real generator bugs in both Phase 27 (a prose correction that
  silently reverted, G-01) and Phase 31 (a pure `export { x } from` re-export that left the name
  unbound in its own module and crashed the sweep — invisible to every unit test that imported it).
- **Surfacing an unsatisfiable criterion instead of tuning to it.** Phase 27's executor stopped when
  Criterion 4's ~5% target collided with D-04's locked 154-activity cohort, and the developer chose
  `split-the-criterion`. The measured 15.8% is a reported finding with the tension left visible in
  QUAL-05 rather than a threshold nudged until the number fit.
- **Inserting a tech-debt phase from the close-out audit.** The 2026-09-18 audit came back
  `tech_debt` with ~30 advisories; five shared the silent-and-passing shape this project's lessons
  single out. Phase 31 closed all five at the source in one day, each with a demonstrated-failing
  test, and the final audit re-derived every figure at HEAD rather than trusting the tech_debt list —
  which had already carried one closed item (27 G-01) for a day.
- **Both v2.1 process fixes held.** Verification re-ran after every gap-closure round it triggered
  (26 ran three verification rounds, 28 two); requirements were ticked only when every mapped
  checkpoint row passed (PR-03/04/05 held "pending" through 28-15 until re-verification, then had
  their wording corrected by Phase 31 rather than left as a stale claim).
- **Gap-closure share dropped sharply.** 14 of 69 plans were gap closure (~20%) against roughly 60 of
  103 in v2.1 — partly because compute-layer work is easier to evidence than rendering, partly
  because the recount-per-phase habit found defects before the checkpoint rather than after.

### What Was Inefficient

- **The milestone ran 402 commits ahead of origin.** The nightly CI kept committing activities to
  origin/master while v2.2 executed against a 1,890-activity snapshot. MERGE-01 merged them on the
  morning of the close (+9 → 1,899), two calibration artifacts had to be regenerated, one record
  changed hands (`3475730418@1mi`, a correct demotion by 0.002 m/s) and PR-04 needed a third sign-off.
  Everything reconciled, but it was avoidable churn on the critical path of the close.
- **Checkpoint rounds still passed on self-agreement twice.** Phase 26's CR-03 (the chart band still
  on the fixed 20s window) survived Rounds 1 and 2 because every row asked whether two surfaces agreed,
  not what either plotted. Phase 28's Round 1 checkpoint AND verification passed on "18 = 18" because
  recount and classifier shared a blind spot. The v2.1 lesson ("assert reachable extent against an
  independently-derived value") was recorded but not yet a drafting rule; both phases relearned it.
- **Hand-written figures went stale in five places.** PACE-06's 13, ERA-02's 716/1,864, two ROADMAP
  criteria and the PR-03/04/05 wording all drifted from what the generators produced. Phase 31 fixed
  the generators where one existed and corrected the prose with dated notes, but a figure that lives
  only in prose will drift again.
- **`phase.add` filed Phase 31's detail block under `## Progress`.** Cosmetic, fixed in the archive,
  but it is the same class of misplacement the memory notes already warn about.
- **`audit-open` false positive, third close running.** The quick-task SUMMARY still has no
  `status:` field. Ten minutes of tooling would end this.

### Patterns Established

- Every phase that produces a headline number ships a script that recomputes it from the published
  artifact without importing the code that produced it. The recount is demonstrated failing on a
  mutated input before it is trusted.
- Every generated artifact of record is regenerated twice and diffed before it is committed. A
  correction that lives only in prose is not a correction — fix the generator.
- Corrections to requirements and criteria are made in place with a dated provenance note, never by
  silently rewriting the figure. Both the original and the corrected number stay visible.
- A criterion that cannot be satisfied is split into a failable gate and a reported finding; a locked
  threshold is never retuned toward a target.
- A checkpoint row pins its expected extent to a value derived outside the changed code — the
  adaptive series' own maximum, the recount's activity count, the shard's `wasPRAtTheTime` — and
  the presenter HALTs if reachability cannot be shown from disk first.
- Sign-offs bind to a content hash. `28-DIFF.md` was signed against its sha256 each time it changed.
- A `tech_debt` audit verdict is an input to a closure phase, not a reason to complete with the debt.

### Key Lessons

1. **Independent re-derivation catches what green tests cannot.** Every defect that mattered in v2.2
   — CR-03, G-01, G-04, 28 CR-01, the unbound re-export — was found by computing a number a second
   way, never by a test going red. The suite was green throughout. Budget for the recount, not just
   the test.
2. **Two artifacts can share a blind spot and agree perfectly.** "18 = 18" was two consumers of the
   same classifier. Independence means zero imports, by any spelling, verified by a structural test.
3. **Merge origin at least once per phase when CI writes to the same branch.** The archive is a
   moving input; calibration artifacts bound to a snapshot go stale the moment origin moves.
4. **A figure in prose is a liability; a figure from a generator is an asset.** Five stale numbers,
   all in prose. Where a generator exists, the prose should be emitted by it.
5. **Insert the tech-debt phase; do not complete with the debt.** Phase 31 cost one day and left the
   archive matching the code. v2.0 completed `tech_debt` and v2.1 closed without an audit; items
   from both are still being acknowledged at every close.
6. **The v2.1 "reachable extent" lesson needed to become a drafting rule, not a memory.** It was
   relearned twice in this milestone before Round 3 of Phase 26 and Round 2 of Phase 28 applied it.

### Cost Observations

- Model mix and token spend were again not instrumented; deliberately left blank rather than
  estimated.
- Structural proxy: 69 plans across 6 phases, of which 14 were gap closure and 10 were the inserted
  tech-debt phase. First-pass feature work was ~45 plans — a far better ratio than v2.1's.
- Seven parallel worktree executors ran Phase 31's wave 1; the post-merge suite went red once on
  stale local artifacts, not a code conflict (see memory: regenerate `data/` + `build-widgets` on the
  primary checkout before `npm test` after schema-widening waves).
- Tests grew 1,617 → 2,192 (+36%) across 85 files on +6,255 non-test LOC in `src/` (+21%). Unlike
  v2.1, a real share of this is product surface (six signals, a ceiling, a queue), not only guards.
- Committed data cost: `data/stats/pace-quality/{id}.json` shards for all 1,899 activities plus
  `data/best-effort-ceiling.json`; `data/streams/` unchanged at 143 MB.

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
| v2.2 Pace Data Quality | 6 | 69 | 11 days | Classifier-independent recount per phase; two-run idempotence for generated artifacts; tech-debt phase inserted from the close-out audit; audit `passed` (first since v1.1) |

### Cumulative Quality

| Milestone | Tests | Non-test LOC (src/) | Notes |
|-----------|-------|---------------------|-------|
| v1.0 | not recorded | 3,844 | — |
| v1.1 | not recorded | 6,702 | — |
| v1.2 | not recorded | 9,148 | — |
| v2.0 | 884 | 26,430 | Two-layer publish guard introduced |
| v2.1 | 1,617 (63 files) | 29,955 | +83% tests on +13% source — guard layers, not features |
| v2.2 | 2,192 (85 files) | 36,210 | +36% tests on +21% source — real product surface this time; plus 7 regenerable artifacts of record |

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
   at three consecutive (v2.0, v2.1, v2.2) milestone closes; v2.0's audit repeated an error of the same class on a todo file
   that had actually shipped in Phase 16.
4. **Independent re-derivation is the only check that has caught every class of defect.** v2.0's black
   page passed 15/15 checks that resolved absolute URLs at the wrong root; v2.1's CR-01 passed three
   human rounds that asserted self-agreement; v2.2's 28 CR-01 passed a checkpoint AND a verification
   that both consumed the classifier's own output. In each case the defect fell to a number computed
   a second way from a different input. Every phase with a headline figure now ships that second way.
5. **Complete with the debt and the debt outlives the milestone.** v2.0 closed `tech_debt` and v2.1
   closed without an audit; items from both are still acknowledged at every close. v2.2 inserted a
   closure phase instead and is the first audit to return `passed` since v1.1.
