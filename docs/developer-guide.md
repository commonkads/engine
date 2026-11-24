# Developer Guide

Setup, build, test, and usage for working on `strata-engine`. For what
this repo is and why it's structured this way, see the [README](../README.md).
For the original requirements and design, see `specs/initial-engine/`.

## Prerequisites

- Node.js (see `@types/node` in `package.json` for the targeted major version)

Cloud providers (AWS Bedrock, Anthropic Claude, Google Gemini) are now in separate packages
(`@robproper/strata-aws`, `@robproper/strata-anthropic`, `@robproper/strata-google`). To run
integration tests or use the CLI, see the `cli/` package in the monorepo root.

## Install

```sh
# From monorepo root (links all workspace packages together):
npm install
```

## Build

```sh
npm run compile      # tsc --build, then typecheck src/ with tsconfig.test.json (no emit)
npm run build        # lint --fix, then compile
```

Compiled output goes to `dist/`. `npm run watch` recompiles on change.

## Lint / format

```sh
npm run lint          # eslint (also runs `format` afterward via postlint)
npm run lint:fix       # eslint --fix
npm run format         # prettier --write (src, test)
```

## Tests

```sh
npm test              # unit tests, no network calls (local dev)
npm run test:ci       # unit tests + JUnit XML reporter (for CI)
```

The engine unit tests have no cloud-provider dependencies — all inference in tests is provided
by fake `IInferenceProvider` implementations. Integration tests (live-model) live in
`@robproper/strata-cli` (`cli/test/integration/`), not here.

## Packaging

```sh
npm run repackage   # audit, compile, test, then npm pack into dist/
```

`files` in `package.json` includes only `dist/` — example domains live in
the separate `@robproper/strata-examples` workspace package at `examples/`
in the monorepo root and are not shipped with the engine.

## CLI

The CLI runner moved to `@robproper/strata-cli` (`cli/` in the monorepo root). It exposes a
`strata` binary (built from `cli/src/index.ts`) that runs a PSM-driven knowledge task against
a live LLM. See `cli/` for usage.

`examples/bin/run-example.sh` at the monorepo root wraps the CLI with a default payload for one of the
three bundled example domains:

```sh
# Install and build first:
npm install
cd cli && npm run compile && cd ..

# Then from the monorepo root:
examples/bin/run-example.sh --model <model-id>
examples/bin/run-example.sh --domain car-diagnosis --provider claude --model claude-opus-4-8
examples/bin/run-example.sh --domain server-monitoring --provider gemini --model gemini-flash-latest
```

## Project structure

```text
src/
├── core/        # RuntimeEngine, RuntimeContext, interfaces, shared types/errors
├── psms/        # CommonKADS PSM templates (Assessment, Diagnosis, Monitoring)
├── provider/    # IInferenceProvider implementation (Ollama only; cloud providers in separate packages)
│   ├── ollama/      # OllamaTextInference
│   └── factory.ts   # registerProvider, buildInference (open registry)
├── knowledge/psm/__fixtures__/vital-signs/  # PSM subclass + wiring example (test fixtures)
├── utils/       # Logging, LLM output parsing helpers

../aws/          # @robproper/strata-aws  — Bedrock + S3 providers
../anthropic/    # @robproper/strata-anthropic — Claude provider
../google/       # @robproper/strata-google   — Gemini provider
../cli/          # @robproper/strata-cli      — CLI runner + integration tests
../examples/     # @robproper/strata-examples — example domains
specs/           # Original requirements, design, and task breakdown
```

## Adding a new domain

A no-code domain (no deterministic selection or custom verdict logic) only
needs knowledge files and a `domain.yml` — no TypeScript required. Use the
`strata` CLI from `@robproper/strata-cli` to run it directly.

A domain that needs deterministic per-step logic (e.g. filtering norms based
on case data) requires a PSM subclass:

1. Author knowledge files in any directory (e.g. `../examples/my-domain/` in the monorepo's examples package, or a separate repository).
2. Add a `domain.yml` manifest to that directory.
3. Subclass the relevant PSM template (see
   `src/knowledge/psm/__fixtures__/vital-signs/vital-signs-assessment-psm.ts` for the pattern)
   to override the hook(s) you need (`updateSpecify`, `buildResult`, etc.).
4. Add a small wiring module that constructs the PSM + file store (see
   `src/knowledge/psm/__fixtures__/vital-signs/wiring.ts`).
5. Write unit tests with a fake `IInferenceProvider` that deterministically
   evaluates whatever the PSM actually selects, so the suite runs without a
   live LLM (see `src/knowledge/psm/__fixtures__/vital-signs/`).

Required `knowledge` keys per PSM type:

| PSM          | Required keys                                                     |
| ------------ | ----------------------------------------------------------------- |
| `assessment` | `ontologyPath`, `normsPath`, `abstractionPath`, `evaluationPath`  |
| `diagnosis`  | `ontologyPath`, `normsPath`, `abstractionPath`, `faultModelPath`  |
| `monitoring` | `ontologyPath`, `normsPath`, `abstractionPath`, `tolerancePath`   |

Extra keys are passed through — the vital-signs example adds `selectionPath`
for documentation purposes even though the base `AssessmentPsm` doesn't read it.
