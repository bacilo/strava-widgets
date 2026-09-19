# Phase 31: Tech-Debt Closure — Silent-Failure Guards & Docs Reconciliation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-19
**Phase:** 31-tech-debt-closure-silent-failure-guards-docs-reconciliation
**Areas discussed:** WR-09 test coupling strategy, copyJsonTree staleness fix, Fail-loud vs degrade policy, Docs + Nyquist backfill

---

## WR-09 test coupling strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fixture + one live premise check | Copy the two depended-on entries into a committed fixture; keep one test reading the real file that asserts only the premise, failing with a named message | ✓ |
| Keep the real file, guard every premise | All four tests keep reading the real file but assert preconditions first; still breaks npm test on a curation edit, legibly | |
| Fixture only, drop the live read | Nothing reads the real file; loses the "REAL committed exclusion" demonstration | |

**User's choice:** Fixture + one live premise check

| Option | Description | Selected |
|--------|-------------|----------|
| Fail loudly with instructions | Message names the entry and points at the fixture/premise to re-pin; nightly deploy goes red once, actionably | ✓ |
| Skip with a loud console warning | `it.skipIf(!premise)`; deploy stays green, coverage quietly stops | |
| Fail, but only in CI | Skip locally, fail under CI; two behaviours | |

**User's choice:** Fail loudly with instructions
**Notes:** Scouting found one of the four tests (`compute-best-efforts.test.ts:944`) already asserts its premise with a named message; the other three assume exact file contents.

---

## copyJsonTree staleness fix

Measured before asking: 7,580 JSON files / 186 MB; SHA-1 over the tree ≈1.4 s; unconditional copy ≈1.7 s; size-only stat ≈16 ms.

| Option | Description | Selected |
|--------|-------------|----------|
| Compare content: size, then digest | Copy on size mismatch; digest when sizes match; correct by construction, ~1.4 s worst case | ✓ |
| Always copy, delete the guard | ~1.7 s per local build, no skip logic; loses the skipped-count line | |
| Keep mtime, add --force for staging | Cheapest; trap stays armed for anyone who forgets | |

**User's choice:** Compare content: size, then digest

| Option | Description | Selected |
|--------|-------------|----------|
| Log replaced-but-same-size files | Print the path of every same-size/different-digest replacement; nothing extra on normal rebuilds | ✓ |
| Silent — correctness is enough | No extra output | |
| Also verify after copy | Re-digest destination after copy; +~1.4 s | |

**User's choice:** Log replaced-but-same-size files

---

## Fail-loud vs degrade policy

| Option | Description | Selected |
|--------|-------------|----------|
| Name it in the copy | Add an `other` bucket to the Records sentence ("… and 1 by another guard"); keep degrade discipline; negative test | ✓ |
| Throw / fail the build | Treat unknown guard as contract violation in records-logic and verify-dashboard-publish | |
| Leave the fold, add the test | Behaviour unchanged, just pinned | |

**User's choice:** Name it in the copy

| Option | Description | Selected |
|--------|-------------|----------|
| Recount fails closed; queue warns | Verifier exits non-zero naming malformed entries; queue skips them and renders an "N ignored (malformed)" line | ✓ |
| Make both skip identically | Shared parse helper imported by both — a verifier importing the code it checks | |
| Validate at write time only | Harden curate-server's write path; hand edits uncovered | |

**User's choice:** Recount fails closed; queue warns

| Option | Description | Selected |
|--------|-------------|----------|
| Always state the margin | 3 dp plus explicit "by X m/s"; archive regenerates; one re-sign | ✓ |
| Adaptive precision only | 2 dp normally, widen only on a tie; two formats | |
| You decide | Planner's choice within the D-09 register | |

**User's choice:** Always state the margin
**Notes:** Trigger case is `3475730418@1mi`, "implied 4.63 m/s exceeds personal ceiling 4.63 m/s", surfaced during the post-merge Round 3 sign-off.

---

## Docs + Nyquist backfill

Finding made during the area: 27 G-01 is already closed (plan 27-11); regenerating `27-CALIBRATION.md` today differs only by timestamp and archive growth (1,890 → 1,899). Dropped from scope.

| Option | Description | Selected |
|--------|-------------|----------|
| Regenerate all against the merged archive | Fix named generators, regenerate all five artifacts twice (idempotence), commit, re-sign 28-DIFF.md once | ✓ |
| Fix generators, regenerate only what the fix touches | 28-CEILING-CALIBRATION, 28-DIFF, 26-RESIDUAL only; 27/30 stay at 1,890 | |
| Fix generators only, regenerate nothing | Prove in temp paths; committed artifacts untouched | |

**User's choice:** Regenerate all against the merged archive

| Option | Description | Selected |
|--------|-------------|----------|
| Correct in place + dated note | Replace figure, append italic dated note naming the source record (Phase 30 D-04 / 26-RESIDUAL style) | ✓ |
| Plain in-place edit | Fix numbers, rely on git history | |
| Leave the text, add a corrections appendix | One Corrections section; wrong numbers stay in place | |

**User's choice:** Correct in place + dated note

| Option | Description | Selected |
|--------|-------------|----------|
| Run /gsd-validate-phase 26, 27, 29 first | Tool re-runs the named commands and flips rows on evidence before planning; leftovers become Phase 31 tasks | ✓ |
| Hand-reconcile inside Phase 31 | A plan re-runs each row's command and edits the tables | |
| Phase 29 only | Backfill only the pre-execution record | |

**User's choice:** Run /gsd-validate-phase 26, 27, 29 first

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| No — unrelated | Keyword false-positive; new capability | ✓ |
| Yes, fold it in | Widen the phase | |

**User's choice:** No — "Garmin export adapter when export arrives" left pending.

## Claude's Discretion

Fixture location/naming; digest algorithm and any size+mtime short-circuit; wording of the `other` bucket and the malformed-entries line; how WR-08's column is reconciled; plan/wave split; whether to end on a browser checkpoint.

## Deferred Ideas

None new — all out-of-scope items were already recorded in ROADMAP § Phase 31 and are re-affirmed in CONTEXT.md. 29 WR-01/WR-06 noted as optional hardening the planner may fold in.
