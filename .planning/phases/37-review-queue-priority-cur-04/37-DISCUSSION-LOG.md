# Phase 37: Review-Queue Priority & CUR-04 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-25
**Phase:** 37-review-queue-priority-cur-04
**Areas discussed:** Reviewed file visibility, Priority order & 'moved', Review stickiness, Queue view & filters

---

## Reviewed file visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Never published | Curate-only; any dist/widgets copy is a leak | ✓ |
| Published like exclusions | Copied to dist/widgets/data | |

| Option | Description | Selected |
|--------|-------------|----------|
| data/curation/reviewed.json | New dir, in no copy list | ✓ |
| data/private/ + gitignore exception | Under existing private guard; needs negation | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Path check | Existence check of published path; .json exemption untouched | ✓ |
| Marker key in JSON | Narrow the .json exemption | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| id + reason + reviewedAt | | ✓ |
| Mirror exclusions shape | | |
| Plus a flag snapshot | | |

**Notes:** The later "resurface on change" choice added a `fingerprint` field to the entry.
Guard 2 asserts 404 on the new route and `/data/curation/reviewed.json` (no objection raised).

---

## Priority order & 'moved'

| Option | Description | Selected |
|--------|-------------|----------|
| Both kinds | contaminated != null OR unreliable-segment demotion | ✓ |
| contaminated only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Intersected segment metres | Segments touching effort windows, once per activity, numeric source | ✓ |
| Activity-wide totalMetres | Index row, already available | |
| Pace moved, not metres | Needs a CUR-06 amendment | |

| Option | Description | Selected |
|--------|-------------|----------|
| Transported → metres desc → rest | Ties newest-first then id | ✓ |
| Absolute guards first | | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Then contaminated metres | Same key as tier 2 | ✓ |
| Transported metres | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Count + order | Recount re-derives membership and sort key | ✓ |
| Count only | | |

---

## Review stickiness

| Option | Description | Selected |
|--------|-------------|----------|
| Resurface on change | Fingerprint mismatch returns the row to the default view | ✓ |
| Sticky by activityId | | |
| Sticky + reviewed filter badge | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Mutually exclusive | | ✓ |
| Exclude wins silently | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep + show as orphaned | | ✓ |
| Silently ignore | | |
| Auto-prune on write | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Delete the entry | | ✓ |
| Tombstone | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Which flags, not how much | (distance, guard) pairs + transported yes/no | ✓ |
| Flags + whole metres | | |
| Flags + metres band | Needs a new threshold constant | |

---

## Queue view & filters

| Option | Description | Selected |
|--------|-------------|----------|
| To review / Reviewed / Excluded / All | | ✓ |
| Default + Reviewed only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling route, shared machinery | PUT/DELETE/GET /__curate/reviewed/:id | ✓ |
| Extend the exclusions route | state body, two files | |

| Option | Description | Selected |
|--------|-------------|----------|
| Blank, required | | ✓ |
| Prefilled from flags | | |

| Option | Description | Selected |
|--------|-------------|----------|
| One at a time | | ✓ |
| Bulk with shared reason | | |

---

## Claude's Discretion

- Field name/placement of the numeric contaminated-metres value
- Guard 1: file path only vs whole `data/curation/` tree
- "changed since review" / "no longer flagged" copy
- Fingerprint serialisation

## Deferred Ideas

- Bulk review with a shared reason
- CUR-05 per-effort override (already deferred)
