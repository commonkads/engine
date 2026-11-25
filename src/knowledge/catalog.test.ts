import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadCatalog,
  loadDomainManifestFromStore,
  KnowledgeCatalogError,
  DomainManifestError,
} from './catalog.js';
import type { FileContent, IFileStore } from '../core/index.js';

class FakeFileStore implements IFileStore {
  constructor(private readonly files: Record<string, string>) {}
  async read(path: string): Promise<string> {
    const content = this.files[path];
    if (content === undefined) throw new Error(`no such fake file: ${path}`);
    return content;
  }
  async readWithVersion(path: string): Promise<FileContent> {
    return { content: await this.read(path), version: 'v1' };
  }
  async list(prefix: string = ''): Promise<string[]> {
    return Object.keys(this.files)
      .filter((p) => p.startsWith(prefix))
      .sort();
  }
}

describe('loadCatalog', () => {
  it('parses a valid catalog.yml', async () => {
    const store = new FakeFileStore({
      'catalog.yml': 'domains:\n  - id: foo\n    name: Foo\n    path: foo/',
    });
    const catalog = await loadCatalog(store);
    assert.deepStrictEqual(catalog.domains, [{ id: 'foo', name: 'Foo', path: 'foo/' }]);
  });

  it('throws KnowledgeCatalogError when catalog.yml is missing', async () => {
    const store = new FakeFileStore({});
    await assert.rejects(() => loadCatalog(store), KnowledgeCatalogError);
  });

  it('throws KnowledgeCatalogError when domains is not an array', async () => {
    const store = new FakeFileStore({ 'catalog.yml': 'domains: not-an-array' });
    await assert.rejects(() => loadCatalog(store), KnowledgeCatalogError);
  });
});

describe('loadDomainManifestFromStore', () => {
  const validManifest = `task: test-task
psm: assessment-with-abstraction
name: Test Domain
knowledge:
  ontologyPath: ontology.yml
  normsPath: norms.yml
  abstractionPath: abstraction.yml
  evaluationPath: evaluation.yml`;

  it('parses a valid domain.yml', async () => {
    const store = new FakeFileStore({ 'foo/domain.yml': validManifest });
    const manifest = await loadDomainManifestFromStore(store, 'foo');
    assert.strictEqual(manifest.psm, 'assessment-with-abstraction');
    assert.strictEqual(manifest.task, 'test-task');
    assert.strictEqual(manifest.name, 'Test Domain');
  });

  it('normalises path with or without trailing slash', async () => {
    const store = new FakeFileStore({ 'foo/domain.yml': validManifest });
    const a = await loadDomainManifestFromStore(store, 'foo');
    const b = await loadDomainManifestFromStore(store, 'foo/');
    assert.strictEqual(a.psm, b.psm);
  });

  it('throws DomainManifestError when domain.yml is missing', async () => {
    const store = new FakeFileStore({});
    await assert.rejects(() => loadDomainManifestFromStore(store, 'foo'), DomainManifestError);
  });

  it('throws DomainManifestError when required knowledge keys are missing', async () => {
    const partial =
      'task: assessment\npsm: assessment-with-abstraction\nknowledge:\n  ontologyPath: o.yml';
    const store = new FakeFileStore({ 'foo/domain.yml': partial });
    await assert.rejects(() => loadDomainManifestFromStore(store, 'foo'), DomainManifestError);
  });
});
