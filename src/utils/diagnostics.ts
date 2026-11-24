import createDebug from 'debug';
import pino, { type Logger as PinoLogger } from 'pino';

import type { ILogger, LogLevel } from './logger.js';

/**
 * General-purpose logging for application code (CLI, providers, wiring,
 * domain modules, etc.) - distinct from the *engine execution* logger a
 * `RuntimeContext` is given (see `logger.ts`), which only ever logs PSM
 * step names and explanations during a task run.
 *
 * Call sites only ever see the `ILogger` contract returned by
 * `createDiagnosticsLogger`; which concrete library backs it (`debug` or
 * `pino`) is resolved once, in this file, from `STRATA_LOG_PROVIDER`. That
 * means switching providers later - or adding a third one - never requires
 * touching any call site.
 */

export type LogProviderName = 'debug' | 'pino';

export interface CreateDiagnosticsLoggerOptions {
  /** Overrides the `STRATA_LOG_PROVIDER` env var for this logger only. */
  provider?: LogProviderName;
}

const LOG_PROVIDER_ENV_VAR = 'STRATA_LOG_PROVIDER';
const LOG_LEVEL_ENV_VAR = 'STRATA_LOG_LEVEL';
const DEFAULT_LOG_LEVEL: LogLevel = 'info';

let sharedPinoRoot: PinoLogger | undefined;

function resolveProviderName(): LogProviderName {
  return process.env[LOG_PROVIDER_ENV_VAR] === 'debug' ? 'debug' : 'pino';
}

function getPinoRoot(): PinoLogger {
  if (!sharedPinoRoot) {
    sharedPinoRoot = pino({ level: process.env[LOG_LEVEL_ENV_VAR] ?? DEFAULT_LOG_LEVEL });
  }
  return sharedPinoRoot;
}

function createPinoBackedLogger(namespace: string): ILogger {
  const child = getPinoRoot().child({ namespace });
  return {
    log(level: LogLevel, message: string): void {
      child[level](message);
    },
    debug: (message) => child.debug(message),
    info: (message) => child.info(message),
    warn: (message) => child.warn(message),
    error: (message) => child.error(message),
  };
}

function createDebugBackedLogger(namespace: string): ILogger {
  // `debug` has no notion of levels, only namespaces - so the level is
  // folded into the message, and visibility is controlled entirely by the
  // DEBUG env var (e.g. `DEBUG=strata:*`), as `debug` users expect.
  const debugLog = createDebug(namespace);
  const log = (level: LogLevel, message: string): void => {
    debugLog(`[${level}] ${message}`);
  };
  return {
    log,
    debug: (message) => log('debug', message),
    info: (message) => log('info', message),
    warn: (message) => log('warn', message),
    error: (message) => log('error', message),
  };
}

/** Creates a namespaced diagnostics logger, e.g. `createDiagnosticsLogger('providers:claude')`. */
export function createDiagnosticsLogger(
  namespace: string,
  options: CreateDiagnosticsLoggerOptions = {},
): ILogger {
  const providerName = options.provider ?? resolveProviderName();
  return providerName === 'debug'
    ? createDebugBackedLogger(namespace)
    : createPinoBackedLogger(namespace);
}
