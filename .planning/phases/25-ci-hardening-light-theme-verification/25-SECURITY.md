---
phase: 25
slug: ci-hardening-light-theme-verification
status: secured
threats_open: 0
asvs_level: 1
created: 2026-09-04
---

# Security Audit — Phase 25: CI Hardening / Light-Theme Verification

**Audited:** 2026-09-04
**Plans covered:** 25-01, 25-02, 25-03, 25-04, 25-05, 25-06, 25-07, 25-08, 25-09, 25-10, 25-11, 25-12
**Threats registered:** 45 (register authored at plan time, one `<threat_model>` block per plan)
**Threats closed:** 45/45
**Threats open:** 0/45 — T-25-43 was found OPEN during this audit and was REMEDIATED in-session (see Remediation Log)
**Unregistered attack surface:** none found. Only `25-11-SUMMARY.md` carries a `## Threat Flags` section; it reads "None. This plan's threat model already covered the trust boundary crossed (T-25-36 through T-25-40); no new surface was introduced." No other plan SUMMARY has a `## Threat Flags` section at all.

This document is the permanent security record for Phase 25. It was produced by re-verifying every declared mitigation directly against the implemented code, the workflow file, the test files, and the process-evidence artifacts (`25-VALIDATION.md`, `REQUIREMENTS.md`, `STATE.md`) — not by trusting plan/summary prose alone. Several threats in this phase (T-25-19, T-25-24, T-25-27, T-25-32, T-25-34, T-25-41-44) are themselves about evidence integrity; those were checked against the actual quoted values/row text in the cited artifact, not against a plan's own claim that the work was done.

---

## Verification Method

| Disposition | How it was checked |
|---|---|
| `mitigate` | Grep/read of the cited implementation file(s) for the actual control, or — for process/evidence-integrity threats — a direct read of the specific row/paragraph in `25-VALIDATION.md`, `REQUIREMENTS.md`, or a plan's `SUMMARY.md` that was supposed to carry the disclosure/quote. |
| `accept` | Confirmed no code control exists (by design) and recorded the risk in the Accepted Risks Log below — the log entry itself is what closes the threat, sourced from the plan's own documented risk-acceptance rationale. |

Checks executed live during this audit:
- `gear-aggregate-logic.ts` read directly from disk with NUL bytes stripped (git treats it as binary — known repo hazard) to grep both call sites of the Unknown-bucket predicate.
- `grep -c "dist/index.js compute-" .github/workflows/daily-refresh.yml` → `1`.
- `grep -n "mandatory" src/compute-all-stats-steps.test.ts` confirmed the mandatory-step-still-rejects test exists.
- `scripts/verify-dashboard-publish.mjs` read in full for the six by-name CI-02 assertions and the runtime-derived shard sampling logic.
- `scripts/lib/curation-guard.mjs` and `curation-guard.test.mjs` read for the readdirSync try/catch, the `return` after the violation push, and the mode-000 fixture teardown.
- `src/dashboard/index.html` and `theme-bootstrap-parity.test.ts` read for the allow-list, the structural pin added to close a Mutation B blind spot, and the six-combination behavioural parity tests against the real `resolveEffectiveTheme` import.
- `scripts/first-paint-capture.mjs` read for absence of `headless`/`setEmulatedMedia`.
- `git diff ced26e40^..HEAD --stat -- package.json package-lock.json` → empty (0 lines) — confirms `T-25-SC` across every plan in the phase.
- `.planning/phases/25-.../25-VALIDATION.md`, `REQUIREMENTS.md`, `STATE.md`, and every `25-NN-SUMMARY.md` read for the process/evidence-integrity threats (T-25-15 through T-25-22, T-25-27 through T-25-34, T-25-36 through T-25-44).
- `git log --oneline -- .planning/STATE.md` and `git show 00d65e0f -- .planning/STATE.md` — surfaced T-25-43's open finding (see below).

---

## Threat Verification

| Threat ID | Plan | Category | Component | Disposition | Status | Evidence |
|---|---|---|---|---|---|---|
| T-25-01 | 25-01 | Tampering (data integrity) | `gear-aggregate-logic.ts` Unknown-bucket predicate | mitigate | CLOSED | `src/analytics/gear-aggregate-logic.ts:152` (`buildGearAggregate`) and `:216` (`buildGearCoverage`) both use `typeof label !== 'string' \|\| label === ''` / `typeof label === 'string' && label !== ''` — the type-and-emptiness check at both call sites, replacing the old `=== null` identity check. |
| T-25-02 | 25-01 | Repudiation | `DashboardIndexRow` type contract | mitigate | CLOSED | `src/analytics/dashboard-index.types.ts:72` — `gearName?: string \| null;`. |
| T-25-03 | 25-02 | Repudiation | Collapsed compute step's logging | mitigate | CLOSED | `src/index.ts:303-324` — `console.log(\`> ${step.name}\`)` per step before it runs; `::warning::` emission lives in `runComputeAllStatsSteps` (`compute-all-stats-steps.ts`); a `DEGRADED STEPS (N)` block prints every degraded step's name after the success line, guarded by `if (degraded.length > 0)`. |
| T-25-04 | 25-02 | Tampering (config drift) | Two hand-maintained orderings | mitigate | CLOSED | `grep -c "dist/index.js compute-" .github/workflows/daily-refresh.yml` → `1`. `src/compute-all-stats-steps.ts` is the sole declaration; `compute-all-stats-steps.test.ts:39-46` pins the ordered array and rejects duplicates. |
| T-25-05 | 25-02 | Elevation-of-privilege-adjacent | `--ci` flag | mitigate | CLOSED | `compute-all-stats-steps.ts` walker: `if (step.mandatory \|\| !options.continueOnError) { throw error; }` — mandatory steps always rethrow regardless of the flag. Pinned by `compute-all-stats-steps.test.ts:147` ("continueOnError: true — a rejecting mandatory step still rejects and halts the walk"). |
| T-25-06 | 25-03 | Tampering (data integrity) | `verify-dashboard-publish.mjs` reachability checks | mitigate | CLOSED | `scripts/verify-dashboard-publish.mjs:429-560` — six by-name blocks (weekly-distance, monthly-stats, yearly-stats [each: non-empty array + typed field checks], year-over-year [`length === 12` literal at line 514], best-efforts.json [non-empty `activities`/`rankings` objects]). |
| T-25-07 | 25-03 | Repudiation | The new assertions themselves | mitigate | CLOSED | `25-03-SUMMARY.md` "D-11 RED observation log" — six independent break/observe/restore cycles, each failure line naming its own document (e.g. "expected an array of exactly 12 entries ... got an array of length 11"), all restored to `56/56` green before the next cycle. |
| T-25-08 | 25-03 | Tampering (sample rot) | Shard sample selection | mitigate | CLOSED | `verify-dashboard-publish.mjs:570-598` — `shardCandidates` filtered from `indexDoc.activities` to `streams.available === true` at runtime, first/middle/last sampled, `String(parsedShard.activityId) !== String(shardId)` cross-check present. |
| T-25-09 | 25-04 | Tampering / Repudiation | `walk()`'s unguarded `readdirSync` | mitigate | CLOSED | `scripts/lib/curation-guard.mjs` — `readdirSync` wrapped in try/catch; catch pushes `{ path: dir, reason: 'could not be listed (...)' }` and returns without descending. |
| T-25-10 | 25-04 | Elevation of privilege (fail-open regression) | The fix itself | mitigate | CLOSED | Same catch block ends in `return;` immediately after the push (never swallow-and-continue). `25-04-SUMMARY.md` "Fail-closed proof": a mode-000 directory planted under the REAL `dist/widgets` made `npm run build-widgets` exit 1 naming it (`REAL_EXIT_CODE=1`), and exit 0 clean after `chmod 0700` + cleanup. |
| T-25-11 | 25-04 | Denial of service (self-inflicted) | Mode-000 fixture teardown | mitigate | CLOSED | `curation-guard.test.mjs:197-206` — `afterEach` restores `chmodSync(mode000DirPath, 0o700)` before `fs.rm(..., { recursive: true })`. |
| T-25-12 | 25-05 | Tampering | Inline bootstrap's `localStorage` read (T-16-TH-01) | mitigate | CLOSED | `src/dashboard/index.html:42` — exact three-value allow-list, falls back to `'auto'`. `theme-bootstrap-parity.test.ts:174-176` adds a structural pin (`/raw === 'light'/`, `/raw === 'dark'/`, `/raw === 'auto'/`) added specifically after Mutation B produced zero observable behavioural change against a weakened allow-list — see Note below. |
| T-25-13 | 25-05 | Repudiation / silent divergence | Duplicated theme resolution | mitigate | CLOSED | `theme-bootstrap-parity.test.ts:96-131` — six `(mode, prefersDark)` cases, each asserting the sandboxed bootstrap's output against the real imported `resolveEffectiveTheme` (line 27 import), not copied literals. |
| T-25-15 | 25-06 | Repudiation | Cross-plan integration | mitigate | CLOSED | `25-06-SUMMARY.md` — three consecutive `npm test` runs on the merged tree, byte-identical tally (`62 passed (62)` files / `1596 passed (1596)` tests each). |
| T-25-16 | 25-06 | Tampering (stale evidence) | `gh workflow run` dispatch ordering | mitigate | CLOSED | `25-11-SUMMARY.md` "Push and pushed-copy verification": `git show origin/master:.github/workflows/daily-refresh.yml \| grep -c "compute-all-stats --ci"` → `0` before push, `1` after push — confirmed before any dispatch. |
| T-25-17 | 25-06 | Repudiation | Reporting a failed or clean run | mitigate | CLOSED | `25-11-SUMMARY.md` records the dispatched run's own data-commit-step race as "Observation, recorded not patched" and explicitly discloses no `DEGRADED STEPS` summary appeared ("absence not treated as failure, per D-03") rather than implying the degraded path was exercised. |
| T-25-18 | 25-06 | Tampering (history) | Push races with nightly auto-commit | mitigate | CLOSED | `25-11-SUMMARY.md` "Decisions Made": "Merged origin/master (not rebase) before pushing — three nightly CI auto-commits, zero conflicts". |
| T-25-19 | 25-07 | Repudiation (false evidence) | VER-01 checkpoint rows | mitigate | CLOSED | `25-VALIDATION.md` R1/R2/R3/R4/R7 all quote `localStorage.getItem('dashboard-theme')` at the instant of observation as `null`/`'auto'` (e.g. line 526 `'auto' — PASS-compatible class per D-04 as amended`); the D-04 amendment is disclosed in its own named section ("D-04 amendment disclosure", line 414+), not quietly applied. |
| T-25-20 | 25-07 | Repudiation (vacuous row) | First-paint flash row | mitigate | CLOSED | `25-VALIDATION.md` line 82 and the R2/R7 write-ups explicitly disclose the dark-OS deviation from criterion 4's literal wording as "D-05 — deliberate deviation ... which MUST be disclosed as such in the write-up, not quietly substituted." GAP-25-01 records the row initially BLOCKED (R2, post-paint frame) rather than a fabricated pass, closed later by R7. |
| T-25-21 | 25-07 | Tampering (stale artifact) | GitHub Pages cached `index.html` | mitigate | CLOSED | `25-VALIDATION.md` R5: hashed asset `index-D-Ts7X8C.js` matched across live DOM/served HTML/cache-busted refetch (SHA-256 `33fa42bd…37fa1`, byte length 3169 both) against `origin/gh-pages`. |
| T-25-22 | 25-07 | Repudiation (premature tick) | Requirement disposition | mitigate | CLOSED | `REQUIREMENTS.md` FIX-02/VER-01/CI-01/CI-02 entries: Round 1 withheld-and-reopened paragraphs (dated 2026-09-04) followed by Round 2 restore paragraphs, each naming the deciding row — ticks applied only after all mapped rows PASSED, per the all-rows-PASS rule. |
| T-25-23 | 25-08 | Spoofing (faked environment) | `scripts/first-paint-capture.mjs` | mitigate | CLOSED | `grep -n "headless\|setEmulatedMedia" scripts/first-paint-capture.mjs` → no matches. `matchMedia('(prefers-color-scheme: dark)').matches` read and logged (line 287, 540). |
| T-25-24 | 25-08 | Tampering (verifier lies) | Capture harness as evidence producer | mitigate | CLOSED | `25-08-SUMMARY.md` Part B negative control: stripped-bootstrap copy sampled `rgb(255, 255, 255)`, intact copy sampled dark — "Bidirectional proof obtained; the mechanism is not vacuous (T-25-24 mitigated)." |
| T-25-25 | 25-08 | Information disclosure | `--remote-debugging-port` on 127.0.0.1 | accept | CLOSED | See Accepted Risks Log #1. |
| T-25-26 | 25-08 | Elevation of privilege / supply chain | New capture dependency | mitigate | CLOSED | `first-paint-capture.mjs:13` — Node built-in `WebSocket`/`fetch` only. `git diff ced26e40^..HEAD --stat -- package.json package-lock.json` empty. |
| T-25-SC | 25-08/09/10/11/12 | Tampering | npm/pip/cargo installs | mitigate | CLOSED | `git diff ced26e40^..HEAD --stat -- package.json package-lock.json` empty across the entire phase commit range — one check closes all five recurring instances. |
| T-25-27 | 25-09 | Repudiation (row redesigned to yield a tick) | R6a/R6b/R6c split | mitigate | CLOSED | `25-VALIDATION.md` line 794-795 records the split was drafted in plan 25-09 and committed before plans 25-10/25-11 ran anything (preamble states an unsatisfiable row is HALTED and gapped, never edited after its outcome is seen). |
| T-25-28 | 25-09 | Repudiation (vacuous row) | R7 and R6c | mitigate | CLOSED | `25-VALIDATION.md` lines 1144, 1465, 1566, 1671 — each row's CAN FAIL paragraph cites concrete prior evidence (D-11 RED log quotes, the currently-0 `--ci` grep). |
| T-25-29 | 25-09 | Repudiation (unpassable row) | R7 | mitigate | CLOSED | `25-VALIDATION.md` line 1152 — R7's CAN PASS paragraph cites plan 25-08 Part A's production runs by run id. |
| T-25-30 | 25-09 | Tampering (internal-agreement evidence) | R6b and R6c | mitigate | CLOSED | R6b cites the six D-09/D-10 document names independently; R6c cites all eight `COMPUTE_ALL_STATS_STEPS` names "enumerated from `src/compute-all-stats-steps.ts`, not read off the log" (`25-11-SUMMARY.md`). |
| T-25-31 | 25-10 | Spoofing (simulated OS state) | R7's dark-OS precondition | mitigate | CLOSED | `25-VALIDATION.md` lines 1111, 1233, 1345 — `defaults read -g AppleInterfaceStyle` quoted `Dark` before/after; `matchMedia(...).matches` quoted `true`; no `osascript`, no `Emulation.setEmulatedMedia` (explicitly disclaimed at lines 1401, 1417, 1838). |
| T-25-32 | 25-10 | Repudiation (false attribution of a frame) | R7's captured frame | mitigate | CLOSED | `25-VALIDATION.md` line 1260+ — `performance.timeOrigin` `1788532205772.8`, `firstPaintStartTime` `4036 ms`, frame at `4024.1 ms` since navigation — `11.9 ms` before first paint, tied to the navigation's own timeOrigin, not wall-clock proximity. |
| T-25-33 | 25-10 | Tampering (stale artifact) | The served `index.html` | mitigate | CLOSED | `25-VALIDATION.md` line 1293/1365 — hashed asset SHA-256 byte-identical across captured document and a cache-busted refetch, independently derived from `origin/gh-pages`. |
| T-25-34 | 25-10 | Repudiation (row edited to yield a tick) | R7 as drafted vs. as run | mitigate | CLOSED | `25-VALIDATION.md` line 1428 — "byte-identical to `ROW_BASELINE_SHA` `bf9d1a139fae3563e431981709f3fb0883a9d7ee`. R7 was run exactly [as drafted]." |
| T-25-35 | 25-10 | Information disclosure | CDP debugging port during the run | accept | CLOSED | See Accepted Risks Log #2. |
| T-25-36 | 25-11 | Elevation of privilege (unauthorised production action) | `git push origin master` / `gh workflow run` | mitigate | CLOSED | `25-11-SUMMARY.md` "Authorisation" section — blocking checkpoint stated both side effects ("Wave 8 (plan 25-11) requires pushing to origin/master, which starts a live production run..."), developer's verbatim selection recorded before Task 3 executed. |
| T-25-37 | 25-11 | Repudiation (unverified premise) | GAP-25-02 clause 1 | mitigate | CLOSED | `25-11-SUMMARY.md` — `git show origin/master:...` grep returns `0` before push, `1` after; same check as T-25-16, confirmed against the pushed copy not the local working copy. |
| T-25-38 | 25-11 | Tampering (circular log reading) | GAP-25-02 clause 3 | mitigate | CLOSED | `25-11-SUMMARY.md` "Dispatched run" — all eight step names enumerated from `src/compute-all-stats-steps.ts:68-166` and matched against the log in that direction; no `DEGRADED STEPS` summary present, explicitly not read as a defect (D-03). |
| T-25-39 | 25-11 | Repudiation (cross-contaminated verdicts) | R6a / R6b / R6c | mitigate | CLOSED | `25-11-SUMMARY.md` "Row Baseline Integrity" — `git diff` against `ROW_BASELINE_SHA` shows zero `-`/`+` lines inside any row's DISCRIMINATOR/EXTENT/CAN FAIL/CAN PASS paragraphs; only verdict-line replacements. |
| T-25-40 | 25-11 | Denial of service (self-inflicted) | The live Pages site | accept | CLOSED | See Accepted Risks Log #3. |
| T-25-41 | 25-12 | Repudiation (premature tick) | Four requirement dispositions | mitigate | CLOSED | `REQUIREMENTS.md` — all four dated Round 2 paragraphs quote the deciding row's evidence and are appended below (not replacing) the Round 1 withhold paragraphs. |
| T-25-42 | 25-12 | Tampering (silent count corruption) | `STATE.md` frontmatter `progress` | mitigate | CLOSED | `25-12-SUMMARY.md` "STATE.md hand-verification": `total_plans`/`completed_plans` hand-summed against the ROADMAP per-phase table (19+20+8+16+13+17+12=103 both fields), quoted in the SUMMARY. Current `STATE.md` frontmatter reads `total_plans: 103` / `completed_plans: 103`, matching. |
| T-25-43 | 25-12 | Tampering (truncated status block) | `STATE.md` `## Current Position` | mitigate | CLOSED | Found OPEN; remediated in-session — `.planning/STATE.md:30-58` now carries a coherent `Plan:`/`Status:` pair plus a repair disclosure citing `00d65e0f`. See "Open Threat Detail" and "Remediation Log". |
| T-25-44 | 25-12 | Repudiation (missing disclosure) | Round's disclosure obligations | mitigate | CLOSED | `25-12-SUMMARY.md` "Disclosure audit" — D-04 amendment, D-05 dark-OS deviation, and R7's slowed-load disclosure all explicitly checked "present" with a cited section name each. |

**Totals: 44/45 CLOSED, 1/45 OPEN.**

---

## Open Threat Detail (resolved in-session)

### T-25-43 (25-12) — `STATE.md`'s `## Current Position` block IS currently truncated, uncorrected

**Declared mitigation:** "If `state.planned-phase` ran, only the first line of `Status` survives; the task requires repairing the rest by hand and disclosing that it was repaired."

**What was found:** `.planning/STATE.md` on disk right now (as of this audit) shows exactly the documented corruption pattern:

```
Phase: 25
Plan: Not started
      one row per requirement. All four rows PASSED — R7 (VER-01), R6a (FIX-02), R6b (CI-02), R6c
      ...
Status: Milestone complete
      yet run)
```

`Plan: Not started` is immediately followed by orphaned continuation text that belongs to a different, longer sentence, and `Status: Milestone complete` is immediately followed by a dangling fragment `yet run)` — the tail of a sentence whose head no longer exists. `git show 00d65e0f -- .planning/STATE.md` confirms the mechanism: the pre-existing, correctly-written 25-12 values (`Plan: 12 of 12 executed (25-12 done: ...` and `Status: Awaiting orchestrator phase-gate decision (requirements ticked; \`/gsd-verify-work 25\` not`) were overwritten down to their first line only (`Plan: Not started`, `Status: Milestone complete`) by a subsequent commit, `00d65e0f "docs(phase-25): complete phase execution"` — the orchestrator's own phase-gate-closure tooling call, made ~20 minutes after `25-12-SUMMARY.md` was written and self-checked. `25-12-SUMMARY.md`'s own claim ("No tooling hazard fired ... neither of the two documented hazards ... had an opportunity to fire") was true at the moment plan 25-12 finished, but is now contradicted by the current state of the file: the hazard fired in a later, out-of-plan orchestrator commit, and the required by-hand repair + disclosure never happened.

**Why this is a BLOCKER, not a documentation nit:** the threat this row exists to police is exactly "a reader who assumes `STATE.md`'s Status block is trustworthy" (per 25-12's own Trust Boundaries table: "GSD tooling -> `STATE.md` frontmatter | Two documented tools corrupt milestone-scoped counts or truncate the Status block"). The file is the canonical machine-readable pointer to project state; it is currently self-contradictory (`status: milestone_complete` in frontmatter vs. a body that still narrates "Awaiting orchestrator phase-gate decision" content with its own field label stripped) and would mislead the next reader or tool that parses `## Current Position` expecting a coherent `Plan:`/`Status:` pair.

**Files searched:** `.planning/STATE.md` (current), `git log --oneline -- .planning/STATE.md`, `git show 00d65e0f -- .planning/STATE.md`.

**Status: CLOSED — remediated in this audit session (2026-09-04).** See the Remediation Log below.

**What closed it:** hand-repair `.planning/STATE.md`'s `## Current Position` block so `Plan:` and `Status:` each carry one coherent value (or the full intended multi-line value with continuation clearly attached to the correct field), and add a disclosure line noting the repair and citing commit `00d65e0f` as the corrupting commit — mirroring the exact remediation T-25-43's own mitigation plan already specifies. This is a documentation-only repair; no `src/`, `scripts/`, or `.github/` file is implicated.

---

## Remediation Log

### T-25-43 — closed 2026-09-04 during `/gsd-secure-phase 25`

The audit found this threat OPEN. With developer authorisation it was remediated in-session rather than deferred, because the fix is documentation-only and touches no `src/`, `scripts/`, `.github/`, or `data/` file.

**Independently re-confirmed before repairing.** The orchestrator re-ran `git show 00d65e0f -- .planning/STATE.md` and re-read the live file rather than accepting the auditor's report at face value. The diff shows the corrupting hunk directly: `-Plan: 12 of 12 executed (25-12 done: Round 2 disposition set under the all-rows-` / `+Plan: Not started`, and `-Status: Awaiting orchestrator phase-gate decision (requirements ticked; \`/gsd-verify-work 25\` not` / `+Status: Milestone complete`, with both continuation blocks left untouched and therefore orphaned.

**Repair applied to `.planning/STATE.md` (lines 30-58):**
1. `Phase:` restored to `Phase: 25 (ci-hardening-light-theme-verification) — COMPLETE`.
2. `Plan:` rewritten as one coherent multi-line value: 12 of 12 executed, all four Round 2 rows PASSED, GAP-25-01/GAP-25-02 CLOSED, requirements ticked.
3. `Status:` rewritten as one coherent multi-line value: milestone complete, v2.1 closed, Phase 25 final. The dangling `yet run)` fragment is gone.
4. A dated **Repair disclosure** paragraph added inside the block, naming `00d65e0f` as the corrupting commit, naming T-25-43, and stating that the corruption landed ~20 minutes after plan 25-12 finished — which is why 25-12's own by-hand-repair obligation never fired.

**Two stale claims the corruption had frozen were also corrected, and the correction is disclosed in the file itself:**
- The old text asserted `/gsd-verify-work` had NEVER run and no `25-VERIFICATION.md` existed. Both are now false — `25-VERIFICATION.md` exists, `verified: 2026-09-04T20:40:00Z`, `status: passed`, 4/4 must-haves.
- The old text asserted `completed_phases` "stays at 6 pending that orchestrator step". The frontmatter reads `completed_phases: 7`; the orchestrator step has since run.

**Not modified by this repair:** every frontmatter counter (`total_phases: 7`, `completed_phases: 7`, `total_plans: 103`, `completed_plans: 103`, `percent: 86`) was left exactly as found. T-25-42 — the sibling threat covering counter corruption — was verified CLOSED independently and this repair does not disturb its evidence.

**Post-repair state:** `threats_open: 0`. All 45 registered threats now carry a disposition — 41 mitigations verified present, 4 risks accepted and logged.

---

## Unregistered Flags

None. Checked all twelve `25-NN-SUMMARY.md` files for a `## Threat Flags` section; only `25-11-SUMMARY.md` has one, and it explicitly maps back to already-registered threats (T-25-36 through T-25-40) with no new surface claimed.

---

## Accepted Risks Log

### 1. T-25-25 — Information disclosure via `--remote-debugging-port` on 127.0.0.1 (plan 25-08)
**Category:** Information Disclosure
**Disposition:** accept
**Rationale:** CDP grants full control of the browser to anything that can reach the port, but the port is loopback-bound, ephemeral, torn down with the process, and the `--user-data-dir` is a throwaway profile carrying no credentials or site data. Same risk posture already accepted for `npm run curate`'s localhost server.
**Verified:** `scripts/first-paint-capture.mjs:240-241` — `--remote-debugging-port=${port}` and `--user-data-dir=${userDataDir}` (a per-run temp directory), no `0.0.0.0` or externally-reachable bind found.

### 2. T-25-35 — Information disclosure via CDP debugging port during the R7 run (plan 25-10)
**Category:** Information Disclosure
**Disposition:** accept
**Rationale:** Identical posture to #1 above, applied to the specific R7 production capture run: loopback-bound ephemeral port, throwaway profile, no credentials, torn down with the process.
**Verified:** `25-VALIDATION.md`'s R7 evidence block describes the same harness/mechanism as plan 25-08; no persistent listening surface or credential exposure identified.

### 3. T-25-40 — Denial of service (self-inflicted) via the live Pages site during push+dispatch (plan 25-11)
**Category:** Denial of Service
**Disposition:** accept
**Rationale:** The workflow's own blocking `npm test` and `npm run verify-dashboard` steps run on the CI runner before the deploy step, and Task 1's local five-command gate already passed on exactly the commit being pushed. Residual risk of a mid-flight production state on failure is accepted explicitly by the Task 2 authorisation; a failing run is recorded as a finding rather than silently patched.
**Verified:** `25-11-SUMMARY.md` "Authorisation" section records the explicit developer sign-off citing both production side effects before the push; the git-race finding in the dispatched run's data-commit step was recorded, not patched, consistent with this acceptance.

### 4. T-25-14 — Tampering (test-harness) via `vm.runInContext` executing extracted script text (plan 25-05)
**Category:** Tampering
**Disposition:** accept
**Rationale:** The extracted text is first-party repo source read from a fixed relative path (`new URL('./index.html', import.meta.url)`), not untrusted input, and `vm.createContext` gives it its own global object. The alternative (jsdom) would add a dependency this repo has deliberately avoided.
**Verified:** `src/dashboard/theme-bootstrap-parity.test.ts:29` — `readFileSync(new URL('./index.html', import.meta.url), 'utf8')`, a fixed same-repo relative path; `git diff ced26e40^..HEAD --stat -- package.json package-lock.json` confirms zero new dependency was added instead.

---

## Residual Observations (non-blocking, informational)

- `25-06-SUMMARY.md` documents that Task 2 (a real `gh workflow run` dispatch) was deliberately NOT executed from within an isolated worktree, because `daily-refresh.yml`'s deploy/commit steps carry no branch guard — recorded as a blocked gap rather than attempted under pressure or faked. This is the correct, conservative behavior the threat model (T-25-16/T-25-36) exists to enforce, and the dispatch was later completed safely from the main checkout in plan 25-11 with explicit authorization.
- The dispatched run in plan 25-11 (`33903407761`) experienced a genuine, disclosed, non-security git race in its own data-commit step (stale checked-out ref vs. a concurrent push-triggered run's auto-commit) — recorded as a finding per house rule, not a defect this audit needs to reopen; it does not affect any of the 45 registered threats' dispositions.

---

SECURITY.md: `.planning/phases/25-ci-hardening-light-theme-verification/25-SECURITY.md`

---

## Security Audit 2026-09-04

| Metric | Count |
|--------|-------|
| Threats found | 45 |
| Closed | 45 |
| Open | 0 |

**Register origin:** authored at plan time — all twelve `25-NN-PLAN.md` files carry a parseable `<threat_model>` block. Auditor ran in verify-only mode (verify declared mitigations exist); no retroactive STRIDE scan was performed and no new threats were introduced.

**Breakdown:** 41 `mitigate` (verified present in code or in the process-evidence artifact that was supposed to carry the disclosure), 4 `accept` (T-25-14, T-25-25, T-25-35, T-25-40 — logged in Accepted Risks). `T-25-SC` recurs across five plans (25-08 through 25-12) as one supply-chain row and is counted once.

**Course of the audit:** 44 closed on first pass; T-25-43 returned OPEN, was independently re-confirmed by the orchestrator against `git show 00d65e0f`, and was remediated in-session with developer authorisation. See Remediation Log.
