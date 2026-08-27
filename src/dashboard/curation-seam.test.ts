import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { stripComments } from './row-semantics.test.js';

/*
 * Source-structure regression guard for Phase 24's D-03 attach seam
 * (`.planning/phases/24-local-curation-mode/`) — the `data-activity-id`
 * attribute `buildBestEffortsSection` sets on the "Best Efforts This Run"
 * `<section>`, and the `dashboard:best-efforts-mounted` CustomEvent
 * `mountBestEffortsAndBadges` dispatches after it.
 *
 * It proves NOTHING about rendering, event dispatch or DOM attachment.
 * Vitest runs in this repository with `environment: 'node'` — this project
 * has no DOM-simulation library dependency and no headless browser anywhere
 * in it — so nothing in this file can construct a live DOM, dispatch a
 * CustomEvent, or observe a listener firing. A green run of this file is
 * coverage of SOURCE TEXT SHAPE only. The sole proof of the actual behaviour
 * is the mandatory human browser checkpoint in plan 24-08.
 */

const VIEWS_DIR = new URL('./views/', import.meta.url);

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, VIEWS_DIR), 'utf8');
}

const detailSectionsSource = readSource('detail-sections.ts');
const detailSource = readSource('detail.ts');
const recordsLogicSource = readSource('records-logic.ts');

const detailSectionsStripped = stripComments(detailSectionsSource);
const detailStripped = stripComments(detailSource);
const recordsLogicStripped = stripComments(recordsLogicSource);

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('D-03(a) — buildBestEffortsSection carries the activityId attach seam', () => {
  it("buildBestEffortsSection's signature includes activityId: string", () => {
    expect(detailSectionsStripped).toContain('activityId: string');
  });

  it('detail-sections.ts sets the data-activity-id attribute, spelling-agnostic (.dataset.activityId or setAttribute)', () => {
    // WR-02 lesson (row-semantics.test.ts): scan both spellings, since a
    // guard keyed to only one idiom can silently miss the other.
    const hasDatasetSpelling = detailSectionsStripped.includes('.dataset.activityId');
    const hasSetAttributeSpelling = detailSectionsStripped.includes("setAttribute('data-activity-id'");
    expect(hasDatasetSpelling || hasSetAttributeSpelling).toBe(true);
  });

  it('the attribute assignment appears BEFORE the zero-efforts empty-state early return, so every activity ships the seam', () => {
    const assignmentOffset = detailSectionsStripped.indexOf('.dataset.activityId = activityId');
    const emptyStateOffset = detailSectionsStripped.indexOf('if (rows.length === 0)');
    expect(assignmentOffset, 'expected .dataset.activityId = activityId to be present').toBeGreaterThanOrEqual(0);
    expect(emptyStateOffset, "expected 'if (rows.length === 0)' to be present").toBeGreaterThanOrEqual(0);
    expect(assignmentOffset).toBeLessThan(emptyStateOffset);
  });
});

describe('D-03(b) — mountBestEffortsAndBadges dispatches the mount event exactly once, in order', () => {
  it("detail.ts contains 'dashboard:best-efforts-mounted' inside a new CustomEvent( construction, exactly once", () => {
    expect(countOccurrences(detailStripped, 'dashboard:best-efforts-mounted')).toBe(1);
    const eventOffset = detailStripped.indexOf('dashboard:best-efforts-mounted');
    const precedingText = detailStripped.slice(Math.max(0, eventOffset - 120), eventOffset);
    expect(precedingText).toContain('new CustomEvent(');
  });

  it('the event fires AFTER the requestToken/mountedContainer guard AND AFTER panelContainer.replaceChildren(buildBestEffortsSection(...)), measured inside mountBestEffortsAndBadges', () => {
    const fnStart = detailStripped.indexOf('async function mountBestEffortsAndBadges');
    expect(fnStart, 'expected to find mountBestEffortsAndBadges').toBeGreaterThanOrEqual(0);
    const fnBody = detailStripped.slice(fnStart);

    const guardOffset = fnBody.indexOf('if (myToken !== requestToken || mountedContainer !== container)');
    const replaceChildrenOffset = fnBody.indexOf('panelContainer.replaceChildren(buildBestEffortsSection');
    const eventOffset = fnBody.indexOf('dashboard:best-efforts-mounted');

    expect(guardOffset, 'expected the requestToken/mountedContainer guard').toBeGreaterThan(0);
    expect(replaceChildrenOffset, 'expected the replaceChildren(buildBestEffortsSection(...)) call').toBeGreaterThan(guardOffset);
    expect(eventOffset, 'expected the mount event dispatch').toBeGreaterThan(replaceChildrenOffset);
  });

  it('detail.ts passes detail.id to buildBestEffortsSection', () => {
    expect(detailStripped).toContain('buildBestEffortsSection(rows, exclusionReason, detail.id)');
  });
});

describe("D-03's 'no write path' claim (T-24-SEAM-02)", () => {
  it('neither detail.ts nor detail-sections.ts contains __curate', () => {
    expect(countOccurrences(detailStripped, '__curate')).toBe(0);
    expect(countOccurrences(detailSectionsStripped, '__curate')).toBe(0);
  });

  it("neither file contains a non-GET fetch method (method: 'PUT'/'DELETE'/'POST')", () => {
    for (const method of ["method: 'PUT'", "method: 'DELETE'", "method: 'POST'"]) {
      expect(countOccurrences(detailStripped, method), `detail.ts should not contain ${method}`).toBe(0);
      expect(
        countOccurrences(detailSectionsStripped, method),
        `detail-sections.ts should not contain ${method}`
      ).toBe(0);
    }
  });
});

describe('D-06 — buildExclusionReasonIndex and the Excluded badge stay unchanged', () => {
  it('records-logic.ts still declares export function buildExclusionReasonIndex(raw: unknown): Map<string, string>', () => {
    expect(recordsLogicStripped).toContain(
      'export function buildExclusionReasonIndex(raw: unknown): Map<string, string>'
    );
  });

  it("detail-sections.ts still contains the 'Excluded — ' badge string, made reachable by this phase, not rebuilt", () => {
    expect(detailSectionsStripped).toContain('Excluded — ');
  });
});
