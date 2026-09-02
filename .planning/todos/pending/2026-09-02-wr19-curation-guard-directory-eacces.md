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

Also open from the same review, both Info-level and cosmetic:
- **IN-17** `curation-guard.mjs:105-141` — a non-regular entry whose name also matches
  `__curate`/`.curate-dist` yields two violation entries for one path.
- **IN-18** `src/dashboard/curation-seam.test.ts:152-178` — the WR-17 literal-string pin is more
  format-brittle than its companion regex pin; a reflowed multi-line call would fail only the
  literal check. Low practical risk (no formatter/lint step in this repo today).
