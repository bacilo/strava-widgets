---
phase: 28
slug: pr-plausibility-ceiling
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-17
---

# Phase 28 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|----------------|
| Local archive → derived ceiling | `compute-best-efforts.ts` Pass 2 derives `CEILING_K`/`CEILING_MIN_POPULATION`-based ceilings from the athlete's own already-filtered effort population | numeric speeds only, no external input |
| Owner curation file → pipeline | `data/best-effort-exclusions.json` (developer-editable via `curate-server.mjs`/`exclusion-cli.mjs`) feeds `excludedFromRecords` and, since CR-01, the ceiling-check sweep over excluded efforts | activity ids, distance keys, free-text reason |
| Archive shard (git-tracked/gitignored JSON) → committed markdown artifacts | `compute-pr-ceiling-calibration.mjs` / `compute-pr-ceiling-diff.mjs` render archive-derived activity ids and dates into `28-CEILING-CALIBRATION.md` / `28-DIFF.md`, committed to the repo | activity ids, start dates, durations, speeds (all already public in the dashboard) |
| Derived effort data → DOM | `records.ts`, `detail-sections.ts` render demotion reason strings and badges into the browser via `appendAccessibleBadge`/`textContent` | demotion reason strings, guard names, counts |
| CI workflow → `origin/master` | `.github/workflows/daily-refresh.yml`'s single `git-auto-commit-action` step commits the derived ceiling-state file and other nightly data | derived ceiling state (population, p90, ceiling, no secrets) |
| Developer CLI flags → local file reads | `compute-pr-ceiling-recount.mjs --expect-demoted/--expect-cohort` and `readShippedJson(path)` read operator-chosen local paths, read-only | local filesystem paths, JSON content |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-28-01-A | Denial of Service | `compute-pr-ceiling-calibration.mjs` `main()` | mitigate | Never-throwing catch, `process.exitCode = 1` | closed |
| T-28-01-B | Tampering | Archive-derived strings → committed markdown | mitigate | `VALID_ACTIVITY_ID = /^i?\d{1,20}$/`, non-matching ids render as `(malformed id)` | closed |
| T-28-01-C | Information Disclosure | Committed calibration artifact | accept | Only public dashboard data emitted | closed |
| T-28-01-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed | closed |
| T-28-02-A | Denial of Service | `buildBestEffortsPanelRows`, `countDemotedAtDistance` | mitigate | `!= null` / optional-chaining reads of `effort.demotion` | closed |
| T-28-02-B | Tampering | `prFlagBadgeSpecs` visible text | mitigate | Rendered via `textContent` only (verified in 28-04) | closed |
| T-28-02-C | Elevation of Privilege | Demotion as a write surface | mitigate | No setter/override/persistence path added; `resolveExcluded` unchanged | closed |
| T-28-02-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed | closed |
| T-28-03-A | Denial of Service | `deriveCeiling` on corrupted population | mitigate | Fail-open shape below floor; sorts a copy; verified at `src/analytics/best-effort-ceiling.ts:117-146` | closed |
| T-28-03-B | Tampering | Derived `ceilingMps` | mitigate | Signature admits only `(distance, populationSpeedsMps)` — verified | closed |
| T-28-03-C | Tampering | Reason string in shipped JSON | mitigate | `ceilingDemotion` (`best-effort-ceiling.ts:188-201`) interpolates only `toFixed` numerics, no caller text | closed |
| T-28-03-D | Repudiation | Undocumented constant change | mitigate | Doc comments cite `28-CEILING-CALIBRATION.md`; reason string test pins `CEILING_K` (`best-effort-ceiling.test.ts:74-79`) | closed |
| T-28-03-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed | closed |
| T-28-04-A | Tampering | Reason strings rendered into DOM | mitigate | `innerHTML` count in `records.ts` = 0 (verified); `appendAccessibleBadge` uses `textContent` | closed |
| T-28-04-B | Denial of Service | Stale shard missing `demotion` | mitigate | Defensive reads (T-28-02-A) reused | closed |
| T-28-04-C | Information Disclosure | Aria id collision | mitigate | `best-efforts-${row.distance}-${spec.descriptionIdSuffix}` at `detail-sections.ts:659` | closed |
| T-28-04-D | Elevation of Privilege | Rendered control that writes | mitigate | No `button`/`input`/`addEventListener` added by phase-28 commits `733d49d3`/`ba3da7f6` (verified via `git show`) | closed |
| T-28-04-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed, no DOM-simulation library | closed |
| T-28-05-A | Denial of Service | Per-activity loop in `computeBestEfforts` | mitigate | Pre-existing `try/catch` + `skippedUnreadable++` preserved (`compute-best-efforts.ts:157,228,276,326,330`) | closed |
| T-28-05-B | Tampering | Derived ceiling input | mitigate | Pass 2 built solely from `byDistance`; signature enforced | closed |
| T-28-05-C | Repudiation | Demoted effort with no reason | mitigate | `auditNoDemotedEffortRemoved` present and tested (`compute-best-efforts.test.ts:624-682`) | closed |
| T-28-05-D | Information Disclosure | Reason strings in shipped shards | accept | Only numbers already published; no path/token/private field interpolated | closed |
| T-28-05-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed | closed |
| T-28-06-A | Denial of Service | `loadCeilingState` parsing hand-edited/truncated file | mitigate | Total, never-throwing parse, `console.warn` fallback (`best-effort-ceiling-state.ts:75-167`) | closed |
| T-28-06-B | Tampering | Derived ceiling influenced by committed state file | mitigate | No source line contains both `previousState` and `deriveCeilings` (verified via grep) | closed |
| T-28-06-C | Denial of Service | CI push race against `origin/master` | mitigate | Conditional write (`ceilingMovement.length > 0` gate, `compute-best-efforts.ts:556-570`), rides single existing `git-auto-commit-action` step | closed |
| T-28-06-D | Denial of Service | Skip-CI token silently suppressing nightly run | mitigate | No new commit-message text added; `git show 810e68ff`/`ea0f651c` confirm no new `[skip ci]` line introduced by phase-28 workflow edits | closed |
| T-28-06-E | Repudiation | Ceiling moving with nobody seeing it | mitigate | `diffCeilingState`/`formatCeilingMovement` always print a movement section or "unchanged" line | closed |
| T-28-06-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed; `git-auto-commit-action` SHA `4a55954c782fc1ea30b9056cd3e7a2b40ca8887d` unchanged across both phase-28 workflow diffs | closed |
| T-28-07-A | Tampering | Dry run overwriting real derived state | mitigate | `main()` uses `os.tmpdir()`-derived `statsDir`/`ceilingStatePath` (`compute-pr-ceiling-diff.mjs:655-670`) | closed |
| T-28-07-B | Tampering | Archive-derived strings in committed markdown | mitigate | `safeActivityId`/`VALID_ACTIVITY_ID` + `safeCell` (newline/pipe stripping) at `compute-pr-ceiling-diff.mjs:75-90` | closed |
| T-28-07-C | Denial of Service | One unreadable stream aborting the sweep | mitigate | Reuses `computeBestEfforts`'s per-activity try/catch plus `main()`'s own catch | closed |
| T-28-07-D | Repudiation | Diff that cannot be reproduced | mitigate | No sign-off text in generated file (verified: zero matches); idempotence proven by 28-14 re-run | closed |
| T-28-07-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed | closed |
| T-28-08-A | Denial of Service | `readShippedJson` on missing/truncated document | mitigate | Returns `{ ok: false, reason }` (`compute-pr-ceiling-recount.mjs:107`); `main()` sets `process.exitCode = 1`. **Caveat:** two sibling functions (`recountImpossibleSampleCohort`, `computeCohortOverlap`) still throw uncaught on a JSON-`null` document — tracked as IN-08 in `28-REVIEW.md`, assessed non-blocking (advisory) by `28-VERIFICATION.md` since it does not defeat a named success criterion. See Unregistered Flags. | closed (with tracked residual gap, non-blocking) |
| T-28-08-B | Tampering | Verifier made to agree with classifier | mitigate | Zero-import guard confirmed: `compute-pr-ceiling-recount.mjs` imports only `fs`/`path`/`url`, no ceiling/compute/utils/types modules | closed |
| T-28-08-C | Spoofing | `--expect` used to manufacture a pass | mitigate | `--expect-demoted`/`--expect-cohort` only ever ADD a mismatch problem (`compute-pr-ceiling-recount.mjs:460,524`), never suppress a structural finding | closed |
| T-28-08-D | Repudiation | Schema drift silently absorbed | mitigate | `unrecognisedGuards`/`rowsMissingQuality`/`demotedWithoutReason` are named findings (`evaluateReport`, `:428-454`) | closed |
| T-28-08-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed; no `npm run build` chained | closed |
| T-28-09-A | Spoofing | Evidence gathered against stale build | mitigate | Served-digest verification recorded in `28-09-SUMMARY.md`/`28-VALIDATION.md`; digest re-confirmed 2026-09-16 | closed |
| T-28-09-B | Repudiation | Sign-off not naming what was reviewed | mitigate | D-14 sha256 binding recorded and re-hashed post-checkpoint | closed |
| T-28-09-C | Tampering | Row that agrees with itself | mitigate | Counts cross-checked against recount script / shipped shard | closed |
| T-28-09-D | Repudiation | Vacuous row recorded as pass | mitigate | CAN PASS/CAN FAIL lines + Reachability Audit; R4 recorded NOT EXERCISABLE, not silently dropped | closed |
| T-28-09-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed | closed |
| T-28-10-A | Tampering | Verifier that agrees with itself | mitigate | Zero ceiling/compute/utils/types imports (grep-verified); recomputes speed from `durationSec` independently | closed |
| T-28-10-B | Repudiation | Silently skipped check | mitigate | `evaluateReport` raises a problem when sweep did not run / `ceilings` missing / effort unevaluable / pinned fixture absent | closed |
| T-28-10-C | Information Disclosure / Tampering | Path flags | accept | Read-only `readFileSync`+`JSON.parse` of operator-chosen local path; nothing written | closed |
| T-28-10-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed | closed |
| T-28-11-A | Tampering | Ceiling derivation population | mitigate | Excluded efforts never enter `byDistance` (`compute-best-efforts.ts:410-417` sweep operates outside the Pass-1 accumulator) | closed |
| T-28-11-B | Tampering | Demotion overwrite | mitigate | Sweep only touches `demotion === null` (`compute-best-efforts.ts:412`) | closed |
| T-28-11-C | Repudiation | Nondeterministic rejected order | mitigate | `Object.keys(activities).sort((a,b) => a.localeCompare(b))` (`compute-best-efforts.ts:410,439`) | closed |
| T-28-11-D | Denial of Service | CI workflow edit | mitigate | Comment-only diff confirmed via `git show ea0f651c`; no skip-ci token added | closed |
| T-28-11-E | Elevation / Tampering | Deleted efforts | mitigate | `auditNoDemotedEffortRemoved` green; sweep only assigns `effort.demotion` field, never splices | closed |
| T-28-11-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed | closed |
| T-28-12-A | Tampering | New owner-excluded table | mitigate | Ids rendered through `safeActivityId`, numerics through `toFixed` (28-DIFF.md "Ceiling demotions on owner-excluded efforts" section) | closed |
| T-28-12-B | Repudiation | Sign-off embedded in generated file | mitigate | No sign-off text found in `compute-pr-ceiling-diff.mjs`/`compute-pr-ceiling-calibration.mjs` output (grep-verified) | closed |
| T-28-12-C | Tampering | Premature regeneration invalidating signed diff | mitigate | Generators' `main()` not invoked in 28-12; sha256/git-status acceptance criteria in `28-12-PLAN.md:170,244` | closed |
| T-28-12-D | Denial of Service | Temp dir leak | mitigate | `try { ... } finally { rmSync(tempDir, { recursive: true, force: true }) }` (`compute-pr-ceiling-diff.mjs:665-699`) | closed |
| T-28-12-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed | closed |
| T-28-13-A | Spoofing (misattribution) | Records demotion note | mitigate | Per-guard counts via `describeDemotionCounts` (`records-logic.ts`) | closed |
| T-28-13-B | Tampering | Stale shard without `demotion` | mitigate | `effort.demotion == null` guard kept (`records-logic.ts:195`) | closed |
| T-28-13-C | Repudiation | Owner intent merged into machine count | mitigate | Owner-excluded efforts skipped in count (D-10), `effort.excludedFromRecords` check present | closed |
| T-28-13-D | Denial of Service (accessibility) | Dark-theme badge contrast | mitigate | `--demoted-text` token + computed-contrast test (`styles.css:36,106,126`; `styles.test.ts:2445-2462`) | closed |
| T-28-13-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed | closed |
| T-28-14-A | Tampering | Archive drift between prediction and regeneration | mitigate | Blob pins + ceiling-state non-rewrite tripwires (`28-14-SUMMARY.md`); independently re-verified in `28-VERIFICATION.md` | closed |
| T-28-14-B | Repudiation | Self-agreeing reconciliation | mitigate | 31/31/31 three-way reconciliation independently reproduced by `28-VERIFICATION.md`'s own from-scratch sweep script | closed |
| T-28-14-C | Tampering | Hand-edited generated artifact | mitigate | Idempotence proven by repeated runs; `git checkout` restore path, never hand-edit | closed |
| T-28-14-D | Tampering | Fix touching more than intended | mitigate | Full pre/post structural comparison in `28-14-SUMMARY.md` | closed |
| T-28-14-SC | Tampering | npm/pip/cargo installs | mitigate | Zero packages installed | closed |
| T-28-15-A | Spoofing | Stale served bytes | mitigate | Source-vs-dist digest check, fetched-byte digest, cache-busting reload (`28-15-SUMMARY.md` Served digests section) | closed |
| T-28-15-B | Repudiation | Sign-off not bound to content | mitigate | D-14 sha256 recorded and re-hashed after checkpoint (`28-15-SUMMARY.md` PR-04 Sign-off) | closed |
| T-28-15-C | Tampering | Row blessing the defect | mitigate | Every row names pre-fix state as CAN FAIL; expected values re-derived without browser/`records-logic.ts` | closed |
| T-28-15-D | Repudiation | Blanket approval standing in for observations | mitigate | String/count rows without a quoted observation are BLOCKED per plan's house rule | closed |
| T-28-15-E | Tampering | Premature tick | mitigate | Ticks annotated "pending phase re-verification"; confirmed resolved by `28-VERIFICATION.md`'s independent re-derivation | closed |
| T-28-15-SC | Tampering | npm/pip/cargo installs | mitigate | `npx http-server` already in use; no new package added to `package.json` (confirmed: only 3 phase-28 commits touch `package.json`, all npm-script registrations only, `package-lock.json` untouched throughout phase 28) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|--------------|------|
| AR-28-01 | T-28-01-C | Committed calibration artifact contains only durations, speeds and activity ids already public in the shipped dashboard; no tokens, no paths outside the repo, no private athlete fields | plan-time threat model (phase 28) | 2026-09-17 |
| AR-28-02 | T-28-05-D | Reason strings interpolate only implied speeds, ceiling values and population sizes derived from data already published in the dashboard; no path, token, or private athlete field interpolated | plan-time threat model (phase 28) | 2026-09-17 |
| AR-28-03 | T-28-10-C | `readFileSync`+`JSON.parse` of an operator-chosen local path in a developer-only CLI; read-only, nothing written; failures return a named reason via `readShippedJson` | plan-time threat model (phase 28) | 2026-09-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|-----------------|--------|------|--------|
| 2026-09-17 | 75 | 75 | 0 | gsd-security-auditor |

---

## Unregistered Flags (WARNING, not blocking)

New attack-surface-adjacent findings surfaced by the phase's own code review (`28-REVIEW.md`) and verification (`28-VERIFICATION.md`) that have no corresponding threat ID in the plan-time register. None defeats a named ROADMAP success criterion; both source reports classify them as advisory/non-blocking. Recorded here per the adversarial-stance requirement to surface unmapped surface rather than let a clean "None" self-report in a SUMMARY.md stand in for it.

1. **WR-09 (`28-REVIEW.md`)** — Four new CR-01 regression tests in `compute-best-efforts.test.ts` (lines ~944-1197) depend on the live, owner-editable `data/best-effort-exclusions.json` without fully checking its contents (only one of four tests verifies its own premise). Because `npm test` blocks the nightly Pages deploy (`.github/workflows/daily-refresh.yml:199-200`), an ordinary curation edit (un-excluding an activity, or narrowing an exclusion's distance scope) could break these tests and silently stop the nightly deploy. This is a genuine DoS-adjacent operational risk with no mapped threat ID — the T-28-06/T-28-11 CI-DoS threats cover push races and skip-ci tokens, not test-gate fragility from curation-file edits. Not a phase-blocker per `28-VERIFICATION.md`'s assessment (currently green, future risk only); recommended follow-up: pin these four tests to a temp-file copy of the two relevant exclusion entries.
2. **IN-08 (`28-REVIEW.md`)** — `recountImpossibleSampleCohort(null)` and `computeCohortOverlap` in `compute-pr-ceiling-recount.mjs` (lines 345, 389) still throw an uncaught `TypeError` on a JSON document whose content is literally `null`, rather than surfacing a named `evaluateReport` problem the way `recountDemoted`/`recountCeilingSweep` do (IN-03's fix only covered those two). This is a narrower input shape than T-28-08-A's declared scope ("missing or truncated document") and is explicitly called out by the reviewer as a partial gap in "the T-28-08-A contract." Recorded here as the residual, not used to reopen T-28-08-A, which is closed for its declared scope. Recommended follow-up: `Array.isArray(indexDoc?.activities)` / `activities[activityId]?.efforts` guards, per the reviewer's own fix suggestion.
3. **28-01 through 28-08 SUMMARY.md files carry an explicit `## Threat Flags` section** (all report "None — surfaces match the register"). **28-09 through 28-15 SUMMARY.md files do not have this section at all** (confirmed by heading search across all six files) — these are checkpoint/gap-closure/verification plans whose SUMMARY.md structure differs (Served digests, Verdicts, Verbatim Evidence sections instead). This is a process-format observation, not a security gap: the equivalent self-report function for these six plans is instead performed by `28-REVIEW.md`'s code review and `28-VERIFICATION.md`'s independent re-derivation, both of which are more rigorous than a self-authored "None" flag would have been, and both were read and cross-checked for this audit.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-17
