import type { FileContent } from '../types/file-content.js';

/** Abstract access to knowledge files, independent of storage location (local filesystem, S3, etc.). */
export interface IFileStore {
  /** Returns the UTF-8 text content of the file at `path`. */
  read(path: string): Promise<string>;
  /** Returns the file content plus a version identifier for audit purposes. */
  readWithVersion(path: string): Promise<FileContent>;
  /**
   * Returns all file paths under the store root that begin with `prefix`,
   * sorted lexicographically. Paths are relative to the store root and use
   * forward-slash separators. Returns `[]` when no paths match.
   */
  list(prefix?: string): Promise<string[]>;
}
