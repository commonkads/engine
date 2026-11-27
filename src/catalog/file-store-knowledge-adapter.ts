import type { IKnowledgeStore } from './i-knowledge-store.js';
import type { IStorageBackend } from './i-storage-backend.js';
import type { FileContent } from '../core/file-content.js';

/** Adapts any `IStorageBackend` to the `IKnowledgeStore` interface. */
export class FileStoreKnowledgeAdapter implements IKnowledgeStore {
  constructor(private readonly store: IStorageBackend) {}

  get(ref: string): Promise<FileContent> {
    return this.store.readWithVersion(ref);
  }

  search(_query: string): Promise<FileContent> {
    return Promise.resolve({ content: '', version: '' });
  }
}
