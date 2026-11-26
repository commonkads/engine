# Changes: Extract Ollama Provider

## Deleted files

- `src/provider/ollama/ollama.ts`
- `src/provider/ollama/ollama.test.ts`

## Modified files

- `src/provider/index.ts` — removed `export * from './ollama/ollama.js'`
- `src/provider/factory.ts` — removed `OllamaTextInference` import, `OllamaProviderOptions` interface, and built-in `'ollama'` registry entry; registry now starts empty
- `CLAUDE.md` — updated providers/domains section to reference `@commonkads/provider-ollama` instead of local path

## Deviations from design

None.
