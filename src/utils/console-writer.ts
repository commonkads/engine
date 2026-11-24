import { inspect, styleText } from 'node:util';
import type { Writable } from 'node:stream';

/**
 * A `console`-like, stream-injectable replacement for `console.log`/
 * `.info`/`.warn`/`.error` - distinct from both the engine execution logger
 * (`logger.ts`) and the general-purpose diagnostics logger
 * (`diagnostics.ts`). Those two are for *logging*; this is for writing
 * user-facing, level-prefixed, optionally-colored text directly to a
 * stream (stdout/stderr, or any other `Writable`), the way `console` does.
 */

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error';

export interface ConsoleWriterOptions {
  /** Destination for `log`/`info`. Defaults to `process.stdout`. */
  stdout?: Writable;
  /** Destination for `warn`/`error`. Defaults to `process.stderr`. */
  stderr?: Writable;
}

export interface IConsoleWriter {
  log(...parts: unknown[]): void;
  info(...parts: unknown[]): void;
  warn(...parts: unknown[]): void;
  error(...parts: unknown[]): void;
}

const LEVEL_PREFIXES: Partial<Record<ConsoleLevel, string>> = {
  warn: '[WARNING]: ',
  error: '[ERROR]: ',
};

export class ConsoleWriter implements IConsoleWriter {
  private readonly stdout: Writable;
  private readonly stderr: Writable;

  constructor(options: ConsoleWriterOptions = {}) {
    this.stdout = options.stdout ?? process.stdout;
    this.stderr = options.stderr ?? process.stderr;
  }

  log(...parts: unknown[]): void {
    this.write(this.stdout, 'log', parts);
  }

  info(...parts: unknown[]): void {
    this.write(this.stdout, 'info', parts);
  }

  /** Prefixed with `[WARNING]: `, colored yellow on a TTY. */
  warn(...parts: unknown[]): void {
    this.write(this.stderr, 'warn', parts);
  }

  /** Prefixed with `[ERROR]: `, colored red and bold on a TTY. */
  error(...parts: unknown[]): void {
    this.write(this.stderr, 'error', parts);
  }

  private write(stream: Writable, level: ConsoleLevel, parts: unknown[]): void {
    stream.write(`${this.format(stream, level, parts)}\n`);
  }

  private format(stream: Writable, level: ConsoleLevel, parts: unknown[]): string {
    const text = parts.map((part) => (typeof part === 'string' ? part : inspect(part))).join(' ');
    const prefixed = `${LEVEL_PREFIXES[level] ?? ''}${text}`;

    if (!isColorCapable(stream)) {
      return prefixed;
    }

    if (level === 'error') {
      return styleText(['red', 'bold'], prefixed, { validateStream: false });
    }
    if (level === 'warn') {
      return styleText('yellow', prefixed, { validateStream: false });
    }
    return prefixed;
  }
}

function isColorCapable(stream: Writable): boolean {
  return 'isTTY' in stream && (stream as { isTTY?: boolean }).isTTY === true;
}

/** Ready-to-use singleton writing to `process.stdout`/`process.stderr`. */
export const consoleWriter: IConsoleWriter = new ConsoleWriter();
