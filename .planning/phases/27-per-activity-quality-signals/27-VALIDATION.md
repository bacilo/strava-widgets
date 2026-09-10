---
phase: 27
slug: per-activity-quality-signals
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-10
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `27-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 (existing) |
| **Config file** | `vitest.config.ts` — existing; `fileParallelism: false`, **keep this setting** |
| **Quick run command** | `npx vitest run src/analytics/pace-quality.test.ts src/dashboard/data/pace-quality-client.test.ts` |
| **Full suite command** | `npm run test` (`vitest run`) |
| **Estimated runtime** | quick ~5-15s · full suite per existing project baseline |

**Framework install:** none needed — infrastructure already present.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/analytics/pace-quality.test.ts src/dashboard/data/pace-quality-client.test.ts`
- **After every plan wave:** Run `npm run test` (full suite, `fileParallelism: false`)
- **Before `/gsd-verify-work`:** Full suite green + `tsc --noEmit` + `npm run build-widgets` — matching every prior phase's convention
- **Max feedback latency:** ~15 seconds for the quick run

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. This table is the **requirement→test contract** the
> planner must satisfy; each row must map to at least one task's `<automated>` verify block.

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01 | 5 signals computed in CI; index row **and** shard both carry them as separate fields | unit + integration (real archive) | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "quality signals"` | ❌ W0 (extend existing) |
| QUAL-02 | Device era and decimation stay separate fields on correlated activities; impossible-sample and decimation overlap does not collapse into one field | unit, decimation-aliased fixture with both signals asserted independently present | `npx vitest run src/analytics/pace-quality.test.ts -t "independent signals"` | ❌ W0 |
| QUAL-03 | Index additive (`DASHBOARD_INDEX_SCHEMA_VERSION` unchanged); shard mirrors `best-efforts` pattern and is fetched lazily | unit (schema) + instrumented fetch-count test (D-18) | `npx vitest run src/dashboard/data/pace-quality-client.test.ts -t "fetch count"` | ❌ W0 |
| QUAL-04 | Badge visible text names the condition **and** its measured value | unit (text assertion, project's jsdom-free convention) | `npx vitest run src/dashboard/views/list.test.ts -t "quality badge text"` | ❌ W0 (extend existing if present) |
| QUAL-05 | Dry-run composite rate reported; recount script reproduces it **without importing the classifier** | integration (script, real archive) | `node scripts/compute-pace-quality-recount.mjs` — diff against committed report / CI-printed count | ❌ W0 |
| ERA-01 | fēnix 6 Pro vs Suunto 9 differentiated despite identical FIT format | unit, real pinned fixtures `10041312551` / `3480808722` | `npx vitest run src/analytics/pace-quality.test.ts -t "device family"` | ❌ W0 |
| ERA-02 | `no-device-name` and `intervals-icu` reported as distinct categories, never a fabricated default | unit + archive-wide dry run | `npx vitest run src/analytics/pace-quality.test.ts -t "no-device-name category"` | ❌ W0 |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = file does not exist yet, Wave 0 creates it*

---

## Wave 0 Requirements

Files that must exist (created or extended) before dependent tasks can verify:

- [ ] `src/analytics/pace-quality.ts` + `.test.ts` — the signal module (impossible-sample count, device-family resolution, tiering)
- [ ] `src/dashboard/data/pace-quality-client.ts` + `.test.ts` — shard client mirroring `best-efforts-client.ts`
- [ ] `scripts/compute-pace-quality-recount.mjs` — D-03's independent recount script (must **not** import the classifier)
- [ ] `src/analytics/dashboard-index.types.ts` — 5 new index-row fields (additive; `DASHBOARD_INDEX_SCHEMA_VERSION` must not move)
- [ ] `src/analytics/compute-dashboard-index.ts` — call the new module, write the 5 fields + per-activity shard
- [ ] `src/dashboard/views/list.ts` — badge-dispatch restructure (**contract change, not additive** — see RESEARCH Pitfall 1; own task/plan step)
- [ ] `src/dashboard/views/list-logic.ts` — one new `FilterState` field + URL param
- [ ] `src/dashboard/views/detail.ts` — add `paceQualityClient.load` to the existing `Promise.all` mount point
- [ ] `src/dashboard/views/detail-sections.ts` — new always-on quality section
- [ ] `scripts/verify-dashboard-publish.mjs` — spot-check at least one of the 5 new fields, following the existing `gearName` check pattern

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zero shard fetches on the activity-list view; exactly one on detail open | QUAL-03 / Criterion 2 | D-18 explicitly requires a **human network-panel reading** — an instrumented in-process fetch counter proves the code path, not the shipped page | Open the built dashboard, DevTools → Network, filter `pace-quality`. Confirm 0 requests on the list view; open one activity detail; confirm exactly 1. Hard-reload between steps (see the project's staged-build browser-cache hazard — `127.0.0.1` alone is not sufficient). |
| Badge on a real flagged activity names the condition and its measured value | QUAL-04 / Criterion 3 | Criterion 3 says "read directly off the rendered page" | Open a known severe-tier activity's detail view in the browser; quote the badge's rendered visible text verbatim, including the numeric value. |
| Composite severe rate is demonstrated *failing* by moving a threshold | QUAL-05 / Criterion 4 | Criterion 4 requires a demonstrated-failing discriminator, not just a passing measurement | Move one severe threshold, re-run the dry run, observe the measured rate move in the expected direction, restore the threshold. |
| Device-era branch demonstrated failing when deleted | ERA-01/ERA-02 / Criterion 5 | Criterion 5 requires the no-device-name branch be shown load-bearing | Delete the `no-device-name` branch, confirm sampled rows fall back to a fabricated/default device name, restore. |

---

## Sampling Continuity Notes

- The archive is ~1,890 activities. A per-signal check that samples fewer than the full
  archive **cannot** substantiate Criterion 4's rate claim — the calibration dry run must be a
  full pass, not a sample. Per-signal *correctness* checks may use pinned fixtures.
- Per memory of this project's checkpoint history: checkpoint rows must assert **reachable
  extent against an independently-derived value**, not internal agreement between two code
  paths that share an implementation. D-03's "recount must not import the classifier" is
  exactly this rule applied to QUAL-05 — preserve it.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s for the quick run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Round 1 Checkpoint (R1-R8)

**Drafted:** 2026-09-10 by plan 27-10 Task 1. Build/serve verification against the main checkout
(branch `master`, HEAD `71df4d97`). No browser row has been run by an agent. Every verdict below
reads `pending` until the developer replies.

### Build and Serve Verification (independent of any browser row)

1. **Rebuild:** `npm run build && npm run compute-dashboard-index && npm run build-widgets` — all
   three exited 0. `compute-dashboard-index` stdout: `Activities indexed: 1890`, `With streams:
   1865`, `Without streams: 25`, `Quality: any severe signal: 299`, `Quality: not computable: 25`
   — matching `27-CALIBRATION.md` §1/§4 and the recount script's own live numbers exactly.
   `dist/widgets` was deleted before rebuilding (per the project's mtime-skip hazard) so this is
   a fresh build, not a stale mtime no-op.

2. **Emitted JS asset vs. 27-09's recorded digest:**
   - Emitted: `assets/index-BHpzXFXA.js`, local-file SHA-256
     `2d48f635ce83dd8b9ce0c71d6831117d8d95e4ee97cfa6b3065f9e6b1f39e8f4`.
   - 27-09-SUMMARY.md recorded: `assets/index-QusZKQ85.js`, SHA-256
     `cea75dd277f419d9dbebb0241190df0375eda8f42e15603d9182d89c73d8eff5`.
   - **Result: DIFFERENT — EXPECTED, not a stale-bundle failure.** 27-09-SUMMARY.md's Task 3
     recorded its digest from an isolated worktree build, before that worktree's own commits (and
     the parallel 27-08 worktree's list.ts badge-dispatch restructure) were merged into the main
     checkout. This rebuild runs AFTER both plans' source changes landed on `master` (confirmed
     by this session's HEAD `71df4d97`), so a changed emitted filename and a changed digest are
     the expected fingerprint of a content-hashed bundle whose source changed since 27-09
     recorded its figure — not the project's "build-widgets skipped, stale file served" failure
     mode (that failure mode is a digest that does NOT change despite a source edit; here it
     changed, correctly, because the content changed). Re-recorded here as the current digest of
     record for this checkpoint; 27-09's figure is superseded, not contradicted.

3. **Served digest (from FETCHED bytes — the one that matters):** served the publish directory
   over HTTP with `cd dist/widgets && python3 -m http.server 8917`, fetched
   `http://127.0.0.1:8917/index.html`, read its referenced asset filename
   (`assets/index-BHpzXFXA.js`, matching the emitted filename above), fetched that URL, and hashed
   the FETCHED bytes:
   ```
   $ curl -s http://127.0.0.1:8917/assets/index-BHpzXFXA.js -o /tmp/fetched-index.js
   $ shasum -a 256 /tmp/fetched-index.js
   2d48f635ce83dd8b9ce0c71d6831117d8d95e4ee97cfa6b3065f9e6b1f39e8f4  /tmp/fetched-index.js
   ```
   **Served digest = local-file digest** (`2d48f635ce83dd8b9ce0c71d6831117d8d95e4ee97cfa6b3065f9e6b1f39e8f4`,
   `assets/index-BHpzXFXA.js`) — confirms the HTTP server is serving the bundle just built, not a
   stale cached copy. This is the digest of record R1 checks against.
   **Serve command for the developer to use (same one, same port):**
   ```
   cd /Users/pedf/workspace/strava-widgets/dist/widgets && python3 -m http.server 8917
   ```
   Then open `http://127.0.0.1:8917/index.html` in a real browser and HARD-RELOAD
   (Cmd+Shift+R) before starting any row — `127.0.0.1` alone is not sufficient per this
   project's own staged-build cache hazard.

4. **Served `/data/dashboard/index.json` vs. the local file:**
   ```
   served: activities.length 1890, totals.qualityAnySevere 299, totals.qualityNotComputable 25, schemaVersion 1
   local:  activities.length 1890, totals.qualityAnySevere 299, totals.qualityNotComputable 25, schemaVersion 1
   ```
   Exact match — no stale staged `index.json` served alongside the fresh bundle.

5. **Recount script stdout (independent figure #2), recorded verbatim:**
   ```
   D-03 independent recount: reading data/dashboard/index.json off disk (no classifier import)...

   Total rows (activity-count denominator): 1890
   Rows with a computable stream (notComputableReason === null): 1865
   Not-computable count: 25
   Per-signal severe counts (own arithmetic, tier === 'severe'):
     decimation:        154
     gapProfile:        127
     impossibleSamples: 31
   Recomputed composite (own arithmetic, union of the three tiers): 299
     vs. totals.qualityAnySevere:        299
     vs. count of row.quality.anySevere:  299

   PASS: recount agrees with the shipped totals; no disagreements found.
   ```
   Exit 0. `npm run verify-dashboard` also run against this same served build: **64 checks
   passed, 0 failures**, including `GET /assets/index-BHpzXFXA.js -> 200` and three
   `pace-quality/{id}.json` spot-checks.

### R1 — served digest

**Instruction:** In DevTools → Network, hard-reload the page, find the loaded JS asset's
filename in the Network panel (or in the page's `view-source`/Sources tab), and compare it to
the digest recorded above.

**Expected:** filename `assets/index-BHpzXFXA.js`, and — if the developer independently hashes
the fetched bytes — SHA-256 `2d48f635ce83dd8b9ce0c71d6831117d8d95e4ee97cfa6b3065f9e6b1f39e8f4`.
Source: this task's own step 3 (FETCHED bytes, not the build log).

CAN PASS: the Network panel's loaded asset filename is `assets/index-BHpzXFXA.js`.
CAN FAIL: a stale bundle serves a different asset filename (e.g. a cached
`index-QusZKQ85.js` or any name other than the one recorded above).

**Verdict:** pending

### R2 — Criterion 2, zero fetches on the list

**Instruction:** DevTools → Network, filter `pace-quality`, hard-reload `#/list`, scroll to the
bottom of the first page.

**Expected:** zero requests. Record the observed count.

CAN PASS: the filtered Network panel shows 0 requests after hard-reload and scroll.
CAN FAIL: any request matching `pace-quality` appears — a list-side code path would exist
despite the grep gate in plan 27-09.

**Verdict:** pending

### R3 — Criterion 2, exactly one fetch on open

**Instruction:** Without clearing the filter, open one activity's detail view. Then navigate
back to `#/list` and open the SAME activity again. Then open a DIFFERENT activity.

**Expected:** exactly one request to `data/stats/pace-quality/{id}.json` (HTTP 200) on first
open; still exactly one total after re-opening the same activity (memoized); exactly two total
after opening a different activity.

CAN PASS: the request counts match 1 / 1 (same activity, no new request) / 2 (different
activity) in that sequence.
CAN FAIL: zero requests on first open (mount never fires), two requests on first open
(duplicate fetch), or a fresh request on re-opening the same activity (memoization broken).

**Verdict:** pending

### R4 — Criterion 3, badge read-back on a severe activity

**Instruction:** Open activity `i183546832` (the severe activity named in
`27-09-SUMMARY.md`). Quote the rendered "Recording gaps" badge/row's visible text VERBATIM,
including its number, from the detail view.

**Expected value, stated before the row runs, independently derived from the committed shard
`data/stats/pace-quality/i183546832.json`** (read directly by this task, not copied from
27-09-SUMMARY without re-checking):
- `signals.gapProfile.tier: "severe"`, `gapFraction: 0.26551897461673785` → **27%** of recorded
  time in gaps or pauses (`recordingGapSec: 2112`, `pauseSec: 1`, `spanSec: 7958`).
- `gapIntervals` array has 11 entries (10 `recording-gap` + 1 `pause`); the longest is
  `startSec: 4766, endSec: 5769` = 1003 seconds = **16:43**.
- Expected rendered text: `27% of recorded time in gaps or pauses`, with evidence naming
  `11 gap intervals; longest 16:43`.
Source: `data/stats/pace-quality/i183546832.json`, read directly by this task — NOT the page
being checked.

CAN PASS: the quoted badge text states `27%` (or an equivalent explicit percentage matching
0.2655…) and names gaps/pauses, and the evidence line (if shown) names 11 intervals / 16:43.
CAN FAIL: the badge names the condition without a number, or the quoted number disagrees with
27% / the 11-interval / 16:43 figures above.

**Verdict:** pending

### R5 — D-08, healthy disclosure

**Instruction:** Open activity `i183856843` (the healthy activity named in
`27-09-SUMMARY.md`). Quote all five Quality Signals rows verbatim.

**Expected:** five rows (decimation, recording gaps, impossible samples, device/recording
source, elapsed vs. moving), each with an explicit statement, none blank, none reading
`undefined`/`null`/`NaN`. Independently confirmed by this task directly from the committed shard
`data/stats/pace-quality/i183856843.json`: `decimation.tier: "none"` (0% zero-advance),
`gapProfile.tier: "none"` (0% gap fraction, zero `gapIntervals`), `impossibleSamples.tier:
"none"` (count 0), `deviceEra.family: "intervals-icu"` → expected text `intervals.icu
(migrated)`, `elapsedVsMoving.ratio: 1.01` → expected text `1.01× elapsed vs. moving time`.

CAN PASS: five rows render, each with a non-blank explicit healthy statement (e.g. "No
decimation detected", "No recording gaps", "No impossible samples"), the device row names
`intervals.icu (migrated)`.
CAN FAIL: fewer than five rows, any blank/undefined/null/NaN value, or the page showing nothing
at all for this healthy activity (the silence-as-good-news failure D-08 exists to prevent).

**Verdict:** pending

### R6 — Criterion 4, the filtered cohort against two independent figures

**Instruction:** Navigate to `#/list?severe=1`, read the result count the page shows. Then
untick the filter and confirm the count returns to the full row count (1890).

**Expected value, stated before the row runs, from two sources OTHER than the page being
checked:**
- `27-CALIBRATION.md` §4: composite (any severe signal) = **299** (15.8% of 1890 activities,
  16.0% of 1865 streamed activities).
- This task's own recount stdout (step 5 above, run against the identical live index the
  server is serving): recomputed composite = **299**, agreeing with both
  `totals.qualityAnySevere` and the per-row `anySevere` flag count.
- Both independent figures agree exactly: **299**. No archive drift exists between them because
  both were run against the same just-rebuilt `data/dashboard/index.json` in this session.

CAN PASS: the browser's `#/list?severe=1` result count reads 299, and unticking the filter
returns the count to 1890.
CAN FAIL: the browser count differs from 299 by any amount (since both independent figures
agree exactly here, ANY delta is a real disagreement, not archive drift — there is no
run-to-run drift window to hide behind in this session), or unticking the filter does not
restore the full 1890 count.

**Verdict:** pending

### R7 — Criterion 4, threshold moved (document read, not a rendered check)

**Instruction:** Read the Threshold Sensitivity table in `27-CALIBRATION.md` (reproduced below
verbatim from that file, produced by `npm run compute-pace-quality-calibration -- --sweep`) and
confirm at least one row where a looser threshold strictly increased the composite and one where
a stricter threshold strictly decreased it.

| Threshold | Shipped | Override | Expected direction | Composite | Delta | Verdict |
|---|---|---|---|---|---|---|
| Gap profile severe fraction — LOOSER | 0.2 | 0.15 | increase | 366 | +67 | MOVED (+67) |
| Gap profile severe fraction — STRICTER | 0.2 | 0.25 | decrease | 261 | -38 | MOVED (-38) |
| Impossible-sample severe count — LOOSER | 10 | 5 | increase | 332 | +33 | MOVED (+33) |
| Impossible-sample severe count — STRICTER | 10 | 20 | decrease | 279 | -20 | MOVED (-20) |
| Decimation zero-advance fraction — LOOSER (demo only, D-04 locks shipped value) | 0.15 | 0.1 | increase | 334 | +35 | MOVED (+35) |
| Decimation zero-advance fraction — STRICTER (demo only, D-04 locks shipped value) | 0.15 | 0.2 | decrease | 255 | -44 | MOVED (-44) |

This is a document read, not a browser action.

CAN PASS: the developer confirms at least one row moved the composite strictly up and at least
one moved it strictly down relative to the shipped 299 baseline (all six rows above already
satisfy this by construction, unless the table is found stale against a re-run).
CAN FAIL: no row moves in one of the two directions, or a re-run of
`npm run compute-pace-quality-calibration -- --sweep` produces a table where every
DID-NOT-MOVE row lacks a stated reason.

**Verdict:** pending

### R8 — Criterion 5, device family and the no-device-name category

**Instruction:** Open activity `10041312551` (fēnix 6 Pro FIT) and activity `3480808722`
(Suunto 9 FIT) and quote each one's device-era row verbatim. Then open activity `18702664326`
(picked from the live index by `quality.deviceEra.family === 'no-device-name'`, stated here
before the row runs) and quote its device-era row.

**Preconditions confirmed by this task, directly against the live shipped index, before
drafting this row (not assumed from 27-RESEARCH):**
- `10041312551` is present in `data/dashboard/index.json` with
  `quality.deviceEra: { family: "garmin-fenix-6-pro", rawDeviceName: null }`.
- `3480808722` is present with `quality.deviceEra: { family: "suunto-9", rawDeviceName: null }`.
- The two families DIFFER (`garmin-fenix-6-pro` vs. `suunto-9`) for the same FIT file format —
  the pair is exercisable, not NOT EXERCISABLE.
- The no-device-name activity picked by this task is `18702664326`
  (`quality.deviceEra: { family: "no-device-name", rawDeviceName: null }`), stated here before
  the row is run. Its shard `data/stats/pace-quality/18702664326.json` confirms the same value.

**Expected:** two different family display strings for the FIT pair (source: the index/shard
`deviceEra.family` values above, read independently of the page), and an explicit
no-device-name statement (never a fabricated device name) for `18702664326`.

CAN PASS: the fēnix and Suunto activities render two visibly different device-era strings, and
`18702664326` renders an explicit no-device-name statement.
CAN FAIL: both FIT activities show the same family string, or `18702664326` shows any device
name string at all instead of an explicit no-device-name statement.

**Verdict:** pending

### Reachability Audit

| Row | CAN PASS | CAN FAIL |
|---|---|---|
| R1 | Network panel's loaded asset filename is `assets/index-BHpzXFXA.js`. | A stale bundle serves a different asset filename. |
| R2 | Filtered Network panel shows 0 `pace-quality` requests after hard-reload and scroll on `#/list`. | Any `pace-quality` request appears on the list view. |
| R3 | Request counts read 1 / 1 (same activity re-open) / 2 (different activity) in sequence. | Zero requests on first open, two on first open, or a fresh request on re-opening the same activity. |
| R4 | Quoted badge text states `27%` and names gaps/pauses, evidence names 11 intervals / 16:43. | Badge names the condition with no number, or the number disagrees with 27% / 11 intervals / 16:43. |
| R5 | Five non-blank rows render with explicit healthy statements; device row names `intervals.icu (migrated)`. | Fewer than five rows, any blank/undefined/null/NaN value, or total silence for this healthy activity. |
| R6 | Browser's `#/list?severe=1` count reads 299; unticking restores 1890. | Any delta from 299, or unticking does not restore 1890. |
| R7 | At least one row strictly increases and one strictly decreases the composite relative to 299. | No row moves in one of the two directions, or a re-run produces an unexplained DID-NOT-MOVE row. |
| R8 | Fēnix/Suunto rows render two different family strings; `18702664326` renders an explicit no-device-name statement. | Both FIT activities show the same family string, or `18702664326` shows any device name string. |

All eight rows carry both lines; none struck.

**All eight verdicts: pending. No browser row has been performed by an agent.**
