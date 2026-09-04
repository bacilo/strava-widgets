---
created: 2026-09-02
source: 24-REVIEW.md § Wave 9 Review
severity: info
area: scripts/lib/curation-guard.mjs
---

# IN-17 / IN-18: curation-guard cosmetics from the wave-9 review

Split out of the WR-19 todo (`.planning/todos/completed/2026-09-02-wr19-curation-guard-directory-eacces.md`)
when that todo closed via plan 25-04, so these two Info-level items are not silently closed
alongside it. Deliberately deferred at Phase 25 planning per `25-CONTEXT.md` § Deferred Ideas
("Both Info-level and cosmetic; they stay in `.planning/todos/pending/` rather than riding along
with WR-19").

- **IN-17** `curation-guard.mjs:105-141` — a non-regular entry whose name also matches
  `__curate`/`.curate-dist` yields two violation entries for one path.
- **IN-18** `src/dashboard/curation-seam.test.ts:152-178` — the WR-17 literal-string pin is more
  format-brittle than its companion regex pin; a reflowed multi-line call would fail only the
  literal check. Low practical risk (no formatter/lint step in this repo today).
