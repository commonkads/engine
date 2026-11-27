# Brainstorm — Catalog Layer

## Angles explored

**A: Module location for `ICatalog`**
New `src/catalog/` top-level directory (chosen) vs nesting under `src/knowledge/`. First-class directory matches the issue's intent and keeps the catalog layer's public surface separate from the PSM/manifest layer.

**B: Engine knowledge-fetch after losing `IKnowledgeStore`**
Engine reads knowledge via `context.catalog.getModel(id)` using existing `knowledgeRefs` strings as model IDs. `knowledgeSearches` returns empty results when the catalog has no search capability — matching current `FileStoreKnowledgeAdapter` behavior. Semantic search leaf catalogs deferred to a future issue.

**C: `ModelContent` type**
Defined as its own interface (`{ content: string; version: string }`) in the catalog layer, not a re-export or alias of `FileContent`. The two types have different semantic roles and should evolve independently.

## Direction chosen

- `src/catalog/` as a first-class directory
- `ICatalog` with `getTask` / `getModel`
- `LocalCatalog` backed by `IStorageBackend` (renamed from `IFileStore`)
- `CompositeCatalog` aggregates N children, enforces ID uniqueness at construction
- `RuntimeEngine` constructor loses `IKnowledgeStore`; reads knowledge via `context.catalog`
- `IKnowledgeStore` relocated to catalog layer (not engine interface)
- `ModelContent` is its own interface, not derived from `FileContent`
