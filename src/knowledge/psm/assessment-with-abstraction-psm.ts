import { buildExplainInstruction, parseJsonArray, parseJsonObject } from '../../utils/index.js';
import type { StepDefinition, TaskState } from '../../core/index.js';
import { BasePsm } from './base-psm.js';

export interface AssessmentWithAbstractionPsmPaths {
  ontologyPath: string;
  normsPath: string;
  abstractionPath: string;
  evaluationPath: string;
}

export interface NormAssessment {
  name: string;
  result: 'Pass' | 'Fail';
  reason?: string;
}

export interface AssessmentResult {
  verdict: 'Pass' | 'Review';
  passed: string[];
  failed: string[];
}

const STEP_NAMES = ['obtain', 'specify', 'abstract', 'evaluate', 'conclude'] as const;

/**
 * CommonKADS Assessment PSM template (REQ-3):
 * obtain -> specify -> abstract -> evaluate -> conclude.
 */
export class AssessmentWithAbstractionPsm extends BasePsm {
  protected readonly stepNames = STEP_NAMES;

  constructor(private readonly paths: AssessmentWithAbstractionPsmPaths) {
    super();
  }

  initializeState(input: unknown): TaskState {
    return { rawInput: input };
  }

  protected isDeterministic(stepName: string): boolean {
    return stepName !== 'abstract' && stepName !== 'evaluate';
  }

  protected knowledgeRefs(stepName: string): string[] | undefined {
    switch (stepName) {
      case 'specify':
        return [this.paths.normsPath];
      case 'abstract':
        return [this.paths.abstractionPath];
      case 'evaluate':
        return [this.paths.ontologyPath, this.paths.evaluationPath];
      default:
        return undefined;
    }
  }

  /**
   * Every step's "how do I turn the engine's output into state" decision is
   * an overridable hook (`updateX`), defaulted here to this template's
   * generic behavior. A domain subclass can override any one of them -
   * e.g. to validate/reshape `obtain`'s case data, or to replace `abstract`'s
   * plain `parseJsonObject` with more complex derivation logic - without
   * touching the step sequencing itself.
   */
  protected applyStep(state: TaskState, stepName: string, output: unknown): void {
    switch (stepName) {
      case 'obtain':
        state.caseData = this.updateObtain(output, state);
        break;
      case 'specify':
        state.normsText = this.updateSpecify(output as string, state);
        break;
      case 'abstract':
        state.derivedValues = this.updateAbstract(output, state);
        break;
      case 'evaluate':
        state.normAssessments = this.updateEvaluate(output, state);
        break;
      case 'conclude':
        state.result = this.buildResult(state.normAssessments as NormAssessment[], state);
        break;
      default:
        throw new Error(`AssessmentWithAbstractionPsm has no handler for step "${stepName}"`);
    }
  }

  /** Binds case data from the task input. Default ignores `obtain`'s (empty) knowledge text. */
  protected updateObtain(_output: unknown, state: TaskState): unknown {
    return state.rawInput;
  }

  /**
   * Returns the norms text to use for `evaluate`. Default is a pass-through
   * of the norms file; subclasses override to deterministically select
   * only the norms applicable to the current case (REQ-6's Selection logic).
   */
  protected updateSpecify(normsFileContent: string, _state: TaskState): string {
    return normsFileContent;
  }

  /** Turns the `abstract` step's LLM output into derived values. Default expects a flat JSON object. */
  protected updateAbstract(output: unknown, _state: TaskState): Record<string, unknown> {
    return parseJsonObject(output);
  }

  /** Turns the `evaluate` step's LLM output into norm assessments. Default expects a JSON array. */
  protected updateEvaluate(output: unknown, _state: TaskState): NormAssessment[] {
    return parseJsonArray(output) as NormAssessment[];
  }

  /** Default conclude logic: any Fail means Review. Subclasses may override for domain-specific verdict logic. */
  protected buildResult(assessments: NormAssessment[], _state: TaskState): AssessmentResult {
    const passed = assessments.filter((a) => a.result === 'Pass').map((a) => a.name);
    const failed = assessments.filter((a) => a.result === 'Fail').map((a) => a.name);
    return {
      verdict: failed.length === 0 ? 'Pass' : 'Review',
      passed,
      failed,
    };
  }

  buildPrompt(
    step: StepDefinition,
    state: TaskState,
    knowledgeText: string,
    explain: boolean,
  ): string {
    const caseDataJson = JSON.stringify(state.caseData ?? state.rawInput, null, 2);
    const explainInstruction = buildExplainInstruction(explain);

    if (step.name === 'abstract') {
      return [
        knowledgeText,
        '## Case Data',
        caseDataJson,
        '## Instructions',
        'Using the abstraction knowledge above, compute every derived value it defines from the case data.' +
          ' Return ONLY a JSON object mapping each derived value name to its computed value.' +
          explainInstruction,
      ].join('\n\n');
    }

    if (step.name === 'evaluate') {
      return [
        knowledgeText,
        '## Norms',
        String(state.normsText ?? ''),
        '## Case Data',
        caseDataJson,
        '## Derived Values',
        JSON.stringify(state.derivedValues ?? {}, null, 2),
        '## Instructions',
        'Evaluate the case data and derived values above against every applicable norm.' +
          ' Return ONLY a JSON array of objects: {"name": <norm name>, "result": "Pass" | "Fail", "reason": <short reason>}.' +
          explainInstruction,
      ].join('\n\n');
    }

    throw new Error(
      `AssessmentWithAbstractionPsm has no prompt for non-deterministic step "${step.name}"`,
    );
  }

  mapOutput(state: TaskState): unknown {
    return state.result;
  }
}
