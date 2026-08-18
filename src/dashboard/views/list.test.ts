import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  formatActivityDate,
  formatPace,
  formatEffortDuration,
  highlightAndFocus,
  statusBadgeTexts,
  activityRowAriaLabel,
  composeRowAriaLabel,
  lowConfidenceDescriptionId,
  noteViewedActivity,
  takeNotedActivityId,
  applyReturnHighlight,
  rowIdPrefix,
} from './list.js';
import type { RowSurface } from './list.js';
import type { DashboardIndexRow } from '../../analytics/dashboard-index.types.js';

/**
 * Minimal stub shape for the parts of `HTMLElement` `highlightAndFocus`
 * actually touches. Each stub records what was done to it so assertions are
 * about behaviour, not source text.
 */
interface StubRow {
  tagName: string;
  classList: { add: (className: string) => void };
  scrollIntoView: () => void;
  focus: () => void;
  querySelector: (selector: string) => StubRow | null;
  addedClasses: string[];
  scrollIntoViewCalled: boolean;
  focusCalled: boolean;
  queriedSelectors: string[];
}

function buildStubRow(opts: { tagName: string; querySelectorResult: StubRow | null }): StubRow {
  const stub: StubRow = {
    tagName: opts.tagName,
    addedClasses: [],
    scrollIntoViewCalled: false,
    focusCalled: false,
    queriedSelectors: [],
    classList: {
      add(className: string) {
        stub.addedClasses.push(className);
      },
    },
    scrollIntoView() {
      stub.scrollIntoViewCalled = true;
    },
    focus() {
      stub.focusCalled = true;
    },
    querySelector(selector: string) {
      stub.queriedSelectors.push(selector);
      return opts.querySelectorResult;
    },
  };
  return stub;
}

describe('formatActivityDate — WR-02 timezone-independent local dates', () => {
  it('formats a real intervals.icu no-Z record', () => {
    expect(formatActivityDate('2026-08-06T07:28:22')).toBe('Aug 6, 2026');
  });

  it('formats a late-evening no-Z record without shifting to the next day (US-viewer repro)', () => {
    expect(formatActivityDate('2026-08-06T22:30:00')).toBe('Aug 6, 2026');
  });

  it('formats an early-morning no-Z record without shifting to the previous day (EU-viewer repro)', () => {
    expect(formatActivityDate('2026-08-06T01:30:00')).toBe('Aug 6, 2026');
  });

  it('still formats a Z-suffixed Strava-shape record correctly', () => {
    expect(formatActivityDate('2024-01-15T09:00:00Z')).toBe('Jan 15, 2024');
  });

  it('formats a year boundary (Dec 31 no-Z)', () => {
    expect(formatActivityDate('2024-12-31T23:59:59')).toBe('Dec 31, 2024');
  });

  it('formats a year boundary the other way (Jan 1 no-Z)', () => {
    expect(formatActivityDate('2024-01-01T00:00:00')).toBe('Jan 1, 2024');
  });

  it('returns an em dash for unparseable input', () => {
    expect(formatActivityDate('not-a-date')).toBe('—');
  });

  it('returns an em dash for an empty string', () => {
    expect(formatActivityDate('')).toBe('—');
  });
});

describe('formatPace — CR-01 m:ss rollover', () => {
  it('rolls 359.9 s/km up to the next minute instead of rendering :60', () => {
    // The defect: floor(359.9/60)=5 while round(359.9%60)=60 -> "5:60/km".
    expect(formatPace(359.9)).toBe('6:00/km');
  });

  it('handles the same boundary at other minute values', () => {
    expect(formatPace(419.8)).toBe('7:00/km');
    expect(formatPace(299.5)).toBe('5:00/km');
    expect(formatPace(359.6)).toBe('6:00/km');
  });

  it('never emits a seconds component of 60 for any real archive value', () => {
    // Guards the whole live dataset's value range, not just the 11 rows that
    // happened to trip it — any pace within rounding distance of a minute
    // boundary must roll over. Step is deliberately fine enough to land on
    // fractional boundaries like x.5 and x.9.
    for (let s = 60; s <= 1200; s = Math.round((s + 0.1) * 10) / 10) {
      const out = formatPace(s);
      expect(out, `formatPace(${s}) produced ${out}`).not.toMatch(/:60\/km$/);
      expect(out).toMatch(/^\d+:[0-5]\d\/km$/);
    }
  });

  it('rounds to nearest second rather than truncating', () => {
    expect(formatPace(360.4)).toBe('6:00/km');
    expect(formatPace(360.6)).toBe('6:01/km');
    expect(formatPace(300)).toBe('5:00/km');
  });

  it('returns an em dash for null', () => {
    expect(formatPace(null)).toBe('—');
  });
});

describe('formatEffortDuration — 18-UI-SPEC § 14 (m:ss under an hour, h:mm:ss at/above)', () => {
  it('renders m:ss for a 5K-scale duration', () => {
    expect(formatEffortDuration(1179)).toBe('19:39');
  });

  it('renders m:ss for a very short duration', () => {
    expect(formatEffortDuration(44)).toBe('0:44');
  });

  it('renders h:mm:ss exactly at the one-hour boundary', () => {
    expect(formatEffortDuration(3600)).toBe('1:00:00');
  });

  it('renders h:mm:ss for a marathon-scale duration', () => {
    expect(formatEffortDuration(5211)).toBe('1:26:51');
  });

  it('rounds in a single step, never producing a :60 seconds component', () => {
    const out = formatEffortDuration(2388.9);
    expect(out).not.toBe('39:60');
    expect(out).toMatch(/^\d+:[0-5]\d$/);
  });

  it('rolls a near-minute-boundary value into the minutes component, not :60', () => {
    expect(formatEffortDuration(59.6)).toBe('1:00');
  });

  it('returns an em dash for a negative duration', () => {
    expect(formatEffortDuration(-1)).toBe('—');
  });

  it('returns an em dash for NaN', () => {
    expect(formatEffortDuration(NaN)).toBe('—');
  });

  it('returns an em dash for Infinity', () => {
    expect(formatEffortDuration(Infinity)).toBe('—');
  });
});

describe('highlightAndFocus — CR-01 / Phase 17 D-08 return-from-detail focus restoration', () => {
  it('focuses the card row itself below the 720px breakpoint, where the mobile card IS the anchor (renderActivityRow) and has no descendant anchor to delegate to', () => {
    // This is the CR-01 regression: renderActivityRow (list.ts) made the
    // card row element itself the <a> and removed its .cta descendant, so
    // querySelector('a') on this shape returns null and the old
    // implementation's optional chain silently no-ops, leaving Phase 17
    // D-08's return-from-detail focus restoration dead on mobile.
    const row = buildStubRow({ tagName: 'A', querySelectorResult: null });

    highlightAndFocus(row as unknown as HTMLElement);

    expect(
      row.focusCalled,
      'card-shaped row (tagName A, no descendant anchor): highlightAndFocus must focus the row itself, or Phase 17 D-08 return-focus is dead on the mobile card layout below the 720px breakpoint'
    ).toBe(true);
    expect(row.addedClasses).toContain('activity-table__row--highlight');
    expect(row.scrollIntoViewCalled).toBe(true);
  });

  it('delegates focus to the descendant anchor for the table row shape (non-regression)', () => {
    const anchor = buildStubRow({ tagName: 'A', querySelectorResult: null });
    const row = buildStubRow({ tagName: 'TR', querySelectorResult: anchor });

    highlightAndFocus(row as unknown as HTMLElement);

    expect(anchor.focusCalled).toBe(true);
    expect(row.focusCalled).toBe(false);
    expect(row.addedClasses).toContain('activity-table__row--highlight');
    expect(row.scrollIntoViewCalled).toBe(true);
  });

  it('does not throw when the row has neither shape (no descendant anchor, not itself an anchor)', () => {
    const row = buildStubRow({ tagName: 'TR', querySelectorResult: null });

    expect(() => highlightAndFocus(row as unknown as HTMLElement)).not.toThrow();
    expect(row.addedClasses).toContain('activity-table__row--highlight');
  });

  it('does not throw when the element is undefined', () => {
    expect(() => highlightAndFocus(undefined)).not.toThrow();
  });
});

/**
 * Builds the two container stubs `applyReturnHighlight` needs, using the same
 * hand-stub discipline as `buildStubRow` above — no DOM library, every
 * selector queried is recorded, exactly as `buildStubRow` records
 * `queriedSelectors`.
 */
function buildStubTableWrapper(rowStubs: StubRow[]): {
  queriedSelectors: string[];
  querySelectorAll: (selector: string) => StubRow[];
} {
  const queriedSelectors: string[] = [];
  return {
    queriedSelectors,
    querySelectorAll(selector: string) {
      queriedSelectors.push(selector);
      return rowStubs;
    },
  };
}

function buildStubCardList(rowStubs: StubRow[]): { children: StubRow[] } {
  return { children: rowStubs };
}

/**
 * `applyReturnHighlight` only reads `row.id` off each page item, so a full
 * `DashboardIndexRow` fixture is unnecessary noise here — this cast helper
 * builds the minimal shape and asserts it through as `readonly
 * DashboardIndexRow[]`.
 */
function pageItemsFrom(ids: string[]): readonly DashboardIndexRow[] {
  return ids.map((id) => ({ id }) as unknown as DashboardIndexRow);
}

describe(
  'takeNotedActivityId / applyReturnHighlight - CR-01 the one-shot return hint is consumed on every render path',
  () => {
    it('happy path still works: the noted id is consumed once and highlights the matching row in both layouts', () => {
      noteViewedActivity('X');
      const notedId = takeNotedActivityId();

      const trX = buildStubRow({ tagName: 'A', querySelectorResult: null });
      const trY = buildStubRow({ tagName: 'A', querySelectorResult: null });
      const cardX = buildStubRow({ tagName: 'A', querySelectorResult: null });
      const cardY = buildStubRow({ tagName: 'A', querySelectorResult: null });
      const tableWrapper = buildStubTableWrapper([trX, trY]);
      const cardList = buildStubCardList([cardX, cardY]);
      const pageItems = pageItemsFrom(['X', 'Y']);

      applyReturnHighlight(
        notedId,
        tableWrapper as unknown as HTMLElement,
        cardList as unknown as HTMLElement,
        pageItems
      );

      for (const stub of [trX, cardX]) {
        expect(stub.scrollIntoViewCalled).toBe(true);
        expect(stub.focusCalled).toBe(true);
        expect(stub.addedClasses).toContain('activity-table__row--highlight');
      }
      for (const stub of [trY, cardY]) {
        expect(stub.scrollIntoViewCalled).toBe(false);
        expect(stub.focusCalled).toBe(false);
        expect(stub.addedClasses).not.toContain('activity-table__row--highlight');
      }
    });

    it('the leak sequence — WCAG 3.2.x unexpected focus movement: a zero-match render that discards the consume must not let a later render re-highlight', () => {
      noteViewedActivity('X');
      // Simulates mount()'s zero-match branch: it must consume the hint even
      // though it never calls applyReturnHighlight.
      takeNotedActivityId();

      // Simulates the next, unrelated render — with the fix, the hint is
      // already spent, so this consume returns null and nothing highlights.
      const notedId = takeNotedActivityId();

      const trX = buildStubRow({ tagName: 'A', querySelectorResult: null });
      const cardX = buildStubRow({ tagName: 'A', querySelectorResult: null });
      const tableWrapper = buildStubTableWrapper([trX]);
      const cardList = buildStubCardList([cardX]);
      const pageItems = pageItemsFrom(['X']);

      applyReturnHighlight(
        notedId,
        tableWrapper as unknown as HTMLElement,
        cardList as unknown as HTMLElement,
        pageItems
      );

      for (const stub of [trX, cardX]) {
        expect(stub.scrollIntoViewCalled).toBe(false);
        expect(stub.focusCalled).toBe(false);
        expect(stub.addedClasses).not.toContain('activity-table__row--highlight');
      }
    });

    it('the load-failure and stale-container branches leak nothing either: two discarded consumes before the eventual render', () => {
      noteViewedActivity('X');
      // Stands in for the load-failure return.
      takeNotedActivityId();
      // Stands in for the stale-container return.
      takeNotedActivityId();
      // The eventual normal render — the hint was already spent twice over.
      const notedId = takeNotedActivityId();

      const trX = buildStubRow({ tagName: 'A', querySelectorResult: null });
      const cardX = buildStubRow({ tagName: 'A', querySelectorResult: null });
      const tableWrapper = buildStubTableWrapper([trX]);
      const cardList = buildStubCardList([cardX]);
      const pageItems = pageItemsFrom(['X']);

      applyReturnHighlight(
        notedId,
        tableWrapper as unknown as HTMLElement,
        cardList as unknown as HTMLElement,
        pageItems
      );

      for (const stub of [trX, cardX]) {
        expect(stub.scrollIntoViewCalled).toBe(false);
        expect(stub.focusCalled).toBe(false);
        expect(stub.addedClasses).not.toContain('activity-table__row--highlight');
      }
    });

    it('applyReturnHighlight never reads module state — pins the parameterisation itself against a future revert', () => {
      noteViewedActivity('X');
      // Module state still holds 'X', but applyReturnHighlight must not read
      // it — only the explicit `notedId` parameter matters.

      const trX = buildStubRow({ tagName: 'A', querySelectorResult: null });
      const cardX = buildStubRow({ tagName: 'A', querySelectorResult: null });
      const tableWrapper = buildStubTableWrapper([trX]);
      const cardList = buildStubCardList([cardX]);
      const pageItems = pageItemsFrom(['X']);

      applyReturnHighlight(
        null,
        tableWrapper as unknown as HTMLElement,
        cardList as unknown as HTMLElement,
        pageItems
      );

      for (const stub of [trX, cardX]) {
        expect(stub.scrollIntoViewCalled).toBe(false);
        expect(stub.focusCalled).toBe(false);
        expect(stub.addedClasses).not.toContain('activity-table__row--highlight');
      }
    });
  }
);

/**
 * A complete, typed `DashboardIndexRow` fixture with every status-badge
 * condition clean: streams available, HR present, not low-confidence, not
 * excluded, zero PRs — `statusBadgeTexts` must return an empty array for
 * this row. `overrides` lets each test flip only the fields it needs, with
 * no cast to `any` and no partial type anywhere in this file.
 */
function baseRow(overrides: Partial<DashboardIndexRow> = {}): DashboardIndexRow {
  return {
    id: '123',
    startDate: '2026-08-06T07:28:22Z',
    startDateLocal: '2026-08-06T07:28:22',
    name: 'Morning Run',
    distanceM: 5000,
    movingTimeSec: 1500,
    paceSecPerKm: 300,
    elevationGainM: 50,
    avgHr: 150,
    maxHr: 170,
    avgCadenceRpm: 85,
    location: 'Copenhagen',
    sportType: 'Run',
    streams: {
      available: true,
      hr: true,
      cadence: true,
      elevation: true,
    },
    lowConfidence: false,
    excludedFromRecords: false,
    prCount: 0,
    gearName: null,
    ...overrides,
  };
}

describe('statusBadgeTexts — CR-02 single source of truth for badge text', () => {
  it('returns an empty array for a clean row (streams, HR, no flags, no PRs)', () => {
    expect(statusBadgeTexts(baseRow())).toEqual([]);
  });

  it('returns "No streams (<reason>)" when streams are unavailable with a reason', () => {
    const row = baseRow({ streams: { available: false, reason: 'manual', hr: false, cadence: false, elevation: false } });
    expect(statusBadgeTexts(row)).toEqual(['No streams (manual)']);
  });

  it('returns bare "No streams" when streams are unavailable with no reason', () => {
    const row = baseRow({ streams: { available: false, hr: false, cadence: false, elevation: false } });
    expect(statusBadgeTexts(row)).toEqual(['No streams']);
  });

  it('returns "No HR" when streams are available but HR is not', () => {
    const row = baseRow({ streams: { available: true, hr: false, cadence: true, elevation: true } });
    expect(statusBadgeTexts(row)).toEqual(['No HR']);
  });

  it('returns "Low confidence" for a low-confidence row', () => {
    expect(statusBadgeTexts(baseRow({ lowConfidence: true }))).toEqual(['Low confidence']);
  });

  it('returns "Excluded from records" for an excluded row', () => {
    expect(statusBadgeTexts(baseRow({ excludedFromRecords: true }))).toEqual(['Excluded from records']);
  });

  it('returns "<n> PR" for a row with PRs', () => {
    expect(statusBadgeTexts(baseRow({ prCount: 3 }))).toEqual(['3 PR']);
  });

  it('returns every applicable flag in the exact render order for a row carrying several at once', () => {
    const row = baseRow({
      streams: { available: false, reason: 'treadmill', hr: false, cadence: false, elevation: false },
      lowConfidence: true,
      excludedFromRecords: true,
      prCount: 2,
    });
    expect(statusBadgeTexts(row)).toEqual([
      'No streams (treadmill)',
      'Low confidence',
      'Excluded from records',
      '2 PR',
    ]);
  });
});

describe('activityRowAriaLabel — CR-02 badge text folded into the row anchor label', () => {
  it('is exactly the curated three-part base for a clean row, with no trailing separator', () => {
    expect(activityRowAriaLabel(baseRow())).toBe('Morning Run, Aug 6, 2026, 5.0 km');
  });

  it('ends with ", Low confidence" for a low-confidence row', () => {
    const label = activityRowAriaLabel(baseRow({ lowConfidence: true }));
    expect(label.endsWith(', Low confidence')).toBe(true);
  });

  it('contains both "Excluded from records" and the PR text for an excluded row with PRs', () => {
    const label = activityRowAriaLabel(baseRow({ excludedFromRecords: true, prCount: 1 }));
    expect(label).toContain('Excluded from records');
    expect(label).toContain('1 PR');
  });

  it('orders badges inside the label exactly as statusBadgeTexts does, for a row carrying several', () => {
    const row = baseRow({ lowConfidence: true, excludedFromRecords: true, prCount: 4 });
    expect(activityRowAriaLabel(row)).toBe(
      `Morning Run, Aug 6, 2026, 5.0 km, ${statusBadgeTexts(row).join(', ')}`
    );
  });

  it('always still starts with the activity name, so the fold cannot displace the curated base', () => {
    const row = baseRow({ lowConfidence: true, excludedFromRecords: true, prCount: 4, name: 'Evening Long Run' });
    expect(activityRowAriaLabel(row).startsWith('Evening Long Run,')).toBe(true);
  });
});

describe('composeRowAriaLabel — the shared separator every surface imports', () => {
  it('returns the base unchanged for an empty badge array', () => {
    expect(composeRowAriaLabel('base label', [])).toBe('base label');
  });

  it('appends one badge with a comma and space', () => {
    expect(composeRowAriaLabel('base label', ['Low confidence'])).toBe('base label, Low confidence');
  });

  it('joins several badges in order', () => {
    expect(composeRowAriaLabel('base label', ['No HR', 'Excluded from records', '2 PR'])).toBe(
      'base label, No HR, Excluded from records, 2 PR'
    );
  });
});

describe('lowConfidenceDescriptionId — CR-02 duplicate-element-id fix', () => {
  it('produces two different ids for the card prefix and the table prefix of the same activity', () => {
    const cardId = lowConfidenceDescriptionId('activity-card-123');
    const tableId = lowConfidenceDescriptionId('activity-table-123');
    expect(cardId).not.toBe(tableId);
    expect(cardId).toBe('activity-card-123-low-confidence-desc');
    expect(tableId).toBe('activity-table-123-low-confidence-desc');
  });
});

/**
 * D-05 per-surface element-id scoping. Nothing in this describe proves the
 * two-line row RENDERS correctly: vitest runs this repository with
 * `environment: 'node'`, there is no jsdom and no headless browser here, so
 * D-06's header/meta hierarchy is discharged only by plan 21-07's browser
 * checkpoint. These assertions are behavioural — `rowIdPrefix` is a pure,
 * importable function — not source-text scans.
 */
describe('rowIdPrefix — D-05 per-surface element-id scoping', () => {
  it('produces the two pre-Phase-21 literal values unchanged', () => {
    // Pinned to their pre-Phase-21 literal values: the surface scheme is
    // additive, and a change here would silently renumber every element id
    // the Activities screen already ships.
    expect(rowIdPrefix('activity-card', '456')).toBe('activity-card-456');
    expect(rowIdPrefix('activity-table', '456')).toBe('activity-table-456');
  });

  it('produces four pairwise-distinct prefixes for one row id, across all four surfaces', () => {
    const SURFACES: RowSurface[] = ['activity-card', 'activity-table', 'overview-prs', 'overview-activities'];
    const prefixes = new Set(SURFACES.map((s) => rowIdPrefix(s, '456')));
    expect(prefixes.size).toBe(4);
  });

  it('produces four pairwise-distinct lowConfidenceDescriptionId values, one per surface', () => {
    // This is the id that actually reaches the DOM as an `id` attribute, so
    // it is the one that must not collide.
    const SURFACES: RowSurface[] = ['activity-card', 'activity-table', 'overview-prs', 'overview-activities'];
    const descriptionIds = new Set(SURFACES.map((s) => lowConfidenceDescriptionId(rowIdPrefix(s, '456'))));
    expect(descriptionIds.size).toBe(4);
  });

  it("overview-prs and overview-activities never produce the same lowConfidenceDescriptionId — the Overview collision D-05 exists to prevent", () => {
    // These are the two lists Overview renders in the same document (plan
    // 21-04). A PR-carrying activity within the ten most recent activities
    // appears in both. No such row exists in the archive as checked against
    // data/dashboard/index.json during planning — so this guard, not the
    // browser checkpoint, is what holds the invariant.
    const prsId = lowConfidenceDescriptionId(rowIdPrefix('overview-prs', '456'));
    const activitiesId = lowConfidenceDescriptionId(rowIdPrefix('overview-activities', '456'));
    expect(prsId).not.toBe(activitiesId);
  });
});

/**
 * Strips block comments, non-greedy, then `//`-to-end-of-line where the `//`
 * is not immediately preceded by `:` — mirrors `row-semantics.test.ts`'s and
 * `row-navigation.test.ts`'s `stripComments` so prose in a comment cannot
 * collide with these assertions. This is a knowing third copy; `20-REVIEW.md`
 * WR-04 asks for a shared `test-utils` module and that extraction is out of
 * this round's scope — logged in `deferred-items.md` under `## Plan 20-12`.
 */
function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlockComments.replace(/(?<!:)\/\/.*$/gm, '');
}

describe('stripComments - self-tests', () => {
  it('removes a trailing // comment', () => {
    expect(stripComments('const x = 1; // trailing comment\n')).toBe('const x = 1; \n');
  });

  it('removes a full-line // comment', () => {
    expect(stripComments('// a full line comment\nconst y = 2;')).toBe('\nconst y = 2;');
  });

  it('removes a block comment', () => {
    expect(stripComments('/* a block comment */ const z = 3;')).toBe(' const z = 3;');
  });

  it('preserves a string literal containing https://example.com', () => {
    const source = "const url = 'https://example.com';";
    expect(stripComments(source)).toBe(source);
  });
});

/**
 * True only when `takeNotedActivityId()` is called inside `mount()` at a
 * character offset strictly earlier than `loadIndex()`'s offset. Returns
 * false — not a thrown error — when either landmark, or the call itself,
 * cannot be found at all; this is deliberate so the blind-spot proof below
 * can assert `false` on a pre-fix-shaped synthetic that has no
 * `takeNotedActivityId()` call anywhere, rather than the check vacuously
 * passing because `indexOf` returns -1 (which is numerically less than any
 * real offset).
 */
function consumePrecedesLoad(source: string): boolean {
  const mountIdx = source.indexOf('async mount(');
  const loadIdx = source.indexOf('loadIndex()');
  if (mountIdx < 0 || loadIdx < 0) return false;
  const callIdx = source.indexOf('takeNotedActivityId()', mountIdx);
  if (callIdx < 0) return false;
  return callIdx < loadIdx;
}

describe('list.ts wiring - CR-01 the consume is unconditional by construction', () => {
  const listSource = readFileSync(new URL('./list.ts', import.meta.url), 'utf8');
  const listStripped = stripComments(listSource);

  it('notedActivityId = null occurs exactly once — one writer, and it is the consume function', () => {
    const matches = listStripped.match(/notedActivityId\s*=\s*null/g) || [];
    expect(
      matches.length,
      'a second `notedActivityId = null` writer reopens the leak this plan closed — only takeNotedActivityId() may clear the hint'
    ).toBe(1);
  });

  it('export function takeNotedActivityId occurs exactly once, and takeNotedActivityId( occurs exactly twice in total (definition + single call site)', () => {
    const exportMatches = listStripped.match(/export function takeNotedActivityId/g) || [];
    expect(
      exportMatches.length,
      'takeNotedActivityId must be exported exactly once — a duplicate or un-exported definition breaks the module contract Task 1 tests against'
    ).toBe(1);

    const callMatches = listStripped.match(/takeNotedActivityId\(/g) || [];
    expect(
      callMatches.length,
      'takeNotedActivityId( must occur exactly twice (its definition and mount()\'s single consume) — more call sites risk consuming the hint more than once per render, fewer means mount() no longer consumes it at all'
    ).toBe(2);
  });

  it("takeNotedActivityId() runs inside mount() before loadIndex() — the consume runs before the load can reject", () => {
    expect(
      consumePrecedesLoad(listStripped),
      'the consume must appear inside mount() at an offset earlier than loadIndex(), so a rejected load cannot leak the hint (CR-01)'
    ).toBe(true);
  });

  it('the slice of source between function applyReturnHighlight and async mount( contains zero occurrences of notedActivityId', () => {
    const start = listStripped.indexOf('function applyReturnHighlight');
    const end = listStripped.indexOf('async mount(');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const applySlice = listStripped.slice(start, end);
    expect(
      /notedActivityId/.test(applySlice),
      'applyReturnHighlight must not reference notedActivityId at all — it is pure with respect to module state after this plan'
    ).toBe(false);
  });

  it('CR-01 blind-spot proof: a pre-fix-shaped synthetic (the consume lives inside applyReturnHighlight, called only from the else branch) fails the ordering check above, proving the guard catches the shipped defect rather than merely describing it', () => {
    // This is the historical CR-01 defect shape, reproduced verbatim as a
    // synthetic string — it must NOT be "fixed" to make this test pass. The
    // whole point is that consumePrecedesLoad() returns false on it.
    const preFixSynthetic = `
      function applyReturnHighlight(tableWrapper, cardList, pageItems) {
        if (notedActivityId === null) {
          return;
        }
        const idx = pageItems.findIndex((row) => row.id === notedActivityId);
        notedActivityId = null;
        if (idx === -1) {
          return;
        }
        highlightAndFocus(tr);
        highlightAndFocus(card);
      }

      async mount(ctx) {
        mountedContainer = ctx.container;
        try {
          await indexClient.loadIndex();
        } catch (error) {
          return;
        }
        if (mountedContainer !== ctx.container) {
          return;
        }
        if (filtered.length === 0) {
          return;
        } else {
          if (mountedContainer === ctx.container) {
            applyReturnHighlight(tableWrapper, cardList, pageItems);
          }
        }
      }
    `;
    const syntheticStripped = stripComments(preFixSynthetic);
    expect(consumePrecedesLoad(syntheticStripped)).toBe(false);
  });
});
