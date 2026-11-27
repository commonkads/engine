import type { Task } from '../core/task.js';
import { loadTaskFromManifest } from '../knowledge/psm-factory.js';
import { CatalogError } from './catalog-error.js';
import { loadCatalog, loadDomainManifestFromStore } from './domain-manifest.js';
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
    const { domains } = await loadCatalog(backend);
    return new LocalCatalog(backend, domains);
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
