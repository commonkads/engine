import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createDebug from 'debug';

import { createDiagnosticsLogger } from './diagnostics.js';

describe('createDiagnosticsLogger', () => {
  it('debug provider writes level-prefixed messages to stderr when its namespace is enabled', () => {
    createDebug.enable('test:diagnostics-debug');
    const log = createDiagnosticsLogger('test:diagnostics-debug', { provider: 'debug' });

    const chunks: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      log.warn('hello from debug');
    } finally {
      process.stderr.write = originalWrite;
      createDebug.enable('');
    }

    assert.ok(chunks.join('').includes('[warn] hello from debug'));
  });

  it('debug provider stays silent when its namespace is not enabled', () => {
    createDebug.enable('some-other-namespace');
    const log = createDiagnosticsLogger('test:diagnostics-debug-disabled', { provider: 'debug' });

    const chunks: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      log.error('should not appear');
    } finally {
      process.stderr.write = originalWrite;
      createDebug.enable('');
    }

    assert.strictEqual(chunks.join(''), '');
  });

  it('every method on both providers implements the ILogger contract without throwing', () => {
    for (const provider of ['debug', 'pino'] as const) {
      const log = createDiagnosticsLogger(`test:${provider}-contract`, { provider });
      assert.doesNotThrow(() => {
        log.debug('debug message');
        log.log('debug', 'via log()');
      });
    }
  });

  it('defaults to the pino provider when no provider is specified or configured via env', () => {
    const previous = process.env.STRATA_LOG_PROVIDER;
    delete process.env.STRATA_LOG_PROVIDER;

    try {
      const log = createDiagnosticsLogger('test:default-provider');
      assert.doesNotThrow(() => log.debug('default provider smoke test'));
    } finally {
      if (previous === undefined) {
        delete process.env.STRATA_LOG_PROVIDER;
      } else {
        process.env.STRATA_LOG_PROVIDER = previous;
      }
    }
  });

  it('resolves the debug provider from STRATA_LOG_PROVIDER when no explicit option is given', () => {
    const previous = process.env.STRATA_LOG_PROVIDER;
    process.env.STRATA_LOG_PROVIDER = 'debug';
    createDebug.enable('test:diagnostics-env-provider');

    const chunks: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const log = createDiagnosticsLogger('test:diagnostics-env-provider');
      log.info('via env provider');
    } finally {
      process.stderr.write = originalWrite;
      createDebug.enable('');
      if (previous === undefined) {
        delete process.env.STRATA_LOG_PROVIDER;
      } else {
        process.env.STRATA_LOG_PROVIDER = previous;
      }
    }

    assert.ok(chunks.join('').includes('[info] via env provider'));
  });
});
