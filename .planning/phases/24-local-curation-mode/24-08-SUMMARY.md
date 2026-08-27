---
phase: 24-local-curation-mode
plan: 08
subsystem: validation
tags: [browser-checkpoint, human-verify, requirement-disposition, gap-closure]

# Dependency graph
requires:
  - phase: 24-local-curation-mode (plans 02, 03, 05, 06, 07)
    provides: "the attach seam, the amended ROADMAP criteria, the HTTP guard, the recompute chain and the overlay whose interaction this plan is the sole proof of"
provides:
  - "24-VALIDATION.md § Round 1 Checkpoint (R1-R14) — 14 recorded verdicts with quoted values, an Expected Values table pinned before any write, and a Final state check"
  - "GAP-24-01 — the one FAIL, recorded verbatim and left unpatched for the next planning round"
  - "CUR-01 disposition: held Pending on rendered evidence rather than ticked on a frontmatter match"
affects: [any future 24.x gap-closure phase, which inherits GAP-24-01 as its brief]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Expected values derived from data/stats/*.json BEFORE the write, so the checkpoint compares the UI against an independently-derived number rather than against the UI's own internal agreement (T-24-EXTENT)"
    - "Operationally-defined HEAD baseline instead of a literal pinned hash — committing a pinned hash advances HEAD past it, which made the original pin stale on arrival"

key-files:
  created:
    - .planning/phases/24-local-curation-mode/24-08-SUMMARY.md
  modified:
    - .planning/phases/24-local-curation-mode/24-VALIDATION.md
    - .planning/REQUIREMENTS.md
---

# Plan 24-08 — Phase close: fresh gate and the blocking browser checkpoint

## What happened

**Task 1** ran the full five-command gate against one fresh build (all exit 0; `npm test`
60 files / 1500 tests), recorded the build identity (`index-xwaleiOf.js`,
`index-B573RjUr.css`) and pinned the expected values from `best-efforts.json`,
`weekly-distance.json` and `monthly-stats.json` before any exclusion existed.

**Task 2** held the 14-row checkpoint. **13 PASS, 1 FAIL.** The round was agent-driven via
Claude-in-Chrome against real Chrome at the developer's explicit delegation — real clicks,
trusted keyboard (`isTrusted: true` verified per focus stop), real hover — with ROW R10
performed by the developer, because its native `window.confirm()` blocks the automation
extension and overriding it would have been substituted evidence. That provenance is
disclosed row-class by row-class in `24-VALIDATION.md` rather than recorded as a human round.

**Task 3** wrote the verdicts, opened GAP-24-01, and held CUR-01 at `Pending`.

## Deviations

1. **A defect in Task 1's own output was fixed before the checkpoint ran.** The pinned
   baseline HEAD (`cf18820`) was stale the instant it was committed — writing the pin advances
   HEAD past the pinned value — so R5/R11/the final state check would have read FAIL on a
   correct run. Replaced with a developer-recorded baseline (commit `44e6f3a`). This is what
   D-09 actually asserts: HEAD at the end of the session equals HEAD at the start.

2. **R14 was run out of plan order** (before R10/R11), so its "working tree empty" half was
   re-checked after R11 rather than in place. Both 403s and the no-write claim are unaffected.

3. **R8's streaming progress text was not observed** — the recompute completed and reloaded
   before a frame could be captured. Recorded as not-observed, not as passed.

## The FAIL — GAP-24-01

The `Excluded — {reason}` badge does not render when Save is pressed. The staged-build cache
trap was excluded first: the reload was confirmed, the app refetched the file, and a
cache-busted fetch returned byte-identical JSON already containing the entry — data present,
badge absent. `detail-sections.ts:348` gates the badge on `row.excluded`, which
`detail-best-efforts-logic.ts:95` reads from `excludedFromRecords` in the precomputed
`data/stats/best-efforts.json`, not from the live exclusions file; only the reason is loaded
live. The badge appeared correctly after R8's Recompute, and R11 showed the mirror-image
staleness (reason-less `Excluded from records` once the entry was deleted but the stats were
not yet recomputed).

So criterion 2 is reachable in-session with no rebuild — but via Save **then Recompute**, not
Save alone, which is the sequencing R5 asserts. No fix proposed, per the house rule since 16-09.

## Why CUR-01 was NOT ticked and the origin todo was NOT closed

Task 3(c) ticks CUR-01 only if every one of R3, R4, R5, R7, R8, R9, R10, R12, R13 is PASS.
R5 is FAIL, so CUR-01 stays unticked and `Pending`, and per Task 3(d) the origin todo
`2026-08-12-exclusion-tickbox-local-curation-mode.md` stays in `pending/`. Closing it now
would repeat the v2.0 audit's stale-todo error in the opposite direction.

## Incidental findings, outside this phase's scope

- **F-2** — the raw-epoch tooltip title is NOT new: `23-07-SUMMARY.md` finding 6 logged it as
  pre-existing from Phase 18 and `23-10-PLAN.md` scoped it out of Phase 23. What this round adds
  is its extent — the record names the *Training Load* tooltip, but *Volume → Monthly* has it too
  (`1,609,459,200,000` for Jan 2021, `1,693,526,400,000` for Sep 2023, values beneath correct,
  reproduced on a clean page with no instrumentation). Treat as a shared `trends-charts.ts`
  formatter defect, not a single-chart fix.
- **F-3 (UNCONFIRMED)** — Monthly volume zoom-out may still be caged at a 5-year window: `−`
  reported `disabled: false` but two clicks left `aria-label` at `Aug 2021 to Aug 2026`; only `←`
  moved it. Clicks in that control row were landing (`←` at the adjacent coordinate worked), but
  this was a two-click incidental observation with no independently derived extent value, so it is
  explicitly not established. Same shape as Phase 23's CR-01, which Round 3 recorded as fixed —
  needs a dedicated check before anyone concludes either way.
- `dist/widgets/test.html` is tracked but no longer emitted by `build-widgets`, so it shows as
  a pending deletion throughout. Pre-existing and unrelated.

## Self-Check: PASSED (with one recorded FAIL by design)

- 14/14 rows carry a verdict; 13 PASS, 1 FAIL (R5), 0 BLOCKED
- Final state: `git status --porcelain data/best-effort-exclusions.json` empty, array length
  restored to 2, `dist/widgets/__curate` absent, no curate-created commit
- `npm test` exits 0 (60 files / 1500 tests); `git status --porcelain src/ scripts/` empty
- `find .planning/todos -name '*exclusion-tickbox*'` returns exactly one path
