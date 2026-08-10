---
phase: 16
slug: dashboard-shell-data-contract
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| — | — | — | DASH-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| — | — | — | DASH-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| — | — | — | DASH-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(To be filled in by the planner with concrete task IDs once plans exist.)*

---

## Wave 0 Requirements

- [ ] Test files for pure dashboard logic (router resolution, view registry, theme resolution, index fetch client) — stubs for DASH-01, DASH-02, DASH-03

*Existing vitest infrastructure covers the framework; no new install needed.*

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
