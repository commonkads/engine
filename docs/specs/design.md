# Design — @commonkads/engine

## 1. Component Overview

| Layer | Component | File |
|-------|-----------|------|
| Core interfaces | `IInferenceProvider` | `src/core/interfaces/i-inference-provider.ts` |
| Core interfaces | `IFileStore` | `src/core/interfaces/i-file-store.ts` |
| Core interfaces | `IKnowledgeStore` | `src/core/interfaces/i-knowledge-store.ts` |
| Core interfaces | `IPsmTemplate` | `src/core/interfaces/i-psm-template.ts` |
| Execution | `RuntimeEngine` | `src/core/engine.ts` |
| Execution | `RuntimeContext` | `src/core/context.ts` |
| PSM templates | `BasePsm` | `src/knowledge/psm/base-psm.ts` |
| PSM templates | `AssessmentPsm` | `src/knowledge/psm/assessment-psm.ts` |
| PSM templates | `DiagnosisPsm` | `src/knowledge/psm/diagnosis-psm.ts` |
| PSM templates | `MonitoringPsm` | `src/knowledge/psm/monitoring-psm.ts` |
| Providers (built-in) | `LocalFileStore` | `src/provider/local/` |
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
       ├─ fetch knowledgeRefs via IFileStore.readWithVersion  ┐ parallel
       ├─ fetch knowledgeSearches via IKnowledgeStore.search  ┘
       │
       ├─ if deterministic
       │    └─ psm.updateState(state, step, knowledgeText)
       │
       └─ if LLM step
            ├─ psm.buildPrompt(step, state, knowledgeText, explain)
            ├─ IInferenceProvider.infer(prompt, options)
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
