import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RuntimeContext } from '../../core/context.js';
import { RuntimeEngine } from '../../core/engine.js';
import type { FileContent } from '@commonkads/engine';
import type { ICatalog } from '../../catalog/i-catalog.js';
import type { IStorageBackend } from '../../catalog/i-storage-backend.js';
import { DataDrivenMonitoringPsm } from './data-driven-monitoring-psm.js';

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

function buildEngine(deviations: Array<{ name: string; severity: string; reason: string }>) {
  const inference = { infer: async () => JSON.stringify(deviations) };
  return new RuntimeEngine(inference);
}

const paths = {
  ontologyPath: 'ontology.txt',
  normsPath: 'norms.txt',
  abstractionPath: 'abstraction.txt',
  tolerancePath: 'tolerance.txt',
};

describe('DataDrivenMonitoringPsm', () => {
  it('sequences observe -> compare -> evaluate -> conclude and produces a Normal verdict', async () => {
    const engine = buildEngine([
      { name: 'Temperature', severity: 'Normal', reason: 'within range' },
    ]);

    const result = (await engine.execute(
      { name: 'monitoring', psm: new DataDrivenMonitoringPsm(paths) },
      {},
      new RuntimeContext({ catalog }),
    )) as {
      verdict: string;
      deviations: unknown[];
    };

    assert.strictEqual(result.verdict, 'Normal');
    assert.strictEqual(result.deviations.length, 1);
  });

  it('throws when LLM returns an object instead of an array for the evaluate step', async () => {
    const inference = {
      infer: async () => JSON.stringify({ name: 'Temperature', severity: 'Normal' }),
    };
    const engine = new RuntimeEngine(inference);

    await assert.rejects(
      engine.execute(
        { name: 'monitoring', psm: new DataDrivenMonitoringPsm(paths) },
        {},
        new RuntimeContext({ catalog }),
      ),
      /Expected a JSON array/,
    );
  });

  it('produces a Warning verdict when the worst deviation is a warning', async () => {
    const engine = buildEngine([
      { name: 'Temperature', severity: 'Normal', reason: 'within range' },
      { name: 'Pressure', severity: 'Warning', reason: 'approaching limit' },
    ]);

    const result = (await engine.execute(
      { name: 'monitoring', psm: new DataDrivenMonitoringPsm(paths) },
      {},
      new RuntimeContext({ catalog }),
    )) as {
      verdict: string;
    };
    assert.strictEqual(result.verdict, 'Warning');
  });

  it('produces a Breach verdict when any deviation is a breach, even alongside warnings', async () => {
    const engine = buildEngine([
      { name: 'Pressure', severity: 'Warning', reason: 'approaching limit' },
      { name: 'Temperature', severity: 'Breach', reason: 'over limit' },
    ]);

    const result = (await engine.execute(
      { name: 'monitoring', psm: new DataDrivenMonitoringPsm(paths) },
      {},
      new RuntimeContext({ catalog }),
    )) as {
      verdict: string;
    };
    assert.strictEqual(result.verdict, 'Breach');
  });
});
