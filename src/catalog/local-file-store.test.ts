import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalFileStore } from './local-file-store.js';
import { FileNotFoundError, InvalidStoreConfigError } from '../core/errors.js';

describe('LocalFileStore', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'strata-engine-test-'));
    await writeFile(join(dir, 'norms.txt'), 'hello knowledge');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('throws InvalidStoreConfigError when the root directory does not exist', () => {
    assert.throws(() => new LocalFileStore(join(dir, 'does-not-exist')), InvalidStoreConfigError);
  });

  it('reads UTF-8 text content relative to the root', async () => {
    const store = new LocalFileStore(dir);
    assert.strictEqual(await store.read('norms.txt'), 'hello knowledge');
  });

  it('throws FileNotFoundError for a missing file', async () => {
    const store = new LocalFileStore(dir);
    await assert.rejects(store.read('missing.txt'), FileNotFoundError);
  });

  it('readWithVersion returns the content and a 12-character hash version', async () => {
    const store = new LocalFileStore(dir);
    const result = await store.readWithVersion('norms.txt');
    assert.strictEqual(result.content, 'hello knowledge');
    assert.strictEqual(result.version.length, 12);
    assert.match(result.version, /^[0-9a-f]{12}$/);
  });

  describe('list', () => {
    let listDir: string;

    beforeEach(async () => {
      listDir = await mkdtemp(join(tmpdir(), 'strata-engine-list-'));
      await writeFile(join(listDir, 'catalog.yml'), '');
      await mkdir(join(listDir, 'domain-a'));
      await writeFile(join(listDir, 'domain-a', 'domain.yml'), '');
      await writeFile(join(listDir, 'domain-a', 'norms.txt'), '');
      await mkdir(join(listDir, 'domain-b'));
      await writeFile(join(listDir, 'domain-b', 'domain.yml'), '');
    });

    afterEach(async () => {
      await rm(listDir, { recursive: true, force: true });
    });

    it('returns all file paths when called with no prefix', async () => {
      const store = new LocalFileStore(listDir);
      const result = await store.list();

      assert.deepStrictEqual(result, [
        'catalog.yml',
        'domain-a/domain.yml',
        'domain-a/norms.txt',
        'domain-b/domain.yml',
      ]);
    });

    it('filters paths by prefix', async () => {
      const store = new LocalFileStore(listDir);
      const result = await store.list('domain-a/');

      assert.deepStrictEqual(result, ['domain-a/domain.yml', 'domain-a/norms.txt']);
    });

    it('returns empty array when prefix has no matches', async () => {
      const store = new LocalFileStore(listDir);
      const result = await store.list('nonexistent/');

      assert.deepStrictEqual(result, []);
    });

    it('returns paths in lexicographic order', async () => {
      const store = new LocalFileStore(listDir);
      const result = await store.list();

      const sorted = [...result].sort();
      assert.deepStrictEqual(result, sorted);
    });

    it('returns empty array for an empty directory', async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), 'strata-engine-empty-'));
      try {
        const store = new LocalFileStore(emptyDir);
        const result = await store.list();
        assert.deepStrictEqual(result, []);
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
      }
    });
  });
});
