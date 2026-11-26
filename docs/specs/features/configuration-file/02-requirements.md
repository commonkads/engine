# Requirements: Configuration Files

## In scope

- Add `ProviderFileConfig { modelId?, apiKey? }` and `loadProviderConfig<T extends ProviderFileConfig>(provider, configFile?): T` to `engine/src/utils/`, exported from the engine package.
- Default config path: `~/.commonkads/providers/<provider>.yml`; `configFile` option overrides it.
- `COMMONKADS_CONFIG_DIR` env var overrides the base directory for the default path (`$COMMONKADS_CONFIG_DIR/<provider>.yml`).
- If the **default** path doesn't exist, return `{}` silently — no error.
- If an **explicit** `configFile` is given and the file is not found, throw a descriptive error.
- Each provider's options interface gains a `configFile?: string` field.
- `modelId` becomes optional in all provider constructors; throws at construction time if neither the explicit arg nor `fileConfig.modelId` resolves to a value.
- Priority (highest to lowest): explicit constructor arg → env var → config file value.
- Each provider may declare a local extension of `ProviderFileConfig` for its own extra fields (e.g. `region` for AWS, `authToken` for Anthropic, `baseURL` for OpenAI, `baseUrl`/`numCtx` for Ollama).
- Diagnostic logging at **info** level in each provider constructor: source of `modelId` and (where applicable) `apiKey`; apiKey value always masked as `***`; `<none>` when apiKey is unset.
- Diagnostic logs write to **stderr** so they do not pollute structured stdout output from CLI consumers.
- Bedrock reads and silently ignores `apiKey`; no apiKey logging.
- Ollama has no apiKey; no apiKey resolution or logging.
- Runner integration tests skip only when **neither** the provider's API key env var nor its default config file is present; they no longer read raw API keys from home-directory dotfiles.
- Runner test support exposes `hasProviderCredentials(provider, apiKeyEnvVar): boolean` for integration test skip guards.

## Out of scope

- JSON config format (YAML only).
- Config validation or schema checking beyond TypeScript types.
- Watching the config file for changes at runtime.
- Global (non-provider-specific) config file.
- Merging multiple config files.
