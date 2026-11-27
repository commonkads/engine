import { buildExplainInstruction, parseJsonArray } from '../../utils/index.js';
import type { StepDefinition, TaskState } from '../../core/index.js';
import { BasePsm } from './base-psm.js';

export interface DataDrivenMonitoringPsmPaths {
  ontologyPath: string;
  normsPath: string;
  abstractionPath: string;
  tolerancePath: string;
}

export interface Deviation {
  name: string;
  severity: 'Normal' | 'Warning' | 'Breach';
  reason?: string;
}

export interface MonitoringResult {
  verdict: 'Normal' | 'Warning' | 'Breach';
  deviations: Deviation[];
}

const STEP_NAMES = ['observe', 'compare', 'evaluate', 'conclude'] as const;

/**
 * CommonKADS Monitoring PSM template (REQ-5):
 * observe -> compare -> evaluate -> conclude.
 */
export class DataDrivenMonitoringPsm extends BasePsm {
  protected readonly stepNames = STEP_NAMES;

  constructor(private readonly paths: DataDrivenMonitoringPsmPaths) {
    super();
  }

  initializeState(input: unknown): TaskState {
    return { rawInput: input };
  }

  protected isDeterministic(stepName: string): boolean {
    return stepName !== 'evaluate';
  }

  protected knowledgeRefs(stepName: string): string[] | undefined {
    switch (stepName) {
      case 'compare':
        return [this.paths.normsPath];
      case 'evaluate':
        return [this.paths.ontologyPath, this.paths.abstractionPath, this.paths.tolerancePath];
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
      case 'compare':
        state.normsText = this.updateCompare(output, state);
        break;
      case 'evaluate':
        state.deviations = this.updateEvaluate(output, state);
        break;
      case 'conclude':
        state.result = this.buildResult(state.deviations as Deviation[], state);
        break;
      default:
        throw new Error(`DataDrivenMonitoringPsm has no handler for step "${stepName}"`);
    }
  }

  /** Binds observations from the task input. Default ignores `observe`'s (empty) knowledge text. */
  protected updateObserve(_output: unknown, state: TaskState): unknown {
    return state.rawInput;
  }

  /** Returns the norms text to use for `evaluate`. Default is a pass-through of the norms file. */
  protected updateCompare(output: unknown, _state: TaskState): string {
    return output as string;
  }

  /** Turns the `evaluate` step's LLM output into deviations. Default expects a JSON array. */
  protected updateEvaluate(output: unknown, _state: TaskState): Deviation[] {
    return parseJsonArray(output) as Deviation[];
  }

  protected buildResult(deviations: Deviation[], _state: TaskState): MonitoringResult {
    const verdict = deviations.some((d) => d.severity === 'Breach')
      ? 'Breach'
      : deviations.some((d) => d.severity === 'Warning')
        ? 'Warning'
        : 'Normal';
    return { verdict, deviations };
  }

  buildPrompt(
    step: StepDefinition,
    state: TaskState,
    knowledgeText: string,
    explain: boolean,
  ): string {
    if (step.name !== 'evaluate') {
      throw new Error(
        `DataDrivenMonitoringPsm has no prompt for non-deterministic step "${step.name}"`,
      );
    }

    const explainInstruction = buildExplainInstruction(explain);

    return [
      knowledgeText,
      '## Norms',
      String(state.normsText ?? ''),
      '## Observations',
      JSON.stringify(state.observations, null, 2),
      '## Instructions',
      'Using the ontology, abstraction, and tolerance knowledge above, compare the observations against the norms and identify deviations.' +
        ' Return ONLY a JSON array of objects: {"name": <observed quantity>, "severity": "Normal" | "Warning" | "Breach", "reason": <short reason>}.' +
        explainInstruction,
    ].join('\n\n');
  }

  mapOutput(state: TaskState): unknown {
    return state.result;
  }
}
