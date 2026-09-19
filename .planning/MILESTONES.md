# Milestones

## v2.2 Pace Data Quality (Shipped: 2026-09-19)

**Phases completed:** 6 phases (26-31), 69 plans, 168 tasks | 36,210 LOC TypeScript in src/ (non-test) | 2,192 tests across 85 files | 11 days (2026-09-08 → 2026-09-19)
**Git range:** feat(26-01) `c8d5faf7` → `60356d34` (499 commits, +26,664 / -271 lines across src/scripts/CI)
**Archive at close:** 1,899 activities (merged from origin on 2026-09-19, +9 over the 1,890 the milestone was scoped and mostly executed against); 1,874 with a computable stream

**Key accomplishments:**

- One gap-aware pace derivation: every stream-derived pace figure on the dashboard — chart band, histogram, coverage caption, splits — now reads `derivePaceWithCoverage` in `src/analytics/pace-derivation.ts`, with an adaptive window (`max(20, 2.5 × p90(advance interval))`) that clips at recording and pause gaps instead of manufacturing pace across them. Three activities a fixed 20s window had read as 94.81% / 59.77% / 42.57% phantom-fast mass resolve to 1.22% / 0.00% / 0.00%; the residual after adaptivity is 14 of the 154-activity severe cohort, all marginal (≤2.44%), enumerated in a regenerable `26-RESIDUAL.md`. A single-source audit test proves no second implementation exists and was shown catching a planted one
- Honest coverage: covered + recording-gap + pause time sums exactly to the stream's own span (`coveredSec === bucketedSec + unbucketedCoveredSec`, verified across all 1,865 streams with zero identity violations), an always-on caption discloses the split under Pace Distribution, gap-crossing splits carry a marker, and a metadata-vs-stream cross-check flags the one archive activity (5059204779) whose metadata implies 1:53/km against a stream-derived 5:51/km — badged as "Pace disputed", never suppressed
- Per-activity quality signals: five individually-disclosed signals (decimation, gap profile, impossible samples, device era, elapsed-vs-moving) computed in CI onto every index row (`DASHBOARD_INDEX_SCHEMA_VERSION` unchanged) and a lazy per-activity evidence shard, badged with the condition and its measured value, filterable by one "any severe signal" toggle. The measured composite severe rate is 299 of 1,890 (15.8%), reproduced by a classifier-independent recount; ROADMAP Criterion 4's "under ~5%" was found jointly unsatisfiable with the locked 154-activity decimation cohort and split into a failable gate plus a reported finding rather than retuned to fit
- PR plausibility ceiling: `compute-best-efforts.ts` runs a strict three-pass shape (accumulate → derive ceiling once → filter-and-flag), deriving a per-distance personal ceiling (`1.28 × p90`, minimum population 100) non-circularly from the already-filtered population, and demotes-never-deletes every over-ceiling effort — 32 ceiling demotions on the merged archive, reconciled three ways (diff, `byGuard.ceiling`, independent sweep), with the pinned 4556693525 400m effort as a permanent regression fixture and an archive-wide before/after `28-DIFF.md` signed by the developer against its sha256 (four sign-off rounds; the last against `97e1782c…`)
- Curation review queue: `npm run curate` gained `/__curate/queue`, one nav click from any view, listing every activity with a demoted effort (47 on the 2026-09-18 archive, equal to the independent recount) and exposing the existing whole-activity exclude control on each row — every write imported from the Phase 24 overlay transport, no second write surface, both publish guards shown red under a planted leak and green on the served build
- Elevation quality signal: three total altitude detectors (sub-ground minimum 11, loop-gated barometric closure drift 21 with `LOOP_RADIUS_M = 100` derived from the archive, implausible vertical rate 39) land as a sixth signal structurally excluded from the severe composite, badged severe-only on every list surface and disclosed always-on in the detail view — flag only, `data/streams/` byte-unchanged; the requirement's original "34 drift" figure was a raw start/end difference and its loop-gated correction is auditable in `30-CALIBRATION.md`
- Tech-debt closure at the source (Phase 31, added from the close-out audit): the nightly deploy gate no longer couples `npm test` to the live owner-editable exclusions file; `copyJsonTree` compares content instead of mtime (its first real run replaced a stale same-size `geo-metadata.json` the old rule had kept); the recount fails closed on malformed exclusions while the queue counts and shows them, with a parity test; the demotion reason states its margin at 3 dp (closing a shipped "4.63 exceeds 4.63"); all five calibration artifacts of record regenerated twice against the merged archive and proven idempotent, and five stale hand-written figures corrected in place with dated provenance

**Requirements:** 33/33 satisfied (27 scoped 2026-09-08 plus TD-01..TD-06 minted 2026-09-19). Every phase that added a rendered surface (26-30) closed on a human browser checkpoint against a digest-verified served build; Phase 31 (compute/test/docs only) closed on automated evidence plus a blocking PR-04 re-sign.

**Milestone audit:** `passed` — 33/33 requirements, 6/6 phases verified, 11/11 integration seams wired (one Info-level partial, seam 11), 4/4 E2E flows, 6/6 phases Nyquist-compliant, zero pre-close obligations. Three audits were run: an interim on 2026-09-17 (phases 26-28), a close-out on 2026-09-18 that returned `tech_debt` with ~30 advisory items and one pre-close obligation (MERGE-01: the milestone sat 402 commits ahead of an origin that had moved past its archive) and seeded Phase 31, and the final on 2026-09-19 at HEAD `3cc8d1db` with every figure re-derived. All three are preserved in `milestones/` (`v2.2-INTERIM-AUDIT.md`, `v2.2-CLOSEOUT-AUDIT-2026-09-18.md`, `v2.2-MILESTONE-AUDIT.md`).

**Known deferred items at close: 2** (see STATE.md § Deferred Items → v2.2 close). Both are inherited and were acknowledged at the v2.0 and v2.1 closes too: the Garmin export adapter todo (STREAM-04, still externally blocked on the export arriving) and the `1-fix-daily-widget-refresh-github-actions-` quick task, a confirmed `audit-open` false positive (SUMMARY exists, no `status:` field) now miscounted at three consecutive closes. Open code-review findings, none shipped-behaviour blockers, are recorded per phase in PROJECT.md: `26-REVIEW.md` WR-06/WR-07, `27-REVIEW.md` WR-02/WR-03, `28-REVIEW.md` WR-06 (opt-in ceiling-file write gate, a developer decision) and IN-05..IN-08, `29-REVIEW.md` WR-01/WR-04/WR-05/WR-06, `30-REVIEW.md` WR-02/WR-03 (badge wording, checkpoint-blessed) and IN-01..IN-07, `31-REVIEW.md` IN-01..IN-08. Explicitly out of scope and recorded so they are not re-litigated: CUR-04 queue dismiss action, 26 F-26-02 histogram tails, the `index-client.ts` `ParsedDashboardIndexRow` retype (phase-sized; candidate for v2.3), and stream re-derivation from the 1 Hz originals (STREAM-05/06, gated on measuring whether the quality signals make it worthwhile).

**Defining pattern of the milestone:** every defect that mattered was caught by re-deriving a number independently of the code that produced it, never by a test going red. Phase 26's CR-03 (the chart band still on the fixed 20s window) survived two clean browser rounds because every row asked whether two surfaces agreed, not what either plotted; Phase 27's G-01 saw a prose correction silently revert when its generator was re-run; Phase 28's Round 1 checkpoint and verification both passed on the defect's own output ("18 = 18") because the recount shared the classifier's blind spot; Phase 31's regeneration found a pure `export { x } from` re-export that left the name unbound in its own module, invisible to every unit test and visible only to the archive sweep. The counter-habit — a classifier-independent recount per phase, checkpoint rows pinned to a value derived outside the changed code, and every generated artifact proven idempotent by a second run — is now the project's second load-bearing convention alongside v2.1's "watch it fail first".

**Pipeline note:** the milestone was executed against a 1,890-activity snapshot while the nightly CI kept committing to origin; MERGE-01 merged the two on 2026-09-19 (+9 activities → 1,899) and exactly one record changed hands — `3475730418@1mi` tipped over a slightly lowered ceiling by 0.002 m/s, a correct demotion the developer re-signed (PR-04 Round 3), which is what surfaced the thin-margin reason wording that became TD-04.

---

## v2.1 Interface Polish (Shipped: 2026-09-05)

**Phases completed:** 7 phases (19-25), 103 plans, 250 tasks | 29,955 LOC TypeScript in src/ (non-test) | 1,617 tests across 63 files | 24 days
**Git range:** feat(19-01) `a3f5870f` → `20c9eda4` (750 commits, +15,884 / -683 lines across src/scripts/CI)

**Key accomplishments:**

- Design system pass across all five screens: a bare `input, select, textarea` selector gives all 13 control-creation sites one box treatment and a bare `button {}` baseline gives all 31 button sites a shared floor — including the stylesheet's first-ever `:disabled` rule — under a two-tone `box-shadow` focus ring (`--bg` inner halo, `--accent` outer ring) that stays visible against the `--accent-strong` active fills the old accent-only `outline` disappeared into
- Row-click interaction pattern: every activity row on every screen is a real `<a>` with one keyboard stop on the Date cell, the redundant "View Activity" CTAs deleted, and a shared `shouldNavigateOnRowClick` predicate consulted from both the row listener and each cell anchor so modifier-click, middle-click, drag-select and double-click all behave the way the browser's own link contract says they should
- Overview rebuilt onto the shared renderer: Recent PRs and Recent Activities now render through the same `renderActivityRow` as the Activities list (made multi-surface-safe via an `idPrefix`), plus an all-time/this-year records scope control, distance and hours this year in Headline Stats, and the Current Streak `ended {date}` sub-label — a two-layer fix, since `streak-utils.ts` only ever populated `currentStreakStart` while a streak was live
- Calendar week start is selectable Sunday/Monday and drives which days each week total sums, with per-week totals at the end of every row; `buildMonthGrid`'s hard-coded Sunday-first padding became a required `WeekStart` parameter, and the compaction breakpoint ultimately widened from 380px to 640px so the totals stay legible at real phone widths rather than only below 380px
- Trends charts zoom and pan by gesture and by keyboard-reachable on-screen controls on taller bands, without disturbing the five-tab structure, the granularity toggle or the canvas lifecycle
- Local curation mode: `npm run curate` serves the dashboard from a localhost-only Node server with an inline whole-activity PR-exclusion tickbox, and the write path is proven absent from the published bundle by two independent layers — a build-time content scan (`curation-guard.mjs`) and an HTTP-layer assertion (`verify-dashboard-publish.mjs`)
- CI hardening: the nightly workflow's eight hand-maintained compute steps collapsed onto a single `COMPUTE_ALL_STATS_STEPS` source of truth (proven by a live dispatched run), the publish verifier now asserts six stats documents by name instead of trusting a directory copy, a `gear-aggregate-logic.ts` crash on an absent `gearName` key degrades into the Unknown bucket, and v2.0's three deferred Phase 16 theme/first-paint items were finally discharged against production

**Requirements:** 25/25 satisfied. Every phase closed on a human browser checkpoint, by design — the milestone charter recorded that automated gates had missed rendering defects in this project three times.

**Known deferred items at close: 5** (see STATE.md § Deferred Items → v2.1 close). Two are inherited v2.0 Phase 16 artifacts, one is a confirmed `audit-open` false positive (a quick task whose SUMMARY exists but carries no `status:` field), and two are genuine todos — the Garmin export adapter (STREAM-04, externally blocked) and IN-17/IN-18 curation-guard cosmetics. Open code-review findings per phase are recorded in PROJECT.md rather than duplicated here.

**Closing correction:** `22-VERIFICATION.md` was stale at the start of this close — dated 2026-08-19T09:30:00Z, `gaps_found` 5/8, it was the report that *triggered* Phase 22's Round 4 gap-closure work and was never re-run afterward. Re-verified 2026-09-05 to `passed` 8/8, each closure re-derived from source and mutation-tested rather than accepted from the Round 4 summaries; the prior report's central premise (a 380px-scoped overflow fix) was found factually false, the breakpoint being 640px with all three named rules overridden inside it. `REQUIREMENTS.md` had also contradicted itself, recording CAL-01/CAL-02 as re-ticked `[x]` while the phase-map rows still read "Pending" — reconciled before archiving, which would otherwise have frozen both as Pending permanently.

**No milestone audit was run for v2.1** (unlike v1.1 and v2.0). The close proceeded on the phase-level evidence instead: all seven phases at `status: passed`, 25/25 requirements ticked, and the Phase 22 re-verification above.

---

## v1.0 MVP (Shipped: 2026-02-14)

**Phases completed:** 4 phases, 9 plans | 3,844 LOC TypeScript | 1 day

**Key accomplishments:**

- Strava OAuth authentication + incremental activity sync with rate limiting (1,808 activities)
- Statistics computation engine: weekly/monthly/yearly aggregations, pace, elevation
- Embeddable widget system: Shadow DOM isolation, Vite IIFE bundles, Chart.js visualizations
- Advanced analytics: streaks, year-over-year comparisons, time-of-day patterns, seasonal trends
- Widget library: stats card, comparison chart, streak/patterns widget — all configurable
- GitHub Actions CI/CD pipeline: daily cron refresh + GitHub Pages deployment

---

## v1.1 Geographic & Widget Customization (Shipped: 2026-02-16)

**Phases completed:** 5 phases (5-9), 10 plans | 6,702 LOC TypeScript (project total) | 3 days
**Git range:** feat(05-01) → docs(v1.1) (43 commits, +13,948 / -301 lines)

**Key accomplishments:**

- Offline reverse geocoding pipeline: 23 countries, 57 cities from 1,658/1,808 activities (92% GPS coverage)
- Geographic statistics with distance aggregation (20,138 km), ranked country/city exports, CSV export
- All 5 widgets migrated to Custom Elements with HTML attribute configuration, dark/light theming, responsive sizing
- Sortable, paginated geographic table widget with locale-aware sorting and ARIA accessibility
- Non-blocking geocoding in CI/CD pipeline with comprehensive README and widget landing page

---

## v1.2 Maps & Geo Fix (Shipped: 2026-02-18)

**Phases completed:** 4 phases (10-13), 11 plans | 9,148 LOC TypeScript (project total) | 2 days
**Git range:** feat(10-01) → fix: recover polylines (49 commits, +118,693 / -1,074 lines)

**Key accomplishments:**

- GeoNames geocoding migration: accurate city names via 166K-city dataset, fixing suburb-instead-of-city problem across 23 countries
- Multi-city route tracking: polyline decoding detects all cities a run passes through (86% of 1,808 activities are multi-city)
- Interactive route map widgets: single-run map, multi-run overlay, and route browser with list selection and auto-fit
- Heatmap widget: all 1,808 runs overlaid with date filtering, color scheme options, and pre-decoded points for zero UI blocking
- Pin map widget: city/country toggle with quintile-based color encoding, cluster markers, and activity popups
- Standalone full-page map views: heatmap, pin map, and route browser with Leaflet Shadow DOM CSS injection and navigation

---

## v2.0 Training Dashboard (Shipped: 2026-08-12)

**Phases completed:** 5 phases (14-18), 56 plans | 26,430 LOC TypeScript in src/ (non-test) | 884 tests | 3 days
**Git range:** feat(14-01) → docs: evolve PROJECT.md (432 commits, +30,711 lines across src/scripts/CI)

**Key accomplishments:**

- Stream ingestion foundation: committed per-activity time-series (time, distance, HR, cadence, elevation) for the full 1,868-activity archive, with a per-channel availability manifest and an explicit unavailable flag rather than silent gaps
- Best-effort engine: fastest 400m/1k/1mi/5k/10k/half/marathon computed within every run from raw streams, with a hand-maintained exclusion list that withholds untrusted GPS readings from PR ranking while keeping them in totals
- Dashboard SPA shell: hash routing over six views, document-level theming, and a lazy data contract — a compact index manifest up front, per-activity detail and streams fetched only on open
- Activity browser and detail views: filter/sort the full archive; per-run pace/HR/cadence charts, route maps, splits and HR zones
- Records and trends: seven PR tables with honesty badges, a PR-evolution grid, Riegel race predictions with a self-suppressing fitted exponent, WMA age-grading, and a five-tab trends page (volume/consistency, year-over-year, cadence & HR, CTL/ATL/TSB training load, per-shoe gear)
- Privacy architecture for a public repo: identity inputs (birthDate, sex, restingHr) isolated in a gitignored `data/private/`, with a two-layer publish guard — a build-time artifact scanner and negative-reachability assertions in the publish verifier

**Milestone audit:** `tech_debt` — 29/29 requirements satisfied, 0 blockers, 41/43 integration checks wired, 6/6 E2E flows. Known deferred items at close: 11 (see STATE.md Deferred Items and `.planning/v2.0-MILESTONE-AUDIT.md`). The notable one is Phase 16's three unverified theme/first-paint UAT items, which phases 17 and 18's human checkpoints did not discharge despite running on the same shell.

**Pipeline note:** data ingestion migrated off the Strava API to intervals.icu during this milestone.

---
