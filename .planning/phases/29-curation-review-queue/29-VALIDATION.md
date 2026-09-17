---
phase: 29
slug: curation-review-queue
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-17
updated: 2026-09-17
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `29-RESEARCH.md` § Validation Architecture. The Per-Task
> Verification Map below is filled in against the eight PLAN.md files; the
> framework, sampling rate, and Wave 0 rows were fixed before planning.

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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-01-T1 | 01 | 1 | CUR-03 | T-29-06 | IN-17 pin observed RED: one path must not yield two violations | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ extend | ⬜ pending |
| 29-01-T2 | 01 | 1 | CUR-03 | T-29-07 | `findCurationArtifacts` reports one violation per path with no exemption widened | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ extend | ⬜ pending |
| 29-01-T3 | 01 | 1 | CUR-03 | T-29-04 | Planted queue page / queue bundle flagged; clean tree returns `[]` | unit | `npx vitest run scripts/lib/curation-guard.test.mjs` | ✅ extend | ⬜ pending |
| 29-02-T1 | 02 | 1 | CUR-03 | T-29-06 | Cases E/F observed RED before the verifier asserts the new paths | integration (subprocess) | `npx vitest run scripts/verify-dashboard-publish-guard.test.mjs` | ✅ extend | ⬜ pending |
| 29-02-T2 | 02 | 1 | CUR-03 | T-29-04 | `/__curate/queue` and `/__curate/queue.js` asserted 404 as explicit literals, never a prefix | integration (subprocess) | `npx vitest run scripts/verify-dashboard-publish-guard.test.mjs` | ✅ extend | ⬜ pending |
| 29-02-T3 | 02 | 1 | CUR-03 | T-29-08 | IN-18: WR-17 pin is format-robust and still rejects a wrong identifier | unit (source-text) | `npx vitest run src/dashboard/curation-seam.test.ts` | ✅ extend | ⬜ pending |
| 29-03-T1 | 03 | 1 | CUR-01 | T-29-09 | `recountDemotedActivities` dedupes by activity, covers all three guards, never throws | unit | `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` | ✅ extend | ⬜ pending |
| 29-03-T2 | 03 | 1 | CUR-01 | T-29-11 | `--expect-flagged-activities` reports MATCH on the true value and fails quoting both numbers otherwise | unit + CLI | `npx vitest run scripts/compute-pr-ceiling-recount.test.mjs` | ✅ extend | ⬜ pending |
| 29-03-T3 | 03 | 1 | CUR-01 | T-29-11 | The day's independent numbers are re-derived, never reused from planning | CLI | `node scripts/compute-pr-ceiling-recount.mjs \| grep -E "Flagged ACTIVITIES\|already excluded"` | ✅ | ⬜ pending |
| 29-04-T1 | 04 | 2 | CUR-01 | T-29-14 | The derivation's test file is proven collected by vitest (`Test Files 1 passed`) | unit (canary) | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` | ❌ W0 | ⬜ pending |
| 29-04-T2 | 04 | 2 | CUR-01 | T-29-12, T-29-13 | `deriveFlaggedActivities` implements D-01..D-05/D-11/D-12; `__proto__` safe; degrades to `[]` | unit | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` | ❌ W0 | ⬜ pending |
| 29-04-T3 | 04 | 2 | CUR-01 | T-29-14 | Derived row count/ids equal the independent recount's on the live archive, no pinned constants | unit (live cross-check) | `npx vitest run scripts/curate-queue/derive-flagged.test.mjs` | ❌ W0 | ⬜ pending |
| 29-05-T1 | 05 | 3 | CUR-01 | — | Local formatters behave, with a collected `.test.mjs` | unit | `npx vitest run scripts/curate-queue/format.test.mjs` | ❌ W0 | ⬜ pending |
| 29-05-T2 | 05 | 3 | CUR-01 | T-29-02, T-29-13 | Client bundles; no HTML-string assignment; three root-absolute public reads; never-blank degraded state | build-gate (esbuild + grep) | `npx esbuild scripts/curate-queue/index.ts --bundle --format=iife --target=es2020 --outfile=/tmp/queue-check.js` | ❌ W0 | ⬜ pending |
| 29-05-T3 | 05 | 3 | CUR-02 | T-29-03 | The bundle reaches the real transport (route strings + `location.reload` present in bundle, absent in source) | build-gate (esbuild + assertion) | `npx esbuild scripts/curate-queue/index.ts --bundle --format=iife --target=es2020 --outfile=/tmp/queue-check.js` | ❌ W0 | ⬜ pending |
| 29-06-T1 | 06 | 4 | CUR-01 | T-29-16 | `extractStylesheetHref` / `renderQueuePage` are pure, attribute-order agnostic, never throw | unit | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ⬜ pending |
| 29-06-T2 | 06 | 4 | CUR-01 | T-29-05, T-29-17 | Exact-match routes only; bundle builds into gitignored `.curate-dist/`; queue URL printed | CLI | `node -e "import('./scripts/curate-server.mjs').then(async m => { await m.buildQueueBundle(); })"` | ✅ | ⬜ pending |
| 29-06-T3 | 06 | 4 | CUR-02 | T-29-01 | Both new GET routes 403 on cross-origin Origin and mismatched Host; 200 on ordinary navigation | integration (live socket) | `npx vitest run scripts/curate-server.test.mjs` | ✅ extend | ⬜ pending |
| 29-07-T1 | 07 | 4 | CUR-01 | T-29-18 | Nav link injected on `DOMContentLoaded`; missing nav root is a silent no-op; no observer/timers | build-gate (esbuild + grep) | `npx esbuild scripts/curate-overlay/index.ts --bundle --format=iife --target=es2020 --outfile=/tmp/overlay-check.js` | ✅ | ⬜ pending |
| 29-07-T2 | 07 | 4 | CUR-01 | T-29-06 | Listener pin is exact (2) and names both events; a third listener still fails it | unit (source-text) | `npx vitest run scripts/curate-overlay.test.mjs` | ✅ extend | ⬜ pending |
| 29-07-T3 | 07 | 4 | CUR-02 | T-29-03, T-29-17 | Queue client imports the transport, has no `/__curate` fetch, ships no CSS/HTML strings, is absent from every build input | unit (source-text) | `npx vitest run scripts/curate-queue.test.mjs` | ❌ W0 | ⬜ pending |
| 29-08-T1 | 08 | 5 | CUR-01, CUR-03 | T-29-20, T-29-04 | Full build + all guards green on the served build; the day's independent numbers and artifact digests captured | suite + CLI | `npm test && npm run build && npm run build-widgets && npm run verify-dashboard` | ✅ | ⬜ pending |
| 29-08-T2 | 08 | 5 | CUR-01, CUR-02 | T-29-01, T-29-19 | Rendered extent vs independent count; write-and-reverse through the existing path; untrusted origin rejected | manual (browser checkpoint) | N/A — human, blocking | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Requirement coverage:** CUR-01 → 29-03, 29-04, 29-05, 29-06, 29-07, 29-08 · CUR-02 → 29-05, 29-06,
29-07, 29-08 · CUR-03 → 29-01, 29-02, 29-08. Every requirement is claimed by at least one task row
with an automated command, plus the blocking checkpoint.

---

## Wave 0 Requirements

- [ ] `scripts/curate-queue/derive-flagged.mjs` + `derive-flagged.test.mjs` — plan 29-04 T1/T2/T3 (canary-first collection proof before any real assertion)
- [ ] `scripts/curate-queue/format.mjs` + `format.test.mjs` — plan 29-05 T1
- [ ] `scripts/curate-queue.test.mjs` — plan 29-07 T3 (source-structure guard mirroring `scripts/curate-overlay.test.mjs`)
- [ ] `recountDemotedActivities` export + test additions — plan 29-03 T1/T2
- [ ] Two new `expect404` lines + matching `it(...)` blocks — plan 29-02 T1/T2
- [ ] Planted queue-page/queue-bundle fixtures in `scripts/lib/curation-guard.test.mjs` — plan 29-01 T3
- [ ] IN-17 fix in `scripts/lib/curation-guard.mjs` — plan 29-01 T2, lands **before** 29-01 T3's fixtures
- [ ] IN-18 fix in `src/dashboard/curation-seam.test.ts` — plan 29-02 T3

*No framework installation gap — vitest already collects both file patterns this phase needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Where |
|----------|-------------|------------|-------|
| Rendered row count equals the independently-derived flagged activity count | CUR-01 (Criterion 1) | Needs the real `npm run curate` UI rendered in a browser against the real archive | 29-08 T2, rows R2/R3 (discriminates against the effort count, the ceiling-only count and the excluded-hidden count) |
| Exclude action writes through the real server and reverses; untrusted origin rejected | CUR-02 (Criterion 2) | End-to-end gesture plus a cross-origin probe | 29-08 T2, rows R7/R8 (R8 carries a 200 control so the row is not unsatisfiable) |
| Guards green on exactly the build that was served | CUR-03 (Criterion 3) | The red halves are automated (29-01/29-02); confirming the served artifact is the built one needs a digest comparison in session | 29-08 T1/T2, row R10 |
| PD-01 ruling (third fetch of `data/dashboard/index.json` for activity names) | CUR-01 (D-12 vs D-08) | A scope judgement reserved for the developer | 29-08 T2, row R11 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or an explicit Wave 0 dependency (29-08 T2 is the blocking human checkpoint, immediately preceded by the automated 29-08 T1)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s for every targeted command
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-09-17 — `wave_0_complete` flips to true once plans 29-01 through 29-05 and 29-07's Wave 0 files exist and run green.
</content>
