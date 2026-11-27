# Change Log — Catalog Layer

Released as **0.4.0** (breaking). See [`CHANGELOG.md`](../../../../CHANGELOG.md).

## New files

### `src/catalog/`

| File | Purpose |
|---|---|
| `i-catalog.ts` | `ICatalog` interface; `ModelContent` type |
| `i-storage-backend.ts` | `IStorageBackend` (renamed from `IFileStore`, same shape) |
| `i-knowledge-store.ts` | `IKnowledgeStore` (moved from `src/core/interfaces/`) |
| `catalog-error.ts` | `CatalogError` base error class |
| `domain-manifest.ts` | Manifest types and parsing, merged from `src/knowledge/manifest.ts` and `src/knowledge/catalog.ts` |
| `local-catalog.ts` | `LocalCatalog implements ICatalog` |
| `composite-catalog.ts` | `CompositeCatalog implements ICatalog` |
| `local-file-store.ts` | `LocalFileStore implements IStorageBackend` (moved from `src/provider/local/`) |
| `file-store-knowledge-adapter.ts` | `FileStoreKnowledgeAdapter`, adapts `IStorageBackend` to `IKnowledgeStore` (moved from `src/provider/`) |
| `index.ts` | Barrel for the catalog layer |
| `local-catalog.test.ts` | 8 tests |
| `composite-catalog.test.ts` | 9 tests |
| `domain-manifest.test.ts` | Moved from `src/knowledge/manifest.test.ts` |
| `local-file-store.test.ts` | Moved from `src/provider/local/local-file-store.test.ts` |
| `file-store-knowledge-adapter.test.ts` | Moved from `src/provider/file-store-knowledge-adapter.test.ts` |

### `src/knowledge/`

| File | Purpose |
|---|---|
| `psm-factory.ts` | `createPsmInstance`, `loadTaskFromManifest`; extracted from `src/knowledge/catalog.ts` |

## Deleted files

| File | Replacement |
|---|---|
| `src/core/interfaces/i-file-store.ts` | `src/catalog/i-storage-backend.ts` |
| `src/core/interfaces/i-knowledge-store.ts` | `src/catalog/i-knowledge-store.ts` |
| `src/core/interfaces/i-inference-provider.ts` | `src/core/inference-provider.ts` |
| `src/core/interfaces/i-psm-template.ts` | `src/core/psm-template.ts` |
| `src/core/interfaces/index.ts` | Subdirectory eliminated |
| `src/core/types/` (8 files) | Flattened into `src/core/` |
| `src/knowledge/manifest.ts` | `src/catalog/domain-manifest.ts` |
| `src/knowledge/catalog.ts` | Split: `src/catalog/domain-manifest.ts` and `src/knowledge/psm-factory.ts` |
| `src/knowledge/catalog.test.ts` | Behavior covered by `src/catalog/local-catalog.test.ts` |
| `src/knowledge/manifest.test.ts` | Moved to `src/catalog/domain-manifest.test.ts` |
| `src/provider/local/` | `LocalFileStore` moved to `src/catalog/` |
| `src/provider/file-store-knowledge-adapter.ts` | Moved to `src/catalog/` |
| `src/utils/provider-config.ts` | Moved to `src/provider/provider-config.ts` |

## Renamed types

| Before | After | Location |
|---|---|---|
| `IInferenceProvider` | `InferenceProvider` | `src/core/inference-provider.ts` |
| `IPsmTemplate` | `PsmTemplate` | `src/core/psm-template.ts` |
| `IFileStore` | `IStorageBackend` | `src/catalog/i-storage-backend.ts` |

## Modified files

| File | Reason |
|---|---|
| `src/core/engine.ts` | Constructor drops `IKnowledgeStore`; knowledge fetched via `context.catalog.getModel(ref)`; `knowledgeSearches` returns empty stubs |
| `src/core/context.ts` | Adds `catalog?: ICatalog` |
| `src/core/index.ts` | Barrel updated for flattened `src/core/` |
| `src/core/task.ts` | `psm: PsmTemplate` (was `IPsmTemplate`) |
| `src/core/errors.ts` | Doc comments updated from `IFileStore` to `IStorageBackend` |
| `src/knowledge/psm/base-psm.ts` | `implements PsmTemplate` (was `IPsmTemplate`) |
| `src/knowledge/index.ts` | Exports only `src/knowledge/psm/` |
| `src/knowledge/psm/__fixtures__/vital-signs/wiring.ts` | Imports `LocalFileStore` from `src/catalog/` |
| `src/provider/index.ts` | Drops `LocalFileStore` and `FileStoreKnowledgeAdapter` exports; adds `provider-config` |
| `src/provider/factory.ts` | `InferenceProvider` (was `IInferenceProvider`) |
| `src/provider/provider-config.ts` | Moved here from `src/utils/` (inference-provider concern) |
| `src/utils/index.ts` | No longer exports `provider-config` |
| `src/index.ts` | Exports `src/catalog/` |
| `src/core/engine.test.ts` | `FakeKnowledgeStore` replaced with `FakeCatalog` on context |
| `src/knowledge/psm/causal-covering-psm.test.ts` | `IStorageBackend` and catalog-on-context pattern |
| `src/knowledge/psm/data-driven-monitoring-psm.test.ts` | `IStorageBackend` and catalog-on-context pattern |
| `src/knowledge/psm/vital-signs-assessment-psm.test.ts` | `IStorageBackend` and catalog-on-context pattern |

## Deviations from the agreed design

- **Manifest code was split and moved differently than designed.** The design kept `src/knowledge/catalog.ts` and made its helpers internal. Instead, manifest types and parsing moved into `src/catalog/domain-manifest.ts`, and PSM wiring moved into `src/knowledge/psm-factory.ts`. This removes the `src/catalog/` → `src/knowledge/` parsing dependency, so `src/knowledge/` holds only PSM code.
- **`src/knowledge/catalog.test.ts` was deleted, not updated.** Its behavior is covered by `local-catalog.test.ts`.
- **`LocalFileStore` and `FileStoreKnowledgeAdapter` moved to `src/catalog/`.** The design left them in `src/provider/`. Both bridge catalog-layer interfaces, so they belong with those interfaces.
- **`provider-config` moved to `src/provider/`.** The design did not list this move. It reads inference-provider API keys and model IDs, so it is not a general utility.
- **`src/core/types/` and `src/core/interfaces/` were flattened into `src/core/`.** The design did not cover this. The subdirectories added path noise. The `I` prefixes were also dropped, since TypeScript structural typing makes them redundant.
- **`CompositeCatalog` fan-out catches only `CatalogError`.** Other failures rethrow immediately. This followed an advisory review fix and adds a propagation test.
- **`engine.ts` import repointed early.** `IKnowledgeStore` was repointed to `src/catalog/i-knowledge-store.ts` before the constructor parameter was removed, to keep each task boundary compiling.
- **Three PSM test files were updated outside the original list.** `causal-covering-psm.test.ts`, `data-driven-monitoring-psm.test.ts`, and `vital-signs-assessment-psm.test.ts` constructed `RuntimeEngine` with a store and imported `IFileStore`.
- **`fetchKnowledge` uses a narrowed local variable** instead of `context.catalog!`, to satisfy the lint rules.
- **`npm run typecheck` does not exist.** `npm run compile` (`tsc --build` plus `tsc --noEmit -p tsconfig.test.json`) is the type-check gate.

## GitHub issues filed for out-of-scope work

- #16 — S3Catalog implementation
- #17 — GCSCatalog implementation
- #18 — Semantic search and vector store wiring (`knowledgeSearches` returns empty stubs until then)
- #19 — Domain manifest shape change (`knowledgeRefs` by logical ID; removes the `getModel` file-path shim)
