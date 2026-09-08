---
phase: 14
slug: stream-ingestion-foundation
status: active
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-10
updated: 2026-08-10
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Synced from `14-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (installed — no install step this phase) |
| **Config file** | `vitest.config.ts` (`include: ['src/**/*.test.ts']`, `environment: 'node'`) |
| **Quick run command** | `npx vitest run src/streams` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds (fixture-based, no network) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/streams` (fast, no network, fixture-based)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green, plus a real local backfill run against a subset of `export_data/` (see Manual-Only Verifications)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | STREAM-01/02/03 | — | Locked schema carries no `pace`, no `lat`/`lng` — committed files hold no position data | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 14-01-02 | 01 | 1 | STREAM-01, STREAM-02 | T-14-02 | FIT/API sentinel and out-of-range values (HR >250, cadence >150, alt outside -500..9000) are dropped, not stored | unit | `npx vitest run src/streams/derive-stream.test.ts && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | STREAM-01 | T-14-02 | Malformed/truncated FIT or GPX yields a skipped file, never a crash or a bogus sample | unit | `npx vitest run src/exports/geometry-readers.test.ts && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 2 | STREAM-01, STREAM-03 | — | Manifest write is atomic (`FileStore.writeJson`) and idempotent — a re-run over unchanged input produces no diff | unit | `npx vitest run src/streams/stream-manifest.test.ts && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 3 | STREAM-01, STREAM-03 | T-14-01 | Per-file `try`/`catch` over 1,841 originals — one bad file warns and is skipped, the run continues | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 14-03-02 | 03 | 3 | STREAM-01, STREAM-03 | — | `classifyUnavailable` assigns the correct reason code (`manual`/`no-original`/`no-samples`); backfill writes nothing under `export_data/` | unit | `npx vitest run src/streams/backfill-streams.test.ts` | ❌ W0 | ⬜ pending |
| 14-04-01 | 04 | 3 | STREAM-02, STREAM-03 | T-14-11, T-14-13, T-14-06 | One unfiltered streams request per activity (not two, not coordinate-narrowed); no new logging of URLs or headers | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 14-04-02 | 04 | 3 | STREAM-02, STREAM-03 | T-14-11, T-14-13, T-14-01 | Fakes reproduce the API's `types` filtering: `getAllStreams === 1` / `getStreams === 0`, persisted `channels.hr/cadence/elevation === true`, throwing client does not reject | unit/integration | `npx vitest run src/sync/intervals-sync.test.ts src/api/intervals-provider.test.ts` | ❌ W0 | ⬜ pending |
| 14-04-03 | 04 | 3 | STREAM-02 | T-14-12 | `file_pattern` stays an explicit allowlist and every listed path is non-gitignored, so `git add` cannot fail and silently skip the deploy | shell gate | `grep -q "data/streams/\*\.json" .github/workflows/daily-refresh.yml && ! git check-ignore -q data/streams && echo OK` | ✅ | ⬜ pending |
| 14-05-01 | 05 | 4 | STREAM-02, STREAM-03 | T-14-01 | An activity past intervals.icu's ~1yr retention 404s and settles as `no-original` rather than aborting the run | unit | `npx vitest run src/streams/backfill-streams.test.ts && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 14-05-02 | 05 | 4 | STREAM-01 | — | Size-gate reports only; it takes no git action (D-02 — the user inspects and commits manually) | unit + build | `npx vitest run src/streams/backfill-streams.test.ts && npm run build && node dist/index.js help` | ❌ W0 | ⬜ pending |
| 14-05-03 | 05 | 4 | STREAM-01/02/03 | — | Manifest covers every activity in `data/activities/` — no activity is invisible to downstream badges | integration gate | `node -e "const m=require('./data/streams/manifest.json');const fs=require('fs');const a=fs.readdirSync('data/activities').filter(f=>f.endsWith('.json')).length;if(m.totals.activities!==a)throw new Error('manifest covers '+m.totals.activities+' of '+a+' activities');console.log('manifest covers all',a,'activities')"` | ✅ (post-run) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** No three consecutive tasks lack an `<automated>` verify — every task in every plan carries one. The `npx tsc --noEmit` entries (14-01-01, 14-03-01, 14-04-01) are each immediately followed by a unit-test task over the same code within the same plan, so no code-producing task goes more than one task without behavioral sampling.

---

## Wave 0 Requirements

Test files that do not exist yet and are created by the task that needs them (each is authored inside its own plan, so no separate Wave 0 pass is required):

- [ ] `src/streams/derive-stream.test.ts` — STREAM-01, STREAM-02 (shape, channel-presence, cadence normalization) — created by 14-01 Task 2
- [ ] `src/exports/geometry-readers.test.ts` — STREAM-01 (multi-channel FIT/GPX extraction, `.gpx.gz` branch) — extended by 14-02 Task 1
- [ ] `src/streams/stream-manifest.test.ts` — STREAM-01, STREAM-03 (idempotency, reason codes) — created by 14-02 Task 2
- [ ] `src/streams/backfill-streams.test.ts` — STREAM-01, STREAM-03 (classification, target selection, idempotency) — created by 14-03 Task 2
- [ ] `src/sync/intervals-sync.test.ts` — STREAM-02 (no existing test file for this module at all) — created by 14-04 Task 2
- [ ] Fixture data: a synthetic FIT-shaped `recordMesgs` array (with and without cadence, exercising Pitfall 4), a synthetic intervals.icu streams payload including a `0`-cadence run (Pitfall 1 guard) and parallel `data`/`data2` latlng arrays

**No framework install needed** — Vitest 4.0.18 and `vitest.config.ts` are already present and proven by `src/api/intervals-provider.test.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real backfill over the full 1,841-file `export_data/` set, and its size-gate report | STREAM-01 | `export_data/` is local-only and gitignored — it does not exist in CI, so no automated job can run this | 14-05 Task 3 (`checkpoint:human-verify`): run the CLI locally, read the size report, eyeball the totals, then commit manually per D-02 |
| Repo growth is acceptable before committing ~1,841 stream files | STREAM-01 | A judgement call on repository size, not a pass/fail assertion | Compare the size-gate report against `git count-objects -vH` (62.84 MiB packed at research time) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`vitest run`, never bare `vitest`)
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
