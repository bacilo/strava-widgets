---
phase: 16
slug: dashboard-shell-data-contract
status: planned
nyquist_compliant: true
wave_0_complete: false  # test files are created inside their owning plans, not a separate wave
created: 2026-08-10
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (environment: node) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 16-01 | 1 | DASH-02 | T-16-EX-03 | Exclusion reasons carry no third-party data | contract | `node -e "require('./data/best-effort-exclusions.json')"` + tsc | ❌ W0 | ⬜ pending |
| 01-T2 | 16-01 | 1 | DASH-02 | T-16-EX-01, T-16-EX-02 | Malformed/absent exclusions file degrades to zero exclusions, never aborts | unit | `npx vitest run src/analytics/best-effort-exclusions.test.ts src/analytics/compute-best-efforts.test.ts --reporter=dot` | ❌ W0 | ⬜ pending |
| 01-T3 | 16-01 | 1 | DASH-02 | T-16-EX-04 | Excluded efforts retained and flagged, ranking change traceable | integration (real archive) | `node dist/index.js compute-best-efforts` + rank assertions | ❌ W0 | ⬜ pending |
| 02-T1 | 16-02 | 1 | DASH-03 | T-16-TH-01, T-16-TH-02 | Tampered localStorage theme never reaches setAttribute; throwing storage degrades | unit | `npx vitest run src/dashboard/theme.test.ts --reporter=dot` | ❌ W0 | ⬜ pending |
| 02-T2 | 16-02 | 1 | DASH-03 | — | N/A | contract | styles.css token/typography contract script | ❌ W0 | ⬜ pending |
| 03-T1 | 16-03 | 1 | DASH-02 | T-16-RT-03 | Published index row carries no athlete/upload/external/gear identifier | contract | `npx tsc --noEmit` + index-contract grep script | ❌ W0 | ⬜ pending |
| 03-T2 | 16-03 | 1 | DASH-01 | — | N/A | contract | view-contract grep script | ❌ W0 | ⬜ pending |
| 03-T3 | 16-03 | 1 | DASH-01 | T-16-RT-01, T-16-RT-02 | `isValidActivityId` chokepoint; malformed escapes return null not throw | unit | `npx vitest run src/dashboard/router.test.ts --reporter=dot` | ❌ W0 | ⬜ pending |
| 04-T1 | 16-04 | 2 | DASH-02 | T-16-IX-01, T-16-IX-02, T-16-IX-04 | Per-row error isolation; explicit member-by-member row build (no spread) | unit | `npx vitest run src/analytics/compute-dashboard-index.test.ts --reporter=dot` | ❌ W0 | ⬜ pending |
| 04-T2 | 16-04 | 2 | DASH-02 | T-16-IX-02 | Real-archive index carries no leaked identifier field; output gitignored | integration (real archive) | `node dist/index.js compute-dashboard-index` + index assertions | ❌ W0 | ⬜ pending |
| 05-T1 | 16-05 | 2 | DASH-02 | T-16-DC-02, T-16-DC-03 | Index fetched once even under concurrency; failure evicted so retry works | unit (mock fetch) | `npx vitest run src/dashboard/data/index-client.test.ts --reporter=dot` | ❌ W0 | ⬜ pending |
| 05-T2 | 16-05 | 2 | DASH-02 | T-16-DC-01, T-16-DC-03 | Non-numeric id rejected with ZERO fetch calls; retry re-fetches | unit (mock fetch) | `npx vitest run src/dashboard/data --reporter=dot` | ❌ W0 | ⬜ pending |
| 06-T1 | 16-06 | 2 | DASH-03 | T-16-SH-01, T-16-SH-03 | Inline bootstrap keeps the allow-list; CSP `default-src 'self'` declared | contract | index.html ordering + allow-list contract script | ❌ W0 | ⬜ pending |
| 06-T2 | 16-06 | 2 | DASH-01, DASH-03 | T-16-SH-02 | nav.ts innerHTML-free and localStorage-free | contract | `npx tsc --noEmit` + nav hygiene script | ❌ W0 | ⬜ pending |
| 06-T3 | 16-06 | 2 | DASH-01 | T-16-SH-02 | Stub panels innerHTML-free | contract | stub copy contract script | ❌ W0 | ⬜ pending |
| 07-T1 | 16-07 | 3 | DASH-02 | T-16-VW-01, T-16-VW-03 | Athlete free text via textContent; 100-row render cap | contract | `npx tsc --noEmit` + views contract script | ❌ W0 | ⬜ pending |
| 07-T2 | 16-07 | 3 | DASH-02 | T-16-VW-02, T-16-VW-04, T-16-VW-05 | Raw route param never in DOM; stale-response token; fixed error copy | contract | detail.ts contract script | ❌ W0 | ⬜ pending |
| 07-T3 | 16-07 | 3 | DASH-01 | — | Detail route absent from nav | unit | `npx vitest run src/dashboard/view-registry.test.ts --reporter=dot` | ❌ W0 | ⬜ pending |
| 08-T1 | 16-08 | 4 | DASH-01 | — | Showcase preserved, not silently overwritten | contract | relocation contract script | ❌ W0 | ⬜ pending |
| 08-T2 | 16-08 | 4 | DASH-01 | T-16-BD-01 | `emptyDir: false` preserves 11 bundles + 5 pages | integration (build) | `npm run build-widgets` + artifact assertions | ❌ W0 | ⬜ pending |
| 08-T3 | 16-08 | 4 | DASH-02 | T-16-BD-02, T-16-BD-04, T-16-BD-05 | Gitignored path kept out of commit file_pattern; CI stage isolated | integration (build + workflow) | build + publish-tree + workflow assertions | ❌ W0 | ⬜ pending |
| 09-T1 | 16-09 | 5 | DASH-01, DASH-02 | T-16-VF-01 | Static server rejects path traversal outside dist/widgets | integration (HTTP) | `npm run verify-dashboard` | ❌ W0 | ⬜ pending |
| 09-T2 | 16-09 | 5 | DASH-01, DASH-03 | T-16-VF-02, T-16-VF-03 | Manual gate recorded with observable evidence; no browser dep added | manual (checkpoint) | `npm run build-widgets && npm run verify-dashboard && npm test && npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** no 3 consecutive tasks lack an automated verify — every task in every plan carries an `<automated>` command (contract scripts count as automated gates and run in under a second).

---

## Wave 0 Requirements

Every test file below is CREATED by the task that needs it, inside the plan that owns the code under test — there is no separate Wave 0 plan, because this repo's vitest infrastructure already exists and each new suite is authored TDD-first alongside its module.

- [ ] `src/analytics/best-effort-exclusions.test.ts` — plan 16-01 task 2
- [ ] `src/dashboard/theme.test.ts` — plan 16-02 task 1 (DASH-03)
- [ ] `src/dashboard/router.test.ts` — plan 16-03 task 3 (DASH-01)
- [ ] `src/analytics/compute-dashboard-index.test.ts` — plan 16-04 task 1 (DASH-02)
- [ ] `src/dashboard/data/index-client.test.ts` — plan 16-05 task 1 (DASH-02)
- [ ] `src/dashboard/data/detail-client.test.ts` — plan 16-05 task 2 (DASH-02)
- [ ] `src/dashboard/view-registry.test.ts` — plan 16-07 task 3 (DASH-01)
- [ ] `scripts/verify-dashboard-publish.mjs` — plan 16-09 task 1 (DASH-01/02 publish-tree gate)

*Existing vitest infrastructure covers the framework; no new install needed. No jsdom or browser-automation dependency is added — D-01 locks the phase to zero new dependencies and RESEARCH.md recommends deferring that tooling decision.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DOM mounting / view rendering | DASH-01 | Repo has zero DOM/browser tests (vitest node env, no jsdom); all 11 widgets verified manually — same precedent | Open dashboard locally via `vite dev`, navigate hash routes, confirm views render without reload/404 |
| GitHub Pages deploy | DASH-01 | Requires live CI deploy | Open published Pages URL, deep-link to `#/activity/<id>` |
| Dark/light theme consistency | DASH-03 | Visual check | Toggle OS/theme preference, confirm dashboard matches widget theming |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
