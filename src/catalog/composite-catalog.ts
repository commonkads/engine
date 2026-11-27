import type { Task } from '../core/task.js';
import { CatalogError } from './catalog-error.js';
import type { ICatalog, ModelContent } from './i-catalog.js';

type RegisteredCatalog = ICatalog & { readonly taskIds: ReadonlyArray<string> };

export class CompositeCatalog implements ICatalog {
  private readonly children: ReadonlyArray<RegisteredCatalog>;

  constructor(children: ReadonlyArray<RegisteredCatalog>) {
    const seen = new Set<string>();
    for (const child of children) {
      for (const id of child.taskIds) {
        if (seen.has(id)) {
          throw new CatalogError(`Duplicate task ID across catalogs: ${id}`);
        }
        seen.add(id);
      }
    }
    this.children = children;
  }

  async getTask(id: string): Promise<Task> {
    for (const child of this.children) {
      try {
        return await child.getTask(id);
      } catch (err) {
        if (err instanceof CatalogError) continue;
        throw err;
      }
    }
    throw new CatalogError(`Task not found: ${id}`);
  }

  async getModel(id: string): Promise<ModelContent> {
    for (const child of this.children) {
      try {
        return await child.getModel(id);
      } catch (err) {
        if (err instanceof CatalogError) continue;
        throw err;
      }
    }
    throw new CatalogError(`Model not found: ${id}`);
  }
}
