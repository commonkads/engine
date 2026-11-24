import type { InferenceOptions } from '../types/inference-options.js';

/** Abstract access to an LLM completion capability. */
export interface IInferenceProvider {
  infer(prompt: string, options?: InferenceOptions): Promise<string>;
}
