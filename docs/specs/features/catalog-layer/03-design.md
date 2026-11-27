# Design — Catalog Layer

## New files

| File | Purpose |
|---|---|
| `src/catalog/i-catalog.ts` | `ICatalog` interface + `ModelContent` type |
| `src/catalog/i-storage-backend.ts` | `IStorageBackend` (renamed shape of `IFileStore`) |
| `src/catalog/i-knowledge-store.ts` | `IKnowledgeStore` moved from `src/core/interfaces/` |
| `src/catalog/catalog-error.ts` | `CatalogError` — ID not found, ID collision |
| `src/catalog/local-catalog.ts` | `LocalCatalog` class |
| `src/catalog/composite-catalog.ts` | `CompositeCatalog` class |
| `src/catalog/index.ts` | Public barrel |
| `src/catalog/local-catalog.test.ts` | Unit tests for `LocalCatalog` |
| `src/catalog/composite-catalog.test.ts` | Unit tests for `CompositeCatalog` |

## Deleted files

- `src/core/interfaces/i-file-store.ts` — replaced by `src/catalog/i-storage-backend.ts`
- `src/core/interfaces/i-knowledge-store.ts` — moved to `src/catalog/i-knowledge-store.ts`

## Modified files

| File | Change |
|---|---|
| `src/core/interfaces/index.ts` | Remove `IFileStore` and `IKnowledgeStore` exports |
| `src/core/context.ts` | Add `catalog?: ICatalog` field + option |
| `src/core/engine.ts` | Remove `IKnowledgeStore` from constructor; fetch knowledge via `context.catalog` |
| `src/core/engine.test.ts` | Replace `FakeKnowledgeStore` + engine-ctor store with `FakeCatalog` on context |
| `src/provider/local/local-file-store.ts` | Implement `IStorageBackend` instead of `IFileStore` |
| `src/provider/file-store-knowledge-adapter.ts` | Update imports: `IStorageBackend`/`IKnowledgeStore` from catalog layer |
| `src/provider/file-store-knowledge-adapter.test.ts` | Update imports |
| `src/knowledge/catalog.ts` | Replace `IFileStore` with `IStorageBackend`; unexport `loadCatalog`, `loadDomainManifestFromStore`, `loadTaskFromManifest` from the package (keep as internal helpers) |
| `src/knowledge/catalog.test.ts` | Update imports; remove tests for functions that become internal |
| `src/knowledge/index.ts` | Remove re-exports of `loadCatalog`, `loadDomainManifestFromStore`, `loadTaskFromManifest` |
| `src/index.ts` | Add `export * from './catalog/index.js'` |

---

## Key interfaces

### `ModelContent`

```ts
interface ModelContent {
  content: string;
  version: string;
}
```

Defined in `src/catalog/i-catalog.ts`. Structurally identical to `FileContent` but semantically distinct — a catalog response, not a storage primitive.

### `ICatalog`

```ts
interface ICatalog {
  getTask(id: string): Promise<Task>;
  getModel(id: string): Promise<ModelContent>;
}
```

### `IStorageBackend`

```ts
interface IStorageBackend {
  read(path: string): Promise<string>;
  readWithVersion(path: string): Promise<FileContent>;
  list(prefix?: string): Promise<string[]>;
}
```

Identical shape to `IFileStore`; rename only. `LocalFileStore` implements this.

### `LocalCatalog`

```ts
type RegisteredCatalog = ICatalog & { readonly taskIds: ReadonlyArray<string> };

class LocalCatalog implements ICatalog {
  readonly taskIds: ReadonlyArray<string>;

  static async load(backend: IStorageBackend): Promise<LocalCatalog>;

  async getTask(id: string): Promise<Task>;
  async getModel(id: string): Promise<ModelContent>;
}
```

`load()` reads and parses `catalog.yml` from the backend; stores domain entries. Throws `KnowledgeCatalogError` for catalog.yml problems, `DomainManifestError` for domain.yml problems (both existing error types).

`getModel(id)` treats `id` as a file path in the backend — a compatibility shim until the domain manifest shape changes in #19. Calls `backend.readWithVersion(id)` and returns the result as `ModelContent`.

`getTask(id)` looks up the domain entry by `id`, reads its `domain.yml` via the backend (calling the existing internal helpers in `knowledge/catalog.ts`), and returns a fully constructed `Task`. Throws `CatalogError` when `id` is not found.

`taskIds` exposes the domain IDs from the parsed `catalog.yml` for `CompositeCatalog` collision detection.

### `CompositeCatalog`

```ts
class CompositeCatalog implements ICatalog {
  constructor(children: ReadonlyArray<RegisteredCatalog>);

  async getTask(id: string): Promise<Task>;
  async getModel(id: string): Promise<ModelContent>;
}
```

Constructor validates that no two children share any task ID; throws `CatalogError` immediately on collision (synchronous, no I/O). `getTask` and `getModel` fan out across children, returning the first successful result. Throws `CatalogError` when no child resolves the ID.

---

## Data flow

### Before

```
RuntimeEngine(IKnowledgeStore, IInferenceProvider)
  → fetchKnowledge: store.get(ref), store.search(query)
  → infer: IInferenceProvider.infer(prompt)

RuntimeContext: { logger, explain, auditLog, timings, explanations }
```

### After

```
RuntimeEngine(IInferenceProvider)
  → fetchKnowledge: context.catalog.getModel(ref)   [refs]
  → fetchKnowledge: empty content                   [searches — deferred to #18]
  → infer: IInferenceProvider.infer(prompt)

RuntimeContext: { catalog?, logger, explain, auditLog, timings, explanations }
```

`catalog` is optional on `RuntimeContext`; the engine throws at runtime if a step declares `knowledgeRefs` and no catalog is provided.

---

## Dependency graph after the change

```
src/core/     ← src/catalog/ (ICatalog, ModelContent)
src/catalog/  ← src/core/types/ (Task, FileContent)
              ← src/knowledge/ (loadDomainManifestFromStore, loadTaskFromManifest — internal)
src/knowledge/← src/catalog/ (IStorageBackend)
src/provider/ ← src/catalog/ (IStorageBackend, IKnowledgeStore)
```

No circular dependencies. `src/catalog/` → `src/knowledge/` for internal helpers only (not a public API dependency); `src/knowledge/` → `src/catalog/` for `IStorageBackend`. This is a diamond, not a cycle.

---

## Decisions

**`ModelContent` is its own interface, not aliased from `FileContent`.** The two types have different semantic roles and should be free to diverge.

**`LocalCatalog.getModel(id)` treats `id` as a file path (compatibility shim).** Until #19 changes the manifest shape, PSMs continue to return file paths as `knowledgeRefs`. The shim makes the migration transparent — no PSM changes needed in this feature.

**`CompositeCatalog` validates task ID uniqueness synchronously at construction.** Children must already be loaded (`LocalCatalog.load()` is async; construction of `CompositeCatalog` happens after all children are ready). Validation is O(n·m) over task IDs — acceptable at startup.

**`knowledgeSearches` returns empty content.** Semantic search is deferred to #18. Behavior is identical to the existing `FileStoreKnowledgeAdapter.search()` stub, so no PSM or test expectations change.

**Existing `knowledge/catalog.ts` helpers stay but become internal.** `loadDomainManifestFromStore` and `loadTaskFromManifest` are well-tested parsing helpers; `LocalCatalog` calls them internally rather than duplicating the logic. They are removed from the package's public exports.
