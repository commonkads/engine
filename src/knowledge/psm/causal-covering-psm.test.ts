import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RuntimeContext } from '../../core/context.js';
import { RuntimeEngine } from '../../core/engine.js';
import type { FileContent } from '@commonkads/engine';
import type { ICatalog } from '../../catalog/i-catalog.js';
import type { IStorageBackend } from '../../catalog/i-storage-backend.js';
import { CausalCoveringPsm } from './causal-covering-psm.js';

class FakeFileStore implements IStorageBackend {
  async read(path: string): Promise<string> {
    return (await this.readWithVersion(path)).content;
  }

  async readWithVersion(path: string): Promise<FileContent> {
    return { content: `CONTENT:${path}`, version: `v:${path}` };
  }

  async list(_prefix?: string): Promise<string[]> {
    return [];
  }
}

const catalog: ICatalog = {
  getTask: () => Promise.reject(new Error('getTask not used in PSM tests')),
  getModel: (id) => new FakeFileStore().readWithVersion(id),
};

function buildEngine(hypotheses: Array<{ name: string; status: string; reason: string }>) {
  const inference = { infer: async () => JSON.stringify(hypotheses) };
  return new RuntimeEngine(inference);
}

const paths = {
  ontologyPath: 'ontology.txt',
  normsPath: 'norms.txt',
  abstractionPath: 'abstraction.txt',
  faultModelPath: 'fault-model.txt',
};

describe('CausalCoveringPsm', () => {
  it('sequences observe -> hypothesise -> verify -> conclude and produces a Healthy verdict', async () => {
    const engine = buildEngine([
      { name: 'H1', status: 'Refuted', reason: 'no evidence' },
      { name: 'H2', status: 'Unverified', reason: 'insufficient data' },
    ]);

    const result = (await engine.execute(
      { name: 'diagnosis', psm: new CausalCoveringPsm(paths) },
      {},
      new RuntimeContext({ catalog }),
    )) as {
      verdict: string;
      confirmed: string[];
      refuted: string[];
      unverified: string[];
    };

    assert.strictEqual(result.verdict, 'Healthy');
    assert.deepStrictEqual(result.confirmed, []);
    assert.deepStrictEqual(result.refuted, ['H1']);
    assert.deepStrictEqual(result.unverified, ['H2']);
  });

  it('throws TaskExecutionError when LLM returns an object instead of an array', async () => {
    const inference = { infer: async () => JSON.stringify({ name: 'H1', status: 'Confirmed' }) };
    const engine = new RuntimeEngine(inference);

    await assert.rejects(
      engine.execute(
        { name: 'diagnosis', psm: new CausalCoveringPsm(paths) },
        {},
        new RuntimeContext({ catalog }),
      ),
      /Expected a JSON array/,
    );
  });

  it('produces a Fault verdict when a hypothesis is confirmed', async () => {
    const engine = buildEngine([
      { name: 'H1', status: 'Confirmed', reason: 'matches symptoms' },
      { name: 'H2', status: 'Refuted', reason: 'no evidence' },
    ]);

    const result = (await engine.execute(
      { name: 'diagnosis', psm: new CausalCoveringPsm(paths) },
      {},
      new RuntimeContext({ catalog }),
    )) as {
      verdict: string;
      confirmed: string[];
    };

    assert.strictEqual(result.verdict, 'Fault');
    assert.deepStrictEqual(result.confirmed, ['H1']);
  });
});
