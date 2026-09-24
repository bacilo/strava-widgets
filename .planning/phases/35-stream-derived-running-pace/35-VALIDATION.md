---
phase: 35
slug: stream-derived-running-pace
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-24
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `35-RESEARCH.md` § Validation Architecture at plan-phase time. Task IDs are
> assigned when PLAN.md files are written — the Per-Task Verification Map below is keyed by
> requirement until then.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (already configured — no Wave 0 install) |
| **Config file** | `vitest.config.ts` — `globals: true`, `environment: 'node'`, `fileParallelism: false` |
| **Quick run command** | `npx vitest run <touched test files> -t "<fragment>"` — `.test.mjs` files import `../dist/`, so run `npm run build` first |
| **Full suite command** | `npm test` |
| **Estimated runtime** | full suite ~ Phase 34 baseline (98 files / 3,499 tests, all green per `34-VALIDATION.md` and STATE.md 2026-09-23) — **re-confirm fresh at Wave 0**, nightly CI may have moved the archive |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched files> -t "<fragment>"` — **record the matched
  test count on every `-t` row.** A name filter matching zero tests exits 0 and is indistinguishable
  from a pass (this project's carried-forward lesson from `33-VALIDATION.md` / `34-VALIDATION.md`).
- **After every plan wave:** `npm test` + `npx tsc --noEmit` + `npm run build` + `npm run build-widgets`
- **Before `/gsd-verify-work`:** Full suite must be green, plus the phase-gate conditions below.
- **Max feedback latency:** quick run < 30 s; wave run = full-suite runtime

### Phase gate (all must hold before verification)

- [ ] Full suite green
- [ ] D-05 calibration artifact and D-08 recount artifact each **regenerated twice, byte-identical**
- [ ] D-05's deliberately circular **strawman watched FAILING first** against the real archive
- [ ] D-11's **stub-the-detector proof watched changing** the running-pace value on a named activity
- [ ] Human browser checkpoint against a **digest-verified served build** — hard-reload after every
      fixture edit (recorded browser-checkpoint pitfall in this project)

---

## Per-Task Verification Map

Keyed by requirement until plans assign task IDs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | RPACE-01 | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "running pace"` | ❌ W0 (extends existing file) | ⬜ pending |
| TBD | TBD | TBD | RPACE-01 (CI write) | — | N/A | unit | `npx vitest run src/analytics/compute-dashboard-index.test.ts -t "running pace"` | ❌ W0 (extends existing file) | ⬜ pending |
| TBD | TBD | TBD | RPACE-02 | — | V5: `textContent`-only | unit + manual | `npx vitest run src/dashboard/views/detail.test.ts -t "running pace"` + browser row on 3475724402 | ❌ W0 (extends existing file) | ⬜ pending |
| TBD | TBD | TBD | RPACE-02 (byte-identical boundary) | — | N/A | unit (regression) | `npx vitest run src/dashboard/views/list.test.ts -t "metadata pace unchanged"` + existing stats-document snapshots re-run unmodified | ✅ extend existing | ⬜ pending |
| TBD | TBD | TBD | RPACE-03 (comparator retarget) | — | N/A | unit | `npx vitest run src/analytics/pace-derivation.test.ts -t "detectPaceDisagreement"` | ✅ extend existing | ⬜ pending |
| TBD | TBD | TBD | RPACE-03 (eligibility gate, D-02) | — | N/A | script (artifact) | the new `compute-<name>-calibration.mjs` eligibility-gate section, asserted via its `.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RPACE-03 (threshold calibration, D-05) | — | N/A | script (artifact) | `npx vitest run scripts/compute-<name>-calibration.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RPACE-03 (badge on 3475724402) | — | N/A | unit + manual | `npx vitest run src/dashboard/views/list.test.ts -t "3475724402"` + browser row | ❌ W0 (new fixture-pinned test) | ⬜ pending |
| TBD | TBD | TBD | RPACE-03 (zero-import recount, D-08) | — | N/A | script | `npx vitest run scripts/compute-<name>-recount.test.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEG-05b (Phase 35 half, D-11) | — | N/A | unit | `npx vitest run src/analytics/pace-single-source.test.ts -t "running pace"` | ✅ extend existing | ⬜ pending |
| TBD | TBD | TBD | D-09 (splits rebase) | — | N/A | unit + manual | `npx vitest run src/dashboard/views/detail-sections.test.ts -t "isRebasedAverage"` + browser row | ✅ extend existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Assertion rule (33 D-03 / 33 D-13 / 34 D-22):** every load-bearing row above must assert against a
value derived **outside** the code under test, and must carry a stated CAN FAIL / CAN PASS
reachability proof in both directions. Internal-agreement and absence-only rows pass equally well
against broken code — that shape has shipped a green gate over a broken build in this project twice.

---

## Wave 0 Requirements

- [ ] The new running-pace function (name TBD per D-08) + unit tests in
      `src/analytics/pace-derivation.test.ts` — including the pinned **boundary-case test** for a
      sample step straddling an interval edge, and for "near-zero excluded metres, large excluded
      seconds"
- [ ] `scripts/compute-<name>-calibration.mjs` + `.test.mjs` — D-05's full HALT-capable machinery,
      instantiated from the `compute-pause-classification-calibration.mjs` shape
- [ ] `scripts/compute-<name>-recount.mjs` + `.test.mjs` — D-08's zero-import independent recount,
      instantiated from the `compute-unreliable-segment-recount.mjs` shape
- [ ] `.planning/phases/35-stream-derived-running-pace/35-CALIBRATION.md` — generated artifact, does
      not exist until the generator runs; **prose is generated**, hand-edits silently revert
- Framework install: none — vitest already configured, no new dependency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 3475724402's detail view shows the running pace beside metadata pace (4:56/km) with the excluded metres/seconds stated, and the two figures **visibly differ** | RPACE-02 / criterion 2 | Rendered claim — only a served build proves it | Digest-verified served build, hard-reload, read both figures off 3475724402's detail page; assert the difference against a value derived outside the changed code |
| "Pace disputed" badge raised on 3475724402 | RPACE-03 / criterion 3 | Rendered claim | Same served build; confirm badge presence and its disclosure sentence names exactly what its number counts (33 D-11) |
| Splits "vs. Avg" bars rebase to the running pace on the widened badged population | D-09 | Visible change to a shipped surface, order ~20–45 activities | Browser checkpoint row against an independently-derived baseline value, not the page's own number |
| Metadata pace / `moving_time` byte-identical on lists, stats documents and widgets | criterion 4 | Cross-surface absence claim | Confirm on a served build **and** by automated regression rows above — absence-only browser rows are not sufficient alone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Every `-t` filtered row records its **matched test count**
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Every load-bearing assertion compares against an independently-derived value
- [ ] Feedback latency < 30s (quick run)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
