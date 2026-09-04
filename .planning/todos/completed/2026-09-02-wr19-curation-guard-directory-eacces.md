---
created: 2026-09-02
source: 24-REVIEW.md § Wave 9 Review (WR-19)
severity: warning
area: scripts/lib/curation-guard.mjs
---

# WR-19: unreadable directory throws uncaught EACCES out of the curation guard

`findCurationArtifacts`'s `readdirSync` at `scripts/lib/curation-guard.mjs:82-83` is unguarded,
so a mode-000 directory under `dist/widgets` throws an uncaught `EACCES` instead of being
reported as an attributed violation. This is the directory-shaped sibling of WR-14, which plan
24-15 fixed for individual file entries only.

**Reproduced independently twice** — by the wave-9 code reviewer and again by the phase verifier,
each with a planted mode-000 directory fixture (`THREW: EACCES: permission denied, scandir ...`).

**Not a publish-safety hole:** it fails CLOSED — the build still aborts via `process.exit(1)`, so
nothing unsafe can ship. The cost is operator experience: it reintroduces the same unattributed
crash (`Widget build failed: EACCES`) that 24-15 set out to replace with
`✗ Curation-artifact guard failed: <path>`.

**Fix shape:** wrap the `readdirSync` in the same try/catch pattern 24-15 applied to
`readFileSync`, converting the throw into a reported violation, and add a mode-000-directory
fixture to `scripts/lib/curation-guard.test.mjs` alongside the five classes 24-15 already covers.

## Closed 2026-09-04 (plan 25-04)

Fixed by plan `25-04`. `walk()`'s `readdirSync(dir, { withFileTypes: true })` at
`scripts/lib/curation-guard.mjs:82-83` (pre-fix line numbers) is now hoisted out of the
`for...of` header into a guarded assignment (commit `b20af51a`):

```
let entries;
try {
  entries = readdirSync(dir, { withFileTypes: true });
} catch (error) {
  violations.push({
    path: dir,
    reason: `could not be listed (${error.code ?? error.message}) — an unreadable directory cannot be certified free of the "${CURATE_MARKER}" marker`,
  });
  return;
}
```

The catch pushes a violation naming the directory and returns without descending — the guard
stays fail-closed, mirroring the existing `readFileSync` catch's shape and wording.

New fixture: `scripts/lib/curation-guard.test.mjs`, case
`'(f) mode-000 directory: reported via the readdir try/catch, citing EACCES (WR-19) — the
directory-shaped sibling of case (c)'`, inside the `'WR-14 — non-regular and unreadable entries
are reported, never thrown'` describe block (commit `56e31c19`).

**Verbatim pre-fix RED observation** (Task 1, before the fix landed — an UNCAUGHT throw, not a
clean assertion mismatch):

```
FAIL scripts/lib/curation-guard.test.mjs > WR-14 — non-regular and unreadable entries are reported, never thrown > (f) mode-000 directory: reported via the readdir try/catch, citing EACCES (WR-19) — the directory-shaped sibling of case (c)
Error: EACCES: permission denied, scandir '/var/folders/lr/1kcx1pmd27sg98ghw6nmwf2m0000gn/T/curation-guard-wr14-AbMufq/wr19-locked-dir'
 ❯ walk scripts/lib/curation-guard.mjs:83:36
    81|
    82|  function walk(dir) {
    83|    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      |                                   ^
    84|      const entryPath = resolve(dir, entry.name);
 ❯ walk scripts/lib/curation-guard.mjs:101:9
 ❯ findCurationArtifacts scripts/lib/curation-guard.mjs:175:3
 ❯ scripts/lib/curation-guard.test.mjs:289:45

 Test Files  1 failed (1)
      Tests  1 failed | 21 passed | 1 skipped (23)
```

Post-fix: `npx vitest run scripts/lib/curation-guard.test.mjs` — 22 passed / 1 skipped, exit 0.
Whole-tree `npm run build-widgets` against the real `dist/widgets` exits 0 with the green
`✓ Curation-artifact scan` line unregressed. A fail-open negative check (planted mode-000
directory under the real `dist/widgets`) confirmed `npm run build-widgets` exits 1, naming that
directory via `✗ Curation-artifact guard failed: ... — could not be listed (EACCES) ...`, then
returns to exit 0 after cleanup. See `25-04-SUMMARY.md` for full detail.

The two remaining Info-level/cosmetic items raised by the same wave-9 review are explicitly NOT
closed by this work — they were split out, before this file moved to `completed/`, into
`.planning/todos/pending/2026-09-02-in17-in18-curation-guard-cosmetics.md`.
