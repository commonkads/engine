import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml, YAMLParseError } from 'yaml';

export type PsmType = 'assessment-with-abstraction' | 'causal-covering' | 'data-driven-monitoring';

export interface DomainManifest {
  name: string;
  /** Machine-readable task type, e.g. "assessment". */
  task: string;
  psm: PsmType;
  /** JSON Schema for the task input (optional). */
  input?: object;
  /** JSON Schema for the task output (optional). */
  output?: object;
  /** Knowledge file paths — relative to the knowledge root. */
  knowledge: Record<string, string>;
}

export class DomainManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainManifestError';
  }
}

const VALID_PSM_TYPES: PsmType[] = [
  'assessment-with-abstraction',
  'causal-covering',
  'data-driven-monitoring',
];

const REQUIRED_KNOWLEDGE_KEYS: Record<PsmType, string[]> = {
  'assessment-with-abstraction': ['ontologyPath', 'normsPath', 'abstractionPath', 'evaluationPath'],
  'causal-covering': ['ontologyPath', 'normsPath', 'abstractionPath', 'faultModelPath'],
  'data-driven-monitoring': ['ontologyPath', 'normsPath', 'abstractionPath', 'tolerancePath'],
};

export function loadDomainManifest(knowledgeRoot: string): DomainManifest {
  const manifestPath = join(knowledgeRoot, 'domain.yml');

  if (!existsSync(manifestPath)) {
    throw new DomainManifestError(`No domain.yml found at: ${manifestPath}`);
  }

  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    if (err instanceof YAMLParseError) {
      throw new DomainManifestError(`Failed to parse domain.yml: ${err.message}`);
    }
    throw err;
  }

  const obj = raw as Record<string, unknown>;
  const psm = obj['psm'];

  if (!VALID_PSM_TYPES.includes(psm as PsmType)) {
    throw new DomainManifestError(
      `Invalid psm value "${String(psm)}" in domain.yml. Must be one of: ${VALID_PSM_TYPES.join(', ')}`,
    );
  }

  const task = obj['task'];
  if (typeof task !== 'string' || task.trim() === '') {
    throw new DomainManifestError(
      'domain.yml is missing required field "task" (must be a non-empty string)',
    );
  }

  const knowledge = (obj['knowledge'] ?? {}) as Record<string, string>;
  const requiredKeys = REQUIRED_KNOWLEDGE_KEYS[psm as PsmType];
  const missingKeys = requiredKeys.filter((k) => !knowledge[k]);

  if (missingKeys.length > 0) {
    throw new DomainManifestError(
      `domain.yml is missing required knowledge keys for psm "${String(psm)}": ${missingKeys.join(', ')}`,
    );
  }

  const missingFiles = Object.values(knowledge)
    .map((relPath) => join(knowledgeRoot, relPath))
    .filter((absPath) => !existsSync(absPath));

  if (missingFiles.length > 0) {
    throw new DomainManifestError(
      `domain.yml references knowledge files that do not exist:\n${missingFiles.map((p) => `  ${p}`).join('\n')}`,
    );
  }

  const input =
    typeof obj['input'] === 'object' && obj['input'] !== null
      ? (obj['input'] as object)
      : undefined;
  const output =
    typeof obj['output'] === 'object' && obj['output'] !== null
      ? (obj['output'] as object)
      : undefined;

  return {
    name: typeof obj['name'] === 'string' ? obj['name'] : '',
    task: task as string,
    psm: psm as PsmType,
    ...(input !== undefined && { input }),
    ...(output !== undefined && { output }),
    knowledge,
  };
}
