/**
 * Converts committed raw WMA/road-running age-grading source artifacts
 * (placed under scripts/wma-source/, gitignored) into the two committed
 * factor tables this project ships: data/wma/road-factors.json and
 * data/wma/track-factors.json.
 *
 * One-shot, re-runnable. Every raw input is a file already downloaded into
 * scripts/wma-source/ by a developer/planning step — this script never
 * fetches over the network itself, so a re-run is fully deterministic and
 * works offline / in CI.
 *
 * Road source (5k/10k/half/marathon, both sexes):
 *   github.com/AlanLyttonJones/Age-Grade-Tables (CC0-1.0), 2025 edition —
 *   scripts/wma-source/MaleRoadStd2025.xlsx, FemaleRoadStd2025.xlsx.
 *   .xlsx is a zip of XML; this script shells out to the system `unzip`
 *   CLI to read xl/worksheets/sheet1.xml and xl/sharedStrings.xml rather
 *   than adding an xlsx-parser dependency (no new npm dependency is
 *   authorized by 18-02-PLAN.md).
 *
 * Track source (400m/800m/1mi, both sexes):
 *   Factors: howardgrubb.co.uk/athletics/wmatnf23.html (WMA 2023 edition) —
 *   scripts/wma-source/wmatnf23.html. This page embeds the age-factor
 *   arrays as inline JavaScript (WMA_M_facs / WMA_F_facs); parsed by regex.
 *
 *   Open standards: the 2023 page above is a "factors-only" calculator —
 *   it has NO open-class standard times at all (confirmed by direct
 *   inspection: no "standard"/"OC" field anywhere in the page). The WMA
 *   2023 Appendix B PDF it links to is exclusively about Combined Events
 *   scoring (decathlon/heptathlon), not single-event standards, so it is
 *   not usable here either. The same author's older lookup tool,
 *   wmalookup15.html (2010/2015 editions, same howardgrubb.co.uk domain),
 *   is the only reachable page that ships single-event open standards
 *   alongside factors, via `new facrow(event, distKm, standard, ...)`
 *   calls. Both its WMA_10_* and WMA_15_* tables carry IDENTICAL standard
 *   times, indicating the WMA single-event open standards for 400m/800m/
 *   1mile were not revised between the 2010 and 2015 editions and are not
 *   revised as often as the age-factor tables — this script therefore
 *   pairs the 2023-edition factors with the most recent available
 *   single-event standards (the 2015 vintage), and documents this
 *   pairing explicitly in the `standardsSource`/`note` fields and in
 *   data/wma/README.md rather than silently blending two sources.
 *
 * Every value bundled here is read from a committed, inspectable raw file
 * under scripts/wma-source/ — never typed from memory (T-18-WMA-01/02).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(__dirname, 'wma-source');
const OUTPUT_DIR = join(__dirname, '../data/wma');

const ROAD_MALE_XLSX = join(SOURCE_DIR, 'MaleRoadStd2025.xlsx');
const ROAD_FEMALE_XLSX = join(SOURCE_DIR, 'FemaleRoadStd2025.xlsx');
const ROAD_SOURCE_URL =
  'https://github.com/AlanLyttonJones/Age-Grade-Tables/blob/master/2025%20Files/MaleRoadStd2025.xlsx';
const ROAD_EDITION = '2025';
const ROAD_LICENCE = 'CC0-1.0';

const TRACK_FACTORS_HTML = join(SOURCE_DIR, 'wmatnf23.html');
const TRACK_STANDARDS_HTML = join(SOURCE_DIR, 'wmalookup15.html');
const TRACK_FACTORS_SOURCE_URL = 'http://howardgrubb.co.uk/athletics/wmatnf23.html';
const TRACK_STANDARDS_SOURCE_URL = 'http://howardgrubb.co.uk/athletics/wmalookup15.html';
const TRACK_EDITION = '2023';
const TRACK_STANDARDS_EDITION = '2015';

// Distance keys must match TargetDistanceKey (src/analytics/best-effort.types.ts)
// for the four road distances; track adds 800m (not a TargetDistanceKey) per
// D-09's 1k-interpolation requirement.
const ROAD_HEADER_TO_KEY = {
  '5 km': '5k',
  '10 km': '10k',
  'H. Mar': 'half',
  Marathon: 'marathon',
};

const TRACK_FACTOR_EVENT_TO_KEY = {
  '400m': '400m',
  '800m': '800m',
  Mile: '1mi',
};

const TRACK_STANDARD_EVENT_TO_KEY = {
  '400m': '400m',
  '800m': '800m',
  '1Mile': '1mi',
};

function decodeXmlEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Reads one entry out of a .xlsx (zip) file via the system `unzip` CLI. */
function readZipEntry(zipPath, entryPath) {
  return execFileSync('unzip', ['-p', zipPath, entryPath], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function parseSharedStrings(xml) {
  const strings = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const text = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((mm) => mm[1]).join('');
    strings.push(decodeXmlEntities(text));
  }
  return strings;
}

/** Parses a worksheet's sheetData into a Map keyed by "A1"-style ref -> resolved value (string). */
function parseSheetCells(xml, sharedStrings) {
  const cells = new Map();
  const rowRe = /<row [^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const cellRe = /<c r="([A-Z]+)(\d+)"([^>]*)>(?:<f>[\s\S]*?<\/f>)?(?:<v>([\s\S]*?)<\/v>)?<\/c>/g;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      const [, col, row, attrs, rawValue] = cellMatch;
      if (rawValue === undefined) continue;
      const isSharedString = /\bt="s"/.test(attrs);
      const value = isSharedString ? sharedStrings[Number(rawValue)] : rawValue;
      cells.set(`${col}${row}`, value);
    }
  }
  return cells;
}

/**
 * Parses one road standards workbook (MaleRoadStd2025.xlsx / FemaleRoadStd2025.xlsx)
 * into { openStandardSec: {distanceKey: number}, factors: {distanceKey: {age: number}} }.
 * Column layout differs between the male and female workbooks (the female sheet has
 * a merged Age column spanning A:B, shifting every later column one letter right) —
 * so every column is located by matching its header TEXT on the header row, never by
 * a hardcoded column letter.
 */
function parseRoadWorkbook(xlsxPath) {
  const sheetXml = readZipEntry(xlsxPath, 'xl/worksheets/sheet1.xml');
  const sharedXml = readZipEntry(xlsxPath, 'xl/sharedStrings.xml');
  const shared = parseSharedStrings(sharedXml);
  const cells = parseSheetCells(sheetXml, shared);

  // Locate the header row: the first row containing a cell whose text matches
  // one of our target distance headers.
  const targetHeaders = Object.keys(ROAD_HEADER_TO_KEY);
  const headerColByKey = {}; // distanceKey -> column letter
  let ocSecRow = null;

  for (const [ref, value] of cells) {
    const match = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!match) continue;
    const [, col, rowStr] = match;
    if (targetHeaders.includes(value)) {
      const key = ROAD_HEADER_TO_KEY[value];
      if (!(key in headerColByKey)) headerColByKey[key] = col;
    }
    if (value === 'OC sec' && ocSecRow === null) {
      ocSecRow = Number(rowStr);
    }
  }

  const missingHeaders = targetHeaders.filter((h) => !(ROAD_HEADER_TO_KEY[h] in headerColByKey));
  if (missingHeaders.length > 0) {
    throw new Error(`Road workbook ${xlsxPath}: missing header column(s) for ${missingHeaders.join(', ')}`);
  }
  if (ocSecRow === null) {
    throw new Error(`Road workbook ${xlsxPath}: could not locate the "OC sec" (open standard) row`);
  }

  const openStandardSec = {};
  for (const [key, col] of Object.entries(headerColByKey)) {
    const raw = cells.get(`${col}${ocSecRow}`);
    const value = Number(raw);
    if (!(value > 0)) throw new Error(`Road workbook ${xlsxPath}: bad OC sec for ${key} ("${raw}")`);
    openStandardSec[key] = value;
  }

  // Age rows: any row whose column-A value is a plain integer in a sane
  // human-age range. This is layout-independent (works regardless of how
  // many header/footer rows precede or follow the data).
  const factors = {};
  for (const key of Object.keys(headerColByKey)) factors[key] = {};

  for (const [ref, value] of cells) {
    const match = /^A(\d+)$/.exec(ref);
    if (!match) continue;
    const age = Number(value);
    if (!Number.isInteger(age) || age < 1 || age > 120) continue;
    const row = match[1];
    for (const [key, col] of Object.entries(headerColByKey)) {
      const rawFactor = cells.get(`${col}${row}`);
      if (rawFactor === undefined) continue;
      const factor = Number(rawFactor);
      if (!(factor > 0 && factor <= 1)) continue; // skip implausible/blank cells rather than corrupting the table
      factors[key][String(age)] = factor;
    }
  }

  for (const [key, ages] of Object.entries(factors)) {
    if (Object.keys(ages).length === 0) {
      throw new Error(`Road workbook ${xlsxPath}: no age rows parsed for ${key}`);
    }
  }

  return { openStandardSec, factors };
}

/** Parses the inline `WMA_[MF]_facs["event"] = ["T2", ...values];` arrays out of wmatnf23.html. */
function parseTrackFactorsHtml(html) {
  const bySex = { M: {}, F: {} };
  const re = /WMA_([MF])_facs\["([^"]+)"\]\s*=\s*\[([^\]]*)\];/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, sexCode, event, valuesRaw] = m;
    if (!(event in TRACK_FACTOR_EVENT_TO_KEY)) continue;
    const key = TRACK_FACTOR_EVENT_TO_KEY[event];
    const parts = valuesRaw.split(',').map((s) => s.trim());
    const numericValues = parts.slice(1).map(Number); // parts[0] is the quoted type marker, e.g. "T2"
    bySex[sexCode][key] = numericValues;
  }

  const agesBySex = {};
  const agesRe = /WMA_([MF])_ages\s*=\s*\[([^\]]*)\];/g;
  while ((m = agesRe.exec(html)) !== null) {
    const [, sexCode, valuesRaw] = m;
    const parts = valuesRaw.split(',').map((s) => s.trim());
    agesBySex[sexCode] = parts.slice(1).map(Number); // parts[0] is the quoted "type" marker
  }

  const sexKeyOf = { M: 'male', F: 'female' };
  const factors = { male: {}, female: {} };
  for (const sexCode of ['M', 'F']) {
    const ages = agesBySex[sexCode];
    if (!ages || ages.length === 0) {
      throw new Error(`Track factors HTML: no age list found for sex "${sexCode}"`);
    }
    for (const key of Object.values(TRACK_FACTOR_EVENT_TO_KEY)) {
      const values = bySex[sexCode][key];
      if (!values || values.length !== ages.length) {
        throw new Error(
          `Track factors HTML: event "${key}" (sex ${sexCode}) has ${values ? values.length : 0} values for ${ages.length} ages`
        );
      }
      const perAge = {};
      for (let i = 0; i < ages.length; i++) {
        const factor = values[i];
        if (!(factor > 0 && factor <= 1)) continue; // a handful of non-running events in this file exceed 1.0; running events do not
        perAge[String(ages[i])] = factor;
      }
      factors[sexKeyOf[sexCode]][key] = perAge;
    }
  }
  return factors;
}

/** Parses `WMA_15_[MW]_facs[i++]=new facrow("event", distKm, standardSec, ...);` calls out of wmalookup15.html. */
function parseTrackStandardsHtml(html) {
  const openStandardSec = { male: {}, female: {} };
  const sexKeyOf = { M: 'male', W: 'female' };
  const re = /WMA_15_([MW])_facs\[i\+\+\]=new facrow\("([^"]+)",\s*[^,]+,\s*([\d.]+),/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, sexCode, event, standardRaw] = m;
    if (!(event in TRACK_STANDARD_EVENT_TO_KEY)) continue;
    const key = TRACK_STANDARD_EVENT_TO_KEY[event];
    const standard = Number(standardRaw);
    if (!(standard > 0)) throw new Error(`Track standards HTML: bad standard for ${event} (sex ${sexCode})`);
    openStandardSec[sexKeyOf[sexCode]][key] = standard;
  }
  for (const sexKey of ['male', 'female']) {
    const gotKeys = Object.keys(openStandardSec[sexKey]).sort();
    const wantKeys = Object.values(TRACK_STANDARD_EVENT_TO_KEY).sort();
    if (gotKeys.join(',') !== wantKeys.join(',')) {
      throw new Error(`Track standards HTML: sex "${sexKey}" got standards for [${gotKeys}], wanted [${wantKeys}]`);
    }
  }
  return openStandardSec;
}

function summarizeAges(factorsBySex) {
  const parts = [];
  for (const [sex, byDistance] of Object.entries(factorsBySex)) {
    for (const [dist, ages] of Object.entries(byDistance)) {
      parts.push(`${sex}/${dist}: ${Object.keys(ages).length} ages`);
    }
  }
  return parts.join(', ');
}

function buildRoadTable() {
  console.log('Parsing road source workbooks...');
  const male = parseRoadWorkbook(ROAD_MALE_XLSX);
  const female = parseRoadWorkbook(ROAD_FEMALE_XLSX);

  const table = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    note:
      'Generated by `node scripts/convert-wma-tables.mjs` from committed raw source workbooks under ' +
      'scripts/wma-source/ (gitignored). Must not be hand-edited — re-run the converter instead. ' +
      `Source: ${ROAD_LICENCE} licensed, ${ROAD_EDITION} edition, github.com/AlanLyttonJones/Age-Grade-Tables.`,
    surface: 'road',
    edition: ROAD_EDITION,
    source: ROAD_SOURCE_URL,
    openStandardSec: { male: male.openStandardSec, female: female.openStandardSec },
    factors: { male: male.factors, female: female.factors },
  };

  console.log(`  road edition ${ROAD_EDITION}: ${summarizeAges({ male: male.factors, female: female.factors })}`);
  console.log(`  road male 5k age-50 factor: ${table.factors.male['5k']['50']}`);
  console.log(`  road male 5k open standard (sec): ${table.openStandardSec.male['5k']}`);

  return table;
}

function buildTrackTable() {
  console.log('Parsing track source pages...');
  const factorsHtml = readFileSync(TRACK_FACTORS_HTML, 'utf8');
  const standardsHtml = readFileSync(TRACK_STANDARDS_HTML, 'utf8');
  const factors = parseTrackFactorsHtml(factorsHtml);
  const openStandardSec = parseTrackStandardsHtml(standardsHtml);

  const table = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    note:
      'Generated by `node scripts/convert-wma-tables.mjs` from committed raw source pages under ' +
      'scripts/wma-source/ (gitignored). Must not be hand-edited — re-run the converter instead. ' +
      `Age factors: WMA ${TRACK_EDITION} edition, ${TRACK_FACTORS_SOURCE_URL}. Open standards: the ` +
      `${TRACK_EDITION} factors page has no standard times at all (it only converts a result to an ` +
      `age-adjusted result); the most recent available single-event open standards on the same domain ` +
      `are the ${TRACK_STANDARDS_EDITION}-edition ones (identical between that page's 2010 and 2015 ` +
      `tables), so this file deliberately pairs ${TRACK_EDITION} factors with ${TRACK_STANDARDS_EDITION} ` +
      'standards. See data/wma/README.md for the full explanation.',
    surface: 'track',
    edition: TRACK_EDITION,
    source: TRACK_FACTORS_SOURCE_URL,
    standardsEdition: TRACK_STANDARDS_EDITION,
    standardsSource: TRACK_STANDARDS_SOURCE_URL,
    openStandardSec,
    factors,
  };

  console.log(`  track edition ${TRACK_EDITION}: ${summarizeAges(factors)}`);
  console.log(`  track standards edition ${TRACK_STANDARDS_EDITION}: 400m/800m/1mi, both sexes`);

  return table;
}

function main() {
  if (!existsSync(ROAD_MALE_XLSX) || !existsSync(ROAD_FEMALE_XLSX)) {
    console.error(`Missing road source workbook(s) under ${SOURCE_DIR}. Expected:`);
    console.error(`  ${ROAD_MALE_XLSX}`);
    console.error(`  ${ROAD_FEMALE_XLSX}`);
    process.exit(1);
  }
  if (!existsSync(TRACK_FACTORS_HTML) || !existsSync(TRACK_STANDARDS_HTML)) {
    console.error(`Missing track source page(s) under ${SOURCE_DIR}. Expected:`);
    console.error(`  ${TRACK_FACTORS_HTML}`);
    console.error(`  ${TRACK_STANDARDS_HTML}`);
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const roadTable = buildRoadTable();
  const trackTable = buildTrackTable();

  writeFileSync(join(OUTPUT_DIR, 'road-factors.json'), JSON.stringify(roadTable, null, 2) + '\n', 'utf8');
  writeFileSync(join(OUTPUT_DIR, 'track-factors.json'), JSON.stringify(trackTable, null, 2) + '\n', 'utf8');

  console.log('\nWMA factor tables written to data/wma/road-factors.json and data/wma/track-factors.json');
}

main();
