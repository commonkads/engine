import type { KnowledgeRef } from './knowledge-ref.js';

/** One entry per executed step, recording which knowledge versions were used. */
export interface AuditLogEntry {
  step: string;
  deterministic: boolean;
  knowledgeRefs: KnowledgeRef[];
}
