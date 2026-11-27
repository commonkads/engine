# Requirements — Catalog Layer

## In scope

1. Define `ICatalog` interface (`getTask(id): Promise<Task>`, `getModel(id): Promise<ModelContent>`) in `src/catalog/`
2. Define `ModelContent` interface (`{ content: string; version: string }`) in `src/catalog/`
3. Rename `IFileStore` → `IStorageBackend`; relocate from `src/core/interfaces/` to `src/catalog/`; update all usages
4. Relocate `IKnowledgeStore` from `src/core/interfaces/` to `src/catalog/`
5. Implement `LocalCatalog` in `src/catalog/` — reads `catalog.yml`, resolves model IDs to content via `IStorageBackend`, builds `Task` instances from domain manifests
6. Implement `CompositeCatalog` in `src/catalog/` — aggregates N `ICatalog` children, fans out `getTask`/`getModel`, throws at construction if any two children register the same model ID
7. `RuntimeContext` gains `catalog: ICatalog` field (optional — existing code not using the catalog does not need to wire one)
8. `RuntimeEngine` constructor drops `IKnowledgeStore`; fetches step knowledge via `context.catalog.getModel(ref)` for `step.knowledgeRefs`; `step.knowledgeSearches` returns empty content when catalog has no search capability
9. Adapt `LocalFileStore` to implement `IStorageBackend` (rename only — shape unchanged)
10. Unit tests: leaf catalog lookup, composite fanout, ID-collision detection at construction, cross-catalog model reference, sub-task lookup via `context.catalog.getTask`

## Out of scope

- Semantic search leaf catalog (vector store wiring) — tracked in #18
- S3Catalog implementation — tracked in #16
- GCSCatalog implementation — tracked in #17
- Domain manifest shape change (`*Path` → `*Ref` keys) — tracked in #19
- Task Chain integration — tracked in #12
