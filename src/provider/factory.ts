import type { IInferenceProvider } from '../core/interfaces/i-inference-provider.js';

import { OllamaTextInference } from './ollama/ollama.js';

export interface OllamaProviderOptions {
  type: 'ollama';
  model: string;
  baseUrl?: string;
}

/** An open-ended config shape passed to registered provider builders. */
export type ProviderConfig = { type: string } & Record<string, unknown>;

type ProviderBuilder = (options: ProviderConfig) => IInferenceProvider;

const registry = new Map<string, ProviderBuilder>([
  [
    'ollama',
    (opts) => {
      const o = opts as unknown as OllamaProviderOptions;
      return new OllamaTextInference(o.model, { baseUrl: o.baseUrl });
    },
  ],
]);

/**
 * Registers a custom provider builder. Call once at startup before any
 * `buildInference` calls that use the custom type. Built-in types can also
 * be overridden here (useful for testing).
 *
 * Third-party packages follow this pattern to extend the registry without
 * forking strata-runtime-api: export a register() function, call
 * `registerProvider()` inside it, and install the package in the target
 * environment before startup.
 */
export function registerProvider(type: string, builder: ProviderBuilder): void {
  registry.set(type, builder);
}

/**
 * Constructs an `IInferenceProvider` from a config object. Dispatches to the
 * matching registered builder; throws if the type is unregistered.
 *
 * Pass any object with a `type` string — the specific provider option types
 * exported by `@robproper/strata-aws`, `@robproper/strata-anthropic`, and
 * `@robproper/strata-google` are all accepted at the call site.
 */
export function buildInference(options: { type: string }): IInferenceProvider {
  const builder = registry.get(options.type);
  if (builder) return builder(options as ProviderConfig);
  throw new Error(
    `Unknown provider type: "${options.type}". Register it with registerProvider() before use.`,
  );
}
