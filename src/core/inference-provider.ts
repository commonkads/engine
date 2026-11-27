import type { InferenceOptions } from './inference-options.js';

/** Abstract access to an LLM completion capability. */
export interface InferenceProvider {
  infer(prompt: string, options?: InferenceOptions): Promise<string>;
}
