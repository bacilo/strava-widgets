# Phase 25: CI Hardening & Light-Theme Verification - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Four independent carried-forward items land together, closing milestone v2.1:

1. **FIX-02** — `gear-aggregate-logic.ts` degrades into the Unknown bucket instead of crashing on `slugify(undefined)` when an index row's `gearName` key is absent, with a regression test for the missing-key case.
2. **CI-01** — the nightly workflow and `compute-all-stats` share one source of truth for compute-step ordering.
3. **CI-02** — `verify-dashboard-publish.mjs` asserts reachability by name for `weekly-distance`, `monthly-stats`, `yearly-stats`, `year-over-year`, `best-efforts.json` and a sample of per-activity best-effort shards, rather than trusting the whole-directory copy to carry them.
4. **VER-01** — Phase 16's three unverified theme/first-paint items are confirmed from a genuinely light-OS environment against the production-served build.

Plus one folded todo (WR-19) and one pin added during discussion (the inline theme bootstrap in `index.html`) — both recorded under Folded Todos and D-06.

**Not in this phase:** anything touching the analytics or computation layer beyond FIX-02; the Garmin export adapter; new metrics or chart types. This is the closing phase of v2.1.

</domain>

<decisions>
## Implementation Decisions

### CI-01 — Compute chain ordering

- **D-01:** The single ordering lives **in code**. The workflow's eight separate compute steps collapse into one `compute-all-stats` invocation, and `computeAllStatsCommand` (`src/index.ts:289`) becomes the sole declaration of both the order and each step's failure disposition. Per-step tolerance moves into the command, which emits `::warning::` annotations so degraded steps still surface in the Actions run summary. Rejected: a shared manifest with generated YAML (new codegen + freshness gate to maintain), and keeping both orderings behind a parity test (leaves two orderings, one merely checked).
  - **Accepted cost:** the eight separate green/red boxes in the Actions UI become one. Diagnosing a nightly failure moves from the step list into that step's output, so the command's logging has to carry the weight the step names used to.
- **D-02:** Tolerance is **opt-in for CI**. `compute-all-stats` stays fail-fast by default so a hand-run aborts loudly; the workflow passes an explicit flag (`--ci` / `--continue-on-error`, exact spelling is the planner's) to get warn-and-continue behaviour. Drift in a boolean is far cheaper than drift in an ordering.
- **D-03 (Claude's discretion, accepted):** the mandatory/tolerated split is preserved exactly as CI has it today — `compute-stats` and `compute-advanced-stats` mandatory; geo, best-efforts, dashboard-index, age-grading, gear-aggregate and training-load tolerated. The command prints an end-of-run failure summary so a nightly that quietly degraded three steps is visible at a glance rather than buried mid-log.

### VER-01 — Light-OS checkpoint protocol

- **D-04:** Each round starts from **cleared site data** (or a fresh profile), and the write-up must quote `localStorage.getItem('dashboard-theme')` returning `null` at the instant of observation. Without this the row proves nothing: `theme.ts` reads the persisted mode *before* falling back to `prefers-color-scheme`, so a browser whose in-page control has ever been touched ignores the OS setting entirely — and a masked row looks identical to a passing one.
- **D-05:** The **first-paint flash row is observed with the OS in dark appearance**, not light. As worded, that row is vacuous: light `--bg` is `#ffffff` (`styles.css:18`), so on a light OS a white first paint *is* the correct final state and cannot discriminate a working pre-paint theme from a broken one. On dark OS a white first frame is the failure and `#1a1a2e` is the pass. Legibility stays on light OS; live-follow spans both. **This is a deliberate deviation from criterion 4's literal wording and must be disclosed as such in the validation write-up**, not quietly substituted.
- **D-06:** A **structural pin on the inline theme bootstrap** is folded into this phase. `src/dashboard/index.html` carries a synchronous pre-paint copy of `parseThemeMode`/`resolveEffectiveTheme` whose own comment declares it a deliberate duplication that "must stay behaviourally identical" and that carries the T-16-TH-01 allow-list mitigation — and nothing in the repo tests it. The pin asserts behavioural parity with `theme.ts` across the same mode/`prefersDark` combinations, the `'light' | 'dark' | 'auto'` allow-list intact, and the script still positioned before the stylesheet link. Same fix shape as Phase 24's WR-17 `resolveExcluded` extraction; here the duplication cannot be removed (the inline copy must run before the module loads), so it is pinned instead.
- **D-07:** **Hybrid execution.** The developer personally performs the OS appearance change in System Settings; the agent handles surrounding instrumentation (cleared-storage assertion, frame capture, quoting `matchMedia('(prefers-color-scheme: dark)').matches` before and after). Mirrors Phase 24's R34 — the gesture the requirement calls human stays human, the parts automation does better stay automated. `osascript`-driven switching was considered and rejected for the recorded rows.
- **D-08:** The round runs against the **live production URL** `https://bacilo.github.io/strava-widgets/`, which as of the 2026-09-03 push finally serves current code. This is what criterion 5 asks for literally, and it exercises the real CDN, base path and caching. Hard-reload discipline is mandatory — this repo has a documented history of a stale cached `index.html` producing false evidence.

### CI-02 — Verifier assertion depth

- **D-09:** Each of the six documents must return **200, parse as JSON, and satisfy one cheap structural invariant** that a truncated or empty file would fail (non-empty array, expected top-level key, plausible count). A bare 200 would pass a zero-byte or `{}` file, which is a real failure mode for generated documents; full schema depth would duplicate what unit tests already own.
- **D-10:** The per-activity best-effort shard sample is **derived at runtime**, following the convention already established at `verify-dashboard-publish.mjs:430-455` (`newestRow` / `newestWithStream` / `newestWithoutStream`). No pinned ids to rot as the archive grows, and it implicitly cross-checks that the index and the shards agree about what exists.
- **D-11:** Every one of the six new assertions must be **observed RED once** before the phase closes — delete or truncate each document in a scratch `dist/widgets`, confirm `verify-dashboard` exits non-zero *naming that document*, restore, confirm green. Inherits Phase 24's D-11 precedent. GAP-24-02 existed precisely because a guard's blind spot was never observed failing.

### FIX-02 — Unknown-bucket hardening

- **D-12:** The Unknown-bucket test accepts **anything that is not a non-empty string** (`typeof label !== 'string' || label === ''`). Covers `null`, the absent key named in the requirement, malformed shapes a partially-written `index.json` can produce, and the empty string — which today slugifies to nothing and lands in the `'shoe'` fallback key rather than Unknown.
- **D-13:** The **type is made honest**: `gearName` becomes optional on the row type so `tsc` enumerates every consumer making the same presence assumption. The rows are parsed from `index.json` at runtime, where the required-key guarantee does not hold, which is why this defect looked impossible. **Bounded explicitly:** fix gear-aggregate plus anything trivially adjacent; if `tsc` surfaces more than a handful of sites, record the remainder as a todo rather than letting the phase grow.

### Claude's Discretion

- D-03's mandatory/tolerated split and the end-of-run failure summary were offered as defaults and accepted without further discussion.
- The exact flag spelling for D-02, the specific structural invariant chosen per document under D-09, and the shard sample size under D-10 are left to the planner.
- Todo folding was delegated ("you decide what's reasonable") — see Folded Todos and Reviewed Todos.

### Folded Todos

- **WR-19 — curation-guard directory EACCES** (`.planning/todos/pending/2026-09-02-wr19-curation-guard-directory-eacces.md`). `findCurationArtifacts`'s `readdirSync` (`scripts/lib/curation-guard.mjs:82-83`) is unguarded, so a mode-000 directory under `dist/widgets` throws an uncaught `EACCES` instead of a reported violation — the directory-shaped sibling of the file case plan 24-15 fixed. It fails **closed**, so publish-safety is intact; the cost is operator experience, reintroducing the unattributed `Widget build failed: EACCES` that 24-15 set out to replace. Folded because it is literally CI hardening, its fix shape is already specified (wrap the `readdirSync` in the same try/catch pattern 24-15 applied to `readFileSync`, plus a mode-000-directory fixture in `scripts/lib/curation-guard.test.mjs`), and it sits in the guard family this phase already touches. Per D-11's precedent the new fixture should be observed red.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition and requirements
- `.planning/ROADMAP.md` § "Phase 25: CI Hardening & Light-Theme Verification" — goal, five success criteria, the human-checkpoint clause
- `.planning/REQUIREMENTS.md` lines 53-56 — FIX-02, VER-01, CI-01, CI-02 verbatim; line 67 § "Verification Note" — the milestone-wide rule that every phase ends with a human browser checkpoint and that VER-01 specifically requires a light-OS environment rather than an in-page toggle
- `.planning/REQUIREMENTS.md` § "Out of Scope" — no analytics/computation changes beyond FIX-02; Garmin export adapter excluded

### CI-01 — compute chain
- `.github/workflows/daily-refresh.yml` — the eight compute steps, their `continue-on-error` dispositions and paired `::warning::` steps; the `paths` trigger list; the header comment explaining why the push trigger exists
- `src/index.ts:289-392` — `computeAllStatsCommand`, including the numbered "Chain ordering below is load-bearing" comment block at lines 329-340 that documents each step's dependency

### CI-02 — publish verifier
- `scripts/verify-dashboard-publish.mjs` — 494 lines; existing by-name assertions for `all-time-totals`, `streaks`, `training-load`, `age-grading`, `gear-aggregate`, and the runtime-derived activity/stream sampling at lines 430-455
- `scripts/build-widgets.mjs:141` — `{ src: 'data/stats', dest: 'dist/widgets/data/stats' }`, the whole-directory copy the six documents currently ride on

### FIX-02 — gear aggregate
- `src/analytics/gear-aggregate-logic.ts:146` — `const isUnknown = label === null;`, the defect site; `slugify` at lines 41-48
- `src/analytics/gear-aggregate-logic.test.ts:26` — the fixture that always sets `gearName: null` explicitly, which is why no existing case constructs the crashing shape
- `src/analytics/gear-naming.ts:21` — `UNKNOWN_GEAR_LABEL`

### VER-01 — theme engine
- `src/dashboard/theme.ts` — `THEME_STORAGE_KEY` (`:30`), `parseThemeMode` allow-list (`:41`), `resolveEffectiveTheme` (`:49`), first-paint resolution (`:117`), the `matchMedia` live-follow listener (`:167`)
- `src/dashboard/index.html` — the inline pre-paint theme bootstrap and its comment declaring the duplication deliberate and the allow-list load-bearing (T-16-TH-01)
- `src/dashboard/theme.test.ts` — 24 existing cases covering `theme.ts`; the parity pin under D-06 should sit alongside these
- `src/dashboard/styles.css:18` (`--bg: #ffffff`) and `:105` (`--bg: #1a1a2e`) — the two backgrounds that make D-05's argument
- `src/dashboard/styles.test.ts:780` — pins that `data-theme` is the only source of truth and no `prefers-color-scheme` query exists in the CSS

### Folded todo
- `.planning/todos/pending/2026-09-02-wr19-curation-guard-directory-eacces.md` — WR-19 finding, reproduction, and fix shape
- `scripts/lib/curation-guard.mjs:82-83` — the unguarded `readdirSync`

### Precedents this phase inherits
- `.planning/phases/24-local-curation-mode/24-VALIDATION.md` § "Round 4 Checkpoint (R32-R35)" — the reachability-proof pattern (assert the discriminator is reachable, HALT before presenting otherwise) and R34's human-hand native-gesture row
- `.planning/phases/24-local-curation-mode/24-CONTEXT.md` — D-11, the "a guard only counts once observed red" precedent

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`verify-dashboard-publish.mjs`'s `expect200` / `expect404` / `ok` / `fail` helpers** — the six new CI-02 assertions should be written in these, not new machinery; the file already reports "N check(s) passed, M failure(s)".
- **Runtime sample derivation (`:430-455`)** — `newestRow`, `newestWithStream`, `newestWithoutStream` already solve "pick a real activity without pinning an id"; D-10's shard sample extends this rather than inventing a scheme.
- **`theme.test.ts`'s table-style cases over `(mode, prefersDark)`** — D-06's parity pin can reuse the exact combination table, running it against the inline bootstrap's logic.
- **`curation-guard.test.mjs`'s five planted-fixture classes** (from plan 24-15) — WR-19's mode-000-directory fixture slots in beside them.

### Established Patterns
- **Guards are observed RED before they count** (Phase 24 D-11). Applies to CI-02's six assertions and to WR-19's new fixture.
- **Checkpoint rows assert reachable extent against an independently-derived value**, never internal agreement (Phase 23 CR-01, Phase 24 R32). D-04's quoted `null` storage read and D-05's dark-OS framing both exist to give VER-01's rows a real discriminator.
- **Duplicated derivations defeat checkpoints** (Phase 24 WR-17). The inline bootstrap is the live instance of this pattern in the theme layer; D-06 pins it because it cannot be deduplicated.
- **Load-bearing behaviour is documented inline in the file that owns it** — both `daily-refresh.yml` and `computeAllStatsCommand` carry long explanatory comments. D-01's collapsed step must carry that reasoning forward rather than dropping it.

### Integration Points
- `.github/workflows/daily-refresh.yml` — eight steps removed, one added; the `paths` trigger and the blocking `npm test` / `npm run verify-dashboard` gates are untouched.
- `src/index.ts` — `computeAllStatsCommand` gains the step table, the CI flag and the summary; the `compute-all-stats` case in the command switch is the entry point.
- `scripts/verify-dashboard-publish.mjs` — six new assertion blocks in the existing style.
- `src/analytics/gear-aggregate-logic.ts` + the row type it imports from `dashboard-index.types.ts` — D-12 and D-13.
- `src/dashboard/index.html` — read by a new test (currently read only by `build-widgets.mjs`).

</code_context>

<specifics>
## Specific Ideas

Three findings surfaced during scouting that shape the work, recorded here so planning does not rediscover them:

1. **The two compute orderings have already drifted.** `compute-all-stats` runs age-grading (step 5) *before* dashboard-index (step 6); `daily-refresh.yml` runs dashboard-index *before* age-grading. It is currently harmless — neither depends on the other, both only need `best-efforts.json` — but the code's own comment block declares an explicit numbered chain and the workflow silently contradicts it. CI-01 is not hypothetical drift; it has already happened, unnoticed.

2. **VER-01's first-paint flash row is unsatisfiable as worded.** See D-05. This is the same defect class as Phase 24's R19 and R26, where a row's own mandated setup emptied the discriminator it existed to test — caught here at discussion time rather than after two failed rounds.

3. **The inline theme bootstrap has zero test coverage.** See D-06. `theme.test.ts` covers `theme.ts` in 24 cases; nothing reads `src/dashboard/index.html` except `build-widgets.mjs`. The copy that actually decides what paints first is the untested one.

</specifics>

<deferred>
## Deferred Ideas

- **IN-17 and IN-18** (from the same wave-9 review as WR-19) — a non-regular entry matching `__curate`/`.curate-dist` yields two violation entries for one path; and the WR-17 literal-string pin in `curation-seam.test.ts:152-178` is more brittle than it needs to be. Both Info-level and cosmetic; they stay in `.planning/todos/pending/` rather than riding along with WR-19.
- **Overflow from D-13's triage** — if making `gearName` optional surfaces more than a handful of consumers, the remainder becomes a todo rather than expanding this phase.

### Reviewed Todos (not folded)

- **Garmin export adapter when export arrives** (`.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md`) — matched this phase on generic keywords only (`data`, `json`, `2026`). Not folded: it is blocked on the Strava export actually arriving, and `REQUIREMENTS.md` § "Out of Scope" lists it explicitly (STREAM-04). Stays pending.

</deferred>

---

*Phase: 25-CI Hardening & Light-Theme Verification*
*Context gathered: 2026-09-03*
