import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { KnowledgeCatalogError } from './domain-manifest.js';
import { CatalogError } from './catalog-error.js';
import { LocalCatalog } from './local-catalog.js';
import type { FileContent } from '../core/file-content.js';
import type { IStorageBackend } from './i-storage-backend.js';

class FakeBackend implements IStorageBackend {
  constructor(private readonly files: Record<string, string> = {}) {}

  async read(path: string): Promise<string> {
    return (await this.readWithVersion(path)).content;
  }

  async readWithVersion(path: string): Promise<FileContent> {
    const content = this.files[path];
    if (content === undefined) throw new Error(`no such file: ${path}`);
    return { content, version: 'v1' };
  }

  async list(prefix = ''): Promise<string[]> {
    return Object.keys(this.files)
      .filter((p) => p.startsWith(prefix))
      .sort();
  }
}

const validCatalog = 'domains:\n  - id: vital-signs\n    name: Vital Signs\n    path: vital-signs/';

const validDomain = `task: assessment
psm: assessment-with-abstraction
knowledge:
  ontologyPath: vital-signs/ontology.yml
  normsPath: vital-signs/norms.yml
  abstractionPath: vital-signs/abstraction.yml
  evaluationPath: vital-signs/evaluation.yml`;

describe('LocalCatalog.load', () => {
  it('parses a valid catalog.yml and exposes taskIds', async () => {
    const catalog = await LocalCatalog.load(new FakeBackend({ 'catalog.yml': validCatalog }));
    assert.deepStrictEqual(catalog.taskIds, ['vital-signs']);
  });

  it('throws KnowledgeCatalogError when catalog.yml is missing', async () => {
    await assert.rejects(() => LocalCatalog.load(new FakeBackend({})), KnowledgeCatalogError);
  });

  it('throws KnowledgeCatalogError when catalog.yml is invalid YAML', async () => {
    const backend = new FakeBackend({ 'catalog.yml': 'not: valid: yaml: [' });
    await assert.rejects(() => LocalCatalog.load(backend), KnowledgeCatalogError);
  });

  it('throws KnowledgeCatalogError when domains is not an array', async () => {
    const backend = new FakeBackend({ 'catalog.yml': 'domains: null' });
    await assert.rejects(() => LocalCatalog.load(backend), KnowledgeCatalogError);
  });
});

describe('LocalCatalog.getTask', () => {
  it('returns a Task for a known domain ID', async () => {
    const backend = new FakeBackend({
      'catalog.yml': validCatalog,
      'vital-signs/domain.yml': validDomain,
    });
    const catalog = await LocalCatalog.load(backend);
    const task = await catalog.getTask('vital-signs');
    assert.strictEqual(task.name, 'assessment');
  });

  it('throws CatalogError for an unknown ID', async () => {
    const catalog = await LocalCatalog.load(new FakeBackend({ 'catalog.yml': validCatalog }));
    await assert.rejects(() => catalog.getTask('nonexistent'), CatalogError);
  });
});

describe('LocalCatalog.getModel', () => {
  it('returns ModelContent for an existing path', async () => {
    const backend = new FakeBackend({
      'catalog.yml': validCatalog,
      'vital-signs/ontology.yml': 'ONTOLOGY',
    });
    const catalog = await LocalCatalog.load(backend);
    const model = await catalog.getModel('vital-signs/ontology.yml');
    assert.deepStrictEqual(model, { content: 'ONTOLOGY', version: 'v1' });
  });

  it('propagates backend errors for a missing path', async () => {
    const catalog = await LocalCatalog.load(new FakeBackend({ 'catalog.yml': validCatalog }));
    await assert.rejects(() => catalog.getModel('missing.yml'), /no such file: missing.yml/);
  });
});
