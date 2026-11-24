/**
 * Thrown by the engine when a step throws; wraps the original error with
 * the name of the step that failed (REQ-2).
 */
export class TaskExecutionError extends Error {
  readonly step: string;

  constructor(step: string, cause: unknown) {
    const causeMessage =
      typeof cause === 'object' &&
      cause !== null &&
      typeof (cause as { message?: unknown }).message === 'string'
        ? (cause as { message: string }).message
        : String(cause);
    super(`Task execution failed at step "${step}": ${causeMessage}`, { cause });
    this.name = 'TaskExecutionError';
    this.step = step;
  }
}

/** Thrown by an `IFileStore` when the requested path does not exist. */
export class FileNotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`File not found: ${path}`);
    this.name = 'FileNotFoundError';
  }
}

/** Thrown when a store is constructed with invalid or unusable configuration. */
export class InvalidStoreConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStoreConfigError';
  }
}

/** Thrown by the engine when the task input fails JSON Schema validation. */
export class TaskInputValidationError extends Error {
  readonly errors: object[];

  constructor(errors: object[]) {
    super('Task input failed schema validation');
    this.name = 'TaskInputValidationError';
    this.errors = errors;
  }
}
