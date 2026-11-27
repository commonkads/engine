# Changelog

All notable changes to this project are documented in this file.

## Versions

- [0.4.0 — 2026-11-27](#040--2026-11-27)
- [0.3.0 — 2026-11-26](#030--2026-11-26)
- [0.2.0 — 2026-11-26](#020--2026-11-26)
- [0.1.0 — 2026-11-26](#010--2026-11-26)

---

## [0.4.0] — 2026-11-27

- **Breaking:** `IInferenceProvider` renamed to `InferenceProvider` — update imports and type annotations
- **Breaking:** `IPsmTemplate` renamed to `PsmTemplate` — update imports and type annotations
- **Breaking:** `IFileStore` renamed to `IStorageBackend` and moved from `src/core/interfaces/` to `src/catalog/` — update imports
- **Breaking:** `IKnowledgeStore` moved from `src/core/interfaces/` to `src/catalog/` — update imports
- **Breaking:** `RuntimeEngine` constructor no longer accepts `IKnowledgeStore` — wire a catalog via `RuntimeContext.catalog` instead
- New `ICatalog` interface: wire a `LocalCatalog` or `CompositeCatalog` to `RuntimeContext.catalog` to supply knowledge models to the engine
- New `LocalCatalog` reads a `catalog.yml` manifest from any `IStorageBackend` and resolves tasks and knowledge models by ID
- New `CompositeCatalog` fans out across multiple `LocalCatalog` instances with duplicate-task-ID detection
- `LocalFileStore` moved to `src/catalog/`; import path changed from `src/provider/local/` to `src/catalog/`
- `FileStoreKnowledgeAdapter` moved to `src/catalog/`
- `loadProviderConfig`/`ProviderFileConfig` moved from `src/utils/` to `src/provider/`

[Full change log →](docs/specs/features/catalog-layer/07-changes.md)

## [0.3.0] — 2026-11-26

- Added living system docs at `docs/specs/requirements.md` and `docs/specs/design.md`; removed stale `specs/` directory carried over from the strata-engine era

[Full change log →](docs/specs/features/cleanup-legacy-specs/07-changes.md)

## [0.2.0] — 2026-11-26

- `OllamaTextInference` and `OllamaProviderOptions` moved to the new `@commonkads/provider-ollama` package — install and call `registerOllamaProviders()` at startup to continue using Ollama

[Full change log →](docs/specs/features/extract-ollama-provider/07-changes.md)

## [0.1.0] — 2026-11-26

- **Core runtime** — `RuntimeEngine` running the Task Execution Loop against pluggable `IStorageBackend`, `IKnowledgeStore`, and `InferenceProvider` interfaces. `RuntimeContext` carries engine logging, explain mode, the audit log, and per-step timings.
- **CommonKADS PSM templates** — `AssessmentPsm` (`obtain → specify → abstract → evaluate → conclude`), `DiagnosisPsm` (`observe → hypothesise → verify → conclude`), and `MonitoringPsm` (`observe → compare → evaluate → conclude`). Each is reusable across domains by swapping knowledge file paths only — no PSM code changes.
- **Storage providers** — `LocalFileStore` implementing `IStorageBackend`; `BedrockKnowledgeStore` implementing `IKnowledgeStore` for semantic retrieval against a Bedrock Knowledge Base.
- **Inference providers** — `BedrockTextInference`, `ClaudeTextInference` (Anthropic Messages API), and `GeminiTextInference` (Google Gemini API) — all implementing `InferenceProvider` and interchangeable without any engine or PSM code change.
- **Provider registry** — `registerProvider(type, builder)` and `buildInference({type, ...options})`; third-party packages extend the registry without forking the engine.
- **`StepDefinition.inferenceId`** — steps can select a named inference provider; `RuntimeEngine` accepts `InferenceProvider | Record<string, InferenceProvider>`.
- **Vital signs assessment example** — an illustrative knowledge base (ontology, norms, abstraction, selection, evaluation) wired up via `VitalSignsAssessmentPsm` and `createVitalSignsAssessment()`.
- **Explain mode** — per-step `{result, _explanation}` JSON wrapper requested from the LLM on non-deterministic steps, unwrapped by the engine into `context.explanations`.
- **Audit log and step timings** — `context.auditLog` records which knowledge document and version was used per step; `context.timings` records per-step duration.
- **Two logging facilities** — `ILogger`/`StreamLogger`/`LevelFilterLogger` for PSM step execution (via `RuntimeContext.logger`); `createDiagnosticsLogger(namespace)` for general application code, backed by `pino` or `debug`.
- **Tests** — 46 unit tests covering the engine, all three PSM templates, the local file store, LLM-output parsing helpers, the diagnostics logger, and the full vital-signs scenario matrix, all without network calls.
