/**
 * Continuous daily-spine CTL/ATL/TSB recursion (TREND-04, D-16).
 *
 * Pure, client-safe module — no `fs`, no `fetch`, no DOM.
 *
 * Pitfall 3 (18-RESEARCH.md § Common Pitfalls): if the CTL/ATL recursion
 * only steps forward on days that have a logged activity, the decay term
 * never applies across rest days or gaps, producing a series that doesn't
 * decay during breaks — defeating the entire point of a fitness/freshness
 * chart. This module's `buildDailySpine` walks every CALENDAR day (UTC
 * midnight, matching `streak-utils.ts`'s `normalizeToUTCMidnight`
 * convention), not activity days, from first to last inclusive. Days
 * absent from the input map still decay.
 *
 * Pitfall 4 (18-RESEARCH.md § Common Pitfalls): TSB computed as
 * `ctl[today] - atl[today]` (rather than yesterday's values) folds today's
 * own training stress into the "form" reading for today, inverting the
 * metric's intended meaning (form going INTO today's session, before it
 * happens). `computeCtlAtlTsb` captures `tsb` from the PRIOR day's ctl/atl
 * BEFORE applying today's decay step. A future edit that moves the capture
 * below the update inverts the metric's meaning — see the inline comment
 * at the capture site.
 */

/** Standard fitness (Chronic Training Load) time constant, in days (D-16). */
export const CTL_TAU_DAYS = 42;
/** Standard fatigue (Acute Training Load) time constant, in days (D-16). */
export const ATL_TAU_DAYS = 7;

/**
 * Every `YYYY-MM-DD` calendar day from `firstISO` to `lastISO` inclusive,
 * stepping by `setUTCDate(+1)`, UTC only. Returns `[]` when either input is
 * unparseable or `lastISO < firstISO`. This is the fix for Pitfall 3: the
 * spine is calendar days, not activity days.
 */
export function buildDailySpine(firstISO: string, lastISO: string): string[] {
  const first = new Date(firstISO + 'T00:00:00Z');
  const last = new Date(lastISO + 'T00:00:00Z');

  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return [];
  if (last.getTime() < first.getTime()) return [];

  const days: string[] = [];
  const cursor = new Date(first.getTime());
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * One exponential decay step toward `todayLoad` with time constant
 * `tauDays`. Uses the exact exponential form `prev + (todayLoad - prev) *
 * (1 - e^(-1/tauDays))`, not the `/tau` linear approximation.
 */
export function decayStep(prev: number, todayLoad: number, tauDays: number): number {
  return prev + (todayLoad - prev) * (1 - Math.exp(-1 / tauDays));
}

export interface DailyLoadPoint {
  date: string;
  trimp: number;
  ctl: number;
  atl: number;
  tsb: number;
}

/**
 * Walks `buildDailySpine(firstISO, lastISO)` and, for each day, captures
 * `tsb = ctl - atl` from the values carried in from the PREVIOUS day BEFORE
 * applying today's decay step, then updates `ctl` and `atl` with today's
 * load. Days absent from `dailyTrimpByDate` contribute `trimp: 0` and still
 * decay. Per Pitfall 4: the emitted `tsb` for date D is derived from D-1's
 * CTL and ATL — moving this capture to after the update inverts the
 * metric's meaning.
 */
export function computeCtlAtlTsb(
  dailyTrimpByDate: ReadonlyMap<string, number>,
  firstISO: string,
  lastISO: string
): DailyLoadPoint[] {
  const spine = buildDailySpine(firstISO, lastISO);

  const points: DailyLoadPoint[] = [];
  let ctl = 0;
  let atl = 0;

  for (const date of spine) {
    const todayLoad = dailyTrimpByDate.get(date) ?? 0;

    // Capture BEFORE updating — tsb for `date` reflects the state going
    // INTO this day, carried in from the previous iteration. Do not move
    // this line below the decayStep calls (Pitfall 4).
    const tsb = ctl - atl;

    ctl = decayStep(ctl, todayLoad, CTL_TAU_DAYS);
    atl = decayStep(atl, todayLoad, ATL_TAU_DAYS);

    points.push({ date, trimp: todayLoad, ctl, atl, tsb });
  }

  return points;
}
