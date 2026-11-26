# Brainstorm: Configuration Files

## Direction explored

Three options for where shared config loading lives:

- **Option A — Add to `engine`**: `yaml` already a dep, all providers depend on engine, `utils/` is established home for shared utilities. No new packages.
- **Option B — Duplicate per provider**: No cross-repo coordination, but copies identical logic across five packages.
- **Option C — New `@commonkads/config` package**: Clean separation, but adds a sixth repo and versioning cycle for ~30 lines.

**Chosen: Option A.** Right trade-off at this scale.

## Other decisions settled here

- Generic `loadProviderConfig<T extends ProviderFileConfig>()` so providers can extend with their own fields (`authToken`, `baseURL`, `region`, etc.) without engine knowing about them.
- `modelId` becomes optional in all provider constructors; config file supplies the default. Breaking change (semver major on providers).
- Bedrock uses IAM creds — no apiKey needed; config file `apiKey` is silently ignored.
- Ollama has no apiKey — no apiKey resolution or logging.
