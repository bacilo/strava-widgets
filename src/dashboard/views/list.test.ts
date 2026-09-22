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
  paceDisputedDescriptionId,
  qualityBadgeDescriptionId,
  qualityBadgeSpecs,
  segmentMechanismLabel,
  noteViewedActivity,
  takeNotedActivityId,
  applyReturnHighlight,
  rowIdPrefix,
  LOW_CONFIDENCE_BADGE_TEXT,
  PACE_DISPUTED_BADGE_TEXT,
} from './list.js';
import type { RowSurface } from './list.js';
import type { DashboardIndexRow, ParsedDashboardIndexRow } from '../../analytics/dashboard-index.types.js';
import type { ActivityQualitySignals, ActivityQualityMetadata } from '../../analytics/pace-quality.js';
import { buildPaceQualityShard } from '../../analytics/pace-quality.js';
import type { CanonicalStream } from '../../streams/stream.types.js';
import { buildFilterChips, removeChip, activeFilterCount, EMPTY_FILTERS } from './list-logic.js';

/**
 * Phase 27 (QUAL-01/QUAL-03): a required row field this suite does not
 * exercise — a clean/not-flagged default, following the `gearName` /
 * `paceDisagreement` fixture precedent already used in `baseRow` below.
 */
const CLEAN_QUALITY: ActivityQualitySignals = {
  decimation: { tier: 'none', zeroAdvanceFraction: 0, sampleCount: 100 },
  gapProfile: { tier: 'none', gapFraction: 0, recordingGapSec: 0, pauseSec: 0, spanSec: 3000 },
  impossibleSamples: { tier: 'none', count: 0, maxImpliedSpeedMps: 0, countInsideZeroAdvanceRun: 0 },
  // Phase 30 (ELEV-01): a required field this suite does not exercise --
  // a clean/not-flagged default, same precedent as the three signals above.
  elevation: {
    tier: 'none',
    subGround: { flagged: false, minAltM: 12 },
    closureDrift: { state: 'clear', deltaM: 4, startEndDistM: 38 },
    verticalRate: { flagged: false, worstRateMps: 1.2, violatingSamples: 0 },
  },
  // Seventh signal (Phase 33, SEG-06, plan 33-09 Task 3): a required field
  // this suite does not exercise — a clean/zero default, same precedent as
  // the three signals and elevation above.
  unreliableSegments: {
    tier: 'none',
    count: 0,
    totalMetres: 0,
    totalExcessMetres: 0,
    totalSeconds: 0,
    excessFraction: 0,
    mechanisms: [],
  },
  deviceEra: { family: 'no-device-name', rawDeviceName: null },
  elapsedVsMoving: { ratio: 1, elapsedSec: 3000, movingSec: 3000 },
  // Ninth/tenth signals (Phase 34, PAUSE-02/STOP-01/STOP-03): required
  // fields this suite does not exercise — clean/zero defaults, same
  // precedent as the signals above.
  pauseClassification: {
    intervalCount: 0,
    stationaryCount: 0,
    walkedCount: 0,
    ranThroughCount: 0,
    transportedCount: 0,
    notClassifiableCount: 0,
  },
  forgottenStop: {
    computable: true,
    reason: null,
    count: 0,
    totalSec: 0,
    longestSec: 0,
    creepCount: 0,
    creepTotalSec: 0,
    creepLongestSec: 0,
    pauseCount: 0,
    pauseTotalSec: 0,
    pauseLongestSec: 0,
  },
  anySevere: false,
  notComputableReason: null,
};

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
    paceDisagreement: null,
    quality: CLEAN_QUALITY,
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

  // D-11/PACE-07 (26-08): the pace-disputed badge, the single-source-pipeline
  // half of D-11 — statusBadgeTexts is the one place `row.paceDisagreement`
  // is read to decide whether "Pace disputed" is pushed.
  it('returns "Pace disputed" for a row whose paceDisagreement is populated', () => {
    const row = baseRow({
      paceDisagreement: { streamPaceSecPerKm: 350.6, metadataPaceSecPerKm: 112.6, ratio: 3.11 },
    });
    expect(statusBadgeTexts(row)).toEqual(['Pace disputed']);
  });

  it('omits "Pace disputed" for a row whose paceDisagreement is null', () => {
    expect(statusBadgeTexts(baseRow({ paceDisagreement: null }))).toEqual([]);
  });

  it('returns every applicable flag in the exact render order for a row carrying several at once, with Pace disputed adjacent to Low confidence', () => {
    const row = baseRow({
      streams: { available: false, reason: 'treadmill', hr: false, cadence: false, elevation: false },
      lowConfidence: true,
      paceDisagreement: { streamPaceSecPerKm: 350.6, metadataPaceSecPerKm: 112.6, ratio: 3.11 },
      excludedFromRecords: true,
      prCount: 2,
    });
    expect(statusBadgeTexts(row)).toEqual([
      'No streams (treadmill)',
      'Low confidence',
      'Pace disputed',
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

/**
 * A row shaped like a pre-Phase-26 (or partially-regenerated) parsed
 * `index.json` entry: `paceDisagreement` genuinely ABSENT as a key, not set
 * to an explicit `null`. Built by destructuring the key off a `baseRow()`
 * result and typing the remainder through `ParsedDashboardIndexRow` — the
 * type `dashboard-index.types.ts` ships for exactly this hazard — then
 * asserted to `DashboardIndexRow` at the call boundary, mirroring what a
 * real `index-client.ts` cast actually hands a consumer (CR-02). Passing
 * `{ paceDisagreement: undefined }` as a `baseRow` override would NOT be a
 * faithful reproduction — that is present-and-undefined, a different object
 * shape from a parsed row that never carried the key at all. Every other
 * fixture in this file sets the key to an explicit `null`, which is exactly
 * why no test previously exercised the missing-key path.
 */
function rowMissingPaceDisagreement(): DashboardIndexRow {
  const full: ParsedDashboardIndexRow = baseRow();
  const { paceDisagreement, ...withoutKey } = full;
  void paceDisagreement;
  return withoutKey as DashboardIndexRow;
}

describe('CR-02 — a row whose index predates the paceDisagreement field produces no badge and no crash', () => {
  it("the fixture helper's own row genuinely lacks the key (not present-and-undefined)", () => {
    const row = rowMissingPaceDisagreement();
    expect('paceDisagreement' in row).toBe(false);
  });

  it('statusBadgeTexts returns [] for the missing-key row, matching a clean explicit-null row', () => {
    const row = rowMissingPaceDisagreement();
    expect(statusBadgeTexts(row)).toEqual([]);
    expect(statusBadgeTexts(row)).toEqual(statusBadgeTexts(baseRow()));
  });

  it('statusBadgeTexts does not contain PACE_DISPUTED_BADGE_TEXT for the missing-key row', () => {
    const row = rowMissingPaceDisagreement();
    expect(statusBadgeTexts(row)).not.toContain(PACE_DISPUTED_BADGE_TEXT);
  });

  it('activityRowAriaLabel contains no "Pace disputed" fragment for the missing-key row', () => {
    const row = rowMissingPaceDisagreement();
    expect(activityRowAriaLabel(row)).not.toContain('Pace disputed');
  });

  it('positive control: a row with a real PaceDisagreement still produces the badge and the aria-label fragment', () => {
    const row = baseRow({
      paceDisagreement: { streamPaceSecPerKm: 350.6, metadataPaceSecPerKm: 112.6, ratio: 3.11 },
    });
    expect(statusBadgeTexts(row)).toContain(PACE_DISPUTED_BADGE_TEXT);
    expect(activityRowAriaLabel(row)).toContain('Pace disputed');
  });

  it('the strict `row.paceDisagreement !== null` form is absent from list.ts (comment-stripped)', () => {
    const listSource = readFileSync(new URL('./list.ts', import.meta.url), 'utf8');
    const stripped = stripComments(listSource);
    const matches = stripped.match(/row\.paceDisagreement\s*!==\s*null/g) || [];
    expect(
      matches.length,
      'row.paceDisagreement !== null must not appear in list.ts — undefined !== null is true, which is the CR-02 defect this block exists to close'
    ).toBe(0);
  });
});

/**
 * Builds a row whose `quality` object is `CLEAN_QUALITY` with the given
 * per-signal overrides merged in — every other row field comes from
 * `baseRow()` unchanged, since `qualityBadgeSpecs` only reads `row.quality`
 * (its `Pick<ParsedDashboardIndexRow, 'quality'>` signature, widened by
 * G-04 to accept an absent key too — see the describe block below).
 */
function qualityRow(overrides: Partial<ActivityQualitySignals>): DashboardIndexRow {
  return baseRow({ quality: { ...CLEAN_QUALITY, ...overrides } });
}

describe('quality badge text (QUAL-04, D-07, D-09)', () => {
  // Phase 33 (D-11): widened from two categories to three — plan 33-03 put
  // unreliableSec inside gapFraction's numerator, so a badge naming only
  // "gaps or pauses" would misdescribe the number it shows. Named so
  // `-t "gaps, pauses or unreliable"` selects this case.
  it('a row severe on gapProfile with gapFraction 0.12 returns exactly one spec with visibleText naming gaps, pauses or unreliable segments', () => {
    const row = qualityRow({
      gapProfile: { tier: 'severe', gapFraction: 0.12, recordingGapSec: 300, pauseSec: 60, spanSec: 3000 },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    expect(specs[0].visibleText).toBe('12% of recorded time in gaps, pauses or unreliable segments');
  });

  it('a severe gapProfile at gapFraction 0.34 produces the D-11 three-category text', () => {
    const row = qualityRow({
      gapProfile: { tier: 'severe', gapFraction: 0.34, recordingGapSec: 900, pauseSec: 100, spanSec: 3000 },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    expect(specs[0].visibleText).toBe('34% of recorded time in gaps, pauses or unreliable segments');
    expect(specs[0].descriptionIdSuffix).toBe('gap-profile');
    expect(specs[0].explanation).toBe('pace during a gap is interpolated, not measured');
  });

  it('a row severe on all three signals returns three specs in the fixed render order, each with a distinct descriptionIdSuffix', () => {
    const row = qualityRow({
      decimation: { tier: 'severe', zeroAdvanceFraction: 0.2, sampleCount: 500 },
      gapProfile: { tier: 'severe', gapFraction: 0.25, recordingGapSec: 700, pauseSec: 50, spanSec: 3000 },
      impossibleSamples: { tier: 'severe', count: 12, maxImpliedSpeedMps: 15, countInsideZeroAdvanceRun: 2 },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs.map((s) => s.signal)).toEqual(['decimation', 'gapProfile', 'impossibleSamples']);
    const suffixes = new Set(specs.map((s) => s.descriptionIdSuffix));
    expect(suffixes.size).toBe(3);
  });

  it('a row at minor tier on all three signals returns zero specs', () => {
    const row = qualityRow({
      decimation: { tier: 'minor', zeroAdvanceFraction: 0.1, sampleCount: 500 },
      gapProfile: { tier: 'minor', gapFraction: 0.1, recordingGapSec: 200, pauseSec: 50, spanSec: 3000 },
      impossibleSamples: { tier: 'minor', count: 3, maxImpliedSpeedMps: 12, countInsideZeroAdvanceRun: 0 },
    });
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });

  it('a row at not-computable tier on all three signals returns zero specs', () => {
    const row = qualityRow({
      decimation: { tier: 'not-computable', zeroAdvanceFraction: null, sampleCount: null },
      gapProfile: { tier: 'not-computable', gapFraction: null, recordingGapSec: null, pauseSec: null, spanSec: null },
      impossibleSamples: { tier: 'not-computable', count: null, maxImpliedSpeedMps: null, countInsideZeroAdvanceRun: null },
    });
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });

  it('a row severe on decimation whose zeroAdvanceFraction is null returns zero specs for that signal, with no null/NaN anywhere in any returned string', () => {
    const row = qualityRow({
      decimation: { tier: 'severe', zeroAdvanceFraction: null, sampleCount: 500 },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toEqual([]);
    for (const spec of specs) {
      expect(spec.visibleText).not.toMatch(/null|NaN/);
    }
  });

  it('uses the singular form for count === 1', () => {
    const row = qualityRow({
      impossibleSamples: { tier: 'severe', count: 1, maxImpliedSpeedMps: 11, countInsideZeroAdvanceRun: 0 },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    expect(specs[0].visibleText).toBe('1 sample faster than the 100 m world record');
  });

  it('uses the plural form for count === 7', () => {
    const row = qualityRow({
      impossibleSamples: { tier: 'severe', count: 7, maxImpliedSpeedMps: 11, countInsideZeroAdvanceRun: 0 },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    expect(specs[0].visibleText).toBe('7 samples faster than the 100 m world record');
  });

  it('never produces a spec for deviceEra or elapsedVsMoving — every returned signal is a member of the closed three-member set', () => {
    const row = qualityRow({
      decimation: { tier: 'severe', zeroAdvanceFraction: 0.2, sampleCount: 500 },
      gapProfile: { tier: 'severe', gapFraction: 0.25, recordingGapSec: 700, pauseSec: 50, spanSec: 3000 },
      impossibleSamples: { tier: 'severe', count: 12, maxImpliedSpeedMps: 15, countInsideZeroAdvanceRun: 2 },
    });
    const specs = qualityBadgeSpecs(row);
    const allowedSignals = new Set(['decimation', 'gapProfile', 'impossibleSamples']);
    for (const spec of specs) {
      expect(allowedSignals.has(spec.signal)).toBe(true);
    }
  });

  it('every returned descriptionIdSuffix differs from low-confidence and pace-disputed', () => {
    const row = qualityRow({
      decimation: { tier: 'severe', zeroAdvanceFraction: 0.2, sampleCount: 500 },
      gapProfile: { tier: 'severe', gapFraction: 0.25, recordingGapSec: 700, pauseSec: 50, spanSec: 3000 },
      impossibleSamples: { tier: 'severe', count: 12, maxImpliedSpeedMps: 15, countInsideZeroAdvanceRun: 2 },
    });
    const specs = qualityBadgeSpecs(row);
    for (const spec of specs) {
      expect(spec.descriptionIdSuffix).not.toBe('low-confidence');
      expect(spec.descriptionIdSuffix).not.toBe('pace-disputed');
    }
  });
});

describe('elevation quality badge text (ELEV-01, D-06, D-10)', () => {
  it('a sub-ground-only severe row returns exactly one spec whose visibleText contains the measured minimum', () => {
    const row = qualityRow({
      elevation: {
        tier: 'severe',
        subGround: { flagged: true, minAltM: -282 },
        closureDrift: { state: 'clear', deltaM: null, startEndDistM: 0 },
        verticalRate: { flagged: false, worstRateMps: 3.3, violatingSamples: 0 },
      },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    expect(specs[0].signal).toBe('elevation');
    expect(specs[0].visibleText).toBe('altitude -282 m below ground');
    expect(specs[0].descriptionIdSuffix).toBe('elevation');
  });

  it('a drift-only severe row returns text showing the ABSOLUTE drift, not the signed value', () => {
    const row = qualityRow({
      elevation: {
        tier: 'severe',
        subGround: { flagged: false, minAltM: 4.2 },
        closureDrift: { state: 'flagged', deltaM: -197.6, startEndDistM: 0 },
        verticalRate: { flagged: false, worstRateMps: 2.3, violatingSamples: 0 },
      },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    expect(specs[0].visibleText).toBe('altitude drift 198 m');
    expect(specs[0].visibleText).not.toContain('-198');
  });

  it('a vertical-rate-only severe row returns text naming the worst rate', () => {
    const row = qualityRow({
      elevation: {
        tier: 'severe',
        subGround: { flagged: false, minAltM: 19.8 },
        closureDrift: { state: 'clear', deltaM: null, startEndDistM: 0 },
        verticalRate: { flagged: true, worstRateMps: 80.4, violatingSamples: 3 },
      },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    expect(specs[0].visibleText).toBe('spike 80 m/s');
  });

  it('a row firing all three modes produces exactly ONE elevation spec whose single visibleText contains all three numbers', () => {
    const row = qualityRow({
      elevation: {
        tier: 'severe',
        subGround: { flagged: true, minAltM: -125.4 },
        closureDrift: { state: 'flagged', deltaM: 164.2, startEndDistM: 0 },
        verticalRate: { flagged: true, worstRateMps: 12.7, violatingSamples: 1 },
      },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs.filter((s) => s.signal === 'elevation')).toHaveLength(1);
    const { visibleText } = specs.filter((s) => s.signal === 'elevation')[0];
    expect(visibleText).toContain('-125');
    expect(visibleText).toContain('164');
    expect(visibleText).toContain('13');
  });

  it("a tier: 'none' row produces no elevation spec", () => {
    const row = qualityRow({
      elevation: {
        tier: 'none',
        subGround: { flagged: false, minAltM: 12 },
        closureDrift: { state: 'clear', deltaM: 4, startEndDistM: 38 },
        verticalRate: { flagged: false, worstRateMps: 1.2, violatingSamples: 0 },
      },
    });
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });

  it("a tier: 'not-computable' row produces no elevation spec", () => {
    const row = qualityRow({
      elevation: {
        tier: 'not-computable',
        subGround: { flagged: false, minAltM: null },
        closureDrift: { state: 'not-computable', deltaM: null, startEndDistM: null },
        verticalRate: { flagged: false, worstRateMps: null, violatingSamples: null },
      },
    });
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });

  it('a severe row whose measured values are all null produces no elevation spec rather than a numberless badge', () => {
    const row = qualityRow({
      elevation: {
        tier: 'severe',
        subGround: { flagged: true, minAltM: null },
        closureDrift: { state: 'flagged', deltaM: null, startEndDistM: 0 },
        verticalRate: { flagged: true, worstRateMps: null, violatingSamples: null },
      },
    });
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });

  it('a row whose quality is undefined (the stale-index G-04 case) still returns an empty array with no TypeError, including for elevation', () => {
    const row = rowMissingQuality();
    expect(() => qualityBadgeSpecs(row)).not.toThrow();
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });
});

describe('CR-01 (30-REVIEW.md) — a row whose quality object lacks elevation does not crash qualityBadgeSpecs', () => {
  it("the fixture helper's own row genuinely lacks the key (not present-and-undefined)", () => {
    const row = rowMissingElevation();
    expect('elevation' in row.quality).toBe(false);
  });

  it('qualityBadgeSpecs returns the other badges and does not throw for a Phase-27-shaped row with no elevation key', () => {
    const row = rowMissingElevation();
    expect(() => qualityBadgeSpecs(row)).not.toThrow();
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });

  it('qualityBadgeSpecs still returns the other three signals\' badges for a row missing elevation but severe elsewhere', () => {
    const row = rowMissingElevation({
      gapProfile: { tier: 'severe', gapFraction: 0.12, recordingGapSec: 300, pauseSec: 60, spanSec: 3000 },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    expect(specs[0].signal).toBe('gapProfile');
  });
});

describe('unreliableSegments quality badge text (SEG-06, D-06, D-08) — 33-11 Task 1', () => {
  it('a severe unreliableSegments signal produces exactly one badge spec with signal "unreliableSegments"', () => {
    const row = qualityRow({
      unreliableSegments: {
        tier: 'severe',
        count: 1,
        totalMetres: 181.5,
        totalExcessMetres: 122.7,
        totalSeconds: 8,
        excessFraction: 0.017964072,
        mechanisms: ['hidden-pause'],
      },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    expect(specs[0].signal).toBe('unreliableSegments');
    expect(specs[0].descriptionIdSuffix).toBe('unreliable-segment');
  });

  it("the badge's visibleText names the measured segment count, total metres, total seconds and the mechanisms that fired", () => {
    const row = qualityRow({
      unreliableSegments: {
        tier: 'severe',
        count: 5,
        totalMetres: 166.2,
        totalExcessMetres: 55.95,
        totalSeconds: 15,
        excessFraction: 0.005292732,
        mechanisms: ['isolated-jump'],
      },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    const { visibleText } = specs[0];
    expect(visibleText).toContain('5');
    expect(visibleText).toContain('166');
    expect(visibleText).toContain('0:15');
    expect(visibleText).toContain('isolated jump');
    expect(visibleText).toBe('5 unreliable segments, 166 m over 0:15 (isolated jump)');
  });

  it("a mechanisms array with more than one distinct mechanism names all of them, in the signal's own declared order", () => {
    const row = qualityRow({
      unreliableSegments: {
        tier: 'severe',
        count: 3,
        totalMetres: 400,
        totalExcessMetres: 40,
        totalSeconds: 30,
        excessFraction: 0.02,
        mechanisms: ['gap-adjacent', 'hidden-pause', 'isolated-jump'],
      },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    expect(specs[0].visibleText).toBe('3 unreliable segments, 400 m over 0:30 (gap adjacent, hidden pause, isolated jump)');
  });

  it("uses the singular 'segment' for count === 1", () => {
    const row = qualityRow({
      unreliableSegments: {
        tier: 'severe',
        count: 1,
        totalMetres: 50,
        totalExcessMetres: 5,
        totalSeconds: 4,
        excessFraction: 0.01,
        mechanisms: ['hidden-pause'],
      },
    });
    const specs = qualityBadgeSpecs(row);
    expect(specs[0].visibleText.startsWith('1 unreliable segment,')).toBe(true);
    expect(specs[0].visibleText).not.toContain('1 unreliable segments');
  });

  it("a 'minor' tier unreliableSegments signal produces no badge (D-06: only severe badges a list row)", () => {
    const row = qualityRow({
      unreliableSegments: {
        tier: 'minor',
        count: 16,
        totalMetres: 2148.7,
        totalExcessMetres: 0,
        totalSeconds: 751,
        excessFraction: 0,
        mechanisms: ['gap-adjacent'],
      },
    });
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });

  it("a 'none' tier unreliableSegments signal produces no badge", () => {
    const row = qualityRow({
      unreliableSegments: { tier: 'none', count: 0, totalMetres: 0, totalExcessMetres: 0, totalSeconds: 0, excessFraction: 0, mechanisms: [] },
    });
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });

  it("a 'not-computable' tier unreliableSegments signal produces no badge", () => {
    const row = qualityRow({
      unreliableSegments: {
        tier: 'not-computable',
        count: null,
        totalMetres: null,
        totalExcessMetres: null,
        totalSeconds: null,
        excessFraction: null,
        mechanisms: null,
      },
    });
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });

  it('a severe signal whose count/totalMetres/totalSeconds/mechanisms are somehow null produces no badge, via unreliableSegmentsBadgeContent\'s null-evidence defence', () => {
    const row = qualityRow({
      unreliableSegments: {
        tier: 'severe',
        count: null,
        totalMetres: null,
        totalExcessMetres: null,
        totalSeconds: null,
        excessFraction: 0.5,
        mechanisms: null,
      },
    });
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });

  it('a signal object absent entirely from quality (a pre-Phase-33 cached index.json) produces no badge and does not throw', () => {
    const row = rowMissingUnreliableSegments({
      gapProfile: { tier: 'severe', gapFraction: 0.12, recordingGapSec: 300, pauseSec: 60, spanSec: 3000 },
    });
    expect('unreliableSegments' in row.quality).toBe(false);
    expect(() => qualityBadgeSpecs(row)).not.toThrow();
    const specs = qualityBadgeSpecs(row);
    // The other severe signal (gapProfile) still produces its own badge —
    // the absent unreliableSegments key silently contributes zero specs,
    // never a crash that would take the whole render loop down with it.
    expect(specs.map((s) => s.signal)).toEqual(['gapProfile']);
  });

  it('no other badge source\'s output changes for a fixture that is ALSO severe on unreliableSegments', () => {
    const row = qualityRow({
      decimation: { tier: 'severe', zeroAdvanceFraction: 0.2, sampleCount: 500 },
      unreliableSegments: {
        tier: 'severe',
        count: 1,
        totalMetres: 181.5,
        totalExcessMetres: 122.7,
        totalSeconds: 8,
        excessFraction: 0.017964072,
        mechanisms: ['hidden-pause'],
      },
    });
    const withoutUnreliable = qualityRow({
      decimation: { tier: 'severe', zeroAdvanceFraction: 0.2, sampleCount: 500 },
    });
    const decimationSpecWith = qualityBadgeSpecs(row).find((s) => s.signal === 'decimation');
    const decimationSpecWithout = qualityBadgeSpecs(withoutUnreliable).find((s) => s.signal === 'decimation');
    expect(decimationSpecWith).toEqual(decimationSpecWithout);
  });

  it('the composed row aria-label includes the new badge text when unreliableSegments is severe', () => {
    const row = baseRow({
      quality: {
        ...CLEAN_QUALITY,
        unreliableSegments: {
          tier: 'severe',
          count: 1,
          totalMetres: 181.5,
          totalExcessMetres: 122.7,
          totalSeconds: 8,
          excessFraction: 0.017964072,
          mechanisms: ['hidden-pause'],
        },
      },
    });
    const label = activityRowAriaLabel(row);
    expect(label).toBe('Morning Run, Aug 6, 2026, 5.0 km, 1 unreliable segment, 182 m over 0:08 (hidden pause)');
  });

  it('the composed row aria-label is unchanged (the clean-row baseline) when unreliableSegments is not severe', () => {
    const row = baseRow({
      quality: { ...CLEAN_QUALITY, unreliableSegments: { tier: 'minor', count: 2, totalMetres: 40, totalExcessMetres: 0, totalSeconds: 10, excessFraction: 0, mechanisms: ['gap-adjacent'] } },
    });
    expect(activityRowAriaLabel(row)).toBe('Morning Run, Aug 6, 2026, 5.0 km');
  });
});

describe('qualityBadgeDescriptionId — quality badge id shape, mirroring lowConfidenceDescriptionId/paceDisputedDescriptionId', () => {
  it('produces two different ids for the card prefix and the table prefix of the same activity', () => {
    const cardId = qualityBadgeDescriptionId('activity-card-123', 'gap-profile');
    const tableId = qualityBadgeDescriptionId('activity-table-123', 'gap-profile');
    expect(cardId).not.toBe(tableId);
    expect(cardId).toBe('activity-card-123-quality-gap-profile-desc');
    expect(tableId).toBe('activity-table-123-quality-gap-profile-desc');
  });

  it('produces a distinct id from lowConfidenceDescriptionId and paceDisputedDescriptionId for the same idPrefix', () => {
    const idPrefix = 'activity-card-456';
    expect(qualityBadgeDescriptionId(idPrefix, 'decimation')).not.toBe(lowConfidenceDescriptionId(idPrefix));
    expect(qualityBadgeDescriptionId(idPrefix, 'decimation')).not.toBe(paceDisputedDescriptionId(idPrefix));
  });
});

describe('existing badges unregressed (Task 2, T-27-23) — the two pre-existing badges did not regress', () => {
  it('the two sentinel strings are byte-identical literal values', () => {
    expect(LOW_CONFIDENCE_BADGE_TEXT).toBe('Low confidence');
    expect(PACE_DISPUTED_BADGE_TEXT).toBe('Pace disputed');
  });

  it('statusBadgeTexts is byte-identical for a low-confidence row: exactly ["Low confidence"]', () => {
    expect(statusBadgeTexts(baseRow({ lowConfidence: true }))).toEqual(['Low confidence']);
  });

  it('a row that is BOTH pace-disputed AND severe on gapProfile keeps the two paths from interfering', () => {
    const row = baseRow({
      paceDisagreement: { streamPaceSecPerKm: 350.6, metadataPaceSecPerKm: 112.6, ratio: 3.11 },
      quality: {
        ...CLEAN_QUALITY,
        gapProfile: { tier: 'severe', gapFraction: 0.3, recordingGapSec: 800, pauseSec: 100, spanSec: 3000 },
      },
    });
    expect(statusBadgeTexts(row)).toEqual(['Pace disputed']);
    expect(statusBadgeTexts(row)).toContain(PACE_DISPUTED_BADGE_TEXT);
    const specs = qualityBadgeSpecs(row);
    expect(specs).toHaveLength(1);
    expect(specs[0].signal).toBe('gapProfile');
  });

  it('paceDisputedDescriptionId and lowConfidenceDescriptionId outputs are unchanged for a given idPrefix', () => {
    expect(lowConfidenceDescriptionId('activity-card-789')).toBe('activity-card-789-low-confidence-desc');
    expect(paceDisputedDescriptionId('activity-card-789')).toBe('activity-card-789-pace-disputed-desc');
  });

  it('activityRowAriaLabel is byte-identical to its pre-change output for a row with no quality signals', () => {
    expect(activityRowAriaLabel(baseRow())).toBe('Morning Run, Aug 6, 2026, 5.0 km');
  });

  it('activityRowAriaLabel for a severe row ends with the quality badge text appended after the status badge texts, in order', () => {
    const row = baseRow({
      lowConfidence: true,
      quality: {
        ...CLEAN_QUALITY,
        gapProfile: { tier: 'severe', gapFraction: 0.12, recordingGapSec: 300, pauseSec: 60, spanSec: 3000 },
      },
    });
    const label = activityRowAriaLabel(row);
    expect(label).toBe(
      'Morning Run, Aug 6, 2026, 5.0 km, Low confidence, 12% of recorded time in gaps, pauses or unreliable segments'
    );
  });

  it('qualityBadgeSpecs returns the same result regardless of idPrefix/surface — there is no surface-specific branching to have', () => {
    const row = qualityRow({
      gapProfile: { tier: 'severe', gapFraction: 0.12, recordingGapSec: 300, pauseSec: 60, spanSec: 3000 },
    });
    // qualityBadgeSpecs takes no idPrefix/surface argument at all — calling
    // it twice with the identical row produces the identical result,
    // because there is no surface-specific input to vary.
    expect(qualityBadgeSpecs(row)).toEqual(qualityBadgeSpecs(row));
  });
});

/**
 * A row shaped like a pre-Phase-27 (or partially-regenerated) parsed
 * `index.json` entry: `quality` genuinely ABSENT as a key, not set to an
 * explicit value — mirrors `rowMissingPaceDisagreement` above verbatim for
 * the G-04 hazard on this newer, REQUIRED field (27-REVIEW.md CR-01).
 * `quality` has no `| null` variant on `DashboardIndexRow` the way
 * `paceDisagreement` does, so there is no explicit-null fixture to
 * contrast against here — a browser tab left open across a deploy, or a
 * CDN edge still serving a cached pre-Phase-27 `index.json` during its
 * cache TTL, produces exactly this shape (schemaVersion does not bump for
 * a purely additive field per `dashboard-index.types.ts`).
 */
function rowMissingQuality(): DashboardIndexRow {
  const full: ParsedDashboardIndexRow = baseRow();
  const { quality, ...withoutKey } = full;
  void quality;
  return withoutKey as DashboardIndexRow;
}

/**
 * A row shaped like a pre-Phase-30 parsed `index.json` entry: `quality` is
 * present with all five original sub-keys, but `elevation` is genuinely
 * ABSENT as a key (30-REVIEW.md CR-01) — the exact shape a browser cache
 * or a staged build lagging the bundle serves. Mirrors `rowMissingQuality`
 * and `rowMissingPaceDisagreement` above, one level deeper: the top-level
 * `quality` key survives the cast, only its newest sub-key does not.
 */
function rowMissingElevation(overrides: Partial<ActivityQualitySignals> = {}): DashboardIndexRow {
  const fullQuality: ActivityQualitySignals = { ...CLEAN_QUALITY, ...overrides };
  const { elevation, ...qualityWithoutElevation } = fullQuality;
  void elevation;
  return baseRow({ quality: qualityWithoutElevation as ActivityQualitySignals });
}

/**
 * A row shaped like a pre-Phase-33 parsed `index.json` entry: `quality` is
 * present with all six original sub-keys, but `unreliableSegments` is
 * genuinely ABSENT as a key (CR-01, 30-REVIEW.md precedent) — the exact
 * shape a browser cache or a staged build lagging the bundle serves.
 * Mirrors `rowMissingElevation` one level deeper: the top-level `quality`
 * key survives the cast, only its newest sub-key does not.
 */
function rowMissingUnreliableSegments(overrides: Partial<ActivityQualitySignals> = {}): DashboardIndexRow {
  const fullQuality: ActivityQualitySignals = { ...CLEAN_QUALITY, ...overrides };
  const { unreliableSegments, ...qualityWithoutUnreliableSegments } = fullQuality;
  void unreliableSegments;
  return baseRow({ quality: qualityWithoutUnreliableSegments as ActivityQualitySignals });
}

describe('G-04 (27-REVIEW.md CR-01) — a row missing quality does not crash qualityBadgeSpecs or the render loop', () => {
  it("the fixture helper's own row genuinely lacks the key (not present-and-undefined)", () => {
    const row = rowMissingQuality();
    expect('quality' in row).toBe(false);
  });

  it('qualityBadgeSpecs returns [] for the missing-key row, rather than throwing (function level)', () => {
    const row = rowMissingQuality();
    expect(() => qualityBadgeSpecs(row)).not.toThrow();
    expect(qualityBadgeSpecs(row)).toEqual([]);
  });

  it('activityRowAriaLabel does not throw for the missing-key row and still folds the curated base label', () => {
    const row = rowMissingQuality();
    expect(() => activityRowAriaLabel(row)).not.toThrow();
    expect(activityRowAriaLabel(row)).toBe('Morning Run, Aug 6, 2026, 5.0 km');
  });

  it('a for-of loop mirroring buildMobileCardList/buildDesktopTable\'s own `for (const row of pageItems)` shape completes over every row, including the missing-quality one, without throwing (render-loop level — activityRowAriaLabel is the exact call every renderActivityRow/buildTableRow iteration makes unconditionally; the DOM-construction half of that loop cannot be exercised in this node-environment suite, see file header)', () => {
    const pageItems: DashboardIndexRow[] = [
      baseRow({ id: '1', name: 'First' }),
      rowMissingQuality(),
      baseRow({ id: '3', name: 'Third' }),
    ];
    const labels: string[] = [];
    expect(() => {
      for (const row of pageItems) {
        labels.push(activityRowAriaLabel(row));
      }
    }).not.toThrow();
    expect(labels).toHaveLength(3);
    expect(labels[1]).toBe('Morning Run, Aug 6, 2026, 5.0 km');
  });

  it('positive control: a row with a real severe quality signal still produces a badge through qualityBadgeSpecs — the guard does not swallow real signals', () => {
    const row = qualityRow({
      gapProfile: { tier: 'severe', gapFraction: 0.5, recordingGapSec: 10, pauseSec: 10, spanSec: 20 },
    });
    expect(qualityBadgeSpecs(row)).toHaveLength(1);
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

// D-11 (26-08): paceDisputedDescriptionId mirrors lowConfidenceDescriptionId's
// naming scheme, with a distinct suffix so the two descriptions never collide
// on a row that is BOTH low-confidence AND pace-disputed at once.
describe('paceDisputedDescriptionId — D-11 distinct-suffix id, mirroring lowConfidenceDescriptionId', () => {
  it('produces two different ids for the card prefix and the table prefix of the same activity', () => {
    const cardId = paceDisputedDescriptionId('activity-card-123');
    const tableId = paceDisputedDescriptionId('activity-table-123');
    expect(cardId).not.toBe(tableId);
    expect(cardId).toBe('activity-card-123-pace-disputed-desc');
    expect(tableId).toBe('activity-table-123-pace-disputed-desc');
  });

  it('produces a distinct id from lowConfidenceDescriptionId for the same idPrefix', () => {
    const idPrefix = 'activity-card-456';
    expect(paceDisputedDescriptionId(idPrefix)).not.toBe(lowConfidenceDescriptionId(idPrefix));
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

describe('severe filter wiring (27-08, D-16)', () => {
  const listSource = readFileSync(new URL('./list.ts', import.meta.url), 'utf8');
  const listStripped = stripComments(listSource);

  // No jsdom in this repo (17-RESEARCH.md Pitfall 4) — buildQualityField,
  // buildFilterPanel and the checkbox's DOM wiring cannot be exercised
  // directly. What IS assertable without a DOM: the pure chip/count/clear
  // machinery (imported from list-logic.js, already covered end to end in
  // list-logic.test.ts's "severe filter" describe block) plus a source-text
  // check that list.ts's own wiring actually calls the new field builder
  // with the change event, following this file's own readFileSync-over-
  // its-own-source precedent (CR-01's wiring tests above).

  it('buildFilterChips/removeChip/activeFilterCount produce the expected results for an anySevere: true state', () => {
    const filters = { ...EMPTY_FILTERS, anySevere: true };
    expect(buildFilterChips(filters)).toEqual([{ key: 'quality', label: 'severe signals only' }]);
    expect(activeFilterCount(filters)).toBe(1);
    expect(removeChip(filters, 'quality')).toEqual(EMPTY_FILTERS);
  });

  it('buildFilterPanel calls buildQualityField, appended after buildDurationField', () => {
    const panelStart = listStripped.indexOf('function buildFilterPanel(');
    const panelEnd = listStripped.indexOf('\n}', panelStart);
    expect(panelStart).toBeGreaterThanOrEqual(0);
    expect(panelEnd).toBeGreaterThan(panelStart);
    const panelBody = listStripped.slice(panelStart, panelEnd);

    expect(panelBody).toContain('buildQualityField(');

    const durationCallIdx = panelBody.indexOf('buildDurationField(');
    const qualityCallIdx = panelBody.indexOf('buildQualityField(');
    expect(durationCallIdx).toBeGreaterThanOrEqual(0);
    expect(qualityCallIdx).toBeGreaterThan(durationCallIdx);
  });

  it('buildQualityField wires the checkbox to "change", not "input"', () => {
    const fnStart = listStripped.indexOf('function buildQualityField(');
    const fnEnd = listStripped.indexOf('\n}', fnStart);
    expect(fnStart).toBeGreaterThanOrEqual(0);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const fnBody = listStripped.slice(fnStart, fnEnd);

    expect(fnBody).toContain("addEventListener('change'");
    expect(fnBody).not.toContain("addEventListener('input'");
    expect(fnBody).not.toContain("addEventListener('keydown'");
  });

  it('buildQualityField( occurs exactly twice — one definition, one buildFilterPanel call site', () => {
    const matches = listStripped.match(/buildQualityField\(/g) || [];
    expect(matches.length).toBe(2);
  });

  it('composeRowAriaLabel( still occurs exactly twice in the stripped source — this plan does not touch the aria-label fold', () => {
    const matches = listStripped.match(/composeRowAriaLabel\(/g) || [];
    expect(matches.length).toBe(2);
  });
});

describe('Task 3 (33-11): end-to-end badge proof on the named activities — compute -> serialise -> parse -> render', () => {
  const NAMED_ACTIVITY_IDS = ['3475724402', '3475734189', '3475740390'] as const;

  function buildMetadata(stream: CanonicalStream): ActivityQualityMetadata {
    return {
      deviceName: 'test-device',
      sourceProvider: undefined,
      elapsedTimeSec: stream.t[stream.t.length - 1] - stream.t[0],
      movingTimeSec: stream.t[stream.t.length - 1] - stream.t[0],
      startLatlng: undefined,
      endLatlng: undefined,
    };
  }

  it.each(NAMED_ACTIVITY_IDS)(
    'named activities %s: qualityBadgeSpecs on the parsed, wire-shaped signal reproduces the computed measured value exactly, badge present exactly when the observed tier is severe',
    (id) => {
      const stream = JSON.parse(readFileSync(`data/streams/${id}.json`, 'utf-8')) as CanonicalStream;
      const metadata = buildMetadata(stream);

      const rawShard = buildPaceQualityShard(id, stream, metadata);
      const computedSignal = rawShard.signals.unreliableSegments;

      // The same serialise/parse hop Task 3's detail-sections.test.ts
      // companion case performs — a genuine wire-shaped document, not the
      // in-memory object handed straight to qualityBadgeSpecs.
      const wireQuality = JSON.parse(JSON.stringify(rawShard.signals)) as ActivityQualitySignals;

      const row = baseRow({ quality: wireQuality });
      const specs = qualityBadgeSpecs(row);
      const spec = specs.find((s) => s.signal === 'unreliableSegments');

      if (computedSignal.tier === 'severe') {
        expect(spec).toBeDefined();
        expect(spec?.visibleText).toContain(String(computedSignal.count));
        expect(spec?.visibleText).toContain(`${Math.round(computedSignal.totalMetres as number)} m`);
        for (const mechanism of computedSignal.mechanisms ?? []) {
          expect(spec?.visibleText).toContain(segmentMechanismLabel(mechanism));
        }
      } else {
        expect(spec).toBeUndefined();
      }

      // eslint-disable-next-line no-console
      console.log(
        `[33-11 Task 3 list badge named activity ${id}] tier=${computedSignal.tier} badgePresent=${spec !== undefined} ` +
          `visibleText=${JSON.stringify(spec?.visibleText ?? null)}`
      );
    }
  );

  it("named activities: at least one of the three produces a badge, so this proof cannot pass vacuously against a pipeline that found nothing severe", () => {
    const specsPerActivity = NAMED_ACTIVITY_IDS.map((id) => {
      const stream = JSON.parse(readFileSync(`data/streams/${id}.json`, 'utf-8')) as CanonicalStream;
      const metadata = buildMetadata(stream);
      const rawShard = buildPaceQualityShard(id, stream, metadata);
      const row = baseRow({ quality: rawShard.signals });
      return qualityBadgeSpecs(row).find((s) => s.signal === 'unreliableSegments');
    });
    expect(specsPerActivity.some((s) => s !== undefined)).toBe(true);
  });
});
