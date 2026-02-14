/**
 * Build script for multiple widget IIFE bundles
 * Programmatically builds each widget entry point separately
 */

import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const widgets = [
  {
    name: 'stats-card',
    entry: resolve(__dirname, '../src/widgets/stats-card/index.ts'),
    globalName: 'StatsCard'
  },
  {
    name: 'comparison-chart',
    entry: resolve(__dirname, '../src/widgets/comparison-chart/index.ts'),
    globalName: 'ComparisonChart'
  },
  {
    name: 'streak-widget',
    entry: resolve(__dirname, '../src/widgets/streak-widget/index.ts'),
    globalName: 'StreakWidget'
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
      emptyDir: true,
      rollupOptions: {
        external: [],
        output: {
          inlineDynamicImports: true,
          globals: {}
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

async function buildAllWidgets() {
  console.log('Building widget library...\n');

  for (let i = 0; i < widgets.length; i++) {
    await buildWidget(widgets[i], i);
  }

  console.log('\nWidget library build complete!');
  console.log('Output: dist/widgets/');
}

buildAllWidgets().catch(error => {
  console.error('Widget build failed:', error);
  process.exit(1);
});
