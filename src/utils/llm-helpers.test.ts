import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractJson,
  parseJsonArray,
  parseJsonObject,
  stripFences,
  unwrapExplanation,
} from './llm-helpers.js';

describe('stripFences', () => {
  it('removes a fenced code block', () => {
    assert.strictEqual(stripFences('```json\n{"a":1}\n```'), '{"a":1}');
  });

  it('returns trimmed text unchanged when there is no fence', () => {
    assert.strictEqual(stripFences('  {"a":1}  '), '{"a":1}');
  });
});

describe('extractJson', () => {
  it('extracts a JSON object surrounded by trailing prose', () => {
    assert.strictEqual(
      extractJson('Sure, here it is:\n{"a":1}\nLet me know if you need more.'),
      '{"a":1}',
    );
  });

  it('extracts a JSON array ignoring braces inside string values', () => {
    const text = 'Result: [{"a": "contains a } brace"}, {"a": 2}] done';
    assert.strictEqual(extractJson(text), '[{"a": "contains a } brace"}, {"a": 2}]');
  });

  it('throws when no JSON value is present', () => {
    assert.throws(() => extractJson('no json here'), SyntaxError);
  });
});

describe('parseJsonArray', () => {
  it('parses a fenced array', () => {
    assert.deepStrictEqual(parseJsonArray('```json\n[1,2,3]\n```'), [1, 2, 3]);
  });

  it('parses a clean array', () => {
    assert.deepStrictEqual(parseJsonArray('[1,2,3]'), [1, 2, 3]);
  });

  it('parses an array with trailing commentary', () => {
    assert.deepStrictEqual(parseJsonArray('Here you go: [1,2,3] - hope that helps!'), [1, 2, 3]);
  });

  it('passes through an already-parsed array', () => {
    assert.deepStrictEqual(parseJsonArray([1, 2]), [1, 2]);
  });

  it('throws when the parsed value is not an array', () => {
    assert.throws(() => parseJsonArray('{"a":1}'), SyntaxError);
  });
});

describe('parseJsonObject', () => {
  it('throws when the parsed value is an array', () => {
    assert.throws(() => parseJsonObject('[1,2]'), SyntaxError);
  });

  it('parses a clean object', () => {
    assert.deepStrictEqual(parseJsonObject('{"a":1}'), { a: 1 });
  });
});

describe('unwrapExplanation', () => {
  it('extracts result and explanation from a wrapper object', () => {
    assert.deepStrictEqual(unwrapExplanation({ result: [1, 2], _explanation: 'because' }), {
      result: [1, 2],
      explanation: 'because',
    });
  });

  it('passes non-wrapper values through with no explanation', () => {
    assert.deepStrictEqual(unwrapExplanation([1, 2]), { result: [1, 2] });
  });
});
