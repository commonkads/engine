/**
 * Describes the next step a PSM wants the engine to execute: which
 * knowledge to fetch, and whether the step is deterministic (knowledge
 * passed straight to `updateState`) or requires an LLM call.
 */
export interface StepDefinition {
  name: string;
  deterministic: boolean;
  knowledgeRefs?: string[];
  knowledgeSearches?: string[];
  inferenceId?: string;
}
