---
phase: 24
slug: local-curation-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-27
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `24-RESEARCH.md` § "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.0.18`, `environment: 'node'` — **no DOM library** (no jsdom/linkedom) |
| **Config file** | `vitest.config.ts` (repo root) — `include: ['src/**/*.test.ts']` |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npm test` (~55 test files under `src/**`) |
| **Estimated runtime** | ~10-20 seconds full suite; subprocess guard test adds ~1s |

**Critical constraint:** the vitest `include` glob reaches `src/**` only. Script-level
tests (`scripts/**/*.test.mjs`) require widening the glob — this is a Wave 0 item.

**Second constraint:** there is no DOM environment. D-03's `data-activity-id` and
`dashboard:best-efforts-mounted` additions cannot be asserted against a live DOM.
They must be proven with the repo's existing **source-structure regression guard**
pattern (`src/dashboard/**/row-semantics.test.ts`, `row-navigation.test.ts`), which
reads source text and asserts on structure.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test files>`
- **After every plan wave:** Run `npm test` + `npm run build-widgets` + `npm run verify-dashboard`
- **Before `/gsd-verify-work`:** Full suite green, `verify-dashboard-publish.mjs` green
  including both new guard checks
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. Rows below are the required *coverage*;
> the planner must map each to concrete task IDs and may split a row across tasks.

| Coverage Row | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|--------------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Write mechanics — `upsertExclusion`/`removeExclusion` produce the exact D-05 shape (`distances: null`; untick **deletes the entry**, never leaves `distances: []`) | CUR-01 | — | N/A | unit | `npx vitest run scripts/**/curate-*.test.mjs` | ❌ W0 | ⬜ pending |
| D-03 attach seam — `data-activity-id` on the `<section>`; `dashboard:best-efforts-mounted` dispatched **after** the `requestToken`/`mountedContainer` guard passes and the panel is placed | CUR-01 | — | N/A | source-structure | `npx vitest run src/dashboard/**/curation-seam.test.ts` | ❌ W0 | ⬜ pending |
| D-10(a)/D-11 build-time guard — extracted `assertNoCurationArtifacts` returns violations against a **planted** fake curate artifact and an empty list against a clean tree | CUR-01 | T-24-CUR-01 | Curate bundle/marker cannot reach `dist/widgets` | unit, planted-fixture | `npx vitest run scripts/lib/curation-guard.test.mjs` | ❌ W0 | ⬜ pending |
| D-10(b)/D-11 HTTP guard — the real `verify-dashboard-publish.mjs` exits non-zero when a fake `/__curate/*` file is planted in `dist/widgets`, and exits 0 when clean | CUR-01 | T-24-CUR-02 | Write endpoints unreachable in publish bundle | integration, subprocess, planted-fixture | `npx vitest run scripts/**/verify-dashboard-publish-guard.test.mjs` | ❌ W0 | ⬜ pending |
| **Non-regression** — `/data/best-effort-exclusions.json` still returns 200 and parses (`verify-dashboard-publish.mjs:294`); the new guards must not catch it | CUR-01 | — | N/A | integration | `npm run verify-dashboard` | ✅ exists | ⬜ pending |
| D-12 Origin/Host check — write endpoints reject mismatched `Origin`/`Host`, accept matching | CUR-01 | T-24-CUR-03 | Drive-by CSRF / DNS rebinding rejected | unit (pure `isTrustedOrigin`) | `npx vitest run scripts/**/curate-*.test.mjs` | ❌ W0 | ⬜ pending |
| Read-path tolerance unchanged — T-16-EX-01 / T-16-EX-02 still green (D-05: do **not** remove distance-array support) | CUR-01 | — | N/A | unit (existing) | `npm test` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — widen `include` to `['src/**/*.test.ts', 'scripts/**/*.test.mjs']`
      (required by every script-level test above)
- [ ] `scripts/lib/curation-guard.mjs` — extract the guard as a **pure, importable**
      function so D-11 can plant a fixture and observe it failing
- [ ] `scripts/lib/copy-data-tree.mjs` — extract the data-copy walk shared by
      `build-widgets.mjs` and the curate server's recompute mirror
      (`build-widgets.mjs` self-executes on import and cannot be reused as-is)
- [ ] `src/dashboard/**/curation-seam.test.ts` — new source-structure test file
      (no framework install needed; follows existing precedent)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end curation: `npm run curate`, tick "Exclude this run from PRs", enter a reason, Save | CUR-01 (criteria 1, 2) | No DOM test environment; the loop spans a browser, a Node server and two files on disk | Start `npm run curate`; open an activity detail view under `/strava-widgets`; tick the box; confirm Save is inert with an empty reason; enter a reason; Save; confirm the entry appears in `data/best-effort-exclusions.json` with `distances: null` and the typed reason |
| Reason surfaced in the detail view | CUR-01 (criterion 2) | Rendering assertion; the `Excluded — {reason}` badge at `detail-sections.ts:349` must become reachable without a hand-edit | After Save, confirm the `Excluded — {reason}` badge renders in the Best Efforts panel **in the same session**, without a manual rebuild (D-07's instant mirror) |
| Untick deletes the entry | CUR-01 | Destructive path with a confirm gesture (D-08) | Untick an excluded run, accept the confirm, verify the entry is **removed** from the array — not left as `distances: []` |
| Recompute promotes the next-best effort | CUR-01 (D-07) | Requires observing a cross-activity ranking change | Press "Recompute records"; confirm progress streams, the page reloads, and the promoted next-best effort comes from a **different** activity |
| Production build has no reachable curation write path | CUR-01 (criterion 4) | Requires a real browser against the real publish bundle | Build, serve `dist/widgets` under `/strava-widgets`, load in a real browser; confirm `/__curate/health`, `/__curate/overlay.js` and the write endpoint all 404, and no curation control renders |
| Totals unaffected by exclusion | CUR-01 | Confirms the structural claim in CONTEXT.md § Established Patterns | Confirm weekly distance / monthly / yearly stats are unchanged after excluding an activity (`loadExclusions` reaches only `compute-best-efforts.ts`) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] **D-11 discharged: each new guard has been *observed failing* against a planted
      regression** — a guard that has never been seen red is not evidence
      (Phase 19 R3-CR-01, Phase 23 WR-06)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
