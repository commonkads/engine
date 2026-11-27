import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadProviderConfig, type ProviderFileConfig } from './provider-config.js';

let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'ck-provider-config-test-'));
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('loadProviderConfig', () => {
  it('returns {} when the default path does not exist', () => {
    // Uses a provider name that will never have a real config file
    const result = loadProviderConfig('__ck-test-no-such-provider__');
    assert.deepStrictEqual(result, {});
  });

  it('throws when an explicit path does not exist', () => {
    const missing = join(dir, 'missing.yml');
    assert.throws(
      () => loadProviderConfig('x', missing),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes(missing));
        return true;
      },
    );
  });

  it('parses modelId and apiKey from a valid YAML file', () => {
    const file = join(dir, 'valid.yml');
    writeFileSync(file, 'modelId: gpt-4o\napiKey: sk-test\n');
    const result = loadProviderConfig('x', file);
    assert.strictEqual(result.modelId, 'gpt-4o');
    assert.strictEqual(result.apiKey, 'sk-test');
  });

  it('returns extra YAML keys without error (generic cast)', () => {
    type Extended = ProviderFileConfig & { baseURL?: string };
    const file = join(dir, 'extended.yml');
    writeFileSync(file, 'modelId: gpt-4o\nbaseURL: https://custom.example.com\n');
    const result = loadProviderConfig<Extended>('x', file);
    assert.strictEqual(result.modelId, 'gpt-4o');
    assert.strictEqual(result.baseURL, 'https://custom.example.com');
  });

  it('returns {} for an empty YAML file', () => {
    const file = join(dir, 'empty.yml');
    writeFileSync(file, '');
    const result = loadProviderConfig('x', file);
    assert.deepStrictEqual(result, {});
  });

  it('uses COMMONKADS_CONFIG_DIR when set', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'ck-config-dir-test-'));
    writeFileSync(join(configDir, 'myprovider.yml'), 'modelId: custom-model\n');
    const prev = process.env['COMMONKADS_CONFIG_DIR'];
    process.env['COMMONKADS_CONFIG_DIR'] = configDir;
    try {
      const result = loadProviderConfig('myprovider');
      assert.strictEqual(result.modelId, 'custom-model');
    } finally {
      if (prev === undefined) delete process.env['COMMONKADS_CONFIG_DIR'];
      else process.env['COMMONKADS_CONFIG_DIR'] = prev;
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it('explicit configFile takes priority over COMMONKADS_CONFIG_DIR', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'ck-config-dir-override-'));
    writeFileSync(join(configDir, 'x.yml'), 'modelId: from-dir\n');
    const explicitFile = join(dir, 'explicit.yml');
    writeFileSync(explicitFile, 'modelId: from-explicit\n');
    const prev = process.env['COMMONKADS_CONFIG_DIR'];
    process.env['COMMONKADS_CONFIG_DIR'] = configDir;
    try {
      const result = loadProviderConfig('x', explicitFile);
      assert.strictEqual(result.modelId, 'from-explicit');
    } finally {
      if (prev === undefined) delete process.env['COMMONKADS_CONFIG_DIR'];
      else process.env['COMMONKADS_CONFIG_DIR'] = prev;
      rmSync(configDir, { recursive: true, force: true });
    }
  });
});
