import type { PsmTemplate } from '../../core/psm-template.js';
import type { StepDefinition, TaskState } from '../../core/index.js';

const COMPLETED_STEPS_KEY = '_completedSteps';

/**
 * Shared sequencing logic for the CommonKADS PSM templates (REQ-3/4/5).
 * Each template is a fixed, ordered list of step names; this class walks
 * that list using an index tracked in `TaskState`, so subclasses only need
 * to describe each step's knowledge requirements and how to fold its
 * output back into state.
 */
export abstract class BasePsm implements PsmTemplate {
  protected abstract readonly stepNames: readonly string[];

  abstract initializeState(input: unknown): TaskState;
  abstract buildPrompt(
    step: StepDefinition,
    state: TaskState,
    knowledgeText: string,
    explain: boolean,
  ): string;
  abstract mapOutput(state: TaskState): unknown;

  protected abstract isDeterministic(stepName: string): boolean;
  protected abstract knowledgeRefs(stepName: string, state: TaskState): string[] | undefined;
  protected knowledgeSearches(_stepName: string, _state: TaskState): string[] | undefined {
    return undefined;
  }
  protected abstract applyStep(state: TaskState, stepName: string, output: unknown): void;

  getNextStep(state: TaskState): StepDefinition | null {
    const stepName = this.stepNames[this.completedSteps(state).length];
    if (stepName === undefined) {
      return null;
    }
    return {
      name: stepName,
      deterministic: this.isDeterministic(stepName),
      knowledgeRefs: this.knowledgeRefs(stepName, state),
      knowledgeSearches: this.knowledgeSearches(stepName, state),
    };
  }

  updateState(state: TaskState, step: string, output: unknown): void {
    this.applyStep(state, step, output);
    this.completedSteps(state).push(step);
  }

  private completedSteps(state: TaskState): string[] {
    if (!Array.isArray(state[COMPLETED_STEPS_KEY])) {
      state[COMPLETED_STEPS_KEY] = [];
    }
    return state[COMPLETED_STEPS_KEY] as string[];
  }
}
