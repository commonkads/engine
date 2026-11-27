import Ajv from 'ajv';

import type { ModelContent } from '../catalog/i-catalog.js';
import { parseJsonValue, unwrapExplanation } from '../utils/index.js';
import type { RuntimeContext } from './context.js';
import { TaskExecutionError, TaskInputValidationError } from './errors.js';
import type { InferenceProvider } from './inference-provider.js';
import type { PsmTemplate } from './psm-template.js';
import type { KnowledgeRef } from './knowledge-ref.js';
import type { StepDefinition } from './step-definition.js';
import type { TaskState } from './task-state.js';
import type { Task } from './task.js';

interface FetchedKnowledge {
  knowledgeText: string;
  knowledgeRefs: KnowledgeRef[];
}

/** Runs the Task Execution Loop described in REQ-2. */
export class RuntimeEngine {
  private readonly inferences: Record<string, InferenceProvider>;

  constructor(inference: InferenceProvider | Record<string, InferenceProvider>) {
    this.inferences = isInferenceProvider(inference) ? { default: inference } : inference;
  }

  async execute<TInput = unknown, TOutput = unknown>(
    task: Task,
    input: TInput,
    context: RuntimeContext,
  ): Promise<TOutput> {
    if (task.inputSchema !== undefined) {
      const ajv = new Ajv.Ajv();
      const valid = ajv.validate(task.inputSchema, input);
      if (!valid) {
        throw new TaskInputValidationError(ajv.errors ?? []);
      }
    }

    const state = task.psm.initializeState(input);
    let step = task.psm.getNextStep(state);
    while (step !== null) {
      await this.executeStep(task.psm, state, step, context);
      step = task.psm.getNextStep(state);
    }

    return task.psm.mapOutput(state) as TOutput;
  }

  private async executeStep(
    psm: PsmTemplate,
    state: TaskState,
    step: StepDefinition,
    context: RuntimeContext,
  ): Promise<void> {
    const startedAt = Date.now();
    context.logger?.info(`Executing step: ${step.name}`);

    try {
      const { knowledgeText, knowledgeRefs } = await this.fetchKnowledge(step, context);

      const output = step.deterministic
        ? knowledgeText
        : await this.infer(psm, state, step, knowledgeText, context);

      psm.updateState(state, step.name, output);

      context.auditLog?.push({ step: step.name, deterministic: step.deterministic, knowledgeRefs });
      context.timings?.push({ step: step.name, startedAt, durationMs: Date.now() - startedAt });
    } catch (error) {
      throw new TaskExecutionError(step.name, error);
    }
  }

  private async fetchKnowledge(
    step: StepDefinition,
    context: RuntimeContext,
  ): Promise<FetchedKnowledge> {
    const refs = step.knowledgeRefs ?? [];
    const queries = step.knowledgeSearches ?? [];
    const catalog = context.catalog;

    let refResults: ModelContent[] = [];
    if (refs.length > 0) {
      if (!catalog) {
        throw new Error(
          `Step '${step.name}' requires knowledge refs but no catalog is configured in RuntimeContext`,
        );
      }
      refResults = await Promise.all(refs.map((ref) => catalog.getModel(ref)));
    }

    // Semantic search deferred to #18 — return empty stubs matching prior behavior.
    const searchResults = queries.map(() => ({ content: '', version: '' }));

    const knowledgeRefs: KnowledgeRef[] = [
      ...refs.map((ref, i) => ({ id: ref, version: refResults[i].version })),
      ...queries.map((query, i) => ({ id: query, version: searchResults[i].version })),
    ];

    const knowledgeText = [...refResults, ...searchResults]
      .map((r) => r.content)
      .filter((text) => text.length > 0)
      .join('\n\n---\n\n');

    return { knowledgeText, knowledgeRefs };
  }

  private async infer(
    psm: PsmTemplate,
    state: TaskState,
    step: StepDefinition,
    knowledgeText: string,
    context: RuntimeContext,
  ): Promise<unknown> {
    const prompt = psm.buildPrompt(step, state, knowledgeText, context.explain);
    const id = step.inferenceId ?? 'default';
    const provider = this.inferences[id];
    if (!provider) {
      throw new Error(`No inference provider registered for id '${id}'.`);
    }
    const raw = await provider.infer(prompt, { explain: context.explain });
    const parsed = parseJsonValue(raw);

    if (!context.explain) {
      return parsed;
    }

    const { result, explanation } = unwrapExplanation(parsed);
    if (explanation !== undefined) {
      context.explanations[step.name] = explanation;
      context.logger?.info(`[${step.name}] ${explanation}`);
    }
    return result;
  }
}

function isInferenceProvider(
  v: InferenceProvider | Record<string, InferenceProvider>,
): v is InferenceProvider {
  return typeof (v as InferenceProvider).infer === 'function';
}
