import type { FileContent } from '../core/file-content.js';

/** Abstract access to a storage location, independent of its physical backend. */
export interface IStorageBackend {
  read(path: string): Promise<string>;
  readWithVersion(path: string): Promise<FileContent>;
  list(prefix?: string): Promise<string[]>;
}
