import type { StepDefinition } from './step-definition.js';
import type { TaskState } from './task-state.js';

/**
 * A problem-solving method template. Drives the engine's Task Execution Loop
 * by mapping input to state, yielding steps one at a time, folding step output
 * back into state, and mapping final state to output.
 */
export interface PsmTemplate {
  initializeState(input: unknown): TaskState;
  /** Returns the next step to execute, or `null` when the task is complete. */
  getNextStep(state: TaskState): StepDefinition | null;
  /**
   * Builds the full prompt for a non-deterministic step, combining the
   * fetched knowledge text with the current case data and the fixed
   * output-shape instructions for this PSM template. Those instructions are
   * invariant across domains, so they live in PSM code, not knowledge files.
   */
  buildPrompt(
    step: StepDefinition,
    state: TaskState,
    knowledgeText: string,
    explain: boolean,
  ): string;
  updateState(state: TaskState, step: string, output: unknown): void;
  mapOutput(state: TaskState): unknown;
}
