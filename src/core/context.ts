import type { ILogger } from '../utils/index.js';
import type { AuditLogEntry, StepTiming } from './types/index.js';

export interface RuntimeContextOptions {
  logger?: ILogger;
  /** When true, the engine requests {result, _explanation} wrappers from the LLM (REQ-11). */
  explain?: boolean;
  /** When true, `auditLog` starts as `[]` and the engine appends an entry per step (REQ-12). */
  enableAuditLog?: boolean;
  /** When true, `timings` starts as `[]` and the engine appends an entry per step (REQ-12). */
  enableTimings?: boolean;
}

/**
 * Infrastructure and execution metadata passed to `RuntimeEngine.execute`
 * (REQ-12). `auditLog` and `timings` are only populated by the engine when
 * initialized to an array; leaving them `undefined` opts out of collection.
 */
export class RuntimeContext {
  readonly logger?: ILogger;
  readonly explain: boolean;
  auditLog?: AuditLogEntry[];
  timings?: StepTiming[];
  readonly explanations: Record<string, string> = {};

  constructor(options: RuntimeContextOptions = {}) {
    this.logger = options.logger;
    this.explain = options.explain ?? false;
    if (options.enableAuditLog) {
      this.auditLog = [];
    }
    if (options.enableTimings) {
      this.timings = [];
    }
  }
}
