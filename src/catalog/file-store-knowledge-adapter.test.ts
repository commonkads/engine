import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FileStoreKnowledgeAdapter } from './file-store-knowledge-adapter.js';
import type { FileContent } from '../core/index.js';

import type { IStorageBackend } from './i-storage-backend.js';

class FakeFileStore implements IStorageBackend {
  constructor(private readonly files: Record<string, FileContent> = {}) {}

  async read(path: string): Promise<string> {
    return (await this.readWithVersion(path)).content;
  }

  async readWithVersion(path: string): Promise<FileContent> {
    const file = this.files[path];
    if (!file) throw new Error(`no such fake file: ${path}`);
    return file;
  }

  async list(prefix = ''): Promise<string[]> {
    return Object.keys(this.files)
      .filter((p) => p.startsWith(prefix))
      .sort();
  }
}

describe('FileStoreKnowledgeAdapter', () => {
  it('get delegates to readWithVersion and returns content and version', async () => {
    const store = new FakeFileStore({ 'doc.txt': { content: 'hello', version: 'v42' } });
    const adapter = new FileStoreKnowledgeAdapter(store);

    const result = await adapter.get('doc.txt');

    assert.deepStrictEqual(result, { content: 'hello', version: 'v42' });
  });

  it('get propagates errors from the underlying file store', async () => {
    const adapter = new FileStoreKnowledgeAdapter(new FakeFileStore());

    await assert.rejects(() => adapter.get('missing.txt'), /no such fake file/);
  });

  it('search returns empty content and empty version regardless of query', async () => {
    const adapter = new FileStoreKnowledgeAdapter(new FakeFileStore());

    const result = await adapter.search('anything');

    assert.deepStrictEqual(result, { content: '', version: '' });
  });
});
