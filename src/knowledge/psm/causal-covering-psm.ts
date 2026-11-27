import { buildExplainInstruction, parseJsonArray } from '../../utils/index.js';
import type { StepDefinition, TaskState } from '../../core/index.js';
import { BasePsm } from './base-psm.js';

export interface CausalCoveringPsmPaths {
  ontologyPath: string;
  normsPath: string;
  abstractionPath: string;
  faultModelPath: string;
}

export interface Hypothesis {
  name: string;
  status: 'Confirmed' | 'Refuted' | 'Unverified';
  reason?: string;
}

export interface DiagnosisResult {
  verdict: 'Healthy' | 'Fault';
  confirmed: string[];
  refuted: string[];
  unverified: string[];
}

const STEP_NAMES = ['observe', 'hypothesise', 'verify', 'conclude'] as const;

/**
 * CommonKADS Diagnosis PSM template (REQ-4):
 * observe -> hypothesise -> verify -> conclude.
 */
export class CausalCoveringPsm extends BasePsm {
  protected readonly stepNames = STEP_NAMES;

  constructor(private readonly paths: CausalCoveringPsmPaths) {
    super();
  }

  initializeState(input: unknown): TaskState {
    return { rawInput: input };
  }

  protected isDeterministic(stepName: string): boolean {
    return stepName !== 'verify';
  }

  protected knowledgeRefs(stepName: string): string[] | undefined {
    switch (stepName) {
      case 'hypothesise':
        return [this.paths.normsPath];
      case 'verify':
        return [this.paths.ontologyPath, this.paths.abstractionPath, this.paths.faultModelPath];
      default:
        return undefined;
    }
  }

  /**
   * Every step's "how do I turn the engine's output into state" decision is
   * an overridable hook (`updateX`), defaulted here to this template's
   * generic behavior. A domain subclass can override any one of them
   * without touching the step sequencing itself.
   */
  protected applyStep(state: TaskState, stepName: string, output: unknown): void {
    switch (stepName) {
      case 'observe':
        state.observations = this.updateObserve(output, state);
        break;
      case 'hypothesise':
        state.hypothesesText = this.updateHypothesise(output, state);
        break;
      case 'verify':
        state.hypotheses = this.updateVerify(output, state);
        break;
      case 'conclude':
        state.result = this.buildResult(state.hypotheses as Hypothesis[], state);
        break;
      default:
        throw new Error(`CausalCoveringPsm has no handler for step "${stepName}"`);
    }
  }

  /** Binds observations from the task input. Default ignores `observe`'s (empty) knowledge text. */
  protected updateObserve(_output: unknown, state: TaskState): unknown {
    return state.rawInput;
  }

  /** Returns the hypotheses-source text to use for `verify`. Default is a pass-through of the norms file. */
  protected updateHypothesise(output: unknown, _state: TaskState): string {
    if (typeof output !== 'string') {
      throw new TypeError(
        `CausalCoveringPsm.updateHypothesise: expected string, got ${typeof output}`,
      );
    }
    return output;
  }

  /** Turns the `verify` step's LLM output into hypotheses. Default expects a JSON array. */
  protected updateVerify(output: unknown, _state: TaskState): Hypothesis[] {
    return parseJsonArray(output) as Hypothesis[];
  }

  protected buildResult(hypotheses: Hypothesis[], _state: TaskState): DiagnosisResult {
    const confirmed = hypotheses.filter((h) => h.status === 'Confirmed').map((h) => h.name);
    const refuted = hypotheses.filter((h) => h.status === 'Refuted').map((h) => h.name);
    const unverified = hypotheses.filter((h) => h.status === 'Unverified').map((h) => h.name);
    return {
      verdict: confirmed.length === 0 ? 'Healthy' : 'Fault',
      confirmed,
      refuted,
      unverified,
    };
  }

  buildPrompt(
    step: StepDefinition,
    state: TaskState,
    knowledgeText: string,
    explain: boolean,
  ): string {
    if (step.name !== 'verify') {
      throw new Error(`CausalCoveringPsm has no prompt for non-deterministic step "${step.name}"`);
    }

    const explainInstruction = buildExplainInstruction(explain);

    return [
      knowledgeText,
      '## Candidate Hypotheses (from norms)',
      String(state.hypothesesText ?? ''),
      '## Case Observations',
      JSON.stringify(state.observations, null, 2),
      '## Instructions',
      'Using the ontology, abstraction, and fault-model knowledge above, verify each candidate hypothesis against the observations.' +
        ' Return ONLY a JSON array of objects: {"name": <hypothesis name>, "status": "Confirmed" | "Refuted" | "Unverified", "reason": <short reason>}.' +
        explainInstruction,
    ].join('\n\n');
  }

  mapOutput(state: TaskState): unknown {
    return state.result;
  }
}
