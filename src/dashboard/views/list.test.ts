import { describe, it, expect } from 'vitest';
import { formatActivityDate, formatPace, formatEffortDuration, highlightAndFocus } from './list.js';

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
