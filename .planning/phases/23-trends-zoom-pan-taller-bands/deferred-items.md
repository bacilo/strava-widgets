# Deferred Items — Phase 23

## Pre-existing: 5 test files fail on a fresh worktree due to missing `data/stats/*.json`

**Found during:** 23-02 Task 2, running full `npm test` per plan verification.

**Files:** `src/dashboard/views/records-logic.test.ts`,
`trends-cadence-hr-logic.test.ts`, `trends-gear-logic.test.ts`,
`trends-training-load-logic.test.ts`, `trends-yoy-logic.test.ts` — all fail
with `ENOENT: no such file or directory, open 'data/stats/<file>.json'`.

**Root cause:** `data/stats/` is gitignored (`.gitignore:11`) and populated
only by running `npm run compute-all-stats` (part of the `process` pipeline
script) against the committed archive. This worktree was never run through
that pipeline, so the directory does not exist at all (`ls data/stats/*.json`
→ no matches). Confirmed this is an environment/data-generation gap, not a
regression — the failing tests read live JSON fixtures via `fs.readFileSync`
and have zero relationship to `styles.css` or `styles.test.ts`, the only two
files this plan (23-02) touches.

**Disposition:** Out of scope per the executor's SCOPE BOUNDARY rule (only
auto-fix issues directly caused by the current task's changes). Not fixed.
`src/dashboard/styles.test.ts` itself is fully green (135/135) and the
remaining 1185 tests across the other 48 test files all pass — only these 5
files fail to even load their live-data fixture. Someone running
`npm run compute-all-stats` (or an equivalent stats-generation step) before
`npm test` would resolve this; it is orthogonal to Phase 23's CSS/zoom-pan
work.

**RESOLVED 2026-08-19 during plan 23-03 Task 2:** Plan 23-03's own verify
step for Task 2 required `npm run verify-dashboard`, which itself requires
`data/dashboard/index.json` and the `data/stats/*.json` fixtures above — so
this pre-existing environment gap became directly blocking, not just
pre-existing test noise. Ran `npm run build` (tsc, `dist/index.js` also did
not exist yet), then `npm run compute-dashboard-index` and
`npm run compute-all-stats`, both of which succeed entirely from the
committed archive (`data/activities/`, `data/streams/`) with no network
calls — `data/private/athlete-private.json` is absent (expected on a fresh
worktree; age-grading/Banister TRIMP degrade to disabled, non-fatal, matches
the athlete-private test's own documented ENOENT-tolerant behavior). All
five previously-failing test files now pass (54/54 files, 1317/1317 tests),
`npm run build-widgets` copies the new `data/stats/`/`data/dashboard/` into
`dist/widgets/`, and `npm run verify-dashboard` reports 37/37 checks
passing. `data/stats/` and `data/dashboard/` are both gitignored — nothing
from this generation step is committed. One side effect was caught and
reverted before committing: `npm run compute-all-stats` also touches
`data/geo/geo-metadata.json`'s `generatedAt` timestamp as a byproduct of a
shared code path; that file was restored via `git checkout --` before the
Task 2 commit, since it is unrelated to Phase 23. Left in place (not
reverted) for any later Phase 23 plan that also runs the full verification
gate: the generated `data/stats/`/`data/dashboard/` files themselves,
since they are gitignored and regenerating them is idempotent/free.

**RESOLVED (env gap widened) 2026-08-27 during plan 23-12 Task 2:** This
worktree's `node_modules/` was entirely empty (0 entries besides Vite's own
cache dirs) — `npm test` additionally failed on `chartjs-plugin-zoom` being
unresolvable, on top of the `data/stats/*.json` gap above. Ran `npm ci`
against the committed, unmodified `package-lock.json` (no `package.json`
change, so the Package Legitimacy Gate does not apply — this restores
already-locked dependencies, it does not add any), then the same
`npm run build` / `npm run compute-dashboard-index` / `npm run compute-all-stats`
sequence as the 23-03 resolution above. Same non-fatal age-grading/Banister
disablement, same `data/geo/geo-metadata.json` `generatedAt` side effect,
reverted the same way via `git checkout --` before staging. Full suite: 55/55
files, 1359/1359 tests; `npm run build-widgets` and `npm run verify-dashboard`
(37/37 checks) both exit 0.

## Finding 12 — Training Load tooltip title renders a raw epoch-millisecond value

**Found during:** plan 23-11 Task 2, the Round 2 browser checkpoint,
2026-08-26/27 — and, first, plan 23-07 Task 2, Round 1, 2026-08-26, where the
same defect was recorded as Finding 6 and ruled OUT OF SCOPE.

**Files:** `src/dashboard/views/trends-charts.ts` (the Training Load chart's
tooltip config, `mountTrainingLoadChart`) and `src/dashboard/views/trends-tick-format.ts`
(`formatTimeAxisTick`, the formatter a future fix would reuse).

**Observed (verbatim from the Round 2 record):** tooltip header
`1,762,646,400,000` while the x-axis directly beneath it correctly read
`9 Nov 2025`; tooltip body lines correct (`CTL (Fitness): 147.3`,
`ATL (Fatigue): 167.9`, `TSB (Form): -42.8`). Confirmed visually in a
screenshot, not only via instrumentation. R38 quoted two adjacent tooltip
titles (`1,762,473,600,000` and `1,762,560,000,000`) and PASSED on its own
stated assertions with this defect present.

**Root cause, as far as it is established:** confirmed by reading
`src/dashboard/views/trends-charts.ts` in this task — no `title` callback is
defined anywhere under any chart's `tooltip.callbacks` in this file (checked
all seven `callbacks:` blocks, at `mountVolumeChart` ×2, `mountYoyChart`,
`buildChannelBand`, `mountTrainingLoadChart` ×2, and `mountGearChart`), so
Chart.js's default title formatter stringifies the raw numeric `x` of a
`type: 'linear'` scale point. Predates Phase 23 entirely — confirmed against
`61ee687`, the last pre-Phase-23 commit. The hypothesis relating it to
23-10's tick-formatter change is UNVERIFIED and was argued against: 23-10
changed the axis TICK callback (`formatAdaptiveTimeTick`, used at the x-axis
tick callbacks in `mountVolumeChart`, `mountYoyChart`, `buildChannelBand` and
`mountTrainingLoadChart`), not the tooltip `title` callback, and Finding 6
predates 23-10.

**Disposition (dated 2026-08-27, plan 23-12): DEFERRED, not fixed.**

1. It gates no requirement. Round 2's requirement-gating table maps TRN-01 to
   R22/R23/R24/R25/R38 and Finding 12 to none; TRN-01 ticked with this defect
   present and visible.
2. It predates Phase 23, so it is not a regression this phase introduced and
   closing Phase 23's gate does not depend on it.
3. Fixing it means adding a `plugins.tooltip.callbacks.title` to a chart
   config in `trends-charts.ts` — chart-config code this gap-closure round's
   scope explicitly excludes. The round's only source change is the Trends
   tab strip's scroll containment (`.trends-tablist-scroll`); reopening
   `trends-charts.ts` would put tick formatting and chart lifecycle back in
   scope days after Round 2 closed TRN-01, TRN-02 and TRN-04 on rendered
   evidence.
4. It is recorded here rather than dropped so the next work that touches
   `trends-charts.ts` inherits it with its evidence intact.

**Fix shape for whoever picks it up:** a `plugins.tooltip.callbacks.title` on
the Training Load chart (`mountTrainingLoadChart`) that formats
`items[0].parsed.x` through the same `D MMM YYYY` shape
`trends-tick-format.ts`'s `formatTimeAxisTick` already produces, rather than
inventing a new date formatter. The other Trends charts that share the same
`type: 'linear'`-scale, epoch-x, `formatAdaptiveTimeTick`-ticked shape and
would need the identical treatment: `mountVolumeChart` (Volume tab),
`mountYoyChart` (Year-over-Year tab), and `buildChannelBand` (the Cadence &
HR tab's two channel bands). `mountGearChart` is not time-scaled and is out
of scope for this fix shape.

**Consequence to state plainly:** any future checkpoint round that adds a row
for this defect will not be a clean sweep until it is fixed. Phase 23's
Round 3 deliberately adds no such row.
