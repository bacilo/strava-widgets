---
phase: 29
slug: curation-review-queue
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-17
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `29-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map is filled in by the planner/executor once PLAN.md task IDs
> exist; the framework, sampling rate, and Wave 0 rows below are already fixed.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.0.18` |
| **Config file** | `vitest.config.ts` (repo root) — `environment: 'node'`, `fileParallelism: false`, `include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs']`. A `scripts/**/*.test.ts` file is **never collected** — new script-side tests must be `*.test.mjs`. |
| **Quick run command** | `npx vitest run <path-to-file>` for the file(s) the task touched |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15s quick / ~180s full suite |

---

## Sampling Rate

- **After every task commit:** Run the targeted `npx vitest run <file>` for whatever file(s) that task touched
- **After every plan wave:** Run `npm test` (full suite — `fileParallelism: false` makes this the only reliable way to run the `curation-guard` / `verify-dashboard-publish-guard` pair together)
- **Before `/gsd-verify-work`:** Full suite green, plus `npm run build`, `npm run build-widgets`, `npm run verify-dashboard` all exit 0
- **Max feedback latency:** 20 seconds (quick command)

---

## Per-Task Verification Map

*Populated during planning — one row per task ID emitted by the PLAN.md files.
Every requirement below must be claimed by at least one task row before
`wave_0_complete` may be set true.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | — | — | CUR-01 | — | `deriveFlaggedActivities` returns exactly the 47-activity set against real archive fixtures (D-01..D-05) | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` | ❌ W0 | ⬜ pending |
| — | — | — | CUR-01 | — | `recountDemotedActivities` returns the same activity count as the independently-verified 47 | unit | `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` | ❌ W0 (extends existing) | ⬜ pending |
| — | — | — | CUR-02 | — | Queue client imports (never reimplements) `saveExclusion`/`removeExclusion` — source-structure guard | unit (source-text) | `npx vitest run scripts/curate-queue.test.mjs` | ❌ W0 | ⬜ pending |
| — | — | — | CUR-02 | — | Untrusted-origin write against `/__curate/exclusions/:id` still rejected (regression) | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ | ⬜ pending |
| — | — | — | CUR-03 | — | `findCurationArtifacts` flags a planted queue page/bundle in a fixture tree; clean tree returns `[]` | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ extend | ⬜ pending |
| — | — | — | CUR-03 | — | `verify-dashboard-publish.mjs` fails when `/__curate/queue`(.js) is served, passes when absent | integration (subprocess) | `npx vitest run scripts/verify-dashboard-publish-guard.test.mjs` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/curate-queue/derive-flagged.mjs` + `scripts/curate-queue/derive-flagged.test.mjs` — pure derivation function and its behavioral tests
- [ ] `scripts/curate-queue.test.mjs` — source-structure guard for the queue client, mirroring `scripts/curate-overlay.test.mjs` (import-guard, `location.reload()` presence, no-second-renderer)
- [ ] `recountDemotedActivities` export in `scripts/compute-pr-ceiling-recount.mjs` + test additions in `scripts/compute-pr-ceiling-recount.test.mjs`
- [ ] Two new `expect404` lines in `scripts/verify-dashboard-publish.mjs` + matching `it(...)` blocks in `scripts/verify-dashboard-publish-guard.test.mjs`
- [ ] New planted-fixture cases in `scripts/lib/curation-guard.test.mjs` for queue-page-shaped and queue-bundle-shaped leaks
- [ ] IN-17 fix in `scripts/lib/curation-guard.mjs` (one path → one violation) — must land **before** the new D-19 fixtures above are written
- [ ] IN-18 fix in `src/dashboard/curation-seam.test.ts` (WR-17 literal pin → regex-shape pin)

*No framework installation gap — vitest already collects both file patterns this phase needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Queue's rendered header count matches the independently-derived activity count | CUR-01 (Criterion 1) | Requires the real `npm run curate` UI rendered in a browser against the real archive | Browser checkpoint — run `node scripts/compute-pr-ceiling-recount.mjs`, open the queue via its one navigation action, compare the two numbers (expected 47) |
| Queue row's Exclude action writes through the real server; untrusted origin rejected | CUR-02 (Criterion 2) | End-to-end gesture through the live curate server | Browser checkpoint — exclude a row, confirm `best-effort-exclusions.json` changed; replay the request from an untrusted origin and confirm rejection |
| Leak-and-rebuild discriminates both guards red/green | CUR-03 (Criterion 3) | Full `npm run verify-dashboard` against a deliberately-leaked build | Automated half covered by the extended guard tests; checkpoint confirms `npm run verify-dashboard` green on the correct build |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
