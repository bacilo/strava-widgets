/**
 * D-17 guard test for `compute-stream-checksums.mjs`: pure-function unit tests, the permanent
 * in-suite planted-edit proof (mirrors `pace-single-source.test.ts`'s planted-violation pattern),
 * and the live gate that runs under `npm test` against the real `data/streams/` tree.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  hashFile,
  listStreamFilenames,
  buildManifest,
  appendToManifest,
  checkManifest,
} from './compute-stream-checksums.mjs';
import { isStreamFile } from './lib/stream-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const STREAMS_DIR = join(ROOT_DIR, 'data/streams');
const MANIFEST_PATH = join(ROOT_DIR, 'data/stream-checksums.json');

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), `stream-checksums-${prefix}-`));
}

describe('hashFile', () => {
  it('returns the lowercase hex sha256 of the raw file bytes, deterministic across identical content', () => {
    const dir = tempDir('hash');
    try {
      writeFileSync(join(dir, 'a.json'), '{"t":[1,2,3]}');
      writeFileSync(join(dir, 'b.json'), '{"t":[1,2,3]}');
      writeFileSync(join(dir, 'c.json'), '{"t":[1,2,4]}');
      const digestA = hashFile(join(dir, 'a.json'));
      expect(digestA).toMatch(/^[0-9a-f]{64}$/);
      expect(hashFile(join(dir, 'b.json'))).toBe(digestA);
      expect(hashFile(join(dir, 'c.json'))).not.toBe(digestA);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('listStreamFilenames', () => {
  it('sorts ascending and excludes manifest.json', () => {
    const dir = tempDir('list');
    try {
      writeFileSync(join(dir, '200.json'), '{}');
      writeFileSync(join(dir, '100.json'), '{}');
      writeFileSync(join(dir, 'manifest.json'), '{}');
      expect(listStreamFilenames(dir)).toEqual(['100.json', '200.json']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('buildManifest', () => {
  it('returns schemaVersion 1 / algorithm sha256 / files with sorted keys and no timestamp field', () => {
    const dir = tempDir('build');
    try {
      writeFileSync(join(dir, 'b.json'), 'B');
      writeFileSync(join(dir, 'a.json'), 'A');
      const manifest = buildManifest(dir, ['b.json', 'a.json']);
      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.algorithm).toBe('sha256');
      expect(Object.keys(manifest.files)).toEqual(['a.json', 'b.json']);
      expect(manifest.generated_at).toBeUndefined();
      expect(manifest.timestamp).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('produces byte-identical JSON across two builds of an unchanged tree (idempotence)', () => {
    const dir = tempDir('idempotent');
    try {
      writeFileSync(join(dir, 'x.json'), 'X');
      writeFileSync(join(dir, 'y.json'), 'Y');
      const names = listStreamFilenames(dir);
      const first = JSON.stringify(buildManifest(dir, names), null, 2);
      const second = JSON.stringify(buildManifest(dir, names), null, 2);
      expect(second).toBe(first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('appendToManifest', () => {
  it('adds only filenames absent from existing.files, leaving existing digests untouched', () => {
    const dir = tempDir('append');
    try {
      writeFileSync(join(dir, 'a.json'), 'A');
      writeFileSync(join(dir, 'b.json'), 'B');
      const existing = buildManifest(dir, ['a.json']);
      const result = appendToManifest(existing, dir, ['a.json', 'b.json']);
      expect(result.ok).toBe(true);
      expect(result.added).toEqual(['b.json']);
      expect(Object.keys(result.manifest.files)).toEqual(['a.json', 'b.json']);
      expect(result.manifest.files['a.json']).toBe(existing.files['a.json']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses and reports every mismatch, writing nothing, when an existing digest differs', () => {
    const dir = tempDir('append-mismatch');
    try {
      writeFileSync(join(dir, 'a.json'), 'A');
      const existing = buildManifest(dir, ['a.json']);
      writeFileSync(join(dir, 'a.json'), 'TAMPERED');
      const result = appendToManifest(existing, dir, ['a.json']);
      expect(result.ok).toBe(false);
      expect(result.mismatches).toHaveLength(1);
      expect(result.mismatches[0].file).toBe('a.json');
      expect(result.mismatches[0].expected).toBe(existing.files['a.json']);
      expect(result.mismatches[0].actual).not.toBe(existing.files['a.json']);
      expect(result.manifest).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses when an existing entry has been deleted, naming the file with a null actual', () => {
    const dir = tempDir('append-deleted');
    try {
      writeFileSync(join(dir, 'a.json'), 'A');
      const existing = buildManifest(dir, ['a.json']);
      rmSync(join(dir, 'a.json'));
      const result = appendToManifest(existing, dir, []);
      expect(result.ok).toBe(false);
      expect(result.mismatches).toEqual([{ file: 'a.json', expected: existing.files['a.json'], actual: null }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('checkManifest', () => {
  it('tolerates an unlisted new file — it never appears in the result', () => {
    const dir = tempDir('check-tolerate');
    try {
      writeFileSync(join(dir, 'a.json'), 'A');
      const manifest = buildManifest(dir, ['a.json']);
      writeFileSync(join(dir, 'new.json'), 'NEW');
      const result = checkManifest(manifest, dir);
      expect(result.ok).toBe(true);
      expect(result.mismatches).toEqual([]);
      expect(result.missing).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports a listed-but-deleted file under missing, without throwing', () => {
    const dir = tempDir('check-missing');
    try {
      writeFileSync(join(dir, 'a.json'), 'A');
      const manifest = buildManifest(dir, ['a.json']);
      rmSync(join(dir, 'a.json'));
      let result;
      expect(() => {
        result = checkManifest(manifest, dir);
      }).not.toThrow();
      expect(result.ok).toBe(false);
      expect(result.missing).toEqual(['a.json']);
      expect(result.mismatches).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns ok:false with a string reason when the manifest has no files object, never throwing', () => {
    expect(() => checkManifest({}, STREAMS_DIR)).not.toThrow();
    const result = checkManifest({}, STREAMS_DIR);
    expect(result.ok).toBe(false);
    expect(typeof result.reason).toBe('string');
  });
});

describe('permanent planted-edit proof (D-17)', () => {
  let dir;
  let fixtureFiles;

  beforeAll(() => {
    dir = tempDir('planted');
    fixtureFiles = readdirSync(STREAMS_DIR).filter(isStreamFile).sort().slice(0, 2);
    for (const file of fixtureFiles) {
      copyFileSync(join(STREAMS_DIR, file), join(dir, file));
    }
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('flips ok true -> false on a planted one-byte edit, names exactly that file, tolerates a new file, and restores clean', () => {
    const names = listStreamFilenames(dir);
    const manifest = buildManifest(dir, names);

    // Sanity: the freshly-built manifest checks clean against the copy it was built from.
    expect(checkManifest(manifest, dir).ok).toBe(true);

    const [targetFile] = fixtureFiles;
    const targetPath = join(dir, targetFile);
    const original = readFileSync(targetPath);
    const originalDigest = manifest.files[targetFile];

    // Flip exactly one byte of the copy.
    const mutated = Buffer.from(original);
    mutated[0] = mutated[0] ^ 0xff;
    writeFileSync(targetPath, mutated);

    const flipped = checkManifest(manifest, dir);
    expect(flipped.ok).toBe(false);
    expect(flipped.mismatches).toHaveLength(1);
    expect(flipped.mismatches[0].file).toBe(targetFile);
    expect(flipped.mismatches[0].expected).toBe(originalDigest);
    expect(flipped.mismatches[0].actual).not.toBe(originalDigest);
    expect(flipped.missing).toEqual([]);

    // A third, unlisted new file must NOT be reported (tolerated by construction).
    writeFileSync(join(dir, 'planted-new-file.json'), '{}');
    const withNewFile = checkManifest(manifest, dir);
    expect(withNewFile.mismatches).toHaveLength(1);
    expect(withNewFile.mismatches[0].file).toBe(targetFile);
    expect(withNewFile.mismatches.some((m) => m.file === 'planted-new-file.json')).toBe(false);

    // Restore the byte — checks clean again.
    writeFileSync(targetPath, original);
    const restored = checkManifest(manifest, dir);
    expect(restored.ok).toBe(true);
    expect(restored.mismatches).toEqual([]);
    expect(restored.missing).toEqual([]);
  });
});

describe('live D-17 gate (npm test)', () => {
  it('data/stream-checksums.json checks clean against data/streams: non-vacuous, no manifest.json key, every key a real stream file, zero mismatches/missing', () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    const keys = Object.keys(manifest.files);

    expect(keys.length).toBeGreaterThan(0);
    expect(manifest.files['manifest.json']).toBeUndefined();
    for (const key of keys) {
      expect(isStreamFile(key)).toBe(true);
    }

    const result = checkManifest(manifest, STREAMS_DIR);
    expect(result.mismatches).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.ok).toBe(true);
    // Hashing the whole archive takes ~1s unloaded but ran 5.6s under parallel
    // executor load, blowing vitest's 5s default. The gate must fail on a digest
    // change, never on a busy machine.
  }, 60_000);
});
