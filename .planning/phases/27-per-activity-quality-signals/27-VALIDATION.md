---
phase: 27
slug: per-activity-quality-signals
status: partial
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-10
---

> **Round 1 Checkpoint outcome (2026-09-10):** all eight rows (R1-R8) recorded **PASS**, via
> agent-performed browser automation countersigned by the developer (see § Round 1 Checkpoint
> below for the provenance line and per-row quoted evidence). `nyquist_compliant: true` reflects
> that every checkpoint row is proven reachable both ways and every row PASSED. `status: partial`
> (not `passed`) because two gaps remain OPEN after the checkpoint — see `## Gap-Closure Record`:
> G-01 (the calibration report generator is not self-regenerable at its own corrected denominator
> values) and G-02 (a stale no-device-name cohort figure cited in ROADMAP/REQUIREMENTS). Neither
> gap reverses any row's PASS verdict; both are tracked for a follow-on gap-closure plan /
> documentation reconciliation rather than patched here.
>
> **Update 2026-09-19 (retroactive Nyquist audit):** G-01 was CLOSED by gap-closure plan 27-11
> on 2026-09-10 (see § Gap-Closure Record) — regenerating `27-CALIBRATION.md` today differs only
> by timestamp and archive growth. G-02 (stale 716/1,864 cohort figure in ROADMAP/REQUIREMENTS)
> remains open and is scheduled for Phase 31 D-13. `status: partial` is kept honestly until G-02's
> documentation correction lands; coverage itself is complete (audit trail at the end of this file).

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

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status (2026-09-19 audit) |
|--------|----------|-----------|-------------------|-------------|------|
| QUAL-01 | 5 signals computed in CI; index row **and** shard both carry them as separate fields | unit + integration (real archive) | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "quality signals"` | ✅ | ✅ green — 6 passed / 36 skipped |
| QUAL-02 | Device era and decimation stay separate fields on correlated activities; impossible-sample and decimation overlap does not collapse into one field | unit, decimation-aliased fixture with both signals asserted independently present | `npx vitest run src/analytics/pace-quality.test.ts -t "independent signals"` | ✅ | ✅ green — 4 passed / 76 skipped |
| QUAL-03 | Index additive (`DASHBOARD_INDEX_SCHEMA_VERSION` unchanged); shard mirrors `best-efforts` pattern and is fetched lazily | unit (schema) + instrumented fetch-count test (D-18) | `npx vitest run src/dashboard/data/pace-quality-client.test.ts -t "fetch count"` | ✅ | ✅ green — 8 passed / 19 skipped |
| QUAL-04 | Badge visible text names the condition **and** its measured value | unit (text assertion, project's jsdom-free convention) | `npx vitest run src/dashboard/views/list.test.ts -t "quality badge text"` | ✅ | ✅ green — 18 passed / 91 skipped |
| QUAL-05 | Dry-run composite rate reported; recount script reproduces it **without importing the classifier** | integration (script, real archive) | `node scripts/compute-pace-quality-recount.mjs` — diff against committed report / CI-printed count | ✅ | ✅ green — PASS, composite 299 on 1,899 rows |
| ERA-01 | fēnix 6 Pro vs Suunto 9 differentiated despite identical FIT format | unit, real pinned fixtures `10041312551` / `3480808722` | `npx vitest run src/analytics/pace-quality.test.ts -t "device family"` | ✅ | ✅ green — 19 passed / 61 skipped |
| ERA-02 | `no-device-name` and `intervals-icu` reported as distinct categories, never a fabricated default | unit + archive-wide dry run | `npx vitest run src/analytics/pace-quality.test.ts -t "no-device-name category"` | ✅ | ✅ green — 2 passed / 78 skipped |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = file does not exist yet, Wave 0 creates it*

---

## Wave 0 Requirements

Files that must exist (created or extended) before dependent tasks can verify:

- [x] `src/analytics/pace-quality.ts` + `.test.ts` — the signal module (impossible-sample count, device-family resolution, tiering)
- [x] `src/dashboard/data/pace-quality-client.ts` + `.test.ts` — shard client mirroring `best-efforts-client.ts`
- [x] `scripts/compute-pace-quality-recount.mjs` — D-03's independent recount script (must **not** import the classifier)
- [x] `src/analytics/dashboard-index.types.ts` — 5 new index-row fields (additive; `DASHBOARD_INDEX_SCHEMA_VERSION` must not move)
- [x] `src/analytics/compute-dashboard-index.ts` — call the new module, write the 5 fields + per-activity shard
- [x] `src/dashboard/views/list.ts` — badge-dispatch restructure (**contract change, not additive** — see RESEARCH Pitfall 1; own task/plan step)
- [x] `src/dashboard/views/list-logic.ts` — one new `FilterState` field + URL param
- [x] `src/dashboard/views/detail.ts` — add `paceQualityClient.load` to the existing `Promise.all` mount point
- [x] `src/dashboard/views/detail-sections.ts` — new always-on quality section
- [x] `scripts/verify-dashboard-publish.mjs` — spot-check at least one of the 5 new fields, following the existing `gearName` check pattern

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

**Verdict:** PASS
**Provenance:** agent-performed browser automation (Claude in Chrome), countersigned by developer 2026-09-10.
**Observed (quoted verbatim):** "Network panel showed the loaded asset as `assets/index-BHpzXFXA.js`. Full initial load was exactly 5 requests: `index.html` 200, `assets/index-BHpzXFXA.js` 200, `assets/index-C8KqIdDR.css` 200, `data/dashboard/index.json` 200, `favicon.ico` 404." Served from `dist/widgets` via `python3 -m http.server 8917`, Chrome, viewport 900x900 (inside the 500..941 clamp), hard-reloaded (cmd+shift+r) before the run. Served bundle sha256 `2d48f635ce83dd8b9ce0c71d6831117d8d95e4ee97cfa6b3065f9e6b1f39e8f4`, computed from FETCHED bytes via `curl … | shasum -a 256`, matching the local build byte-for-byte.

### R2 — Criterion 2, zero fetches on the list

**Instruction:** DevTools → Network, filter `pace-quality`, hard-reload `#/list`, scroll to the
bottom of the first page.

**Expected:** zero requests. Record the observed count.

CAN PASS: the filtered Network panel shows 0 requests after hard-reload and scroll.
CAN FAIL: any request matching `pace-quality` appears — a list-side code path would exist
despite the grep gate in plan 27-09.

**Verdict:** PASS
**Provenance:** agent-performed browser automation (Claude in Chrome), countersigned by developer 2026-09-10.
**Observed (quoted verbatim):** "After hard-reload of `#/list` and scrolling to the bottom of the first page, requests matching `pace-quality`: 0."

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

**Verdict:** PASS
**Provenance:** agent-performed browser automation (Claude in Chrome), countersigned by developer 2026-09-10.
**Observed (quoted verbatim):** "Sequence observed as exactly 1 / 1 / 2: opening `#/activity/i183546832` → exactly one request, `http://127.0.0.1:8917/data/stats/pace-quality/i183546832.json`, HTTP 200; returning to `#/list` and re-opening the SAME activity → still 1 total (no new request; memoized); opening a DIFFERENT activity `#/activity/i183856843` → 2 total, second request `…/pace-quality/i183856843.json` HTTP 200."

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

**Verdict:** PASS
**Provenance:** agent-performed browser automation (Claude in Chrome), countersigned by developer 2026-09-10.
**Observed (quoted verbatim):** Severe activity `i183546832`. Rendered badge text, verbatim: "27% of recorded time in gaps or pauses". Rendered evidence line, verbatim: "11 gap intervals; longest 16:43". Also rendered: "Longest zero-advance run: 2 samples (1003.0s); adaptive window 20.0s" and "1.37× elapsed vs. moving time". Independently derived expected values, read from the committed `data/stats/pace-quality/i183546832.json` by the orchestrator BEFORE the row ran: `gapProfile.gapFraction = 0.26551897461673785` → 27%; `gapIntervals.length = 11`; longest interval = 1003 s = 16:43; `elapsedVsMoving.ratio = 1.37`. Rendered values match the shard on every figure.

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

**Verdict:** PASS
**Provenance:** agent-performed browser automation (Claude in Chrome), countersigned by developer 2026-09-10.
**Observed (quoted verbatim):** Healthy activity `i183856843`. All five rows rendered, none blank, none `undefined`/`null`/`NaN`, verbatim: Decimation → "No decimation detected"; Recording gaps → "No recording gaps"; Impossible samples → "No impossible samples"; Device / recording source → "intervals.icu (migrated)"; Elapsed vs. moving → "1.01× elapsed vs. moving time". Independently derived from the committed shard: all three tiering signals `tier: "none"`, `impossibleSamples.count: 0`, `deviceEra.family: "intervals-icu"`, `elapsedVsMoving.ratio: 1.01`. Matches.

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

**Verdict:** PASS
**Provenance:** agent-performed browser automation (Claude in Chrome), countersigned by developer 2026-09-10.
**Observed (quoted verbatim):** "`#/list?severe=1` rendered `299 activities` with `Filters (1 active)` and chip `severe signals only`. Unticking via the chip's × control returned `1890 activities`, hash reverted to `#/list`, checkbox `false`, `Filters` no longer showing an active count." Independent figures compared against, neither produced by the browser: `27-CALIBRATION.md` §4 composite = 299, and `node scripts/compute-pace-quality-recount.mjs` stdout = 299. Zero delta; no archive drift between runs.

Additional Criterion 3 corroboration (not a drafted row, recorded as supporting evidence): the `?severe=1` filtered list rendered a DIFFERENT measured value per row — 27%, 55%, 42%, 38%, 22%, 31%, 23%, 26%, 31%, 62%, 61%, 71% — confirming badge text varies per row rather than being a fixed label.

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

**Verdict:** PASS, with evidence STRONGER than the drafted document-read.
**Provenance:** agent-performed browser automation (Claude in Chrome) plus an independent script re-run, countersigned by developer 2026-09-10.
**Observed (quoted verbatim):** "The Threshold Sensitivity table was re-derived by an independent re-run of `npm run compute-pace-quality-calibration -- --sweep`, and all six rows reproduced identically: gap-profile looser 0.2→0.15 = 366 (+67); gap-profile stricter 0.2→0.25 = 261 (−38); impossible-sample looser 10→5 = 332 (+33); impossible-sample stricter 10→20 = 279 (−20); decimation looser 0.15→0.1 = 334 (+35, demonstration only per D-04); decimation stricter 0.15→0.2 = 255 (−44, demonstration only per D-04). At least one strict increase and one strict decrease: both CONFIRMED." This same re-run is what exposed Gap G-01 (see `## Gap-Closure Record` below): the six sensitivity-table figures reproduced identically, but the re-run also silently rewrote `27-CALIBRATION.md`'s stream-file/stream-less denominators (1865/25 → the generator's stale 1866/24), which the orchestrator restored via `git checkout --` before this file was drafted. That rewrite does not change this row's verdict — the sensitivity table itself, which is what R7 asks about, reproduced exactly — but it is recorded as the discovery event for G-01.

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

**Verdict:** PASS
**Provenance:** agent-performed browser automation (Claude in Chrome), countersigned by developer 2026-09-10.
**Observed (quoted verbatim):** Device rows rendered verbatim: `10041312551` (fēnix 6 Pro FIT) → "Garmin fēnix 6 Pro"; `3480808722` (Suunto 9 FIT) → "Suunto 9"; `18702664326` (no-device-name) → "No device name recorded". Two different family strings for two files of the SAME format. The no-device-name activity renders an explicit category and no device string at all.

Note: the verbatim results record the no-device-name activity opened as `18702664326`, matching the id stated in the drafted row's precondition. No substitution occurred.

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

**All eight verdicts: PASS.** Recorded via agent-performed browser automation (Claude in
Chrome), countersigned by the developer 2026-09-10 — per the developer's provenance decision
("Agent-performed, you countersign"), no row is recorded as developer-observed. No verdict was
pre-filled before the checkpoint ran; every row above carries the observed evidence quoted
verbatim from the countersigned report, and no observation was invented beyond what that report
stated.

## Gap-Closure Record

Neither gap below was patched in this plan. Both are recorded verbatim, unpatched, per the
house rule since 16-09 (a failing/open item is logged, not fixed under checkpoint pressure).

### G-01 — the calibration artifact of record is not regenerable at its own stated values (CLOSED by plan 27-11, 2026-09-10)

`scripts/compute-pace-quality-calibration.mjs` line 425 counts stream files as
`readdirSync(STREAMS_DIR).filter((f) => f.endsWith('.json'))`, which includes the non-activity
`data/streams/manifest.json` stream-availability index. It therefore emits stream-file count
**1866** / stream-less **24**. Plan 27-03's continuation corrected these figures to **1865 / 25**
in the PROSE of `27-CALIBRATION.md` but did not fix the GENERATOR. Consequence: running
`npm run compute-pace-quality-calibration` rewrites `27-CALIBRATION.md` and silently REVERTS the
documented correction — observed directly during R7's re-run, which reverted 42 lines including
the live-denominator correction note and the three-way corroboration of 299; the orchestrator
restored the file via `git checkout --`. The report's own header claims "Every figure below is
computed by THIS run", which is currently FALSE for the denominators. This also touches ROADMAP
Criterion 4a, whose GATE clause requires the rate be "measured against a live denominator
(recomputed at run time, never a hardcoded archive size)" — the denominator is recomputed at run
time but computed WRONG. The activity count (1890) and the composite (299) are unaffected.

**Developer disposition:** close with a gap-closure plan inside phase 27 — fix the glob to
exclude `manifest.json`, add a regression test asserting a regenerated report reproduces
1865/25, then regenerate and commit.

**Status: CLOSED by gap-closure plan 27-11 (2026-09-10).** Not fixed by plan 27-10, which left
`27-CALIBRATION.md` byte-identical to its committed (corrected) state and did not run the
calibration script. Closed subsequently by plan 27-11:

- `scripts/compute-pace-quality-calibration.mjs` now routes the stream-file glob through a pure
  `isStreamFile()` that excludes `data/streams/manifest.json`, and the section-1 prose the
  generator emits was corrected to describe what the code actually does.
- A regression test in `scripts/compute-pace-quality-calibration.test.mjs` pins the exclusion and
  was demonstrated FAILING against the old naive glob (2 failures, recorded verbatim in
  `27-11-SUMMARY.md`) before being trusted — the defect this gap records is precisely a
  correction that no test defended.
- The live-denominator correction note, the three-way corroboration of 299, and the section-3
  rounding footnote are now GENERATOR-EMITTED rather than hand-written, so they survive future
  regenerations instead of being stripped by them.
- `27-CALIBRATION.md` regenerated and now states **1865 / 25 by live computation**.

**Orchestrator re-verification (independent of the executing agent):** regenerating a second time
via `npm run compute-pace-quality-calibration -- --sweep` produced **0 non-timestamp diff lines** —
regeneration is now idempotent, which is the only evidence that actually distinguishes a fixed
generator from a re-applied hand edit. Invariants confirmed unchanged: activity count 1890,
composite 299, cohorts 154/127/31, and all six Threshold Sensitivity rows (+67/-38/+33/-20/+35/-44).
`npm test` 73/73, `verify-dashboard` exit 0, recount exit 0 reporting 299, empty diff on
`src/analytics/pace-quality.ts`.

### G-02 — Criterion 5 / ERA-02 cite a stale no-device-name cohort size (open, documentation-only)

ROADMAP Phase 27 Criterion 5 and REQUIREMENTS ERA-02 both cite a **716**-activity no-device-name
cohort ("716 of 1,864 activities (38%)"). The live shipped index carries **663**. Full measured
device-family census across all 1,890 rows: `garmin-fenix-6-pro` 908, `no-device-name` 663,
`suunto-9` 205, `intervals-icu` 78, `strava-app-gpx` 35, `garmin-vivoactive-4` 1. The shortfall
is consistent with improved classification rather than a defect — activities that previously had
no recognisable device name now resolve to real named categories (`intervals-icu`,
`strava-app-gpx`, `garmin-vivoactive-4`), and plan 27-01 deliberately removed the colliding
`unknown-device` taxonomy value. ERA-02's actual requirement — that the category is explicit and
never a fabricated device name — HOLDS, evidenced by R8. Only the cited figure is stale. Note
that `27-CONTEXT.md` had flagged this cohort's size as needing to stay verifiable.

**Developer disposition:** no code change implied; this is a documentation reconciliation for
verification to disposition.

**Status: OPEN.** Not fixed by this plan. ERA-02's requirement is ticked below on R8's PASS —
the tick is NOT contingent on this gap, since the gap concerns only a cited figure, not the
behavior R8 verified.

### G-03 — the same manifest.json miscount exists in Phase 26's residual script (open, out of Phase 27 scope)

Discovered by Phase 27's regression gate, 2026-09-10. `scripts/compute-pace-residual.mjs` line 277
counts stream files with the identical naive glob G-01 fixed in the calibration script:
`readdirSync(STREAMS_DIR).filter((f) => f.endsWith('.json'))`, with zero references to `manifest`
anywhere in the file. It therefore reports "Archive size scanned: **1866**", inflated by one by the
non-activity `data/streams/manifest.json` availability index — the live per-activity stream count is
**1865**.

ROADMAP Phase 26 Criterion 1 cites that figure directly ("re-derived against the live committed
archive on 2026-09-08 (1,866 streams scanned)"), so the criterion's stated denominator carries the
same off-by-one.

**Materiality: low, and bounded.** Re-running `npm run compute-pace-residual` during Phase 27's
regression gate reproduced the severe stair-step cohort at **154**, the residual list at **14**, max
residual **2.44%**, and "153 strictly improved, 1 tied at zero, 0 regressed" — byte-identical apart
from the generated timestamp. `manifest.json` fails to parse as a stream and is excluded from the
cohort, so only the reported *scanned* count is affected, not any derived result. D-04's boundary
cross-check between `26-RESIDUAL.md` and this phase's decimation cohort is therefore unaffected.

**Not fixed here.** `compute-pace-residual.mjs` and `26-RESIDUAL.md` are Phase 26 artifacts; editing
them from a Phase 27 gap-closure plan would fork a prior phase's artifact of record after the fact,
which is the failure mode D-02 and D-04 exist to prevent. Recorded for verification to disposition —
the natural fix mirrors G-01's (`isStreamFile()` exclusion plus a regression test), and G-01's
now-committed helper in `scripts/compute-pace-quality-calibration.mjs` is the reference implementation.

### G-04 — `qualityBadgeSpecs` crashed the whole Activities list on a row with no `quality` (CLOSED by plan 27-12, 2026-09-10)

Raised as **Critical** by `27-REVIEW.md`. `src/dashboard/views/list.ts`'s `qualityBadgeSpecs`
destructured `const { decimation, gapProfile, impossibleSamples } = row.quality;` with no guard,
and was reached unconditionally from `activityRowAriaLabel` and `appendQualityBadges` — both called
from `buildTableRow` and `renderActivityRow`, whose render loops carry no per-row try/catch. One row
lacking `quality` therefore blanked the ENTIRE Activities list, and `overview.ts` reuses the helper.

The compiler could not see it: the function was typed `Pick<DashboardIndexRow, 'quality'>` where
`quality` is required, while runtime values are `ParsedDashboardIndexRow`, whose own doc comment
states "no key can be assumed present here — which is what lets the compiler enumerate every
consumer that assumed otherwise." Three siblings touched by this same phase already guarded
correctly (`rowIsAnySevere`, `detail.ts`'s `getRow(id)?.quality ?? null`, `rowPaceDisagreement`);
`qualityBadgeSpecs` alone did not.

**Orchestrator reproduction, before the fix**, against the built bundle:
`TypeError: Cannot destructure property 'decimation' of 'row.quality' as it is undefined.`

**Closed by plan 27-12:** parameter widened to `Pick<ParsedDashboardIndexRow, 'quality'>` — the fix
the type contract was written to enable, not a cast — and absence now returns `[]`. Every other
`.quality` reader in the render path audited: `list-logic.ts` and `detail.ts` already guarded;
`overview.ts`, `records.ts`, `calendar.ts` never read `.quality` directly and are fixed
transitively. 5 new tests, 3 demonstrated failing with the verbatim TypeError first.

**Orchestrator re-verification after the fix:** `qualityBadgeSpecs` returns `[]` for all three
shapes — no `quality` key, `quality: null`, `quality: undefined` — none throwing.

### G-05 — Criterion 3's explanation strings were defended only by an accidental asymmetry (CLOSED by plan 27-12, 2026-09-10)

Raised as WR-01 by `27-REVIEW.md`, after the orchestrator flagged the same `?? ''` fallback at
wave 5. `detail-sections.ts` sourced its three tiering explanations from `list.ts`'s
`qualityBadgeSpecs` via a module-load probe row and read them through a helper ending `?? ''`. The
existing drift test caught total failure only through an accidental `''`-vs-`undefined` mismatch,
and the probe object was hand-duplicated between production and test source.

**Closed by plan 27-12:** `EXPLANATION_PROBE_QUALITY` is now exported as the single origin shared by
production and test, and all three explanations are asserted non-empty eagerly at module load,
throwing rather than rendering blank. The `?? ''` fallback is now unreachable defense-in-depth.

**The confirming evidence:** the new direct assertion FAILED (`expected 0 to be greater than 0`)
against a deliberately-emptied explanation while the pre-existing equality drift test stayed GREEN
on that same broken state — demonstrating the old safety net was accidental, exactly as the review
claimed.

## Requirement -> Row Disposition

Applying the plan's own requirement->row map (27-10-PLAN.md checkpoint task acceptance
criteria) against the eight PASS verdicts above:

| Requirement | Mapped rows | All mapped rows PASS? | Tick? | Gap contingency |
|---|---|---|---|---|
| QUAL-03 | R2, R3, R6 | Yes (PASS/PASS/PASS) | **Ticked** | None — unaffected by G-01/G-02. |
| QUAL-04 | R4, R5 | Yes (PASS/PASS) | **Ticked** | None — unaffected by G-01/G-02. |
| QUAL-05 | R6, R7 | Yes (PASS/PASS) | **Ticked, with a stated caveat** | Ticked on R6/R7's PASS verdicts (the measured composite 299 and the six-row Threshold Sensitivity table both reproduced independently and are unaffected by G-01). **Caveat RESOLVED 2026-09-10 by gap-closure plan 27-11:** this caveat originally read that G-01 left the calibration artifact's denominator figures (1865/25) non-regenerable, so the tick reflected measured composite/sensitivity behaviour rather than a claim of clean regeneration. G-01 is now closed and regeneration was verified idempotent (0 non-timestamp diff lines on a second run), so `27-CALIBRATION.md` does regenerate to its own stated values and the tick no longer carries this contingency. QUAL-05's own recorded tension with the ~5% target (see REQUIREMENTS.md) remains open by design (27-03's disposition), separately from G-01. |
| ERA-01 | R8 | Yes (PASS) | **Ticked** | None — unaffected by G-01/G-02. |
| ERA-02 | R8 | Yes (PASS) | **Ticked** | **Not contingent on G-02.** G-02 explicitly states ERA-02's behavioral requirement (explicit category, never a fabricated device name) HOLDS per R8; only the cited cohort SIZE (716 vs. the live 663) is stale, which is a documentation reconciliation, not a behavioral gap. |

QUAL-01 and QUAL-02 are discharged by automated artifact inspection in plans 27-02 and 27-04
(not by a browser row) and are ticked on that evidence: QUAL-01 by `27-04-SUMMARY.md`
(`requirements-completed: [QUAL-01, QUAL-03]`, `data/dashboard/index.json` + per-activity
`data/stats/pace-quality/{id}.json` shard fields, `npx vitest run src/analytics/pace-quality.test.ts`)
and QUAL-02 by `27-02-SUMMARY.md` (`requirements-completed: [QUAL-01, QUAL-02, QUAL-05]`,
`npx vitest run src/analytics/pace-quality.test.ts src/analytics/best-effort-utils.test.ts`,
97/97 passed, device era and decimation severity asserted as independently-present separate
fields).

## Validation Audit 2026-09-19

Retroactive audit (`/gsd-validate-phase 27`, from the v2.2 close-out audit's Nyquist finding: the Per-Task map carried only a "File Exists" column, every entry still `❌ W0`, and the frontmatter read `status: partial` for G-01/G-02).

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

No coverage gaps. Every row's `-t` filter was checked for a non-zero match before flipping (a filter matching zero tests exits 0 and cannot fail — the vacuous-row shape the Phase 26 audit found on the same day):

| Row | Command | Matched |
|-----|---------|---------|
| QUAL-01 | `compute-dashboard-index.test.ts -t "quality signals"` | 6 passed / 36 skipped |
| QUAL-02 | `pace-quality.test.ts -t "independent signals"` | 4 passed / 76 skipped |
| QUAL-03 | `pace-quality-client.test.ts -t "fetch count"` | 8 passed / 19 skipped |
| QUAL-04 | `list.test.ts -t "quality badge text"` | 18 passed / 91 skipped |
| QUAL-05 | `node scripts/compute-pace-quality-recount.mjs --expect 299` | PASS — composite 299 on the merged 1,899-row index (unchanged by +9 activities) |
| ERA-01 | `pace-quality.test.ts -t "device family"` | 19 passed / 61 skipped |
| ERA-02 | `pace-quality.test.ts -t "no-device-name category"` | 2 passed / 78 skipped |

Gap records: **G-01 CLOSED** (27-11, 2026-09-10; confirmed by regeneration on 2026-09-19 — only `Generated` and the 1,890→1,899 archive figures differ). **G-02 OPEN**, documentation-only, assigned to Phase 31 D-13 (correct-in-place with dated note; re-measure the no-device-name cohort on the merged archive at that time). WR-02 from `27-REVIEW.md` (gapProfile/impossibleSamples severe+null test pair) is noted as optional hardening for Phase 31; it is not a requirement row. Manual rows (Round 1 checkpoint R1–R8) remain satisfied by their recorded developer countersign. No test files generated. `nyquist_compliant: true` stands; `wave_0_complete` flipped to true; `status: partial` retained until G-02 closes.

