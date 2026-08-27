/**
 * Build script for multiple widget IIFE bundles
 * Programmatically builds each widget entry point separately
 */

import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, existsSync } from 'fs';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import { copyJsonTree } from './lib/copy-data-tree.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const widgets = [
  {
    name: 'stats-card',
    entry: resolve(__dirname, '../src/widgets/stats-card/index.ts'),
    globalName: 'StatsCard',
    isMapWidget: false
  },
  {
    name: 'comparison-chart',
    entry: resolve(__dirname, '../src/widgets/comparison-chart/index.ts'),
    globalName: 'ComparisonChart',
    isMapWidget: false
  },
  {
    name: 'streak-widget',
    entry: resolve(__dirname, '../src/widgets/streak-widget/index.ts'),
    globalName: 'StreakWidget',
    isMapWidget: false
  },
  {
    name: 'geo-stats-widget',
    entry: resolve(__dirname, '../src/widgets/geo-stats-widget/index.ts'),
    globalName: 'GeoStatsWidget',
    isMapWidget: false
  },
  {
    name: 'geo-table-widget',
    entry: resolve(__dirname, '../src/widgets/geo-table-widget/index.ts'),
    globalName: 'GeoTableWidget',
    isMapWidget: false
  },
  {
    name: 'map-test',
    entry: resolve(__dirname, '../src/widgets/map-test-widget/index.ts'),
    globalName: 'MapTestWidget',
    isMapWidget: true
  },
  {
    name: 'single-run-map',
    entry: resolve(__dirname, '../src/widgets/single-run-map/index.ts'),
    globalName: 'SingleRunMap',
    isMapWidget: true
  },
  {
    name: 'multi-run-overlay',
    entry: resolve(__dirname, '../src/widgets/multi-run-overlay/index.ts'),
    globalName: 'MultiRunOverlay',
    isMapWidget: true
  },
  {
    name: 'route-browser',
    entry: resolve(__dirname, '../src/widgets/route-browser/index.ts'),
    globalName: 'RouteBrowser',
    isMapWidget: true
  },
  {
    name: 'heatmap-widget',
    entry: resolve(__dirname, '../src/widgets/heatmap-widget/index.ts'),
    globalName: 'HeatmapWidget',
    isMapWidget: true
  },
  {
    name: 'pin-map-widget',
    entry: resolve(__dirname, '../src/widgets/pin-map-widget/index.ts'),
    globalName: 'PinMapWidget',
    isMapWidget: true
  }
];

async function buildWidget(widget, index) {
  console.log(`Building ${widget.name}...`);

  // Use a unique temporary output directory for each widget
  const tempOutDir = `dist/widgets-temp-${index}`;

  const config = {
    build: {
      lib: {
        entry: widget.entry,
        name: widget.globalName,
        fileName: widget.name,
        formats: ['iife']
      },
      outDir: tempOutDir,
      emptyOutDir: true,
      rollupOptions: {
        external: widget.isMapWidget ? ['leaflet'] : [],
        output: {
          inlineDynamicImports: true,
          globals: widget.isMapWidget ? { 'leaflet': 'L' } : {}
        }
      },
      target: 'es2020',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false // Keep console.error for widget debugging
        }
      }
    },
    plugins: widget.isMapWidget ? [cssInjectedByJsPlugin()] : [],
    logLevel: 'warn'
  };

  await build(config);

  // Copy the built file to the final widgets directory
  mkdirSync('dist/widgets', { recursive: true });
  const files = readdirSync(tempOutDir);
  const jsFile = files.find(f => f.endsWith('.js'));
  if (jsFile) {
    copyFileSync(
      resolve(tempOutDir, jsFile),
      resolve('dist/widgets', jsFile)
    );
  }

  console.log(`✓ Built ${widget.name}.iife.js`);
}

// data/private/ must NEVER be added to dataDirs or dataFiles below —
// assertNoPrivateArtifacts() (called at the end of copyDataFiles) is the
// enforcement that identity/health fields never reach dist/widgets/data/
// (T-18-PII-01).
const dataDirs = [
  { src: 'data/stats', dest: 'dist/widgets/data/stats' },
  { src: 'data/geo', dest: 'dist/widgets/data/geo' },
  { src: 'data/routes', dest: 'dist/widgets/data/routes' },
  { src: 'data/heatmap', dest: 'dist/widgets/data/heatmap' },
  // Extended for the dashboard SPA (D-11): the generated index manifest
  // plus every per-activity detail and stream file it can request.
  { src: 'data/dashboard', dest: 'dist/widgets/data/dashboard' },
  { src: 'data/activities', dest: 'dist/widgets/data/activities' },
  // Whole-directory copy also carries data/streams/manifest.json.
  { src: 'data/streams', dest: 'dist/widgets/data/streams' },
  // Hand-maintained athlete.json and gear.json that the activity detail
  // view fetches at runtime (DETAIL-01 gear tile, DETAIL-05 HR-zone panel).
  { src: 'data/config', dest: 'dist/widgets/data/config' },
  // Committed WMA age-grading factor tables (D-09/D-22).
  { src: 'data/wma', dest: 'dist/widgets/data/wma' }
];

// Single-file copies for data/ root files that copyDataFiles's directory
// walk (dataDirs above) doesn't reach. Deliberately NOT a whole-data-root
// directory entry (dest 'dist/widgets/data' mapped straight from the
// top-level 'data' dir) — that would also publish data/provenance.json
// (282 KB of local export-path metadata) and data/sync-state.json for no
// reason (T-18-PII-03).
const dataFiles = [
  { src: 'data/best-effort-exclusions.json', dest: 'dist/widgets/data/best-effort-exclusions.json' }
];

/**
 * Build-time guard against identity/health fields ever reaching the publish
 * directory (T-18-PII-01). Hard-fails the build — never a warning — because
 * this repo is public and dist/widgets/ is what actually gets deployed.
 */
function assertNoPrivateArtifacts() {
  const publishDataDir = 'dist/widgets/data';
  if (!existsSync(publishDataDir)) return;

  if (existsSync(resolve(publishDataDir, 'private'))) {
    console.error(`✗ Private-artifact guard failed: ${publishDataDir}/private exists and must never be published.`);
    process.exit(1);
  }

  const forbiddenSubstrings = ['"birthDate"', '"restingHr"', '"sex"'];
  let scanned = 0;

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (!entry.name.endsWith('.json')) continue;
      scanned++;
      const content = readFileSync(entryPath, 'utf8');
      for (const needle of forbiddenSubstrings) {
        if (content.includes(needle)) {
          console.error(
            `✗ Private-artifact guard failed: ${entryPath} contains ${needle} — identity/health fields must never reach the published site.`
          );
          process.exit(1);
        }
      }
    }
  }

  walk(publishDataDir);
  console.log(`✓ Private-artifact scan: ${scanned} published JSON file${scanned === 1 ? '' : 's'} scanned, none contain identity/health fields.`);
}

function copyDataFiles() {
  for (const { src, dest } of dataDirs) {
    if (!existsSync(src)) continue;
    const { copied, skipped } = copyJsonTree(src, dest);
    console.log(`✓ Copied ${src}/*.json → ${dest}/ (${copied} copied, ${skipped} skipped)`);
  }

  for (const { src, dest } of dataFiles) {
    if (!existsSync(src)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    console.log(`✓ Copied ${src} → ${dest}`);
  }

  assertNoPrivateArtifacts();
}

async function buildPages() {
  console.log('\nBuilding standalone pages...');
  await build({
    root: 'src/pages',
    build: {
      outDir: '../../dist/widgets',
      emptyOutDir: false,
      rollupOptions: {
        input: {
          heatmap: resolve(__dirname, '../src/pages/heatmap.html'),
          pinmap: resolve(__dirname, '../src/pages/pinmap.html'),
          routes: resolve(__dirname, '../src/pages/routes.html'),
          widgets: resolve(__dirname, '../src/pages/widgets.html'),
        },
      },
      target: 'es2020',
      minify: 'terser',
    },
    logLevel: 'warn',
  });
  console.log('✓ Built standalone pages (heatmap.html, pinmap.html, routes.html, widgets.html)');
}

async function buildDashboard() {
  console.log('\nBuilding dashboard SPA...');
  await build({
    root: 'src/dashboard',
    // CRITICAL: the site deploys to a GitHub Pages *project* page served under
    // https://bacilo.github.io/strava-widgets/, not at a domain root. Vite's
    // default base of '/' emits <script src="/assets/index-*.js">, which the
    // browser resolves to https://bacilo.github.io/assets/... — outside the
    // project, where GitHub returns its 404 *HTML* page. The browser then tries
    // to parse that HTML as JavaScript and dies on the first '{' inside its
    // <style> block, leaving a black page with only the title. './' keeps every
    // asset URL relative to index.html, which is correct at any mount depth.
    // Safe with hash routing specifically: the document URL stays at the site
    // root and only the fragment changes, so relative asset URLs never re-resolve
    // against a deeper path. Do not change this to an absolute path.
    base: './',
    build: {
      outDir: '../../dist/widgets',
      emptyOutDir: false,  // CRITICAL: same reason as buildPages() — by this point
      // dist/widgets/ already holds 11 IIFE bundles, four page HTML files, and the
      // copied data tree. Setting this to false is what actually declares that
      // don't-empty intent to Vite; emptying it would destroy all of them and the
      // deploy step would publish the gutted directory.
      rollupOptions: {
        input: {
          // The `index` key is what makes the output land at
          // dist/widgets/index.html, taking over the site root (D-08).
          index: resolve(__dirname, '../src/dashboard/index.html'),
        },
      },
      target: 'es2020',
      minify: 'terser',
    },
    logLevel: 'warn',
  });
  console.log('✓ Built dashboard SPA (index.html)');
}

async function buildAllWidgets() {
  console.log('Building widget library...\n');

  for (let i = 0; i < widgets.length; i++) {
    await buildWidget(widgets[i], i);
  }

  // Copy data JSON files into dist/widgets so they're deployed to GitHub Pages
  copyDataFiles();

  // Build standalone pages
  await buildPages();

  // Build the dashboard SPA last so it definitively replaces any
  // pre-Phase-16 committed dist/widgets/index.html at the site root.
  await buildDashboard();

  console.log('\nWidget library build complete!');
  console.log('Output: dist/widgets/ (widgets, pages, and the dashboard SPA)');
}

buildAllWidgets().catch(error => {
  console.error('Widget build failed:', error);
  process.exit(1);
});
