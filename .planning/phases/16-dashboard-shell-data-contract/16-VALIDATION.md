---
phase: 16
slug: dashboard-shell-data-contract
status: planned
nyquist_compliant: true
wave_0_complete: false  # test files are created inside their owning plans, not a separate wave
created: 2026-08-10
revised: 2026-08-11  # extended to cover gap-closure plans 16-10..16-16
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

## Per-Task Verification Map — Gap Closure (plans 16-10 … 16-16)

Added 2026-08-11 after `16-VERIFICATION.md` returned `gaps_found` (5 failing must-haves, 4 flagged warnings). Wave labels `GC1`/`GC2`/`GC3` are the gap-closure waves and are independent of the original waves 1-5, which are complete.

**Gate-command discipline:** every multi-command `<automated>` string below is joined with `&&`, never `;`. A `;`-joined line exits with the status of the last command only, which would let an earlier failure pass as green — the exact fail-open shape that let this phase ship at 334/334. The one deliberate `;` in the set is `16-10` task 3, where `test $? -eq 1` must read the preceding pipeline's status.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-T1 | 16-10 | GC1 | DASH-02 | T-16-RT-01 | Widened id gate still rejects `../secrets`, `12%2F..`, `<script>`, `x123`, `i`, `ii123`, `I…`, `1i23` | unit | `npx vitest run src/dashboard/router.test.ts` | ✅ exists (extended) | ⬜ pending |
| 10-T2 | 16-10 | GC1 | DASH-02 | T-16-RT-01, T-16-10-02 | i-prefixed id reaches URL construction; near-miss ids record zero fetches | unit (mock fetch) | `npx vitest run src/dashboard/data/detail-client.test.ts` | ✅ exists (extended) | ⬜ pending |
| 10-T3 | 16-10 | GC1 | DASH-02 | — | Neither prior plan still specifies the defect as a must-have; DASH-01 checklist matches its Pending status row | contract | `! grep -qF "not all digits" 16-03-PLAN.md 16-05-PLAN.md && grep -q '^- \[ \] \*\*DASH-01\*\*' REQUIREMENTS.md` → `MUSTHAVE_WORDING_CORRECTED`. Scoped to those two files on purpose — `16-VERIFICATION.md` and `16-10-PLAN.md` both quote the old wording as evidence, so a recursive grep would be self-invalidating. | n/a | ⬜ pending |
| 11-T1 | 16-11 | GC1 | DASH-03 | T-16-TH-01 | `color-scheme` pinned to `data-theme`; dead `fill: var(--accent)` rule absent | contract | `&&`-joined grep chain → `CSS_RULES_OK` | n/a | ⬜ pending |
| 11-T2 | 16-11 | GC1 | DASH-03 | — | Six WR-04 rules + widget token parity locked against silent reversion | unit (CSS text) | `npx vitest run src/dashboard/styles.test.ts` | ❌ GC0 | ⬜ pending |
| 12-T1 | 16-12 | GC1 | DASH-02 | T-16-12-01 | Malformed timestamp returns an em dash, never `undefined NaN, NaN` into the DOM | unit (TZ matrix) | 4 × `TZ=… npx vitest run src/dashboard/views/list.test.ts`, `&&`-joined | ❌ GC0 | ⬜ pending |
| 12-T2 | 16-12 | GC1 | DASH-02 | T-16-12-02 | Published row order is a function of the data, not the build host's `TZ`; NaN-safe | unit (TZ matrix) | 3 × `TZ=… npx vitest run src/analytics/compute-dashboard-index.test.ts`, `&&`-joined | ✅ exists (extended) | ⬜ pending |
| 12-T3 | 16-12 | GC1 | DASH-02 | T-16-12-03 | A stale rejection cannot paint into a container the view no longer owns | contract | `npx tsc --noEmit && npm test` | ✅ exists | ⬜ pending |
| 13-T1 | 16-13 | GC1 | DASH-01 | T-16-13-01 | Real `emptyOutDir` guard preserves 11 bundles, 5 pages and the copied data tree | integration (build) | `npm run build-widgets` + artifact assertions | n/a | ⬜ pending |
| 13-T2 | 16-13 | GC1 | DASH-01 | T-16-13-02, T-16-13-04 | Gate steps blocking and ordered build → test → verify → deploy; no new action or secret | contract | `&&`-joined line-number ordering script → `GATE_ORDER_OK` | n/a | ⬜ pending |
| 14-T1 | 16-14 | GC2 | DASH-01, DASH-02, DASH-03 | T-16-14-01 | Nothing credential-shaped or home-path-shaped becomes public; gate holds mechanically before the irreversible push | integration | `npx tsc --noEmit && npm test && npm run build && npm run build-widgets && npm run verify-dashboard` | n/a | ⬜ pending |
| 14-T2 | 16-14 | GC2 | DASH-01 | T-16-14-03 | Deploy source carries `src/dashboard`; both CI gate steps ran and concluded success, not skipped | integration (CI) | `&&`-joined push assertions → `PUSH_OK`, then `gh run view <id> --json conclusion` | n/a | ⬜ pending |
| 14-T3 | 16-14 | GC2 | DASH-01, DASH-02, DASH-03 | T-16-14-04 | Deployed root is the SPA and the data tree is published — asserted against the remote, never `dist/widgets` | integration (remote + HTTP) | `&&`-joined gh-pages + live-URL assertions → `DEPLOY_VERIFIED` | n/a | ⬜ pending |
| 15-T1 | 16-15 | GC3 | DASH-01 | T-16-15-01 | Live-origin hash routing with no full reload and no 404 | manual (checkpoint) | pre-check: served root contains `id="app-nav-root"` | n/a | ⬜ pending |
| 15-T2 | 16-15 | GC3 | DASH-03 | — | Toggle legible against `#f5f5f7` on both a light-OS and a dark-OS machine | manual (checkpoint) | pre-check: deployed CSS asset carries the WR-04 fix | n/a | ⬜ pending |
| 16-T1 | 16-16 | GC3 | DASH-02 | T-16-RT-01, T-16-16-03 | i-prefixed deep link renders; hostile ids short-circuit with zero requests in a real browser | manual (checkpoint) | pre-check: deployed index + both first-row detail URLs return 200 | n/a | ⬜ pending |
| 16-T2 | 16-16 | GC3 | DASH-02 | — | List, overview and detail agree on the true local wall-clock date in a non-UTC browser timezone | manual (checkpoint) | pre-check: derive the two target rows from the deployed index | n/a | ⬜ pending |

**Sampling continuity (gap closure):** every one of the 17 tasks carries an `<automated>` command. The four `manual (checkpoint)` tasks each run an automated pre-check before pausing, so no 3 consecutive tasks lack an automated gate.

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

**Gap-closure additions (GC0, 2026-08-11)** — same convention: each file is created by the task that needs it, inside the plan that owns the code under test.

- [ ] `src/dashboard/styles.test.ts` — plan 16-11 task 2 (DASH-03; locks the six WR-04 rules and widget token parity)
- [ ] `src/dashboard/views/list.test.ts` — plan 16-12 task 1 (DASH-02; `formatActivityDate` timezone independence, WR-02)

Three existing suites are EXTENDED rather than created, and the extension is the point — their absence of coverage is finding IN-07, the reason a 334/334 green suite shipped a broken detail view:

- [ ] `src/dashboard/router.test.ts` — plan 16-10 task 1 adds i-prefixed accept cases and seven near-miss reject cases
- [ ] `src/dashboard/data/detail-client.test.ts` — plan 16-10 task 2 adds an i-prefixed happy path asserting both fetch URLs
- [ ] `src/analytics/compute-dashboard-index.test.ts` — plan 16-12 task 2 adds a mixed-suffix day-boundary ordering case and a malformed-timestamp case

*Existing vitest infrastructure covers the framework; no new install needed. No jsdom or browser-automation dependency is added — D-01 locks the phase to zero new dependencies and RESEARCH.md recommends deferring that tooling decision.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DOM mounting / view rendering | DASH-01 | Repo has zero DOM/browser tests (vitest node env, no jsdom); all 11 widgets verified manually — same precedent | **Must be performed against the live GitHub Pages origin, not `vite dev` or any localhost server.** Navigate all five hash routes, hard-refresh on each, confirm no full reload and no 404. *(Corrected 2026-08-11: the original wording permitted a local server, and a local-server UAT is exactly what let SC1 pass at the 16-09 checkpoint while the site was never deployed.)* |
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
