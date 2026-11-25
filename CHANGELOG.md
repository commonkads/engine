# Changelog

All notable changes to this project are documented in this file.

## Versions

- [3.1.0 — 2026-11-25](#310--2026-11-25)
- [3.0.0](#300--2026-11-17)
- [1.1.0](#110--2026-11-17)
- [1.0.0](#100)

## 3.1.0 — 2026-11-25

- `OllamaTextInference` and `OllamaProviderOptions` moved to the new `@commonkads/provider-ollama` package — install and call `registerOllamaProviders()` at startup to continue using Ollama

[Full change log →](docs/specs/features/extract-ollama-provider/07-changes.md)

## 3.0.0 — 2026-11-17

- **Breaking:** `IInference` renamed to `IInferenceProvider` — update imports and type annotations in any code that implements or consumes the LLM provider interface
- No change to the `infer` method signature or runtime behaviour; the rename is type-level only

[Full change log →](docs/specs/features/rename-iinference-provider/07-changes.md)

## 1.1.0 — 2026-11-17

- `ITextInference` renamed to `IInference` — a cleaner name for the LLM completion boundary
- `StepDefinition` gains `inferenceId?: string` — steps can now select a named inference provider
- `RuntimeEngine` constructor now accepts `IInference | Record<string, IInference>` — route different steps to different models

## 1.0.0

[Initial engine](specs/initial-engine/requirements.md) changes:

- **Core runtime** - `RuntimeEngine`, running the Task Execution Loop against
  pluggable `IFileStore`, `IKnowledgeStore`, and `ITextInference` providers.
  `RuntimeContext` carries engine logging, explain mode, the audit log, and
  per-step timings.
- **CommonKADS PSM templates** - `AssessmentPsm`
  (`obtain → specify → abstract → evaluate → conclude`), `DiagnosisPsm`
  (`observe → hypothesise → verify → conclude`), and `MonitoringPsm`
  (`observe → compare → evaluate → conclude`). Each is reusable across
  domains by swapping knowledge file paths only - no PSM code changes.
- **Storage providers** - `LocalFileStore` and `S3FileStore` implementing
  `IFileStore`; `BedrockKnowledgeStore` implementing `IKnowledgeStore` for
  semantic retrieval against a Bedrock Knowledge Base.
- **Inference providers** - `BedrockTextInference`, `ClaudeTextInference`
  (Anthropic Messages API, adaptive thinking on by default), and
  `GeminiTextInference` (Google Gemini API, automatic thinking budget by
  default) - all implementing `ITextInference` and interchangeable without
  any engine or PSM code change.
- **Vital signs assessment example** - an illustrative knowledge base
  (shared ontology plus norms/abstraction/selection/evaluation documents)
  under `knowledge/`, wired up via `VitalSignsAssessmentPsm` and
  `createVitalSignsAssessment()`.
- **Explain mode** - per-step `{result, _explanation}` JSON wrapper
  requested from the LLM on non-deterministic steps, unwrapped by the
  engine into `context.explanations`.
- **Audit log and step timings** - `context.auditLog` records which
  knowledge document (and version) was used per step; `context.timings`
  records per-step duration.
- **Two separate logging facilities**:
  - The engine execution logger (`StreamLogger`/`LevelFilterLogger`),
    wired through `RuntimeContext.logger`, logging PSM step names and
    explanations.
  - `createDiagnosticsLogger()`, a general-purpose logger for application
    code (CLI, providers, wiring), backed by `debug` or `pino` depending on
    `STRATA_LOG_PROVIDER` (default `pino`) - call sites depend only on the
    shared `ILogger` contract, so the backing library can change without
    touching any call site.
- **Multi-provider CLI** (`strata-engine` bin, built from `src/cli/`) -
  runs the vital signs assessment against a live LLM, selectable via
  `--provider bedrock|claude|gemini`, with `--guardrail`/`--region`
  (Bedrock), `--api-key`/`--no-thinking` (Claude/Gemini), `--log-level`,
  `--explain`, `--audit`, and `--timings`.
- **`bin/vital-signs-assessment.sh`** - a convenience wrapper that supplies
  a default synthetic payload and forwards any additional arguments to the
  compiled CLI, so it can be smoke-tested without hand-writing JSON.
- **`src/` organised around directory barrels** - every multi-file
  directory under `src/` has an `index.ts` re-exporting its siblings, and
  cross-directory imports go through the target directory's barrel.
- **Tests** - 46 unit tests (engine, all three PSM templates, the local
  file store, LLM-output parsing helpers, the diagnostics logger, and the
  full vital-signs scenario matrix), all without network calls; a separate
  live-Bedrock integration suite that self-skips without credentials.
- **Docs** - `README.md` (purpose and architecture), `docs/developer-guide.md`
  (setup, build, test, and CLI usage), and `specs/initial-engine/`
  (requirements, design, and task breakdown).
