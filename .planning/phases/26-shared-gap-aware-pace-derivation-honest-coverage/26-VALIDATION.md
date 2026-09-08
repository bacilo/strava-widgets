---
phase: 26
slug: shared-gap-aware-pace-derivation-honest-coverage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-08
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `26-RESEARCH.md` § "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | `vitest.config.ts` (existing — keep `fileParallelism: false`, per STATE.md's Phase 24 cross-plan-defect lesson; do **not** re-enable parallelism for this phase's new test files) |
| **Quick run command** | `npx vitest run src/analytics/pace-derivation.test.ts src/analytics/pace-fixtures.test.ts` |
| **Full suite command** | `npm run test` (`vitest run`) |
| **Estimated runtime** | ~30s quick / full suite per existing project baseline |

**Framework install:** none needed — vitest is already configured project-wide.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/analytics/pace-derivation.test.ts src/analytics/pace-fixtures.test.ts`
- **After every plan wave:** Run `npm run test` (full suite, `fileParallelism: false`)
- **Before `/gsd-verify-work`:** Full suite green **+** `tsc --noEmit` **+** `npm run build-widgets` — this project's existing phase-gate convention, confirmed across every prior phase in STATE.md
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner. Rows below are keyed by requirement and are
filled in with concrete task IDs once `*-PLAN.md` files exist; every task that
touches a requirement below must cite the matching automated command.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PACE-01 | — | N/A | unit (grep-based audit) | `npx vitest run src/analytics/pace-single-source.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-02 | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "gap boundary"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-03 | — | N/A | unit, real committed stream `5059204779` | `npx vitest run src/analytics/pace-derivation.test.ts -t "adaptive window"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-04 | — | N/A | unit, real archive | `npx vitest run src/analytics/pace-derivation.test.ts -t "histogram"` | ❌ W0 | ⬜ pending |
| Task 2 | 26-06 | 4 | PACE-05 | — | N/A | unit | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "gap marker"` | ✅ (created by 26-06; 8 passing) | ✅ green |
| TBD | TBD | TBD | PACE-06 | — | N/A | integration (script, real archive) | `node scripts/compute-pace-residual.mjs` — diff against committed `26-RESIDUAL.md` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACE-07 | T-26-01 | Total/never-throwing on malformed stream input | unit + archive-wide dry run | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "pace disagreement"` | ❌ W0 (extend existing file) | ⬜ pending |
| TBD | TBD | TBD | COV-01 | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "coverage sums"` | ❌ W0 | ⬜ pending |
| Task 2 | 26-06 | 4 | COV-02 | — | N/A | unit (text/structure assertion — no jsdom, per project convention) | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "coverage caption"` | ✅ (created by 26-06; 5 passing) | ✅ green |
| TBD | TBD | TBD | ERA-03 | — | N/A | unit | `npx vitest run src/analytics/pace-fixtures.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Demonstrated-Failing Cases (Nyquist negative staging)

Every Phase 26 Success Criterion carries a "demonstrated failing" clause. Each negative
case below must be staged and observed failing **before** its positive assertion is trusted.

| # | Negative case staged | Observable that proves the failure | Criterion / Req |
|---|----------------------|-----------------------------------|-----------------|
| 1 | Fixed 20s window instead of adaptive | `5059204779` reads ~94.8% fast mass / ~30% coverage (vs 1.2% / 97% adaptive) | Crit 5 · PACE-03 |
| 2 | Absolute distance-flat pause threshold instead of scale-relative | ~97% of `5059204779` classified as paused despite max time gap of 7s | D-05 · PACE-02 |
| 3 | Gap-boundary clipping removed | Constructed known-duration-gap fixture shows the window bridging the gap | Crit 2 · PACE-02 |
| 4 | Split gap marking removed | Split whose window crosses a gap renders with no marker/legend | Crit 2 · PACE-05 |
| 5 | The `dd <= 0` skip in `computePaceDistribution` (the located defect) | `covered + Σ(excluded by category)` ≠ `t[n-1] - t[0]`; 964/3,394s (28%) unaccounted on `4556693525` | Crit 3 · COV-01 |
| 6 | A second per-sample pace implementation deliberately reintroduced | `pace-single-source.test.ts` fails, naming the offending file | Crit 4 · PACE-01 |
| 7 | Metadata-vs-stream cross-check removed | Dashboard reverts to displaying `5059204779` as 1:53/km as fact | Crit 7 · PACE-07 |
| 8 | Archive sweep re-run against the unfixed per-sample path | Baseline fast-mass values reproduce, confirming the "after" comparison is real | Crit 1 · PACE-04/06 |

---

## Wave 0 Requirements

- [ ] `src/analytics/pace-derivation.ts` + `src/analytics/pace-derivation.test.ts` — the shared module
- [ ] `src/analytics/pace-fixtures.ts` + `src/analytics/pace-fixtures.test.ts` — ERA-03 fixture library
- [ ] `src/analytics/pace-single-source.test.ts` — D-18's grep-based audit
- [ ] `scripts/compute-pace-residual.mjs` — D-19's regenerating script
- [ ] `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md` — D-19's committed deliverable (13 IDs; re-verify against the live archive before committing as final)
- [ ] Extend `src/dashboard/views/detail-sections.test.ts` — D-08 caption + D-09 split marker
- [ ] Extend `src/analytics/compute-dashboard-index.test.ts` — PACE-07's additive flag field

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coverage caption reads correctly on screen under the `Pace Distribution` heading, and its percentage equals a hand-sum taken straight from the committed stream file | COV-02, Crit 3 | Criterion 3 requires the value be *read in the browser at the moment of observation*, not asserted from a unit test | Serve the built dashboard, hard-reload (stale `index.html`/`index.json` in staged builds is a known trap), open the pinned exemplar `4556693525`, read the caption percentage back against an independently summed value from `data/streams/4556693525.json`. Pre-computed expectation (plan 26-06, re-derived at execution time from `derivePaceWithCoverage`): `"99% of elapsed time covered · 1% recording gaps · 0% paused"` (spanSec 3394, coveredSec 3363, recordingGapSec 31, pauseSec 0). |
| Split gap marker + legend render legibly at phone widths without breaking the splits table's 7 columns (`Km \| Pace \| Elapsed \| Avg HR \| Avg Cadence \| Elev Δ \| vs. Avg` — confirmed by direct source read, not the 8 columns CONTEXT.md's prose stated) | PACE-05, D-09 | Layout legibility is not assertable from a text/structure test | Hard-reload, open activity `10198771331` (fēnix 6 Pro FIT, span 5225s, distance 11169m — pinned as `gap-crossing-split` in `pace-fixtures.ts`) at narrow viewport (clamped 500..941). Confirm km 11's Pace cell reads `"18:38/km ⚠"` and the legend below the splits table reads exactly `"Km 11: includes 11:29 of recording gap"` — the marker and legend should read as "paused mid-km" not "bad kilometre". Verified at execution time (plan 26-06): `splitGapAnnotations` flags exactly km 11 (recordingGapSec 688, pauseSec 1, totalSec 689 = 11:29), no other split in this activity is flagged. Backups if `10198771331` cannot be reached: `10238432339` (km 17, 515s gap) or `10325703458` (km 2, 273s gap), both also pinned in `pace-fixtures.ts`. |
| PACE-07 badge appears on **both** the detail Pace stat card and the Activities list row (and is considered against all three `renderActivityRow` surfaces) | PACE-07, D-11 | Multi-surface rendering; `idPrefix` pattern makes the list row shared across Activities, Overview Recent Activities, Overview Recent PRs | Hard-reload, sort Activities by pace, confirm `5059204779` ranks #1 **with** its badge visible and is not suppressed from results (D-12) |

*This project has a standing browser-checkpoint convention: per PROJECT.md, automated gates have
missed shipped rendering defects three times. ROADMAP.md marks Phase 26 `UI hint: yes`. A human
browser checkpoint is expected before this phase closes.*

---

## Round 1 Checkpoint (R1-R6)

Prepared by plan 26-10 Task 1, 2026-09-08. All six rows below carry a pre-stated expected value,
derived **before** observation, and an explicit failing-observation description, per this
project's `checkpoint-rows-must-assert-extent` and `checkpoint-rows-can-be-unsatisfiable` lessons.

### Pre-session automated gate (all exited 0, run against the live tree before serving)

| # | Command | Exit code |
|---|---------|-----------|
| 1 | `npm run test` | 0 (1883 passed / 0 failed, 69 files) |
| 2 | `npx tsc --noEmit` | 0 |
| 3 | `npm run build` | 0 |
| 4 | `npm run compute-dashboard-index` | 0 (1890 indexed, **Pace disagreements flagged: 1**) |
| 5 | `npm run build-widgets` | 0 (dashboard SPA + all 11 widgets built; `data/dashboard/*.json` — 1 copied) |
| 6 | `npm run verify-dashboard` | 0 (56 checks passed, 0 failures) |

`git status --porcelain data/streams` — no output (archive byte-identical; `data/dashboard/index.json`
is gitignored per `.gitignore:14`, so its regeneration produces no working-tree diff).

### Served build

- **URL (mounted, production-shaped — matches the GitHub Pages project-page mount D-02 uses):**
  `http://127.0.0.1:4173/strava-widgets/`
- **Server:** `npm run curate` (`scripts/curate-server.mjs`), started detached:
  `nohup npm run curate > /tmp/gsd-26-serve.log 2>&1 &`
- **Restart command if the process is gone:** from the repo root,
  `nohup npm run curate > /tmp/gsd-26-serve.log 2>&1 & disown` (binds `127.0.0.1:4173` only; if you see
  `FATAL: port 4173 is already in use`, a prior instance is still running — that is fine, just reload
  the browser).
- **Staged-build guard (T-26-18), confirmed by fetch against the SERVED URL, not the repo file:**
  `curl -s http://127.0.0.1:4173/strava-widgets/data/dashboard/index.json` → activity `5059204779`'s
  row carries `"paceDisagreement":{"streamPaceSecPerKm":350.6,"metadataPaceSecPerKm":112.6,"ratio":3.11}`
  and `"paceSecPerKm":112.6` — matching the freshly regenerated repo artifact exactly, not a stale
  staged copy. `GET /strava-widgets/` → `200`.

### Setup instructions (read before every row)

1. **Hard reload** the page before starting (Cmd+Shift+R / disable cache in DevTools). Staged builds
   in this project have served a stale `index.html`/`index.json` before — pointing at `127.0.0.1`
   alone is not sufficient.
2. Keep the browser viewport within the **500-941 px** band for every row.
3. Routes (hash router): Overview `#/`, Activities list `#/list`, Detail `#/activity/{id}`.

### Row 1 — D-08 / COV-02 — coverage caption, activity `4556693525`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/4556693525`, scroll to `Pace Distribution`.
- **What to read back:** the `.text-label` caption line directly under the `Pace Distribution` heading.
- **Independent derivation method (does NOT import `src/analytics/pace-derivation.ts`):** a
  standalone throwaway Node script (`/tmp/hand-derive-coverage.mjs`, not committed) read
  `data/streams/4556693525.json`'s `t`/`d` arrays directly and reimplemented the classification rule
  from its documented spec in `pace-derivation.ts`'s own comments (read, not imported) — segment
  `[t[i],t[i+1]]` is `recording-gap` if `dt > 10s`; else `pause` if it belongs to a maximal
  distance-flat run (`d[i+1]-d[i] <= 0`) whose duration exceeds `5 * p90(advanceIntervals)` (R-7
  linear-interpolation quantile); else `covered`. Result: `n=1682` samples, `spanSec = t[1681]-t[0] =
  3394`, `coveredSec=3363`, `recordingGapSec=31`, `pauseSec=0`, `coveredSec+recordingGapSec+pauseSec
  = 3394 = spanSec` exactly (sum identity holds). Rounded: **covered 99%, recording gaps 1%, paused
  0%.** (This independently-derived result matches plan 26-06's own pre-computed figure from
  `derivePaceWithCoverage` exactly — expected, since both implement the same documented rule; the
  point of this derivation is that it was computed WITHOUT calling that code.)
- **Pre-stated expected caption (verbatim):** `"99% of elapsed time covered · 1% recording gaps · 0% paused"`
- **PASS if:** the caption is present, names all three categories, and its three percentages equal
  the hand-derived 99/1/0 (or disagree by no more than one point of rounding).
- **FAIL if:** the caption is absent, any of the three named categories is missing, or a percentage
  disagrees with the hand sum by more than one point of rounding.
- **Both-direction check:** satisfiable both ways — a code regression that dropped the caption, or
  that fed the histogram's numbers through a different span, would produce an observably different
  or absent string; a correct render reproduces the hand-derived percentages exactly.

### Row 2 — D-09 / PACE-05 — split gap marker + legend, activity `10198771331`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/10198771331`, scroll to `Splits`.
- **Selected activity (plan 26-06's verified pick, pinned in `pace-fixtures.ts` and by a permanent
  automated assertion in `detail-sections.test.ts`):** `10198771331` (fēnix 6 Pro FIT, span 5225s,
  distance 11169m — confirmed present at `data/streams/10198771331.json`, span 5225s matches).
- **Flagged split:** km 11 only (689s total overlap: 688s recording-gap + 1s pause boundary noise).
- **Pre-stated expected values (verbatim):**
  - Pace-column cell text: `"18:38/km ⚠"`
  - Legend line (below the splits table): `"Km 11: includes 11:29 of recording gap"`
  - That split's own pace number, unchanged from before this phase: `18:38/km` (PACE-05's own
    "splits' own arithmetic is not changed" claim — the marker adds a glyph, never alters the number).
- **PASS if:** the marker and legend both render with the exact strings above, and km 11's Pace
  number reads `18:38/km`.
- **FAIL if:** the marker or legend is absent, the legend does not state a duration, or the pace
  number differs from `18:38/km`.
- **Both-direction check:** satisfiable both ways — this row was previously vacuous (plan 26-10's
  own `<interfaces>` noted no real activity had been selected); plan 26-06 closed that gap by
  selecting and pinning this real activity with a permanent regression test, so a marker/legend
  regression is independently observable in the browser (not merely re-reading the same test).

### Row 3 — D-11 / PACE-07, detail view — Pace stat card, activity `5059204779`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/5059204779`, Pace stat card.
- **Source data (read from the served, freshly-regenerated index, confirmed above):**
  `paceSecPerKm: 112.6` (metadata), `paceDisagreement.streamPaceSecPerKm: 350.6`.
- **Pre-stated expected values (verbatim):**
  - Stat card big value (unchanged, D-10): `"1:53/km"`
  - Badge line beneath it: `"Pace disputed — stream-derived 5:51/km"`
- **PASS if:** both strings read exactly as above.
- **FAIL if:** the big value differs from `1:53/km`, or the badge is absent or does not name the
  stream-derived figure.
- **Both-direction check:** satisfiable both ways — a code regression silently substituting the
  stream pace for the metadata pace would change the big value (observable FAIL); an omitted badge
  or wrong figure is independently distinguishable from a correct render.

### Row 4 — D-11 / PACE-07, list row — Activities, sorted by pace, activity `5059204779`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/list`, sort by Pace ascending (fastest first) —
  the "Pace (fastest)" option in the sort `<select>` at narrow widths, or the clickable `Pace` column
  header at wider widths.
- **Independently computed expected position:** sorting the served `index.json`'s 1889
  activities carrying a numeric `paceSecPerKm` ascending by that field places `5059204779`
  (`112.6` sec/km) **first** — no other activity in the archive has a lower `paceSecPerKm` (next
  fastest: `7827165619` at `247.2`). Plan 26-08's own independent verification (against the compiled
  `list-logic.js`) recorded this as `"#1 of 1890"`.
- **Pre-stated expected values:** badge text `"Pace disputed"`; **position: rank #1 (fastest pace in
  the sorted list)** — not merely present.
- **PASS if:** the row appears in the sorted results (not suppressed) at rank #1, with the
  `"Pace disputed"` badge visible.
- **FAIL if:** the row is absent from the sorted results (suppression, forbidden by D-12), the badge
  is missing, or the row's rank differs from #1.
- **Both-direction check:** satisfiable both ways — a suppression regression removes the row
  entirely (observable FAIL distinct from a correct render); a sort-key regression would place it at
  a different, observably wrong rank.

### Row 5 — D-11 / PACE-07, other surfaces — Overview, activity `5059204779`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/`, Recent Activities and Recent PRs cards.
- **Pre-recorded verdict: NOT EXERCISABLE**, determined before the session by direct inspection of
  the served/regenerated index, independent of the UI:
  - **Recent PRs** filters `rows.filter(row => row.prCount > 0)` (`overview.ts`). `5059204779`'s
    served row carries `"prCount": 0` — it can never qualify, by construction, regardless of any
    other state.
  - **Recent Activities** takes `rows.slice(0, 10)` from the index, which is ordered date-descending
    (confirmed: index entry 0 is `2026-09-07T14:11:59Z`, entry 1889 is `2011-08-16T18:55:32Z`).
    `5059204779`'s `startDate` is `2021-03-25T17:03:15Z`, at **date-descending position 1091 of
    1890** in the served index — far outside the top-10 slice.
  - Both exclusions are independent and structural (a zero PR count; a five-year-old date against a
    live-updating archive), not incidental — this row cannot be forced into either surface without
    fabricating a fixture the plan's own scope does not authorize.
- **Instruction for the session:** confirm this reasoning still holds against the served build (re-check
  `prCount` and the Recent Activities list's actual contents) and record NOT EXERCISABLE with that
  confirmation — never as a silent skip.

### Row 6 — D-13 / PACE-07 — rebased `vs. Avg` baseline, activity `5059204779`

- **Where:** `http://127.0.0.1:4173/strava-widgets/#/activity/5059204779`, splits table `vs. Avg`
  column + caption note below `.splits-scroll`.
- **Pre-stated expected caption (verbatim):**
  `"Splits above are compared against the stream-derived average (5:51/km), not the disputed metadata average."`
- **What to read back:** the caption note verbatim, plus at least one split's `vs. Avg` value or
  `aria-label`, confirming it now reads as a small, plausible delta.
- **PASS if:** the caption note reads exactly as above, and the quoted `vs. Avg` delta is small
  (consistent with comparing against a ~5:51/km baseline) rather than the roughly four-minutes-slow
  reading the old metadata-average baseline (~1:53/km) would have produced against the same
  stream-derived per-split paces.
- **FAIL if:** the note is absent, or the quoted delta is still on the order of four minutes wide.
- **Both-direction check:** satisfiable both ways — a regression that left the baseline unrebased
  would reproduce the ~4-minute-wide deltas PACE-07's problem statement describes (observable FAIL);
  a correct rebase produces small deltas and the disclosure note, both independently readable.

### Verdict table (filled in during Task 2 — do not pre-fill)

| Row | Requirement | Verdict | Verbatim quotation |
|-----|-------------|---------|---------------------|
| R1  | D-08/COV-02 | _(pending)_ | _(pending)_ |
| R2  | D-09/PACE-05 | _(pending)_ | _(pending)_ |
| R3  | D-11/PACE-07 | _(pending)_ | _(pending)_ |
| R4  | D-11/PACE-07/D-12 | _(pending)_ | _(pending)_ |
| R5  | D-11/PACE-07 | NOT EXERCISABLE (pre-recorded, see Row 5 above) | _(developer to confirm reasoning still holds, see instruction above)_ |
| R6  | D-13/PACE-07 | _(pending)_ | _(pending)_ |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] All 8 demonstrated-failing cases staged and observed failing before their positive assertion
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
