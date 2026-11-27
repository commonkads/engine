import type { FileContent } from '../core/file-content.js';

/** Unified knowledge access — reference lookup and semantic search. */
export interface IKnowledgeStore {
  get(ref: string): Promise<FileContent>;
  search(query: string): Promise<FileContent>;
}
