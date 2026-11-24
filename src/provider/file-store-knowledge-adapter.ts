import type { FileContent, IFileStore, IKnowledgeStore } from '../core/index.js';

/** Adapts any `IFileStore` to the `IKnowledgeStore` interface. */
export class FileStoreKnowledgeAdapter implements IKnowledgeStore {
  constructor(private readonly store: IFileStore) {}

  get(ref: string): Promise<FileContent> {
    return this.store.readWithVersion(ref);
  }

  search(_query: string): Promise<FileContent> {
    return Promise.resolve({ content: '', version: '' });
  }
}
