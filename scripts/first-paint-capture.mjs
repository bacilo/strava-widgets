#!/usr/bin/env node
/**
 * First-paint capture harness (GAP-25-01 reachability proof).
 *
 * Proves, on THIS hardware, whether a capture mechanism exists that can obtain
 * a raster frame at or before a page's own `first-paint` timing entry. It
 * exists because a browser-extension screenshot round trip measured a floor
 * of ~855 ms from navigation start against a 612 ms first paint (Round 1,
 * plan 25-07, R2 BLOCKED) — a frame saved ~243 ms after first-paint cannot
 * discriminate a first-paint white flash from its absence, because the flash
 * would already have ended.
 *
 * Zero new dependencies: Node's global `WebSocket` and `fetch` (both built-in
 * since Node 21+; this repo runs v25.2.1) are enough to speak the Chrome
 * DevTools Protocol directly. ESM, Node built-ins only, matching
 * scripts/verify-dashboard-publish.mjs's and scripts/build-widgets.mjs's
 * house style ("this script deliberately does not attempt to fake [a real
 * browser] with a fully-invisible-window dependency").
 *
 * This harness launches Chrome with a REAL, VISIBLE window (never an
 * invisible/off-screen rendering mode — that mode does not follow the macOS
 * Appearance setting, which would silently defeat D-05's dark-OS
 * discriminator) with a throwaway --user-data-dir, drives
 * Page.startScreencast (or one of two other candidate mechanisms) over a raw
 * CDP WebSocket, and reports each captured frame's timestamp against that
 * SAME navigation's own performance.timeOrigin + first-paint startTime —
 * never against wall-clock proximity to the reload, which GAP-25-01 clause 3
 * explicitly forbids as an attribution method.
 *
 * Exit code reports whether the HARNESS worked (Chrome launched, CDP socket
 * opened, page loaded) — NOT whether a frame beat first paint. That is a
 * measurement, recorded in report.json, not a pass/fail.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEFAULT_URL = 'https://bacilo.github.io/strava-widgets/';

// --- CLI argument parsing ---------------------------------------------------

function argValue(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

const url = argValue('--url', DEFAULT_URL);
const mechanism = argValue('--mechanism', null);
const throttleMs = Number(argValue('--throttle-ms', '1000'));
const keepOpen = process.argv.includes('--keep-open');
const outDir = argValue(
  '--out',
  join(
    process.cwd(),
    '.planning/phases/25-ci-hardening-light-theme-verification/capture',
    new Date().toISOString().replace(/[:.]/g, '-')
  )
);

if (!mechanism || !['screencast', 'screenshot-burst', 'throttled'].includes(mechanism)) {
  console.error(
    'Usage: node scripts/first-paint-capture.mjs --mechanism <screencast|screenshot-burst|throttled> ' +
      '[--url URL] [--throttle-ms N] [--out DIR] [--keep-open]'
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

// --- Small helpers -----------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, { timeoutMs = 15000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await fn();
    if (result) return result;
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await sleep(intervalMs);
  }
}

// --- Minimal PNG pixel sampler (no image library) ---------------------------
// Decodes a PNG's IDAT stream with node:zlib's inflateSync and reads a small
// fixed sample set (four corners inset by 8px, plus the centre) by walking
// the un-filtered scanlines. Assumes 8-bit RGB or RGBA color type (Chrome
// screenshots are always one of these), and un-filters using the standard
// PNG filter types 0 (None) and 2 (Up), which is sufficient for the flat,
// low-entropy solid-color frames a first-paint capture actually produces. If
// a frame uses a filter type this sampler cannot handle, the sample is
// reported as `not-sampled` rather than guessed.

function readPngChunks(buf) {
  const chunks = [];
  let offset = 8; // skip PNG signature
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return chunks;
}

function samplePngColors(pngBuffer) {
  try {
    const chunks = readPngChunks(pngBuffer);
    const ihdr = chunks.find((c) => c.type === 'IHDR');
    if (!ihdr) return null;
    const width = ihdr.data.readUInt32BE(0);
    const height = ihdr.data.readUInt32BE(4);
    const bitDepth = ihdr.data.readUInt8(8);
    const colorType = ihdr.data.readUInt8(9);
    if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
      return { notSampled: true, reason: `unsupported PNG format (bitDepth=${bitDepth}, colorType=${colorType})` };
    }
    const channels = colorType === 6 ? 4 : 3;
    const idatChunks = chunks.filter((c) => c.type === 'IDAT').map((c) => c.data);
    const compressed = Buffer.concat(idatChunks);
    const raw = inflateSync(compressed);

    const stride = width * channels;
    const rows = [];
    let prevRow = Buffer.alloc(stride);
    let pos = 0;
    for (let y = 0; y < height; y++) {
      const filterType = raw[pos];
      pos += 1;
      const rowData = raw.subarray(pos, pos + stride);
      pos += stride;
      const outRow = Buffer.alloc(stride);
      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? outRow[x - channels] : 0;
        const b = prevRow[x];
        let value;
        if (filterType === 0) value = rowData[x];
        else if (filterType === 1) value = (rowData[x] + a) & 0xff;
        else if (filterType === 2) value = (rowData[x] + b) & 0xff;
        else if (filterType === 3) value = (rowData[x] + Math.floor((a + b) / 2)) & 0xff;
        else if (filterType === 4) {
          // Paeth predictor
          const c = x >= channels ? prevRow[x - channels] : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          value = (rowData[x] + pred) & 0xff;
        } else {
          return { notSampled: true, reason: `unsupported PNG filter type ${filterType} at row ${y}` };
        }
        outRow[x] = value;
      }
      rows.push(outRow);
      prevRow = outRow;
    }

    function pixelAt(px, py) {
      const clampedX = Math.max(0, Math.min(width - 1, px));
      const clampedY = Math.max(0, Math.min(height - 1, py));
      const row = rows[clampedY];
      const idx = clampedX * channels;
      return `rgb(${row[idx]}, ${row[idx + 1]}, ${row[idx + 2]})`;
    }

    const inset = 8;
    return {
      topLeft: pixelAt(inset, inset),
      topRight: pixelAt(width - 1 - inset, inset),
      bottomLeft: pixelAt(inset, height - 1 - inset),
      bottomRight: pixelAt(width - 1 - inset, height - 1 - inset),
      center: pixelAt(Math.floor(width / 2), Math.floor(height / 2)),
    };
  } catch (error) {
    return { notSampled: true, reason: `PNG decode error: ${error.message}` };
  }
}

// --- CDP client ---------------------------------------------------------------

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.eventListeners = new Map();
    ws.addEventListener('message', (event) => this._onMessage(event));
  }

  _onMessage(event) {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      const listeners = this.eventListeners.get(msg.method);
      if (listeners) {
        for (const fn of listeners) fn(msg.params);
      }
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.eventListeners.has(method)) this.eventListeners.set(method, []);
    this.eventListeners.get(method).push(fn);
  }
}

// --- Chrome launch ------------------------------------------------------------

async function launchChrome(port, userDataDir) {
  const child = spawn(
    CHROME_BIN,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore', detached: false }
  );
  return child;
}

async function discoverPageTarget(port) {
  return waitFor(
    async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (!res.ok) return null;
        const list = await res.json();
        return list.find((t) => t.type === 'page') || null;
      } catch {
        return null;
      }
    },
    { timeoutMs: 15000, intervalMs: 150 }
  );
}

// --- Report evaluation expression --------------------------------------------

const EVAL_EXPRESSION = `
  (() => {
    const paints = performance.getEntriesByType('paint');
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const fp = paints.find(p => p.name === 'first-paint');
    const fcp = paints.find(p => p.name === 'first-contentful-paint');
    let bg = null;
    try { bg = getComputedStyle(document.body).backgroundColor; } catch (e) {}
    const scriptEl = document.querySelector('script[type=module][src]');
    return JSON.stringify({
      timeOrigin: performance.timeOrigin,
      firstPaintStartTime: fp ? fp.startTime : null,
      firstContentfulPaintStartTime: fcp ? fcp.startTime : null,
      navResponseEnd: nav.responseEnd ?? null,
      navDomInteractive: nav.domInteractive ?? null,
      navLoadEventEnd: nav.loadEventEnd ?? null,
      navType: nav.type ?? null,
      dashboardTheme: (() => { try { return localStorage.getItem('dashboard-theme'); } catch (e) { return 'ERROR'; } })(),
      prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
      dataTheme: document.documentElement.getAttribute('data-theme'),
      bodyBackgroundColor: bg,
      moduleScriptSrc: scriptEl ? scriptEl.getAttribute('src') : null,
      title: document.title,
    });
  })()
`;

// --- Mechanism implementations -------------------------------------------------

async function runScreencast(client, targetUrl, framesDir) {
  await client.send('Page.enable');
  const frames = [];
  let frameSeq = 0;

  client.on('Page.screencastFrame', async (params) => {
    const seq = frameSeq++;
    const buf = Buffer.from(params.data, 'base64');
    const framePath = join(framesDir, `frame-${String(seq).padStart(3, '0')}.png`);
    writeFileSync(framePath, buf);
    // CDP reports metadata.timestamp as Network.TimeSinceEpoch: SECONDS since
    // the Unix epoch. Convert to ms so it is directly comparable to
    // performance.timeOrigin (which is ms since epoch).
    const timestampMs = params.metadata.timestamp * 1000;
    frames.push({ seq, framePath, timestampMs });
    await client.send('Page.screencastFrameAck', { sessionId: params.sessionId });
  });

  await client.send('Page.startScreencast', {
    format: 'png',
    everyNthFrame: 1,
  });

  await client.send('Page.navigate', { url: targetUrl });

  // Give the page time to load and paint, then capture a burst of frames.
  await waitForLoadEvent(client);
  await sleep(1500);

  await client.send('Page.stopScreencast');

  return frames;
}

async function waitForLoadEvent(client) {
  return new Promise((resolve) => {
    let done = false;
    client.on('Page.loadEventFired', () => {
      if (!done) {
        done = true;
        resolve();
      }
    });
    // Fallback timeout in case the event was already fired before the
    // listener attached, or the page never fires it.
    setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, 10000);
  });
}

async function runScreenshotBurst(client, targetUrl, framesDir) {
  await client.send('Page.enable');
  const frames = [];
  const captureErrors = [];

  const navigatedAt = { requestMs: null, respondedMs: null };
  client.on('Page.frameNavigated', () => {
    if (navigatedAt.requestMs === null) navigatedAt.requestMs = Date.now();
  });

  await client.send('Page.navigate', { url: targetUrl });

  // Tight loop of screenshots from the moment navigation is issued. A
  // cross-origin navigation can trigger a Chrome renderer-process swap
  // (site isolation) partway through this loop, which detaches the CDP
  // session opened directly against the original page target
  // ("Not attached to an active page"). That is a real limitation of this
  // client-attachment shape, not a bug to paper over: catch it, record it
  // in the report, and stop the burst rather than crashing the harness.
  const burstCount = 8;
  for (let i = 0; i < burstCount; i++) {
    const requestMs = Date.now();
    try {
      const result = await client.send('Page.captureScreenshot', { format: 'png' });
      const responseMs = Date.now();
      const buf = Buffer.from(result.data, 'base64');
      const framePath = join(framesDir, `frame-${String(i).padStart(3, '0')}.png`);
      writeFileSync(framePath, buf);
      frames.push({ seq: i, framePath, requestMs, responseMs, timestampMs: responseMs });
    } catch (error) {
      captureErrors.push({ seq: i, requestMs, error: error.message });
      break;
    }
  }

  try {
    await waitForLoadEvent(client);
  } catch {
    /* session may already be detached; frames captured so far still stand */
  }

  return { frames, captureErrors };
}

async function runThrottled(client, targetUrl, framesDir, throttleMsValue) {
  await client.send('Page.enable');
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: throttleMsValue,
    downloadThroughput: (50 * 1024) / 8, // ~50kbps
    uploadThroughput: (50 * 1024) / 8,
  });

  const frames = [];
  let frameSeq = 0;

  client.on('Page.screencastFrame', async (params) => {
    const seq = frameSeq++;
    const buf = Buffer.from(params.data, 'base64');
    const framePath = join(framesDir, `frame-${String(seq).padStart(3, '0')}.png`);
    writeFileSync(framePath, buf);
    const timestampMs = params.metadata.timestamp * 1000;
    frames.push({ seq, framePath, timestampMs });
    await client.send('Page.screencastFrameAck', { sessionId: params.sessionId });
  });

  await client.send('Page.startScreencast', {
    format: 'png',
    everyNthFrame: 1,
  });

  await client.send('Page.navigate', { url: targetUrl });
  await waitForLoadEvent(client);
  await sleep(1500);
  await client.send('Page.stopScreencast');

  return {
    frames,
    emulation: {
      offline: false,
      latencyMs: throttleMsValue,
      downloadThroughputBytesPerSec: (50 * 1024) / 8,
      uploadThroughputBytesPerSec: (50 * 1024) / 8,
    },
  };
}

// --- Main ----------------------------------------------------------------------

async function main() {
  const port = 9200 + Math.floor(Math.random() * 300);
  const userDataDir = mkdtempSync(join(tmpdir(), 'fpc-profile-'));
  const framesDir = join(outDir, 'frames');
  mkdirSync(framesDir, { recursive: true });

  let chromeProcess;
  let ws;
  let exitCode = 0;

  try {
    chromeProcess = await launchChrome(port, userDataDir);

    let target;
    try {
      target = await discoverPageTarget(port);
    } catch (error) {
      console.error(`FATAL: could not discover a page target: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await waitFor(() => (ws.readyState === WebSocket.OPEN ? true : null), { timeoutMs: 10000 });

    const client = new CdpClient(ws);

    let frames = [];
    let emulation = null;
    let captureErrors = [];

    if (mechanism === 'screencast') {
      frames = await runScreencast(client, url, framesDir);
    } else if (mechanism === 'screenshot-burst') {
      const result = await runScreenshotBurst(client, url, framesDir);
      frames = result.frames;
      captureErrors = result.captureErrors;
    } else if (mechanism === 'throttled') {
      const result = await runThrottled(client, url, framesDir, throttleMs);
      frames = result.frames;
      emulation = result.emulation;
    }

    // Evaluate the page-state expression after load. If the capture loop
    // above hit a session detach (see runScreenshotBurst's comment), this
    // evaluate can fail too — record that rather than crashing, since the
    // frames captured before the detach are still valid evidence.
    let pageState = null;
    try {
      const evalResult = await client.send('Runtime.evaluate', {
        expression: EVAL_EXPRESSION,
        returnByValue: true,
      });
      pageState = JSON.parse(evalResult.result.value);
    } catch (error) {
      console.error(`WARNING: could not evaluate page state (session may be detached): ${error.message}`);
    }

    // Sample colors for each frame and compute navigation-relative timing.
    const timeOrigin = pageState ? pageState.timeOrigin : null;
    const firstPaintStartTime = pageState ? pageState.firstPaintStartTime : null;

    // Read each frame file back off disk and sample its pixel colors.
    const { readFileSync: readFileSyncFn } = await import('node:fs');
    const finalFrames = frames.map((frame) => {
      const pngBuf = readFileSyncFn(frame.framePath);
      const colors = samplePngColors(pngBuf);
      const tSinceNav = timeOrigin !== null ? frame.timestampMs - timeOrigin : null;
      const beatsFirstPaint =
        tSinceNav !== null && firstPaintStartTime !== null ? tSinceNav <= firstPaintStartTime : null;
      return {
        seq: frame.seq,
        framePath: frame.framePath,
        timestampMs: frame.timestampMs,
        t_since_navigation_ms: tSinceNav,
        beats_first_paint: beatsFirstPaint,
        colors,
      };
    });

    const report = {
      mechanism,
      url,
      throttleMs: mechanism === 'throttled' ? throttleMs : undefined,
      emulation,
      timeOrigin,
      firstPaintStartTime,
      pageState,
      frames: finalFrames,
      captureErrors,
    };

    writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

    // Human-readable summary.
    console.log(`\n=== first-paint-capture: mechanism=${mechanism} url=${url} ===`);
    console.log(`timeOrigin: ${timeOrigin}, first-paint startTime: ${firstPaintStartTime}`);
    if (pageState) {
      console.log(`prefers-color-scheme dark: ${pageState.prefersDark}`);
      console.log(`dashboard-theme: ${JSON.stringify(pageState.dashboardTheme)}`);
      console.log(`data-theme: ${pageState.dataTheme}`);
      console.log(`body background: ${pageState.bodyBackgroundColor}`);
    }
    let earliestBeating = null;
    for (const f of finalFrames) {
      const colorStr = f.colors && !f.colors.notSampled ? f.colors.center : f.colors ? `not-sampled (${f.colors.reason}; frame retained at ${f.framePath})` : 'no-color';
      console.log(
        `  frame ${f.seq}: t_since_navigation_ms=${f.t_since_navigation_ms} beats_first_paint=${f.beats_first_paint} color=${colorStr}`
      );
      if (f.beats_first_paint && !earliestBeating) earliestBeating = f;
    }
    if (earliestBeating) {
      console.log(
        `\nEARLIEST FRAME BEATING FIRST PAINT: seq ${earliestBeating.seq}, margin ${
          firstPaintStartTime - earliestBeating.t_since_navigation_ms
        }ms (frame at ${earliestBeating.t_since_navigation_ms}ms vs first-paint at ${firstPaintStartTime}ms)`
      );
    } else {
      console.log('\nNo frame beat first paint.');
    }

    console.log(`\nReport written to ${join(outDir, 'report.json')}`);
  } catch (error) {
    console.error(`FATAL: ${error.message}`);
    exitCode = 1;
  } finally {
    if (ws) {
      try {
        ws.close();
      } catch {
        /* noop */
      }
    }
    if (chromeProcess && !keepOpen) {
      try {
        chromeProcess.kill('SIGKILL');
      } catch {
        /* noop */
      }
    }
    if (!keepOpen && existsSync(userDataDir)) {
      try {
        rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        /* noop */
      }
    }
  }

  process.exitCode = exitCode;
}

main();
