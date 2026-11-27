# Requirements — @commonkads/engine

## Overview

The engine is a runtime for executing knowledge-intensive tasks by composing reusable CommonKADS problem-solving method (PSM) templates with domain knowledge retrieved at runtime. Domain knowledge lives entirely outside the code (in YAML/Markdown files), is retrieved per step, and is handed to an `InferenceProvider` or evaluated deterministically to produce an auditable result.

## REQ-1 — Core Interfaces

The engine exposes four seams that isolate it from every infrastructure choice:

| Interface | Responsibility |
|-----------|----------------|
| `InferenceProvider` | LLM completion — `infer(prompt, options?): Promise<string>` |
| `ICatalog` | Knowledge model and task retrieval — `getTask`, `getModel` |
| `IStorageBackend` | File-based storage primitive — `read`, `readWithVersion`, `list` |
| `IKnowledgeStore` | Reference and semantic knowledge retrieval — `get`, `search` |
| `PsmTemplate` | PSM template contract — `initializeState`, `getNextStep`, `buildPrompt`, `updateState`, `mapOutput` |

Any implementation of each interface can be substituted without touching engine or PSM code.

## REQ-1a — Catalog Layer

The engine resolves knowledge models through an `ICatalog` interface. `RuntimeContext.catalog?: ICatalog` is optional for backward compatibility; the engine throws at step execution if `knowledgeRefs` are present and no catalog is wired. The catalog layer lives in `src/catalog/`.

## REQ-1b — Composite and Local Catalog

`LocalCatalog.load(backend: IStorageBackend)` reads a `catalog.yml` manifest and exposes `taskIds`. `CompositeCatalog` fans out across multiple `LocalCatalog` instances, validates task ID uniqueness at construction, and rethrows non-`CatalogError` failures immediately. `LocalCatalog.getModel(id)` treats `id` as a file path (compatibility shim until #19).

## REQ-2 — Task Execution Loop

`RuntimeEngine.execute(psm, input, context)` drives every domain through the same loop:

1. `psm.initializeState(input)` → initial `TaskState`
2. While `psm.getNextStep(state)` returns a `StepDefinition`:
   - Fetch `knowledgeRefs` via `context.catalog.getModel(ref)`, in parallel. `knowledgeSearches` returns empty stubs until semantic search is wired (#18).
   - If `deterministic`: pass knowledge text to `psm.updateState` directly
   - Otherwise: call `psm.buildPrompt`, send to `InferenceProvider.infer`, unwrap explain wrapper if active, then call `psm.updateState`
3. `psm.mapOutput(state)` → final result

A thrown error from any step is wrapped in `TaskExecutionError` naming the failing step.

## REQ-3 — Assessment PSM Template

Implements the CommonKADS assessment inference sequence:

```
obtain(case data)      ← deterministic: bind case data from input
specify(norms)         ← deterministic: select applicable norms
abstract(derived)      ← LLM: compute derived values from abstraction knowledge
evaluate(norm checks)  ← LLM: evaluate each norm; return NormAssessment[]
conclude(result)       ← deterministic: derive AssessmentResult from norm assessments
```

Each step delegates output processing to an independently overridable hook (`updateObtain`, `updateSpecify`, `updateAbstract`, `updateEvaluate`, `buildResult`). Domain subclasses override only the hook(s) they need.

## REQ-4 — Diagnosis PSM Template

```
observe(observations)  ← deterministic: bind observations from input
hypothesise(hyps)      ← deterministic: generate hypotheses from norms file
verify(hyps)           ← LLM: verify each hypothesis; return Hypothesis[]
conclude(result)       ← deterministic: derive DiagnosisResult from hypotheses
```

Hooks: `updateObserve`, `updateHypothesise`, `updateVerify`, `buildResult`.

## REQ-5 — Monitoring PSM Template

```
observe(observations)  ← deterministic: bind observations from input
compare(norms)         ← deterministic: load norms
evaluate(deviations)   ← LLM: compare observed vs. expected; return Deviation[]
conclude(result)       ← deterministic: derive MonitoringResult from deviations
```

Hooks: `updateObserve`, `updateCompare`, `updateEvaluate`, `buildResult`.

## REQ-6 — Override-Hooks Pattern

`BasePsm` implements step sequencing only. Each template declares a fixed `stepNames` list and `BasePsm` walks it via a counter in `TaskState`. Every step's output-processing is a `protected` synchronous hook with a default implementation. Subclasses override only the hook(s) they need; all other steps run with defaults. **Hooks are synchronous and have no access to `InferenceProvider`** — PSMs hold no inference reference.

## REQ-7 — Local File Store

`LocalFileStore` (`src/catalog/local-file-store.ts`) implements `IStorageBackend` and reads knowledge files from the local filesystem relative to a configured root directory. `readWithVersion` returns a 12-character SHA-256 hash of the content as the version identifier. `list(prefix?)` returns all matching paths sorted lexicographically. Throws `FileNotFoundError` for missing files.

## REQ-8 — Logging

Two distinct logging facilities:

- **Execution logger** — `ILogger`/`StreamLogger`/`LevelFilterLogger` wired via `RuntimeContext.logger`. Logs PSM step execution. Level-filtered; can be disabled entirely.
- **Diagnostics logger** — `createDiagnosticsLogger(namespace)` for general application code (providers, CLI, wiring). Backend resolved from `STRATA_LOG_PROVIDER` env var (`pino` default, `debug` alternative); level via `STRATA_LOG_LEVEL`.

Both expose the same `ILogger` shape (`log`, `debug`, `info`, `warn`, `error`).

## REQ-9 — Explain Feature

When `RuntimeContext.explain` is `true`, the engine injects `_explain: true` into `TaskState`. `buildPrompt` requests `{"result": ..., "_explanation": "..."}` wrappers from the LLM. The engine unwraps these itself and stores explanations on `context.explanations[stepName]`. PSM code only ever sees the unwrapped `result`.

## REQ-10 — Audit Log and Step Timings

When `RuntimeContext.enableAuditLog` is `true`, the engine appends an `AuditLogEntry` per step (step name, deterministic flag, `KnowledgeRef[]` with id + version). When `enableTimings` is `true`, it appends a `StepTiming` entry (step name, `startedAt`, `durationMs`).

## REQ-11 — Provider Registry

`registerProvider(type, builder)` registers a custom `InferenceProvider` builder keyed by type string. `buildInference({type, ...options})` looks up the registered builder and constructs the provider. The registry starts empty; callers must register providers at startup. Built-in types can be overridden.

## Out of Scope

- Cloud provider implementations (see `@commonkads/provider-aws`, `@commonkads/provider-anthropic`, `@commonkads/provider-google`, `@commonkads/provider-openai`, `@commonkads/provider-ollama`)
- Cloud catalog implementations — S3Catalog (#16), GCSCatalog (#17)
- Semantic search and vector store wiring (#18)
- Domain manifest shape change, `knowledgeRefs` by logical ID (#19)
- CLI tooling
- CDK / cloud infrastructure
- OWL/RDF formal reasoning or SPARQL
- Knowledge self-validation
