import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';

import { ConsoleWriter } from './console-writer.js';

function createCapturingStream(isTTY: boolean): { stream: Writable; chunks: string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  Object.defineProperty(stream, 'isTTY', { value: isTTY });
  return { stream, chunks };
}

describe('ConsoleWriter', () => {
  it('routes log/info to stdout and warn/error to stderr', () => {
    const stdout = createCapturingStream(false);
    const stderr = createCapturingStream(false);
    const writer = new ConsoleWriter({ stdout: stdout.stream, stderr: stderr.stream });

    writer.log('a log line');
    writer.info('an info line');
    writer.warn('a warn line');
    writer.error('an error line');

    assert.strictEqual(stdout.chunks.join(''), 'a log line\nan info line\n');
    assert.strictEqual(stderr.chunks.join(''), '[WARNING]: a warn line\n[ERROR]: an error line\n');
  });

  it('joins multiple variadic arguments with a space, like console does', () => {
    const stdout = createCapturingStream(false);
    const writer = new ConsoleWriter({ stdout: stdout.stream, stderr: stdout.stream });

    writer.log('a', 'b', 123);

    assert.strictEqual(stdout.chunks.join(''), 'a b 123\n');
  });

  it('does not emit ANSI codes when the destination is not a TTY', () => {
    const stderr = createCapturingStream(false);
    const writer = new ConsoleWriter({ stdout: stderr.stream, stderr: stderr.stream });

    writer.error('boom');

    assert.strictEqual(stderr.chunks.join(''), '[ERROR]: boom\n');
  });

  it('colors error red+bold and warn yellow when the destination is a TTY', () => {
    const stderr = createCapturingStream(true);
    const writer = new ConsoleWriter({ stdout: stderr.stream, stderr: stderr.stream });

    writer.error('boom');
    writer.warn('careful');

    const [errorLine, warnLine] = stderr.chunks.join('').split('\n');

    assert.ok(errorLine.includes('\u001b[31m'));
    assert.ok(errorLine.includes('\u001b[1m'));
    assert.ok(errorLine.includes('[ERROR]: boom'));
    assert.ok(warnLine.includes('\u001b[33m'));
    assert.ok(warnLine.includes('[WARNING]: careful'));
  });

  it('log/info stay uncolored even on a TTY', () => {
    const stdout = createCapturingStream(true);
    const writer = new ConsoleWriter({ stdout: stdout.stream, stderr: stdout.stream });

    writer.log('plain');

    assert.strictEqual(stdout.chunks.join(''), 'plain\n');
  });
});
