import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CatalogError } from './catalog-error.js';
import { CompositeCatalog } from './composite-catalog.js';
import type { ICatalog, ModelContent } from './i-catalog.js';
import type { PsmTemplate } from '../core/psm-template.js';
import type { Task } from '../core/task.js';

class FakeCatalog implements ICatalog {
  readonly taskIds: ReadonlyArray<string>;

  constructor(
    taskIds: string[],
    private readonly models: Record<string, ModelContent> = {},
    private readonly tasks: Record<string, Task> = {},
  ) {
    this.taskIds = taskIds;
  }

  async getTask(id: string): Promise<Task> {
    const t = this.tasks[id];
    if (!t) throw new CatalogError(`task not found: ${id}`);
    return t;
  }

  async getModel(id: string): Promise<ModelContent> {
    const m = this.models[id];
    if (!m) throw new CatalogError(`model not found: ${id}`);
    return m;
  }
}

function stubTask(name: string): Task {
  return { name, psm: null as unknown as PsmTemplate };
}

describe('CompositeCatalog constructor', () => {
  it('succeeds when children have disjoint task IDs', () => {
    assert.doesNotThrow(
      () => new CompositeCatalog([new FakeCatalog(['a']), new FakeCatalog(['b'])]),
    );
  });

  it('throws CatalogError on duplicate task ID', () => {
    assert.throws(
      () => new CompositeCatalog([new FakeCatalog(['foo']), new FakeCatalog(['foo'])]),
      (err: unknown) => err instanceof CatalogError && err.message.includes('foo'),
    );
  });
});

describe('CompositeCatalog.getTask', () => {
  it('returns task from first child', async () => {
    const a = new FakeCatalog(['a'], {}, { a: stubTask('from-a') });
    const composite = new CompositeCatalog([a, new FakeCatalog(['b'])]);
    assert.strictEqual((await composite.getTask('a')).name, 'from-a');
  });

  it('returns task from second child (cross-catalog lookup)', async () => {
    const b = new FakeCatalog(['b'], {}, { b: stubTask('from-b') });
    const composite = new CompositeCatalog([new FakeCatalog(['a']), b]);
    assert.strictEqual((await composite.getTask('b')).name, 'from-b');
  });

  it('throws CatalogError when no child has the ID', async () => {
    const composite = new CompositeCatalog([new FakeCatalog(['a']), new FakeCatalog(['b'])]);
    await assert.rejects(() => composite.getTask('x'), CatalogError);
  });

  it('propagates non-CatalogError thrown by a child without swallowing it', async () => {
    const broken: ICatalog & { readonly taskIds: ReadonlyArray<string> } = {
      taskIds: ['a'],
      getTask: () => Promise.reject(new TypeError('parse failure')),
      getModel: () => Promise.reject(new TypeError('parse failure')),
    };
    const composite = new CompositeCatalog([broken]);
    await assert.rejects(() => composite.getTask('a'), TypeError);
  });
});

describe('CompositeCatalog.getModel', () => {
  it('returns model from first child', async () => {
    const a = new FakeCatalog([], { m1: { content: 'M1', version: 'v1' } });
    const composite = new CompositeCatalog([a, new FakeCatalog([])]);
    assert.deepStrictEqual(await composite.getModel('m1'), { content: 'M1', version: 'v1' });
  });

  it('returns model from second child (cross-catalog lookup)', async () => {
    const b = new FakeCatalog([], { m2: { content: 'M2', version: 'v2' } });
    const composite = new CompositeCatalog([new FakeCatalog([]), b]);
    assert.deepStrictEqual(await composite.getModel('m2'), { content: 'M2', version: 'v2' });
  });

  it('throws CatalogError when no child has the ID', async () => {
    const composite = new CompositeCatalog([new FakeCatalog([]), new FakeCatalog([])]);
    await assert.rejects(() => composite.getModel('missing'), CatalogError);
  });
});
