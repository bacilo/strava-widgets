/**
 * Wiring tests (quick 261127-gha): mount each REAL chart builder against a
 * fake Chart constructor, capture the config, and assert the tooltip `title`
 * callback exists and returns a hand-written string. Expected values are
 * literals — never computed via chart-tooltip-title.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => [] as { canvas: unknown; config: any }[]);

vi.mock('chart.js', () => {
  class FakeChart {
    static register(): void {}
    tooltip = { setActiveElements(): void {} };
    options: unknown;
    constructor(canvas: unknown, config: any) {
      this.options = config.options;
      captured.push({ canvas, config });
    }
    resize(): void {}
    destroy(): void {}
    update(): void {}
  }
  const dummy = (name: string) => ({ id: name });
  return {
    Chart: FakeChart,
    BarController: dummy('BarController'),
    BarElement: dummy('BarElement'),
    LineController: dummy('LineController'),
    LineElement: dummy('LineElement'),
    PointElement: dummy('PointElement'),
    LinearScale: dummy('LinearScale'),
    CategoryScale: dummy('CategoryScale'),
    Tooltip: dummy('Tooltip'),
    Filler: dummy('Filler'),
    Decimation: dummy('Decimation'),
    Legend: dummy('Legend'),
  };
});

vi.mock('./chart-zoom.js', () => ({
  chartZoomPlugin: { id: 'zoom' },
  buildZoomPluginOptions: () => ({}),
  attachZoomController: () => ({
    settle: () => {},
    applyRange: () => {},
    currentRange: () => null,
    destroy: () => {},
  }),
}));

class FakeElement {
  children: FakeElement[] = [];
  attrs: Record<string, string> = {};
  className = '';
  textContent = '';
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  parentElement: FakeElement | null = null;
  listeners: Record<string, ((...a: any[]) => void)[]> = {};
  classList = {
    add: () => {},
    remove: () => {},
    toggle: () => {},
    contains: () => false,
  };
  constructor(public tag: string) {}
  appendChild(c: FakeElement): FakeElement {
    c.parentElement = this;
    this.children.push(c);
    return c;
  }
  append(...cs: FakeElement[]): void {
    for (const c of cs) this.appendChild(c);
  }
  replaceChildren(...cs: FakeElement[]): void {
    this.children = [];
    this.append(...cs);
  }
  remove(): void {}
  setAttribute(k: string, v: string): void {
    this.attrs[k] = String(v);
  }
  getAttribute(k: string): string | null {
    return this.attrs[k] ?? null;
  }
  removeAttribute(k: string): void {
    delete this.attrs[k];
  }
  addEventListener(type: string, fn: (...a: any[]) => void): void {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(): void {}
  querySelector(): null {
    return null;
  }
  querySelectorAll(): [] {
    return [];
  }
  getContext(): null {
    return null;
  }
  focus(): void {}
}

function find(root: FakeElement, pred: (e: FakeElement) => boolean): FakeElement | null {
  if (pred(root)) return root;
  for (const c of root.children) {
    const r = find(c, pred);
    if (r) return r;
  }
  return null;
}

vi.stubGlobal('document', {
  documentElement: new FakeElement('html'),
  createElement: (tag: string) => new FakeElement(tag),
  createTextNode: (t: string) => {
    const e = new FakeElement('#text');
    e.textContent = t;
    return e;
  },
});
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));

import { mountChannelBands, mountTrainingLoadChart, mountVolumeChart } from './trends-charts.js';
import { mountEvolutionCharts } from './records-charts.js';
import { mountChartBands } from './detail-charts.js';

const zoomOpts = { header: new FakeElement('div') as any, savedRange: null, onRangeChange: () => {} };
const noHeader = { savedRange: null, onRangeChange: () => {} };
const canvas = () => new FakeElement('canvas') as any;

function titleOf(cfg: any): (items: any[]) => string {
  const t = cfg.options.plugins.tooltip.callbacks.title;
  expect(typeof t).toBe('function');
  return t;
}

const NOV23 = Date.UTC(2026, 10, 23);

beforeEach(() => {
  captured.length = 0;
});

describe('Volume chart tooltip title', () => {
  const vp = (x: number) => ({ x, km: 10, runs: 1, label: 'l' });
  const cases: [string, 'weekly' | 'monthly' | 'yearly', number, string][] = [
    ['weekly', 'weekly', NOV23, 'Week of 23 Nov 2026'],
    ['monthly', 'monthly', Date.UTC(2026, 10, 1), 'November 2026'],
    ['yearly', 'yearly', Date.UTC(2026, 0, 1), '2026'],
  ];
  for (const [name, gran, x, expected] of cases) {
    it(`empty-bounds branch, ${name}`, () => {
      mountVolumeChart(canvas(), [], gran, zoomOpts);
      expect(captured).toHaveLength(1);
      const title = titleOf(captured[0].config);
      expect(title([{ parsed: { x } }])).toBe(expected);
      expect(title([])).toBe('');
    });
    it(`zoom branch, ${name}`, () => {
      mountVolumeChart(canvas(), [vp(x), vp(x + 7 * 86400000)], gran, zoomOpts);
      expect(captured).toHaveLength(1);
      expect(titleOf(captured[0].config)([{ parsed: { x } }])).toBe(expected);
    });
  }
});

describe('Cadence & HR bands tooltip title', () => {
  it('both bands show the month', () => {
    const mp = (x: number) => ({ x, monthKey: 'k', value: 80, runs: 1, contributing: 1 });
    mountChannelBands(new FakeElement('div') as any, [mp(Date.UTC(2025, 7, 1)), mp(Date.UTC(2025, 8, 1))], [mp(Date.UTC(2025, 8, 1))], noHeader);
    expect(captured).toHaveLength(2);
    for (const c of captured) expect(titleOf(c.config)([{ parsed: { x: Date.UTC(2025, 8, 1) } }])).toBe('September 2025');
  });
  it('both bands answer hover anywhere over the band (points are hidden, pointRadius 0)', () => {
    const mp = (x: number) => ({ x, monthKey: 'k', value: 80, runs: 1, contributing: 1 });
    mountChannelBands(new FakeElement('div') as any, [mp(Date.UTC(2025, 7, 1))], [mp(Date.UTC(2025, 7, 1))], noHeader);
    expect(captured).toHaveLength(2);
    for (const c of captured) expect((c.config as any).options.interaction).toEqual({ mode: 'index', intersect: false });
  });
});

describe('Training Load tooltip title', () => {
  const lp = (x: number) => ({ x, ctl: 1, atl: 1, tsb: 0, trimp: 1 });
  it('empty branch', () => {
    mountTrainingLoadChart(canvas(), [], [], zoomOpts);
    expect(captured).toHaveLength(1);
    expect(titleOf(captured[0].config)([{ parsed: { x: NOV23 } }])).toBe('Mon 23 Nov 2026');
  });
  it('zoom branch', () => {
    mountTrainingLoadChart(canvas(), [lp(NOV23 - 86400000), lp(NOV23)], [], zoomOpts);
    expect(captured).toHaveLength(1);
    expect(titleOf(captured[0].config)([{ parsed: { x: NOV23 } }])).toBe('Mon 23 Nov 2026');
  });
});

describe('Records evolution tooltip title', () => {
  it('shows the effort date', () => {
    mountEvolutionCharts([
      { distance: '5k' as any, displayName: '5K', canvas: canvas(), points: [{ x: Date.UTC(2025, 2, 14), y: 1200, activityId: 'a' }] },
    ]);
    expect(captured).toHaveLength(1);
    expect(titleOf(captured[0].config)([{ parsed: { x: Date.UTC(2025, 2, 14) } }])).toBe('14 Mar 2025');
  });
});

describe('Activity detail tooltip title', () => {
  it('distance mode then time mode after toggle', () => {
    const t: number[] = [];
    const d: number[] = [];
    for (let s = 0; s <= 1000; s++) {
      t.push(s);
      d.push(s * 10);
    }
    const stream: any = {
      schemaVersion: 1,
      id: 'x',
      source: 'fit',
      distanceSource: 'native',
      sampleCount: t.length,
      channels: { time: true, distance: true, hr: false, cadence: false, elevation: false },
      t,
      d,
    };
    const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} } as any;
    const container = new FakeElement('div');
    mountChartBands(container as any, { stream, storage });
    expect(captured.length).toBeGreaterThan(0);
    const cfg = captured[captured.length - 1].config;
    const primary = cfg.data.datasets.length - 1;
    expect(titleOf(cfg)([{ datasetIndex: primary, parsed: { x: 3.4512 } }])).toBe('3.45 km');
    expect(titleOf(cfg)([])).toBe('');

    const timeBtn = find(container, (e) => e.textContent === 'Time' && !!e.listeners.click);
    expect(timeBtn).not.toBeNull();
    const before = captured.length;
    timeBtn!.listeners.click[0]();
    expect(captured.length).toBeGreaterThan(before);
    const cfg2 = captured[captured.length - 1].config;
    const primary2 = cfg2.data.datasets.length - 1;
    expect(titleOf(cfg2)([{ datasetIndex: primary2, parsed: { x: 754 } }])).toBe('12:34');
  });
});
