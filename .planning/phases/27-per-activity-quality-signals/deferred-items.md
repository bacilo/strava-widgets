# Deferred Items

## Plan 27-01: pre-existing `npm run test` failures, out of scope

Observed when running the full suite (`npm run test`) after completing plan 27-01's Task 3.
None of these 8 failing files are touched by this plan (`src/analytics/pace-quality.ts`,
`pace-quality.test.ts`, `pace-fixtures.ts`, `pace-fixtures.test.ts`), and none were introduced
by this plan's changes — confirmed by checking the failure causes below, all of which are
this worktree's environment state, not code defects.

| File | Cause |
|---|---|
| `scripts/compute-pace-residual.test.mjs` | reads a gitignored, derived `data/stats/` output never generated in this fresh worktree |
| `scripts/verify-dashboard-publish-stats.test.mjs` | same — gitignored derived output absent |
| `src/dashboard/views/records-logic.test.ts` | `ENOENT: data/stats/best-efforts.json` — gitignored, never generated locally |
| `src/dashboard/views/trends-cadence-hr-logic.test.ts` | `ENOENT: data/dashboard/index.json` — gitignored, never generated locally |
| `src/dashboard/views/trends-gear-logic.test.ts` | `ENOENT: data/stats/gear-aggregate.json` — gitignored, never generated locally |
| `src/dashboard/views/trends-training-load-logic.test.ts` | `ENOENT: data/stats/training-load.json` — gitignored, never generated locally |
| `src/dashboard/views/trends-yoy-logic.test.ts` | `ENOENT: data/stats/year-over-year.json` — gitignored, never generated locally |
| `src/dashboard/views/trends-zoom-logic.test.ts` | `ENOENT: node_modules/chartjs-plugin-zoom/dist/...` — this worktree's own `node_modules/` was created empty; Node module resolution silently falls back to the parent repo's `node_modules/` for `import` specifiers, but this test reads the package file via a relative `fs` path from `__dirname`, which resolves inside the worktree's own (empty) `node_modules/` and fails |

Root cause for the last six: this worktree's dependency install never ran (`node_modules/`
directory exists but is empty — 0 entries) and the CI compute pipeline
(`npm run process` / `compute-all-stats`) never ran to produce `data/stats/*.json` and
`data/dashboard/index.json`. Both are outside this plan's scope (interface-first, pure
TypeScript, no I/O) and outside the deviation rules' auto-fix boundary (running the full
compute pipeline touches dozens of unrelated files and activity data; a fresh `npm install`
is excluded from Rule 3's auto-fix scope by policy).

Everything this plan actually modifies passes cleanly:
```
npx tsc --noEmit                                                         # 0 errors
npx vitest run src/analytics/pace-quality.test.ts src/analytics/pace-fixtures.test.ts
# 55 tests passed (2 files)
```

## Plan 27-07: the same `data/dashboard/index.json` gap, newly EXPOSED (not caused) by Task 3

Task 3's own mandated verification step (`npm run build-widgets`) creates `dist/widgets/index.html`
for the first time in this worktree. That un-skips
`scripts/verify-dashboard-publish-guard.test.mjs`'s `describe.skipIf(!existsSync(INDEX_HTML))`
block — on a fresh worktree that has never run `build-widgets`, this file was previously
SKIPPED (0 tests, not a failure), so it never appeared in the 27-01 table above. Now that the
describe block runs for real, it invokes the real `scripts/verify-dashboard-publish.mjs` as a
subprocess, which correctly FATALs with `Missing: dist/widgets/data/dashboard/index.json` — the
exact same root cause already documented above (`compute-dashboard-index` / the CI compute
pipeline never ran in this worktree, so `data/dashboard/index.json` does not exist to be
copied into `dist/widgets/`). 4 of the file's 5 tests fail on this FATAL message instead of
reaching their planted-fixture assertions; the 1 passing test (Case A's clean-baseline half)
still exercises the guard far enough to confirm the verifier itself runs.

Not fixed, per the same policy as 27-01: running the full compute pipeline to produce
`data/dashboard/index.json` locally is outside this plan's scope (it touches dozens of
unrelated files and activity data) and outside the deviation rules' auto-fix boundary.

This plan's own targets are fully green:
```
npx tsc --noEmit                                                              # 0 errors
npx vitest run src/dashboard/views/list.test.ts src/dashboard/views/overview.test.ts \
  src/dashboard/views/detail-sections.test.ts                                 # 201/201 passed
npm run build-widgets                                                        # exit 0, 0 css-syntax-error
grep -o "badge--severe[^}]*}" dist/widgets/assets/index-*.css
# badge--severe{color:var(--destructive);border-color:var(--destructive)}
```
