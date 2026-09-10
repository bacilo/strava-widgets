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
