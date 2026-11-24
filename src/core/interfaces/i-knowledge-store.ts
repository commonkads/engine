import type { FileContent } from '../types/file-content.js';

/** Unified knowledge access — reference lookup and semantic search. */
export interface IKnowledgeStore {
  /** Returns the content and version of the knowledge item identified by `ref`. */
  get(ref: string): Promise<FileContent>;
  /** Returns retrieved passages for `query`, or `{ content: '', version: '' }` if none. */
  search(query: string): Promise<FileContent>;
}
