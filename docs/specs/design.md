# Design — @commonkads/engine

## 1. Component Overview

| Layer | Component | File |
|-------|-----------|------|
| Core types | `InferenceProvider`, `PsmTemplate`, `Task`, `StepDefinition`, `TaskState`, `ModelContent`, etc. | `src/core/*.ts` |
| Execution | `RuntimeEngine` | `src/core/engine.ts` |
| Execution | `RuntimeContext` | `src/core/context.ts` |
| Catalog | `ICatalog`, `IStorageBackend`, `IKnowledgeStore` | `src/catalog/i-*.ts` |
| Catalog | `LocalCatalog`, `CompositeCatalog` | `src/catalog/local-catalog.ts`, `src/catalog/composite-catalog.ts` |
| Catalog | `LocalFileStore` | `src/catalog/local-file-store.ts` |
| Catalog | `FileStoreKnowledgeAdapter` | `src/catalog/file-store-knowledge-adapter.ts` |
| Catalog | `DomainManifest`, `loadCatalog` | `src/catalog/domain-manifest.ts` |
| PSM templates | `BasePsm` | `src/knowledge/psm/base-psm.ts` |
| PSM templates | `AssessmentPsm`, `DiagnosisPsm`, `MonitoringPsm` | `src/knowledge/psm/` |
| PSM factory | `loadTaskFromManifest` | `src/knowledge/psm-factory.ts` |
| Registry | `registerProvider`, `buildInference` | `src/provider/factory.ts` |
| Utilities | `createDiagnosticsLogger` | `src/utils/diagnostics.ts` |
| Utilities | `StreamLogger`, `LevelFilterLogger` | `src/utils/logger.ts` |

## 2. Task Execution Loop

```
RuntimeEngine.execute(psm, input, context)
  │
  ├─ psm.initializeState(input) → TaskState
  │
  └─ loop: psm.getNextStep(state) → StepDefinition | null
       │
       ├─ fetch knowledgeRefs via context.catalog.getModel(ref)  ┐ parallel
       ├─ knowledgeSearches → empty stubs (semantic search, #18)  ┘
       │
       ├─ if deterministic
       │    └─ psm.updateState(state, step, knowledgeText)
       │
       └─ if LLM step
            ├─ psm.buildPrompt(step, state, knowledgeText, explain)
            ├─ InferenceProvider.infer(prompt, options)
            ├─ unwrapExplanation (if explain active)
            └─ psm.updateState(state, step, result)
  │
  └─ psm.mapOutput(state) → output
```

Errors from any step are wrapped in `TaskExecutionError(step, cause)`.

## 3. PSM Step Sequences

### Assessment
| Step | Mode | Hook |
|------|------|------|
| obtain | deterministic | `updateObtain` |
| specify | deterministic | `updateSpecify` |
| abstract | LLM | `updateAbstract` |
| evaluate | LLM | `updateEvaluate` |
| conclude | deterministic | `buildResult` |

### Diagnosis
| Step | Mode | Hook |
|------|------|------|
| observe | deterministic | `updateObserve` |
| hypothesise | deterministic | `updateHypothesise` |
| verify | LLM | `updateVerify` |
| conclude | deterministic | `buildResult` |

### Monitoring
| Step | Mode | Hook |
|------|------|------|
| observe | deterministic | `updateObserve` |
| compare | deterministic | `updateCompare` |
| evaluate | LLM | `updateEvaluate` |
| conclude | deterministic | `buildResult` |

## 4. Override-Hooks Pattern

```ts
// Domain subclass only overrides the hook(s) it needs:
class VitalSignsAssessmentPsm extends AssessmentPsm {
  protected override updateSpecify(output: string, state: TaskState): void {
    // deterministic norm selection — no LLM needed
    state.norms = filterNorms(output, state.input);
  }
}
```

The base hook implementations in `AssessmentPsm`, `DiagnosisPsm`, and `MonitoringPsm` cover the common case. `BasePsm` itself only owns step sequencing (the counter in `TaskState`).

## 5. Provider Registry

```ts
// At startup — third-party package
import { registerProvider } from '@commonkads/engine';
registerProvider('claude', (opts) => new ClaudeTextInference(opts.model, { apiKey: opts.apiKey }));

// At runtime
const inference = buildInference({ type: 'claude', model: 'claude-sonnet-5-5', apiKey: '...' });
```

The registry is a `Map<string, ProviderBuilder>`. All entries come from caller code at startup; the engine never hard-codes any provider.

## 6. Catalog Layer

- **`ICatalog` is the engine's single point of contact for knowledge model retrieval.** `RuntimeEngine` calls `context.catalog.getModel(ref)` for each `knowledgeRef`. The engine holds no storage reference. `RuntimeContext.catalog` is optional; a step that declares refs with no catalog wired fails at execution.
- **`LocalCatalog` reads `catalog.yml` through `IStorageBackend`.** `LocalCatalog.load(backend)` parses the manifest and exposes `taskIds`. `getTask(id)` builds a `Task` from the domain's `domain.yml`. `getModel(id)` treats `id` as a file path in the backend. This is a compatibility shim that stays until the manifest shape changes (#19).
- **`CompositeCatalog` fans out across child catalogs.** It validates task ID uniqueness at construction, so a collision fails at startup rather than at lookup. Fan-out catches only `CatalogError` and rethrows anything else immediately, so a real I/O or parse failure is not masked as "not found".
- **`IStorageBackend` replaces `IFileStore`.** The shape is unchanged; the rename reflects that storage is a catalog concern, not a provider concern.
- **Placement rule.** `src/catalog/` is the home for all storage backend implementations (`LocalFileStore`, future `S3Catalog` and `GCSCatalog`). `src/provider/` is for inference providers only.
