import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RuntimeContext } from './context.js';
import { RuntimeEngine } from './engine.js';
import { TaskExecutionError, TaskInputValidationError } from './errors.js';
import type {
  FileContent,
  IInferenceProvider,
  IKnowledgeStore,
  InferenceOptions,
  IPsmTemplate,
  StepDefinition,
  TaskState,
} from '@commonkads/engine';

class FakeKnowledgeStore implements IKnowledgeStore {
  constructor(
    private readonly files: Record<string, FileContent> = {},
    private readonly passages: Record<string, string> = {},
  ) {}

  async get(ref: string): Promise<FileContent> {
    const file = this.files[ref];
    if (!file) throw new Error(`no such fake ref: ${ref}`);
    return file;
  }

  async search(query: string): Promise<FileContent> {
    return { content: this.passages[query] ?? '', version: '' };
  }
}

/** Two-step PSM: a deterministic "det" step, then a non-deterministic "llm" step. */
class FakePsm implements IPsmTemplate {
  initializeState(input: unknown): TaskState {
    return { input, completed: [] };
  }

  getNextStep(state: TaskState): StepDefinition | null {
    const completed = state.completed as string[];
    if (completed.length === 0) {
      return { name: 'det', deterministic: true, knowledgeRefs: ['a.txt'] };
    }
    if (completed.length === 1) {
      return {
        name: 'llm',
        deterministic: false,
        knowledgeRefs: ['b.txt'],
        knowledgeSearches: ['q1'],
      };
    }
    return null;
  }

  buildPrompt(
    step: StepDefinition,
    _state: TaskState,
    knowledgeText: string,
    _explain: boolean,
  ): string {
    return `PROMPT[${step.name}]:${knowledgeText}`;
  }

  updateState(state: TaskState, step: string, output: unknown): void {
    (state.completed as string[]).push(step);
    state[`${step}Output`] = output;
  }

  mapOutput(state: TaskState): unknown {
    return state;
  }
}

function buildEngine(infer: IInferenceProvider['infer']) {
  const store = new FakeKnowledgeStore(
    {
      'a.txt': { content: 'A-CONTENT', version: 'va' },
      'b.txt': { content: 'B-CONTENT', version: 'vb' },
    },
    { q1: 'Q1-PASSAGE' },
  );
  const inference: IInferenceProvider = { infer };
  return new RuntimeEngine(store, inference);
}

describe('RuntimeEngine', () => {
  it('runs the deterministic step with knowledge text passed directly, and the LLM step via inference', async () => {
    let capturedPrompt = '';
    const engine = buildEngine(async (prompt) => {
      capturedPrompt = prompt;
      return JSON.stringify({ ok: true });
    });

    const context = new RuntimeContext();
    const result = (await engine.execute(
      { name: 'fake', psm: new FakePsm() },
      { x: 1 },
      context,
    )) as TaskState;

    assert.strictEqual(result.detOutput, 'A-CONTENT');
    assert.strictEqual(capturedPrompt, 'PROMPT[llm]:B-CONTENT\n\n---\n\nQ1-PASSAGE');
    assert.deepStrictEqual(result.llmOutput, { ok: true });
    assert.deepStrictEqual(result.completed, ['det', 'llm']);
  });

  it('unwraps the explain wrapper and stores the explanation on the context', async () => {
    const engine = buildEngine(async (_prompt, _options?: InferenceOptions) =>
      JSON.stringify({ result: { ok: true }, _explanation: 'because reasons' }),
    );

    const context = new RuntimeContext({ explain: true });
    const result = (await engine.execute(
      { name: 'fake', psm: new FakePsm() },
      {},
      context,
    )) as TaskState;

    assert.deepStrictEqual(result.llmOutput, { ok: true });
    assert.strictEqual(context.explanations.llm, 'because reasons');
  });

  it('records an audit log entry and a timing entry per step when enabled', async () => {
    const engine = buildEngine(async () => JSON.stringify({ ok: true }));
    const context = new RuntimeContext({ enableAuditLog: true, enableTimings: true });

    await engine.execute({ name: 'fake', psm: new FakePsm() }, {}, context);

    assert.deepStrictEqual(context.auditLog, [
      { step: 'det', deterministic: true, knowledgeRefs: [{ id: 'a.txt', version: 'va' }] },
      {
        step: 'llm',
        deterministic: false,
        knowledgeRefs: [
          { id: 'b.txt', version: 'vb' },
          { id: 'q1', version: '' },
        ],
      },
    ]);
    assert.strictEqual(context.timings?.length, 2);
    for (const timing of context.timings!) {
      assert.strictEqual(typeof timing.startedAt, 'number');
      assert.ok(timing.durationMs >= 0);
    }
  });

  it('leaves auditLog and timings undefined when not enabled', async () => {
    const engine = buildEngine(async () => JSON.stringify({ ok: true }));
    const context = new RuntimeContext();

    await engine.execute({ name: 'fake', psm: new FakePsm() }, {}, context);

    assert.strictEqual(context.auditLog, undefined);
    assert.strictEqual(context.timings, undefined);
  });

  it('wraps a thrown inference error in a TaskExecutionError naming the failing step', async () => {
    const engine = buildEngine(async () => {
      throw new Error('boom');
    });
    const context = new RuntimeContext();

    let caught: unknown;
    try {
      await engine.execute({ name: 'fake', psm: new FakePsm() }, {}, context);
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof TaskExecutionError);
    assert.strictEqual((caught as TaskExecutionError).step, 'llm');
    assert.ok((caught as TaskExecutionError).cause instanceof Error);
  });

  it('routes a step with inferenceId to the named provider, not the default', async () => {
    let defaultCalled = false;
    let namedCalled = false;

    const store = new FakeKnowledgeStore({ 'a.txt': { content: 'A', version: 'v1' } }, {});

    class SingleStepPsm implements IPsmTemplate {
      initializeState(input: unknown): TaskState {
        return { input, completed: [] };
      }
      getNextStep(state: TaskState): StepDefinition | null {
        return (state.completed as string[]).length === 0
          ? { name: 'named', deterministic: false, inferenceId: 'fast' }
          : null;
      }
      buildPrompt(): string {
        return 'PROMPT';
      }
      updateState(state: TaskState, step: string): void {
        (state.completed as string[]).push(step);
      }
      mapOutput(state: TaskState): unknown {
        return state;
      }
    }

    const engine = new RuntimeEngine(store, {
      default: {
        infer: async () => {
          defaultCalled = true;
          return JSON.stringify({});
        },
      },
      fast: {
        infer: async () => {
          namedCalled = true;
          return JSON.stringify({});
        },
      },
    });

    await engine.execute({ name: 'test', psm: new SingleStepPsm() }, {}, new RuntimeContext());

    assert.strictEqual(defaultCalled, false);
    assert.strictEqual(namedCalled, true);
  });

  it('throws TaskExecutionError when step inferenceId is not registered', async () => {
    const store = new FakeKnowledgeStore({ 'a.txt': { content: 'A', version: 'v1' } }, {});

    class MissingIdPsm implements IPsmTemplate {
      initializeState(input: unknown): TaskState {
        return { input, completed: [] };
      }
      getNextStep(state: TaskState): StepDefinition | null {
        return (state.completed as string[]).length === 0
          ? { name: 'bad', deterministic: false, inferenceId: 'missing' }
          : null;
      }
      buildPrompt(): string {
        return 'PROMPT';
      }
      updateState(state: TaskState, step: string): void {
        (state.completed as string[]).push(step);
      }
      mapOutput(state: TaskState): unknown {
        return state;
      }
    }

    const engine = new RuntimeEngine(store, { infer: async () => JSON.stringify({}) });

    let caught: unknown;
    try {
      await engine.execute({ name: 'test', psm: new MissingIdPsm() }, {}, new RuntimeContext());
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof TaskExecutionError);
    assert.ok((caught as TaskExecutionError).cause instanceof Error);
    assert.ok(((caught as TaskExecutionError).cause as Error).message.includes('missing'));
  });
});

describe('RuntimeEngine — schema validation', () => {
  it('skips validation and runs normally when task has no inputSchema', async () => {
    const engine = buildEngine(async () => JSON.stringify({ ok: true }));
    const context = new RuntimeContext();
    // No inputSchema on task — should not throw
    const result = await engine.execute({ name: 'fake', psm: new FakePsm() }, { x: 1 }, context);
    assert.ok(result !== undefined);
  });

  it('runs normally when input satisfies the inputSchema', async () => {
    const engine = buildEngine(async () => JSON.stringify({ ok: true }));
    const context = new RuntimeContext();
    const task = {
      name: 'fake',
      psm: new FakePsm(),
      inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
    };
    const result = await engine.execute(task, { x: 1 }, context);
    assert.ok(result !== undefined);
  });

  it('throws TaskInputValidationError when input violates the inputSchema', async () => {
    const engine = buildEngine(async () => JSON.stringify({ ok: true }));
    const context = new RuntimeContext();
    const task = {
      name: 'fake',
      psm: new FakePsm(),
      inputSchema: { type: 'object', required: ['x'], properties: { x: { type: 'number' } } },
    };

    let caught: unknown;
    try {
      await engine.execute(task, { y: 'wrong' }, context);
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof TaskInputValidationError);
    assert.ok(Array.isArray((caught as TaskInputValidationError).errors));
    assert.ok((caught as TaskInputValidationError).errors.length > 0);
  });

  it('does not throw TaskExecutionError for a schema failure (schema is validated before the loop)', async () => {
    const engine = buildEngine(async () => {
      throw new Error('should not reach inference');
    });
    const context = new RuntimeContext();
    const task = {
      name: 'fake',
      psm: new FakePsm(),
      inputSchema: { type: 'object', required: ['required_field'] },
    };

    let caught: unknown;
    try {
      await engine.execute(task, {}, context);
    } catch (err) {
      caught = err;
    }

    assert.ok(caught instanceof TaskInputValidationError);
  });
});
