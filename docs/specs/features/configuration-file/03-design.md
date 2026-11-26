# Design: Configuration Files

## New files

| File | Purpose |
|---|---|
| `engine/src/utils/provider-config.ts` | Base type + loader function |
| `engine/src/utils/provider-config.test.ts` | Unit tests for loader |

## Changed files

| File | Change |
|---|---|
| `engine/src/utils/index.ts` | Add `export * from './provider-config.js'` |
| `engine/src/utils/diagnostics.ts` | Route pino output to `process.stderr` (not stdout) |
| `provider-anthropic/src/claude.ts` | Extend options, make `modelId` optional, add logging |
| `provider-anthropic/src/index.ts` | `model: string` → `model?: string` in `ClaudeProviderOptions` |
| `provider-openai/src/openai.ts` | Extend options, make `modelId` optional, add logging |
| `provider-openai/src/index.ts` | `model: string` → `model?: string` in `OpenAIProviderOptions` |
| `provider-google/src/gemini.ts` | Extend options, make `modelId` optional, add logging |
| `provider-google/src/index.ts` | `model: string` → `model?: string` in `GoogleProviderOptions` |
| `provider-ollama/src/ollama.ts` | Extend options, make `modelId` optional, model logging only |
| `provider-ollama/src/index.ts` | `model: string` → `model?: string` in `OllamaProviderOptions` |
| `provider-aws/src/bedrock.ts` | Extend options, make `modelId` optional, model logging only |
| `provider-aws/src/index.ts` | `model: string` → `model?: string` in `AWSProviderOptions` |
| `runner/src/domain-runner.ts` | `model: string` → `model?: string` in `DomainRunnerOptions` |
| `runner/src/cli/index.ts` | Remove hardcoded `gemini-2.0-flash-lite` default; update help text |
| `runner/test/integration/support/runner.ts` | Add `hasProviderCredentials`; remove home-dir dotfile reads |
| All runner integration test files | Use `hasProviderCredentials` skip guard; remove explicit `--api-key` flags |

## `loadProviderConfig` (engine)

```typescript
export interface ProviderFileConfig {
  modelId?: string;
  apiKey?: string;
}

export function loadProviderConfig<T extends ProviderFileConfig>(
  provider: string,      // e.g. "anthropic", "openai"
  configFile?: string,  // explicit path; defaults to ~/.commonkads/providers/<provider>.yml
): T
```

- Uses `node:os`, `node:fs`, and the `yaml` package (already a dep).
- Explicit path, file missing → `throw new Error('Config file not found: <path>')`.
- Default path, file missing → return `{} as T` silently.
- Parses YAML and casts to `T` — no runtime validation; unknown keys silently ignored.
- Default base dir: `process.env['COMMONKADS_CONFIG_DIR'] ?? join(homedir(), '.commonkads', 'providers')`.

## Data flow in each provider constructor

```
constructor(modelId?: string, options: XOptions = {})
  fileConfig = loadProviderConfig<XFileConfig>('x', options.configFile)

  // modelId — two-level, track source for logging
  if modelId set            → resolvedModel = modelId,            modelSource = "explicit-arg"
  elif fileConfig.modelId   → resolvedModel = fileConfig.modelId,  modelSource = "config-file"
  else throw Error('modelId is required: pass it or set modelId in ~/.commonkads/providers/x.yml')

  // apiKey — three-level, track source (skipped for Ollama and Bedrock)
  if options.apiKey          → resolvedApiKey = options.apiKey,       apiKeySource = "explicit-arg"
  elif process.env[VAR]      → resolvedApiKey = process.env[VAR],     apiKeySource = "env-var"
  elif fileConfig.apiKey     → resolvedApiKey = fileConfig.apiKey,     apiKeySource = "config-file"
  else                       → resolvedApiKey = undefined,             apiKeySource = "sdk-default"

  // info-level diagnostic logging (using existing module-level logger)
  logger.info(`config: model="${resolvedModel}" source=${modelSource}`)
  // apiKey-using providers only:
  if resolvedApiKey is set:
    logger.info(`config: apiKey=*** source=${apiKeySource}`)
  else:
    logger.info(`config: apiKey=<none> source=${apiKeySource}`)
```

## Provider-specific extensions (local, not exported)

| Provider | Extra fields | Env var(s) checked |
|---|---|---|
| anthropic | `authToken?` | `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` |
| openai | `baseURL?` | `OPENAI_API_KEY` |
| google | — | `GOOGLE_API_KEY`, `GEMINI_API_KEY` (either) |
| ollama | `baseUrl?`, `numCtx?` | — |
| aws/bedrock | `region?` | — |

## Runner: `hasProviderCredentials`

```typescript
export function hasProviderCredentials(provider: string, apiKeyEnvVar: string): boolean {
  if (process.env[apiKeyEnvVar]) return true;
  const configDir =
    process.env['COMMONKADS_CONFIG_DIR'] ?? join(homedir(), '.commonkads', 'providers');
  return existsSync(join(configDir, `${provider}.yml`));
}
```

Integration tests call this in their skip guard:
```typescript
const describeIntegration = hasProviderCredentials('google', 'GEMINI_API_KEY')
  ? describe
  : describe.skip;
```

## Non-obvious decisions

1. **Explicit env var check in providers**: each provider must check `process.env[ITS_ENV_VAR]` by name. Without it, a config file `apiKey` would be passed to the SDK and silently override an env var, since SDKs only read their env var when no key is passed.

2. **Generic cast, no validation**: `yaml.parse(text) as T` — typos in config are silently ignored rather than throwing. Acceptable for a user-facing defaults file.

3. **`BedrockTextInference.withGuardrailName`** keeps `modelId` as a required `string` — it's a named factory for a specific purpose.

4. **Semver**: making `modelId` optional is a breaking change — semver major on all five provider packages. Engine gains a new export — semver minor.

5. **Cross-repo ordering**: engine must be built and published (or npm-linked locally) before provider packages can import the new `loadProviderConfig` export.

6. **Pino writes to stderr**: the diagnostics logger routes pino output to `process.stderr` so structured JSON written to stdout by the CLI is not polluted by log lines.
