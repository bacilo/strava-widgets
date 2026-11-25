#!/usr/bin/env node
// Local-only real-FIT reproduction check for ING-03. export_data/ is gitignored
// and absent in CI, so this has no .test sibling. Requires `npm run build`.
// Never writes under data/ or export_data/: everything goes to a temp dir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importFit } from '../dist/exports/fit-import.js';

const FIT = 'export_data/strava/activities/19410946914.fit.gz';
const read = p => JSON.parse(fs.readFileSync(p, 'utf-8'));
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function compare(imported, stream, ref, refStream, label) {
  const rows = [
    ['distance', imported.distance, ref.distance, ''],
    ['start_date', imported.start_date, ref.start_date, ''],
    ['start_date_local', imported.start_date_local, ref.start_date_local, ''],
    ['sampleCount', stream.sampleCount, 1097, ''],
  ];
  for (const k of ['t', 'd', 'hr', 'cadence', 'alt']) {
    rows.push([`stream.${k}`, deepEq(stream[k], refStream[k]), true, ' (seam reuse, same FIT same seam, not independent)']);
  }
  let mismatches = 0;
  for (const [name, got, want, note] of rows) {
    const ok = got === want;
    if (!ok) mismatches++;
    const shown = typeof got === 'object' ? 'array' : String(got);
    console.log(`  ${ok ? 'PASS' : 'FAIL'} [${label}] ${name}: ${shown}${ok ? '' : ` != ${want}`}${note}`);
  }
  return mismatches;
}

async function main() {
  if (!fs.existsSync(FIT)) {
    console.log('REAL-FIT CHECK SKIPPED: export absent');
    process.exitCode = 2;
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-real-'));
  try {
    const exportRoot = path.join(tmp, 'export');
    const dest = path.join(exportRoot, 'strava', 'activities', '19410946914.fit.gz');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(FIT, dest);

    const mk = name => {
      const base = path.join(tmp, name);
      return {
        exportRoot,
        activitiesDir: path.join(base, 'activities'),
        streamsDir: path.join(base, 'streams'),
        manifestPath: path.join(base, 'streams', 'manifest.json'),
        provenancePath: path.join(base, 'provenance.json'),
      };
    };

    const a = mk('a');
    fs.mkdirSync(a.activitiesDir, { recursive: true });
    const res = await importFit({ fitPath: dest, garminId: '19410946914', source: 'strava', ...a });
    if (res.status !== 'imported') throw new Error(`expected imported, got ${res.status}`);
    const imported = read(path.join(a.activitiesDir, '19410946914.json'));
    const stream = read(path.join(a.streamsDir, '19410946914.json'));
    const refStream = read('data/streams/i174110410.json');

    console.log('CAN-PASS against i174110410:');
    const passMiss = compare(imported, stream, read('data/activities/i174110410.json'), refStream, 'i174110410');

    console.log('CAN-FAIL against 18180779941 (must mismatch):');
    const failMiss = compare(imported, stream, read('data/activities/18180779941.json'), refStream, '18180779941');
    console.log(`  CAN-FAIL mismatches: ${failMiss}`);

    console.log('Real dedupe:');
    const b = mk('b');
    fs.mkdirSync(b.activitiesDir, { recursive: true });
    fs.copyFileSync('data/activities/i174110410.json', path.join(b.activitiesDir, 'i174110410.json'));
    const dup = await importFit({ fitPath: dest, garminId: '19410946914', source: 'strava', ...b });
    const streamsEmpty = !fs.existsSync(b.streamsDir) || fs.readdirSync(b.streamsDir).length === 0;
    console.log(`  status=${dup.status} existingId=${dup.existingId} streamsDirEmpty=${streamsEmpty}`);

    const ok =
      passMiss === 0 && failMiss > 0 && dup.status === 'duplicate' && dup.existingId === 'i174110410' && streamsEmpty;
    console.log(ok ? 'REAL-FIT CHECK PASSED' : 'REAL-FIT CHECK FAILED');
    process.exitCode = ok ? 0 : 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
