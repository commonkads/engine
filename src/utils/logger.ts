import type { Writable } from 'node:stream';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Structured logging interface, independent of any specific logging library (REQ-10). */
export interface ILogger {
  log(level: LogLevel, message: string): void;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Writes `[LEVEL] message` lines to a `Writable` stream. */
export class StreamLogger implements ILogger {
  private enabled = true;

  constructor(private readonly stream: Writable = process.stdout) {}

  log(level: LogLevel, message: string): void {
    if (!this.enabled) {
      return;
    }
    this.stream.write(`[${level.toUpperCase()}] ${message}\n`);
  }

  debug(message: string): void {
    this.log('debug', message);
  }

  info(message: string): void {
    this.log('info', message);
  }

  warn(message: string): void {
    this.log('warn', message);
  }

  error(message: string): void {
    this.log('error', message);
  }

  /** Suppresses all further output. */
  disable(): void {
    this.enabled = false;
  }
}

/** Wraps a logger, forwarding only messages at or above `threshold`. */
export class LevelFilterLogger implements ILogger {
  constructor(
    private readonly inner: ILogger,
    private readonly threshold: LogLevel,
  ) {}

  log(level: LogLevel, message: string): void {
    if (LEVEL_ORDER[level] >= LEVEL_ORDER[this.threshold]) {
      this.inner.log(level, message);
    }
  }

  debug(message: string): void {
    this.log('debug', message);
  }

  info(message: string): void {
    this.log('info', message);
  }

  warn(message: string): void {
    this.log('warn', message);
  }

  error(message: string): void {
    this.log('error', message);
  }
}
