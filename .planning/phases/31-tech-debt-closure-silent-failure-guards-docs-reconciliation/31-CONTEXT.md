# Phase 31: Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation - Context

**Gathered:** 2026-09-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the v2.2 close-out audit's silent-and-passing findings at the source — each with a
demonstrated-failing test — and bring every artifact of record the milestone left behind into
agreement with both the code and the archive it now ships with (1,899 activities after the
2026-09-19 merge). No new capability, no new interactive surface, no threshold retune. The scope
list is `.planning/v2.2-MILESTONE-AUDIT.md` § tech_debt as narrowed by the decisions below; the
ROADMAP § Phase 31 "Out of scope" list is binding and is not re-litigated here.

Correction to the audit made during this discussion: **27 G-01 is already closed** (plan 27-11,
2026-09-10, fixed the generator; regenerating `27-CALIBRATION.md` today differs only by timestamp
and by archive growth). It is dropped from scope; the audit's tech_debt list should be amended in
this phase's docs pass.

</domain>

<decisions>
## Implementation Decisions

### WR-09 — the CR-01 regression tests' coupling to the live exclusions file
- **D-01:** **Fixture plus exactly one live premise check.** The two exclusion entries the four
  CR-01 tests depend on (`4556693525` all-distance, `3475711469` 400m-only) are copied into a
  committed test fixture, and all arithmetic assertions (`populationN`, negative-control speeds,
  demotion guards) run against that fixture. Exactly ONE test keeps reading the real
  `data/best-effort-exclusions.json`, and it asserts only the premise ("4556693525 is excluded
  all-distance"), preserving the "REAL committed exclusion" demonstration the CR-01 closure was
  built on without letting the file's other contents drive any number.
- **D-02:** **When that one live premise fails, the suite fails loudly with instructions** — the
  message names the entry and points at the fixture and premise to re-pin ("4556693525 is no
  longer excluded all-distance; if intentional, update <fixture path> and this premise"). No
  `skipIf`, no CI-only branch: a red nightly deploy for a reason a human can act on in one minute
  is preferred over a coverage hole nobody notices.
- **D-03:** Demonstrated-failing is mandatory for the decoupling itself: a test edits a *copy* of
  the fixture (never the real file) and shows the arithmetic assertions would have caught the
  change, so the fixture is not a silent second source of truth.

### copyJsonTree — `scripts/lib/copy-data-tree.mjs:41-48`
- **D-04:** **Replace the mtime skip with a content comparison: size first, then digest when sizes
  match.** Copy when either differs. Measured on the primary checkout: 7,580 files / 186 MB,
  full SHA-1 pass ≈1.4 s, unconditional copy ≈1.7 s, size-only stat ≈16 ms — the guard being
  replaced saved under two seconds. A doctored `dist/widgets/data/` file can no longer survive a
  `build-widgets`. CI behaviour (fresh checkout, full copy) is unchanged.
- **D-05:** **Make staleness visible:** when a same-size, different-digest destination is
  overwritten, the build prints the path (`replaced stale dist/widgets/data/<path>`). Ordinary
  rebuilds print nothing extra; the `copied/skipped` counts stay (now honest). No post-copy
  re-verification pass.
- **D-06:** Demonstrated failing: a test plants a same-size doctored destination newer than its
  source and proves the old rule would have skipped it and the new rule replaces it and logs it.

### Fail-loud vs degrade — three sites, decided per role
- **D-07 (`records-logic.ts:216`, display surface — degrade honestly):** an unrecognized
  `demotion.guard` is no longer folded silently. `DemotionCounts` gains an `other` bucket and
  `describeDemotionCounts` renders it in the fixed order after the three named guards ("… and 1
  by another guard"), so the on-screen total is never unexplained. The module keeps its
  degrade-rather-than-throw discipline; a negative test with a fabricated guard value pins the
  sentence.
- **D-08 (`scripts/compute-pr-ceiling-recount.mjs`, verifier — fail closed):** a malformed
  exclusions entry (duplicate `activityId`, non-string/empty `reason`, `__proto__` key,
  non-string id) makes the recount exit non-zero naming each offending entry, matching its
  existing treatment of malformed demotions. It still must not import the classifier or the queue
  code (D-15 of Phase 28 stands).
- **D-09 (`scripts/curate-queue/derive-flagged.mjs` + queue page, display surface — degrade
  visibly):** the queue keeps skipping malformed entries but reports how many it skipped, and the
  queue page renders a visible line ("N exclusion entries ignored (malformed)") next to the header
  counts so the count is never quietly short. Negative tests for both D-08 and D-09 use a planted
  malformed file, never the real one.
- **D-10 (`best-effort-ceiling.ts:200`, demotion reason):** **always state the margin.** The
  reason renders three decimals and an explicit margin: `implied 4.630 m/s exceeds personal
  ceiling 4.628 m/s by 0.002 m/s (1.28 x p90 3.616 m/s over 1851 filtered 1mi efforts)`. Existing
  tests matching `/exceeds personal ceiling/` keep passing; the shipped document's reason strings
  change on regeneration, which is expected and covered by the single re-sign in D-12.

### Docs reconciliation and generated artifacts
- **D-11:** **Fix the generators the audit names, then regenerate ALL five artifacts of record
  against the merged archive:** `26-RESIDUAL.md` (26 G-03 manifest miscount — reuse
  `isStreamFile()` from `compute-pace-quality-calibration.mjs` or an equivalent shared helper),
  `27-CALIBRATION.md` (generator already correct — regenerate for the archive only),
  `28-CEILING-CALIBRATION.md` (WR-07 hard-coded "400m shows the largest drift" prose replaced by a
  data-derived sentence; WR-08 "Demoted" column either labelled as non-excluded-only or extended
  with the excluded count so it reconciles with the pipeline's 32), `28-DIFF.md`, `30-CALIBRATION.md`.
  Each is regenerated twice and the second run must be byte-identical (idempotence), per the
  project's prose-corrections-revert lesson.
- **D-12:** **One PR-04 re-sign at the end of the phase** (D-14 of Phase 28: sign-off lives in
  `28-VALIDATION.md`, bound to the new sha256). The developer is shown the machine diff against
  the Round 3 signed version (`cdf9d654…`) before the verdict; expected content change is the
  reason-string format from D-10 plus any archive drift since 2026-09-19.
- **D-13:** **Hand-written stale figures are corrected in place with a dated italic note** (the
  Phase 30 D-04 / `26-RESIDUAL.md` house style): REQUIREMENTS.md PACE-06 "13 of the 154" → 14;
  ERA-02 and ROADMAP Phase 27 Criterion 5 "716 of 1,864 (38%)" → the live figure at regeneration
  time (663 of 1,890 at audit; re-measure on the merged archive); PR-03/04/05 "pending phase
  re-verification" wording → replaced by the 2026-09-17 re-verification reference; the audit's
  own tech_debt list amended for G-01 (closed). Each note names the source record (e.g.
  `27-VALIDATION.md` G-02).
- **D-14:** **Nyquist backfill runs BEFORE planning, via the tool, not by hand:**
  `/gsd-validate-phase 26`, `27`, `29` are run first (each committed separately). Whatever they
  leave red or cannot fill becomes an explicit Phase 31 task; Phase 31 itself does not hand-edit
  another phase's VALIDATION.md status table.
  **Done 2026-09-19, before planning** (commits `c5f0e1ef` 29, `faaf7c5e` 26, `4b89773f` 27):
  all three re-ran green; the only gap was Phase 26's PACE-04 row, whose `-t "histogram"` filter
  matched 0 tests (vacuous) — repointed to `detail-zones.test.ts -t "PACE-04"` (11 tests). Leftover
  for this phase: none beyond G-02, already in D-13; `27-VALIDATION.md` stays `status: partial`
  until D-13 lands, and the plan that closes G-02 must flip it to `passed`.

### Claude's Discretion
- Fixture location and naming for D-01 (e.g. `src/analytics/__fixtures__/…` vs. an inline
  constant), and whether the premise message links to the fixture by relative path.
- Digest algorithm for D-04 (SHA-1 vs. a faster non-cryptographic hash); whether to short-circuit
  on identical `size + mtime` before hashing as a pure optimisation, provided a same-size
  different-content file is still always replaced.
- Exact wording of the `other` bucket sentence (D-07) and the queue's malformed-entries line
  (D-09), within the Phase 27 D-09 register (named condition plus measured value).
- How WR-08's "Demoted" column is reconciled (relabel vs. extra column), as long as a reader can
  see why 18 ≠ 32 without leaving the page.
- Plan/wave breakdown; whether the docs pass is one plan or split by artifact; whether the phase
  ends on a human browser checkpoint (only the Records "other guard" sentence and the queue's
  malformed line are rendered surfaces, and both can be proven by unit text assertions plus a
  planted fixture — a browser round is optional, not required by the roadmap).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope source
- `.planning/v2.2-MILESTONE-AUDIT.md` — the close-out audit; § tech_debt is the item list, § MERGE-01 records the merged-archive figures (1,899 / 32 / 66 / 47 / 60 / 299)
- `.planning/ROADMAP.md` § Phase 31 — goal, six success criteria, binding "Out of scope" list

### Findings being closed
- `.planning/phases/28-pr-plausibility-ceiling/28-REVIEW.md` — WR-07, WR-08, WR-09 (calibration prose/column, test coupling)
- `.planning/phases/28-pr-plausibility-ceiling/28-VALIDATION.md` § PR-04 Sign-off (Round 3 — post-merge, D-14) — current signed hash `cdf9d654…`; the reason-margin observation; the re-sign convention D-12 follows
- `.planning/phases/28-pr-plausibility-ceiling/28-CONTEXT.md` — D-07 (committed ceiling state), D-10 (demotion is a separate field), D-13/D-14/D-15 (diff artifact, sign-off outside it, recount independence)
- `.planning/phases/29-curation-review-queue/29-REVIEW.md` — WR-02 (queue vs recount on malformed exclusions), WR-01/WR-06 latent items
- `.planning/phases/29-curation-review-queue/29-CONTEXT.md` — D-01 (all-guards queue population), D-14 (header counts), D-16 (the "matches exactly" cross-check)
- `.planning/phases/27-per-activity-quality-signals/27-VALIDATION.md` § Gap-Closure Record — G-01 (CLOSED by 27-11 — verify, do not re-fix), G-02 (stale no-device-name figure), G-03 (residual script manifest count)
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/deferred-items.md` — the `copyJsonTree` mtime-guard record (plan 26-16) and the F-26-02 / index-client items that stay out of scope
- `.planning/phases/26-shared-gap-aware-pace-derivation-honest-coverage/26-RESIDUAL.md` — the artifact of record for PACE-06 (14/154) and the "corrected <date>" note style D-13 copies

### Generators and their tests (regenerate-twice targets)
- `scripts/compute-pace-residual.mjs`, `scripts/compute-pace-quality-calibration.mjs` (`isStreamFile`), `scripts/compute-pr-ceiling-calibration.mjs`, `scripts/compute-pr-ceiling-diff.mjs`, `scripts/compute-elevation-calibration.mjs`, and each one's `*.test.mjs`
- `scripts/compute-pr-ceiling-recount.mjs` (D-08 target; `KNOWN_GUARDS`, `evaluateReport`), `scripts/compute-pace-quality-recount.mjs --expect 299`, `scripts/compute-elevation-recount.mjs`

### Project lessons that bind this phase
- `~/.claude/projects/-Users-pedf-workspace-strava-widgets/memory/` entries: prose corrections revert on regeneration (prove by idempotence), build-widgets mtime skip silently no-ops (verify served digest), skip-ci token in commit body, CI auto-commit push races (merge, never rebase)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isStreamFile()` in `scripts/compute-pace-quality-calibration.mjs:82` — the manifest-excluding filter G-01 introduced; D-11 reuses it (or lifts it to `scripts/lib/`) for `compute-pace-residual.mjs`.
- `evaluateReport` / `KNOWN_GUARDS` in `scripts/compute-pr-ceiling-recount.mjs:70,107-176` — already fails closed on malformed demotions with `{ ok: false, reason }`; D-08 extends the same pattern to exclusions.
- `buildExclusionReasonMap` in `scripts/curate-queue/derive-flagged.mjs:44-66` — already skips non-string ids/reasons and `__proto__`; D-09 adds a skipped-count return, not new parsing.
- `describeDemotionCounts` / `DemotionCounts` in `src/dashboard/views/records-logic.ts:198-227` — the fixed-order sentence builder D-07 extends; it already omits zero-count parts.
- `compute-best-efforts.test.ts:944-1000` — the one CR-01 test that already asserts its premise with a named message; D-01/D-02 generalise its shape and move the arithmetic to a fixture.

### Established Patterns
- Verifier scripts never import the classifier they check (Phase 27 D-?/Phase 28 D-15/Phase 30 recount) — D-08 must not break this.
- Generated artifacts carry `**Generated:**` timestamps and are proven idempotent by a double run; hand-corrections in generated prose are forbidden (27 G-01 history).
- Sign-offs live outside the generated file, bound to a sha256 (Phase 28 D-14) — D-12.
- Degrade-rather-than-throw in dashboard view logic; fail-closed in scripts that gate CI.

### Integration Points
- `scripts/build-widgets.mjs:233` — sole `copyJsonTree` call site; D-05's log line lands there or inside the helper.
- `src/dashboard/views/records.ts:592` — consumes `describeDemotionCounts`; no change needed if D-07 stays inside the sentence builder.
- `scripts/curate-queue/index.ts` header-count render — D-09's malformed line sits beside the D-14 (Phase 29) counts.
- `.github/workflows/daily-refresh.yml` — `npm test` gates deploy; D-02 deliberately lets a premise failure turn it red.

</code_context>

<specifics>
## Specific Ideas

- The margin wording should read naturally in the queue prefill and the detail badge as well as
  the JSON: "exceeds … by 0.002 m/s" — the developer's example case is `3475730418@1mi`
  (4.630 vs 4.628 m/s), which is also the record that changed hands in the Round 3 sign-off.
- The premise-failure message should be actionable in one minute: name the entry, name the file
  to edit, name the test.
- The staleness log line is modelled on the "verify served digest, not the build log" lesson —
  it exists so the next checkpoint plan can quote it.

</specifics>

<deferred>
## Deferred Ideas

- Re-affirmed out of scope (ROADMAP § Phase 31): 28 WR-06 opt-in ceiling-file write gate (D-07
  mechanism, developer decision), CUR-04 queue dismiss action, 26 F-26-02 histogram tails,
  30 WR-02/WR-03 badge wording, `index-client.ts` → `ParsedDashboardIndexRow` retype (v2.3
  candidate), 28 R2-6 per-ID confirmation of the 13 owner-excluded demotions.
- 29 WR-01 (HTML attribute injection from a malformed local `dist/widgets/index.html`) and
  WR-06 (`formatPace(undefined)` → `NaN:NaN/km`) were not discussed; the planner may fold them
  in as small hardening tasks if they fit a wave, but they are not success-criteria items.

### Reviewed Todos (not folded)
- "Garmin export adapter when export arrives" (`.planning/todos/pending/2026-08-10-garmin-export-adapter-when-export-arrives.md`) — keyword false-positive (`data`, `json`, `2026`); a new capability, unrelated to tech-debt closure. Left pending.

</deferred>

---

*Phase: 31-tech-debt-closure-silent-failure-guards-docs-reconciliation*
*Context gathered: 2026-09-19*
