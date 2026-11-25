# Requirements: Extract Ollama Provider

## In scope
- Remove `src/provider/ollama/` (source and test)
- Remove built-in `'ollama'` registry entry and `OllamaProviderOptions` from `src/provider/factory.ts`
- Remove ollama re-export from `src/provider/index.ts`
- Update `CLAUDE.md` to reference `@commonkads/provider-ollama`

## Out of scope
- Changes to any other providers
- Updating downstream consumers
