import type { PsmTemplate } from './psm-template.js';

export interface Task {
  /** Machine-readable task type, e.g. "assessment". */
  name: string;
  /** PSM implementation that executes this task. */
  psm: PsmTemplate;
  /** JSON Schema (draft-07) for the task input. Validated before execution when present. */
  inputSchema?: object;
  /** JSON Schema (draft-07) for the task output. Declared for documentation; not enforced at runtime. */
  outputSchema?: object;
}
