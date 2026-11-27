## 2026-11-27

- Decision: LocalCatalog.load() calls the existing loadCatalog from knowledge/catalog.ts instead of duplicating its parsing logic. Error types and messages are the same.
- Deviation: `npm run typecheck` does not exist as a package script; used `npm run compile` (which runs tsc --build + tsc --noEmit -p tsconfig.test.json) instead.
- Deviation: engine.ts still imported IKnowledgeStore from the deleted core interface at Task 2 boundary; repointed that import to src/catalog/i-knowledge-store.ts before Task 5 removed the parameter.
- Deviation: causal-covering-psm.test.ts, data-driven-monitoring-psm.test.ts, and vital-signs-assessment-psm.test.ts imported IFileStore and constructed RuntimeEngine with a store argument; all three updated to IStorageBackend and catalog-on-context pattern.
- Deviation: fetchKnowledge uses a narrowed local variable instead of context.catalog! to satisfy lint.
- Deviation: stale IFileStore doc comments in src/core/errors.ts and src/core/types/file-content.ts updated to IStorageBackend.

- Decision: CompositeCatalog advisory fix — changed fan-out catch blocks to only catch CatalogError and rethrow anything else. Updated FakeCatalog in composite-catalog.test.ts to throw CatalogError for not-found, matching the contract all leaf catalogs must satisfy. Added propagation test.

- Decision: moved manifest types (DomainManifest, PsmType, DomainManifestError, loadDomainManifest) and catalog parsing helpers (loadCatalog, loadDomainManifestFromStore, KnowledgeCatalogError, CatalogEntry, KnowledgeCatalog) from src/knowledge/ into src/catalog/domain-manifest.ts. PSM factory (createPsmInstance, loadTaskFromManifest) moved to src/knowledge/psm-factory.ts. This eliminates the src/catalog/ → src/knowledge/ dependency for parsing (only psm-factory wiring remains), and makes src/knowledge/ purely PSM code.
- Deviation: src/knowledge/catalog.ts and src/knowledge/manifest.ts deleted (content redistributed). src/knowledge/catalog.test.ts deleted (behaviour covered by local-catalog.test.ts). src/knowledge/manifest.test.ts moved to src/catalog/domain-manifest.test.ts.

- Decision: moved LocalFileStore from src/provider/local/ to src/catalog/. LocalFileStore implements IStorageBackend which is a catalog concern; src/knowledge/psm/__fixtures__/vital-signs/wiring.ts import updated accordingly.
- Decision: moved FileStoreKnowledgeAdapter from src/provider/ to src/catalog/. Both interfaces it bridges (IStorageBackend, IKnowledgeStore) live in src/catalog/, so the adapter belongs there too.
- Decision: moved loadProviderConfig/ProviderFileConfig from src/utils/ to src/provider/. It is an inference-provider utility (reads API keys and model IDs), not a general utility. src/utils/ now contains only logging and formatting helpers.

- Decision: flattened src/core/types/ and src/core/interfaces/ into src/core/. The subdirectories added path noise without meaningful grouping — src/core/types/ contained interfaces, src/core/interfaces/ had only 2 files. All 10 type/interface files now live directly in src/core/. Removed the i- filename prefix and I- type name prefix from the two interface files: IInferenceProvider → InferenceProvider, IPsmTemplate → PsmTemplate. TypeScript structural typing makes the prefix redundant. All 25+ references across the codebase updated.
