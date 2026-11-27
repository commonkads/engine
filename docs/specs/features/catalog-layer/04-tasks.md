# Tasks — Catalog Layer

Six ordered tasks. Each is self-contained. Run the verify command at the end of each task before moving on.

---

## Task 1 — Create the `src/catalog/` module foundation

**What:** Create five new files. Do not modify any existing file.

---

### `src/catalog/i-storage-backend.ts`

```ts
import type { FileContent } from '../core/types/file-content.js';

/** Abstract access to a storage location, independent of its physical backend. */
export interface IStorageBackend {
  read(path: string): Promise<string>;
  readWithVersion(path: string): Promise<FileContent>;
  list(prefix?: string): Promise<string[]>;
}
```

---

### `src/catalog/i-catalog.ts`

```ts
import type { Task } from '../core/types/task.js';

/** Content and version of a resolved knowledge model. */
export interface ModelContent {
  content: string;
  version: string;
}

/** Single entry point for resolving knowledge models and tasks by stable ID. */
export interface ICatalog {
  getTask(id: string): Promise<Task>;
  getModel(id: string): Promise<ModelContent>;
}
```

---

### `src/catalog/i-knowledge-store.ts`

Move the content verbatim from `src/core/interfaces/i-knowledge-store.ts`, updating only the import path:

```ts
import type { FileContent } from '../core/types/file-content.js';

/** Unified knowledge access — reference lookup and semantic search. */
export interface IKnowledgeStore {
  get(ref: string): Promise<FileContent>;
  search(query: string): Promise<FileContent>;
}
```

---

### `src/catalog/catalog-error.ts`

```ts
export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogError';
  }
}
```

---

### `src/catalog/index.ts`

```ts
export type * from './i-catalog.js';
export type * from './i-storage-backend.js';
export type * from './i-knowledge-store.js';
export * from './catalog-error.js';
```

`LocalCatalog` and `CompositeCatalog` will be added to this barrel in later tasks.

---

**Verify:**

```bash
npm run typecheck
```

---

## Task 2 — Migrate IFileStore → IStorageBackend across all existing files

**What:** Delete the two old core interface files, update their consumers, and trim the knowledge catalog's public exports. Do not change any logic — only rename the type and update import paths.

---

### Delete

- `src/core/interfaces/i-file-store.ts`
- `src/core/interfaces/i-knowledge-store.ts`

---

### `src/core/interfaces/index.ts`

Remove the two deleted exports. Result:

```ts
export type * from './i-inference-provider.js';
export type * from './i-psm-template.js';
```

---

### `src/provider/local/local-file-store.ts`

Change the import and the `implements` clause:

- Remove: `import type { IFileStore } from '../../core/interfaces/i-file-store.js';`
- Add: `import type { IStorageBackend } from '../../catalog/i-storage-backend.js';`
- Change `export class LocalFileStore implements IFileStore` → `implements IStorageBackend`

No other changes.

---

### `src/provider/file-store-knowledge-adapter.ts`

Change imports only. The existing import is:

```ts
import type { FileContent, IFileStore, IKnowledgeStore } from '../core/index.js';
```

Replace with:

```ts
import type { FileContent } from '../core/types/file-content.js';

import type { IKnowledgeStore } from '../catalog/i-knowledge-store.js';
import type { IStorageBackend } from '../catalog/i-storage-backend.js';
```

Change the constructor parameter type from `IFileStore` to `IStorageBackend`.

---

### `src/provider/file-store-knowledge-adapter.test.ts`

The existing import is:

```ts
import type { FileContent, IFileStore } from '../core/index.js';
```

Replace with:

```ts
import type { FileContent } from '../core/index.js';

import type { IStorageBackend } from '../catalog/i-storage-backend.js';
```

Change `FakeFileStore implements IFileStore` → `implements IStorageBackend`.

---

### `src/knowledge/catalog.ts`

Change the import:

- Remove: `import type { IFileStore } from '../core/interfaces/i-file-store.js';`
- Add: `import type { IStorageBackend } from '../catalog/i-storage-backend.js';`

Change every parameter typed `IFileStore` to `IStorageBackend`. No logic changes.

---

### `src/knowledge/catalog.test.ts`

The existing import is:

```ts
import type { FileContent, IFileStore } from '../core/index.js';
```

Replace with:

```ts
import type { FileContent } from '../core/index.js';

import type { IStorageBackend } from '../catalog/i-storage-backend.js';
```

Change `FakeFileStore implements IFileStore` → `implements IStorageBackend`.

---

### `src/knowledge/index.ts`

Remove `export * from './catalog.js'`. The PSM and manifest exports are unaffected; `DomainManifest` / `PsmType` / `DomainManifestError` come from `manifest.js` and stay public. Result:

```ts
export * from './manifest.js';
export * from './psm/index.js';
```

---

**Verify:**

```bash
npm run typecheck && npm test
```

---

## Task 3 — Implement `LocalCatalog`

**What:** Add `src/catalog/local-catalog.ts` and `src/catalog/local-catalog.test.ts`; update the catalog barrel.

---

### `src/catalog/local-catalog.ts`

`LocalCatalog` is a class that implements `ICatalog`. Its static `load(backend)` factory reads and parses `catalog.yml` from the backend. It exposes `taskIds` as a readonly list of domain IDs, which `CompositeCatalog` uses for uniqueness validation.

```ts
import { parse as parseYaml, YAMLParseError } from 'yaml';

import type { Task } from '../core/types/task.js';
import {
  KnowledgeCatalogError,
  loadDomainManifestFromStore,
  loadTaskFromManifest,
} from '../knowledge/catalog.js';
import { CatalogError } from './catalog-error.js';
import type { ICatalog, ModelContent } from './i-catalog.js';
import type { IStorageBackend } from './i-storage-backend.js';

interface DomainEntry {
  id: string;
  name: string;
  path: string;
}

export class LocalCatalog implements ICatalog {
  readonly taskIds: ReadonlyArray<string>;

  private constructor(
    private readonly backend: IStorageBackend,
    private readonly domains: ReadonlyArray<DomainEntry>,
  ) {
    this.taskIds = domains.map((d) => d.id);
  }

  static async load(backend: IStorageBackend): Promise<LocalCatalog> {
    // Read catalog.yml
    // Parse with parseYaml — throw KnowledgeCatalogError on YAMLParseError
    // Validate that parsed.domains is an array
    // Map each entry to DomainEntry, validating id/name/path are strings
    // Return new LocalCatalog(backend, domains)
  }

  async getTask(id: string): Promise<Task> {
    const entry = this.domains.find((d) => d.id === id);
    if (!entry) {
      throw new CatalogError(`Task not found: ${id}`);
    }
    const manifest = await loadDomainManifestFromStore(this.backend, entry.path);
    return loadTaskFromManifest(manifest);
  }

  async getModel(id: string): Promise<ModelContent> {
    // Compatibility shim: id is treated as a file path until #19.
    const { content, version } = await this.backend.readWithVersion(id);
    return { content, version };
  }
}
```

**`load()` implementation detail:** The parsing logic mirrors the existing `loadCatalog` function in `src/knowledge/catalog.ts` (which is now internal). Read `catalog.yml`, parse YAML (wrapping `YAMLParseError` in `KnowledgeCatalogError`), validate `domains` is an array, validate each entry has string `id`/`name`/`path` fields (throw `KnowledgeCatalogError` on any violation), construct and return the instance.

---

### `src/catalog/local-catalog.test.ts`

Use `node:test` and `node:assert/strict` (same pattern as all other tests in this repo).

Create a `FakeBackend` class implementing `IStorageBackend` that takes a `Record<string, string>` of path → content. `readWithVersion(path)` returns `{ content, version: 'v1' }`; `read(path)` returns content; `list(prefix)` filters keys by prefix. Throw `Error('no such file: <path>')` for missing paths.

The valid `catalog.yml` for tests:
```yaml
domains:
  - id: vital-signs
    name: Vital Signs
    path: vital-signs/
```

The valid `domain.yml` for `vital-signs/` domain (assessment-with-abstraction PSM):
```yaml
task: assessment
psm: assessment-with-abstraction
knowledge:
  ontologyPath: vital-signs/ontology.yml
  normsPath: vital-signs/norms.yml
  abstractionPath: vital-signs/abstraction.yml
  evaluationPath: vital-signs/evaluation.yml
```

**Tests to write:**

| # | Test name | Input | Expected output |
|---|---|---|---|
| 1 | `load() parses a valid catalog.yml and exposes taskIds` | backend with valid catalog.yml | instance with `taskIds = ['vital-signs']` |
| 2 | `load() throws KnowledgeCatalogError when catalog.yml is missing` | empty backend | throws `KnowledgeCatalogError` |
| 3 | `load() throws KnowledgeCatalogError when catalog.yml is invalid YAML` | backend with `catalog.yml: 'not: valid: yaml: ['` | throws `KnowledgeCatalogError` |
| 4 | `load() throws KnowledgeCatalogError when domains is not an array` | backend with `catalog.yml: 'domains: null'` | throws `KnowledgeCatalogError` |
| 5 | `getTask() returns a Task for a known domain ID` | catalog loaded with valid catalog + domain.yml | returns Task with `name === 'assessment'` |
| 6 | `getTask() throws CatalogError for an unknown ID` | id `'nonexistent'` | throws `CatalogError` |
| 7 | `getModel() returns ModelContent for an existing path` | id `'vital-signs/ontology.yml'`, file exists | returns `{ content: '<file content>', version: 'v1' }` |
| 8 | `getModel() propagates backend errors for a missing path` | id `'missing.yml'`, file absent | rejects with error from backend |

---

### `src/catalog/index.ts`

Add the `LocalCatalog` export:

```ts
export type * from './i-catalog.js';
export type * from './i-storage-backend.js';
export type * from './i-knowledge-store.js';
export * from './catalog-error.js';
export * from './local-catalog.js';
```

---

**Verify:**

```bash
npm run typecheck && npm test
```

---

## Task 4 — Implement `CompositeCatalog`

**What:** Add `src/catalog/composite-catalog.ts` and `src/catalog/composite-catalog.test.ts`; update the catalog barrel.

---

### `src/catalog/composite-catalog.ts`

`CompositeCatalog` accepts an array of children typed as `ICatalog & { readonly taskIds: ReadonlyArray<string> }`. The constructor (synchronous) validates that no two children share any task ID; throws `CatalogError` immediately on the first detected collision.

`getTask(id)` tries each child in order. Returns the first successful result. If all children throw, throws `CatalogError` with message `Task not found: <id>`.

`getModel(id)` tries each child in order. Returns the first successful result. If all children throw, throws `CatalogError` with message `Model not found: <id>`.

```ts
import { CatalogError } from './catalog-error.js';
import type { ICatalog, ModelContent } from './i-catalog.js';
import type { Task } from '../core/types/task.js';

type RegisteredCatalog = ICatalog & { readonly taskIds: ReadonlyArray<string> };

export class CompositeCatalog implements ICatalog {
  private readonly children: ReadonlyArray<RegisteredCatalog>;

  constructor(children: ReadonlyArray<RegisteredCatalog>) {
    // Validate task ID uniqueness across all children
    // Build a Map<id, childIndex> as you iterate; on duplicate throw CatalogError
    this.children = children;
  }

  async getTask(id: string): Promise<Task> {
    // try each child; return first success; throw CatalogError if none found
  }

  async getModel(id: string): Promise<ModelContent> {
    // try each child; return first success; throw CatalogError if none found
  }
}
```

**Collision detection detail:** Iterate through `children`. For each child, iterate through its `taskIds`. Maintain a `Set<string>` of seen IDs. If the current ID is already in the set, throw `CatalogError` with message `Duplicate task ID across catalogs: <id>`. Add IDs to the set as you go.

**Fan-out detail:** For `getTask` and `getModel`, iterate through children sequentially. Call the method on each child inside a try/catch; on success return the result. After trying all children without success, throw `CatalogError`.

---

### `src/catalog/composite-catalog.test.ts`

Use `node:test` and `node:assert/strict`.

Create a `FakeCatalog` class implementing `ICatalog & { readonly taskIds: ReadonlyArray<string> }`:

```ts
class FakeCatalog implements ICatalog {
  readonly taskIds: ReadonlyArray<string>;

  constructor(
    taskIds: string[],
    private readonly models: Record<string, ModelContent> = {},
    private readonly tasks: Record<string, Task> = {},
  ) {
    this.taskIds = taskIds;
  }

  async getTask(id: string): Promise<Task> {
    const t = this.tasks[id];
    if (!t) throw new Error(`task not found: ${id}`);
    return t;
  }

  async getModel(id: string): Promise<ModelContent> {
    const m = this.models[id];
    if (!m) throw new Error(`model not found: ${id}`);
    return m;
  }
}
```

For a minimal `Task` stub in tests: `{ name: 'test', psm: null as unknown as IPsmTemplate }` is sufficient — the tests only assert on the Task's `name` property.

**Tests to write:**

| # | Test name | Input | Expected output |
|---|---|---|---|
| 1 | `constructor succeeds when children have disjoint task IDs` | children A: `['a']`, B: `['b']` | no throw |
| 2 | `constructor throws CatalogError on duplicate task ID` | children A: `['foo']`, B: `['foo']` | throws `CatalogError` with message containing `'foo'` |
| 3 | `getTask returns task from first child` | id `'a'` present in child A | returns task from A |
| 4 | `getTask returns task from second child (cross-catalog lookup)` | id `'b'` absent in A, present in B | returns task from B |
| 5 | `getTask throws CatalogError when no child has the ID` | id `'x'` absent in all | throws `CatalogError` |
| 6 | `getModel returns model from first child` | id `'m1'` present in child A | returns model from A |
| 7 | `getModel returns model from second child (cross-catalog lookup)` | id `'m2'` absent in A, present in B | returns model from B |
| 8 | `getModel throws CatalogError when no child has the ID` | id `'missing'` absent in all | throws `CatalogError` |

---

### `src/catalog/index.ts`

Add the `CompositeCatalog` export:

```ts
export type * from './i-catalog.js';
export type * from './i-storage-backend.js';
export type * from './i-knowledge-store.js';
export * from './catalog-error.js';
export * from './local-catalog.js';
export * from './composite-catalog.js';
```

---

**Verify:**

```bash
npm run typecheck && npm test
```

---

## Task 5 — Update `RuntimeContext` and `RuntimeEngine`

**What:** Add `catalog?: ICatalog` to `RuntimeContext`; remove `IKnowledgeStore` from `RuntimeEngine`'s constructor and replace it with `context.catalog`; rewrite `src/core/engine.test.ts`.

---

### `src/core/context.ts`

Add `catalog` to `RuntimeContextOptions` and `RuntimeContext`:

```ts
import type { ICatalog } from '../catalog/i-catalog.js';
import type { ILogger } from '../utils/index.js';
import type { AuditLogEntry, StepTiming } from './types/index.js';

export interface RuntimeContextOptions {
  catalog?: ICatalog;
  logger?: ILogger;
  explain?: boolean;
  enableAuditLog?: boolean;
  enableTimings?: boolean;
}

export class RuntimeContext {
  readonly catalog?: ICatalog;
  readonly logger?: ILogger;
  readonly explain: boolean;
  auditLog?: AuditLogEntry[];
  timings?: StepTiming[];
  readonly explanations: Record<string, string> = {};

  constructor(options: RuntimeContextOptions = {}) {
    this.catalog = options.catalog;
    this.logger = options.logger;
    this.explain = options.explain ?? false;
    if (options.enableAuditLog) this.auditLog = [];
    if (options.enableTimings) this.timings = [];
  }
}
```

---

### `src/core/engine.ts`

**Constructor:** Remove the `store: IKnowledgeStore` parameter. Remove the `private readonly store` field. Remove the `IKnowledgeStore` import.

**`fetchKnowledge`:** Change its signature from `fetchKnowledge(step)` to `fetchKnowledge(step, context)`. Replace all use of `this.store` with `context.catalog`. For `knowledgeRefs`: call `context.catalog.getModel(ref)` for each ref; if `context.catalog` is undefined and `refs.length > 0` throw `Error("Step '<step.name>' requires knowledge refs but no catalog is configured in RuntimeContext")`. For `knowledgeSearches`: return an array of `{ content: '', version: '' }` stubs (search deferred to issue #18; same behavior as the previous `FileStoreKnowledgeAdapter.search` stub).

**`executeStep`:** Update its call to `fetchKnowledge(step)` → `fetchKnowledge(step, context)`.

**`FetchedKnowledge` internal type:** Stays the same (`{ knowledgeText: string; knowledgeRefs: KnowledgeRef[] }`). The fact that refs now come from `ModelContent` instead of `FileContent` is an internal detail.

**Imports to remove:** `IKnowledgeStore` import.

**New import:** `import type { ModelContent } from '../catalog/i-catalog.js';` — needed only if you use `ModelContent` explicitly in `fetchKnowledge`. Alternatively, use inline type `{ content: string; version: string }` for the stub objects so no extra import is needed.

Full `fetchKnowledge` after the change:

```ts
private async fetchKnowledge(step: StepDefinition, context: RuntimeContext): Promise<FetchedKnowledge> {
  const refs = step.knowledgeRefs ?? [];
  const queries = step.knowledgeSearches ?? [];

  if (refs.length > 0 && !context.catalog) {
    throw new Error(
      `Step '${step.name}' requires knowledge refs but no catalog is configured in RuntimeContext`,
    );
  }

  const refResults = await Promise.all(
    refs.map((ref) => context.catalog!.getModel(ref)),
  );

  // Semantic search deferred to #18 — return empty stubs matching prior behavior.
  const searchResults = queries.map(() => ({ content: '', version: '' }));

  const knowledgeRefs: KnowledgeRef[] = [
    ...refs.map((ref, i) => ({ id: ref, version: refResults[i].version })),
    ...queries.map((query, i) => ({ id: query, version: searchResults[i].version })),
  ];

  const knowledgeText = [...refResults, ...searchResults]
    .map((r) => r.content)
    .filter((text) => text.length > 0)
    .join('\n\n---\n\n');

  return { knowledgeText, knowledgeRefs };
}
```

---

### `src/core/engine.test.ts`

Replace `FakeKnowledgeStore` with `FakeCatalog`. Remove the `IKnowledgeStore` import. Update every `RuntimeEngine` constructor call (remove the first argument). Pass a `FakeCatalog` via `context.catalog`.

**`FakeCatalog`:**

```ts
class FakeCatalog implements ICatalog {
  constructor(
    private readonly models: Record<string, { content: string; version: string }> = {},
  ) {}

  async getTask(_id: string): Promise<Task> {
    throw new Error('getTask not used in engine tests');
  }

  async getModel(id: string): Promise<ModelContent> {
    const m = this.models[id];
    if (!m) throw new Error(`no such fake model: ${id}`);
    return m;
  }
}
```

**`buildEngine` helper:** Update to remove `store`, create a `FakeCatalog`, and return both engine and catalog:

```ts
function buildEngine(infer: IInferenceProvider['infer']) {
  const catalog = new FakeCatalog({
    'a.txt': { content: 'A-CONTENT', version: 'va' },
    'b.txt': { content: 'B-CONTENT', version: 'vb' },
  });
  const inference: IInferenceProvider = { infer };
  return { engine: new RuntimeEngine(inference), catalog };
}
```

Then update each test to do `const { engine, catalog } = buildEngine(...)` and pass `new RuntimeContext({ catalog })`.

**Assert change:** The prompt assertion in the first test changes from:

```ts
assert.strictEqual(capturedPrompt, 'PROMPT[llm]:B-CONTENT\n\n---\n\nQ1-PASSAGE');
```

to:

```ts
assert.strictEqual(capturedPrompt, 'PROMPT[llm]:B-CONTENT');
```

because `knowledgeSearches: ['q1']` now returns empty content (search is not yet implemented), and the filter removes empty strings.

**Audit log assertion:** Keep the existing `{ id: 'q1', version: '' }` entry — the engine still records a ref for each query even when the content is empty, matching previous stub behavior.

**Existing test coverage to preserve:** All existing test cases must remain and pass — schema validation tests, `explain` unwrapping, timings, audit log, named inference provider routing, missing inference id. Only the prompt content assertion and the engine construction helper change.

**New test to add:**

| # | Test name | Input | Expected output |
|---|---|---|---|
| 1 | `throws at step execution when knowledgeRefs present but no catalog on context` | `RuntimeContext` with no `catalog`, PSM step with `knowledgeRefs: ['a.txt']` | step wrapped in `TaskExecutionError`; cause message contains `'catalog'` |

---

**Verify:**

```bash
npm run typecheck && npm test
```

---

## Task 6 — Update barrel exports

**What:** Add the catalog module to the package's public API.

---

### `src/index.ts`

Add one line:

```ts
export * from './catalog/index.js';
```

Add it after `export * from './knowledge/index.js';`.

---

**Verify:**

```bash
npm run typecheck && npm run lint && npm test
```

If lint reports auto-fixable issues (unused imports, formatting), run `npm run lint:fix` and re-verify.

---

## Completion check

After all six tasks:

```bash
npm run compile   # type-check + lint + build
npm test          # all tests pass, zero failures
```

All new and modified test files must pass with zero failures.
