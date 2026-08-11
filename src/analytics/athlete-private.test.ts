import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileStore } from '../storage/file-store.js';
import { loadAthletePrivateConfig, parseAthletePrivateConfig } from './athlete-private.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE_PATH = path.resolve(__dirname, '../../data/private/athlete-private.example.json');

describe('parseAthletePrivateConfig', () => {
  it('accepts a fully valid config', () => {
    const config = parseAthletePrivateConfig({
      schemaVersion: 1,
      birthDate: '1985-04-12',
      sex: 'male',
      restingHr: 48,
    });
    expect(config).toEqual({
      schemaVersion: 1,
      birthDate: '1985-04-12',
      sex: 'male',
      restingHr: 48,
    });
  });

  it('rejects the shipped example template (placeholder birthDate)', async () => {
    const raw = JSON.parse(await fs.readFile(EXAMPLE_PATH, 'utf8'));
    expect(parseAthletePrivateConfig(raw)).toBeNull();
  });

  it('rejects a config with missing sex', () => {
    const config = parseAthletePrivateConfig({
      schemaVersion: 1,
      birthDate: '1985-04-12',
    });
    expect(config).toBeNull();
  });

  it("rejects sex: 'M' (must be exactly 'male' or 'female')", () => {
    const config = parseAthletePrivateConfig({
      schemaVersion: 1,
      birthDate: '1985-04-12',
      sex: 'M',
    });
    expect(config).toBeNull();
  });

  it('restingHr absent becomes null', () => {
    const config = parseAthletePrivateConfig({
      schemaVersion: 1,
      birthDate: '1985-04-12',
      sex: 'female',
    });
    expect(config?.restingHr).toBeNull();
  });

  it('restingHr: 0 becomes null (placeholder value, not a real resting HR)', () => {
    const config = parseAthletePrivateConfig({
      schemaVersion: 1,
      birthDate: '1985-04-12',
      sex: 'female',
      restingHr: 0,
    });
    expect(config?.restingHr).toBeNull();
  });

  it('restingHr: 48 is preserved as 48', () => {
    const config = parseAthletePrivateConfig({
      schemaVersion: 1,
      birthDate: '1985-04-12',
      sex: 'female',
      restingHr: 48,
    });
    expect(config?.restingHr).toBe(48);
  });

  it('a __proto__-keyed object is not reachable (prototype-pollution discipline)', () => {
    const malicious = JSON.parse(
      '{"schemaVersion":1,"birthDate":"1985-04-12","sex":"male","__proto__":{"restingHr":48}}'
    );
    // JSON.parse never triggers the [[Prototype]] setter for a "__proto__"
    // key — it lands as an ordinary own data property, and the object's
    // actual prototype stays Object.prototype (no pollution occurred).
    expect(Object.getPrototypeOf(malicious)).toBe(Object.prototype);
    const config = parseAthletePrivateConfig(malicious);
    // restingHr is nested under the __proto__ VALUE, not a top-level own
    // key, so the hasOwn-gated parser must not reach it and reports null.
    expect(config?.restingHr).toBeNull();
  });

  it('a prose birthDate like "1985" is rejected', () => {
    const config = parseAthletePrivateConfig({
      schemaVersion: 1,
      birthDate: '1985',
      sex: 'male',
    });
    expect(config).toBeNull();
  });
});

describe('loadAthletePrivateConfig', () => {
  let tmpDir: string;
  let fileStore: FileStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'athlete-private-'));
    fileStore = new FileStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns null (not throwing) when readJson rejects with ENOENT', async () => {
    const config = await loadAthletePrivateConfig(fileStore, 'does-not-exist.json');
    expect(config).toBeNull();
  });

  it('loads a real valid config from disk', async () => {
    await fileStore.writeJson('athlete-private.json', {
      schemaVersion: 1,
      birthDate: '1985-04-12',
      sex: 'male',
      restingHr: 48,
    });
    const config = await loadAthletePrivateConfig(fileStore, 'athlete-private.json');
    expect(config).toEqual({
      schemaVersion: 1,
      birthDate: '1985-04-12',
      sex: 'male',
      restingHr: 48,
    });
  });
});
