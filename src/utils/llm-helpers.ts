/**
 * Parsing helpers for free-form LLM text output (REQ-13). Models reliably
 * wrap JSON in markdown fences and/or surround it with commentary, so
 * extraction has to tolerate both before `JSON.parse` can run.
 */

const FENCE_PATTERN = /^```[^\n]*\n([\s\S]*?)\n?```$/;

/** Removes a surrounding ```lang\n...\n``` markdown fence, if present. */
export function stripFences(text: string): string {
  const trimmed = text.trim();
  const match = FENCE_PATTERN.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

/**
 * Locates and returns the first balanced JSON object or array substring in
 * `text`, ignoring any surrounding prose. String-literal aware, so braces
 * inside quoted values don't throw off the balance count.
 */
export function extractJson(text: string): string {
  const start = findJsonStart(text);
  if (start === -1) {
    throw new SyntaxError('No JSON value found in text');
  }

  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === open) {
      depth++;
    } else if (char === close) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  throw new SyntaxError('Unbalanced JSON value in text');
}

function findJsonStart(text: string): number {
  const braceIndex = text.indexOf('{');
  const bracketIndex = text.indexOf('[');
  if (braceIndex === -1) {
    return bracketIndex;
  }
  if (bracketIndex === -1) {
    return braceIndex;
  }
  return Math.min(braceIndex, bracketIndex);
}

/** Strips fences, extracts the JSON substring, and parses it. */
export function parseJsonValue(text: string): unknown {
  return JSON.parse(extractJson(stripFences(text)));
}

/**
 * Parses `input` (raw LLM text, or an already-parsed value) and asserts the
 * result is a JSON array.
 */
export function parseJsonArray(input: unknown): unknown[] {
  const value = typeof input === 'string' ? parseJsonValue(input) : input;
  if (!Array.isArray(value)) {
    throw new SyntaxError('Expected a JSON array');
  }
  return value;
}

/**
 * Parses `input` (raw LLM text, or an already-parsed value) and asserts the
 * result is a JSON object.
 */
export function parseJsonObject(input: unknown): Record<string, unknown> {
  const value = typeof input === 'string' ? parseJsonValue(input) : input;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SyntaxError('Expected a JSON object');
  }
  return value as Record<string, unknown>;
}

/**
 * Returns the sentence appended to a PSM prompt when explain mode is active.
 * Centralised here so all PSMs produce a consistent instruction.
 */
export function buildExplainInstruction(explain: boolean): string {
  return explain
    ? ' Return it as JSON: {"result": <value described above>, "_explanation": "<plain-English reasoning>"}.'
    : '';
}

/** A parsed `{result, _explanation}` wrapper requested when explain mode is active (REQ-11). */
export interface ExplainWrapper {
  result: unknown;
  explanation?: string;
}

/**
 * Unwraps a parsed LLM value that may be a `{result, _explanation}` wrapper.
 * Values that aren't wrapper-shaped are returned as-is with no explanation.
 */
export function unwrapExplanation(value: unknown): ExplainWrapper {
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'result' in value) {
    const wrapper = value as { result: unknown; _explanation?: unknown };
    return {
      result: wrapper.result,
      explanation: typeof wrapper._explanation === 'string' ? wrapper._explanation : undefined,
    };
  }
  return { result: value };
}
