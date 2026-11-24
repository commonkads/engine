import { parse as parseYaml, YAMLParseError } from 'yaml';

import type { IPsmTemplate } from '../core/interfaces/index.js';
import type { IFileStore } from '../core/interfaces/i-file-store.js';
import type { Task } from '../core/types/task.js';
import {
  AssessmentWithAbstractionPsm,
  type AssessmentWithAbstractionPsmPaths,
  CausalCoveringPsm,
  type CausalCoveringPsmPaths,
  DataDrivenMonitoringPsm,
  type DataDrivenMonitoringPsmPaths,
} from './psm/index.js';
import { DomainManifestError } from './manifest.js';
import type { DomainManifest, PsmType } from './manifest.js';

export type { DomainManifest, PsmType };
export { DomainManifestError };

export interface CatalogEntry {
  id: string;
  name: string;
  /** Path relative to the fileStore root where the domain's files live. */
  path: string;
}

export interface KnowledgeCatalog {
  domains: CatalogEntry[];
}

export class KnowledgeCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeCatalogError';
  }
}

/** Reads and parses catalog.yml from the root of the fileStore. */
export async function loadCatalog(fileStore: IFileStore): Promise<KnowledgeCatalog> {
  let raw: string;
  try {
    raw = await fileStore.read('catalog.yml');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new KnowledgeCatalogError(`Failed to read catalog.yml: ${msg}`);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    if (err instanceof YAMLParseError) {
      throw new KnowledgeCatalogError(`Failed to parse catalog.yml: ${err.message}`);
    }
    throw err;
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj['domains'])) {
    throw new KnowledgeCatalogError('catalog.yml must have a "domains" array');
  }

  const domains: CatalogEntry[] = (obj['domains'] as unknown[]).map((d, i) => {
    const entry = d as Record<string, unknown>;
    if (
      typeof entry['id'] !== 'string' ||
      typeof entry['name'] !== 'string' ||
      typeof entry['path'] !== 'string'
    ) {
      throw new KnowledgeCatalogError(
        `catalog.yml domains[${i}] must have string fields: id, name, path`,
      );
    }
    return { id: entry['id'], name: entry['name'], path: entry['path'] };
  });

  return { domains };
}

const VALID_PSM_TYPES: readonly PsmType[] = [
  'assessment-with-abstraction',
  'causal-covering',
  'data-driven-monitoring',
];

const REQUIRED_KNOWLEDGE_KEYS: Record<PsmType, string[]> = {
  'assessment-with-abstraction': ['ontologyPath', 'normsPath', 'abstractionPath', 'evaluationPath'],
  'causal-covering': ['ontologyPath', 'normsPath', 'abstractionPath', 'faultModelPath'],
  'data-driven-monitoring': ['ontologyPath', 'normsPath', 'abstractionPath', 'tolerancePath'],
};

/**
 * Reads and parses {domainPath}/domain.yml from the fileStore.
 * Validates PSM type and required knowledge keys.
 * Does NOT verify that the referenced knowledge files exist — they will
 * fail with a clear error at execution time if missing.
 */
export async function loadDomainManifestFromStore(
  fileStore: IFileStore,
  domainPath: string,
): Promise<DomainManifest> {
  const normalised = domainPath.endsWith('/') ? domainPath : `${domainPath}/`;
  const manifestPath = `${normalised}domain.yml`;

  let raw: string;
  try {
    raw = await fileStore.read(manifestPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DomainManifestError(`Failed to read ${manifestPath}: ${msg}`);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    if (err instanceof YAMLParseError) {
      throw new DomainManifestError(`Failed to parse ${manifestPath}: ${err.message}`);
    }
    throw err;
  }

  const obj = parsed as Record<string, unknown>;
  const psm = obj['psm'];

  if (!VALID_PSM_TYPES.includes(psm as PsmType)) {
    throw new DomainManifestError(
      `Invalid psm "${String(psm)}" in ${manifestPath}. Must be one of: ${VALID_PSM_TYPES.join(', ')}`,
    );
  }

  const task = obj['task'];
  if (typeof task !== 'string' || task.trim() === '') {
    throw new DomainManifestError(
      `${manifestPath} is missing required field "task" (must be a non-empty string)`,
    );
  }

  const knowledge = (obj['knowledge'] ?? {}) as Record<string, string>;
  const missingKeys = REQUIRED_KNOWLEDGE_KEYS[psm as PsmType].filter((k) => !knowledge[k]);

  if (missingKeys.length > 0) {
    throw new DomainManifestError(
      `${manifestPath} missing required knowledge keys for psm "${String(psm)}": ${missingKeys.join(', ')}`,
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

function createPsmInstance(manifest: DomainManifest): IPsmTemplate {
  const paths = manifest.knowledge as unknown;
  switch (manifest.psm) {
    case 'assessment-with-abstraction':
      return new AssessmentWithAbstractionPsm(paths as AssessmentWithAbstractionPsmPaths);
    case 'causal-covering':
      return new CausalCoveringPsm(paths as CausalCoveringPsmPaths);
    case 'data-driven-monitoring':
      return new DataDrivenMonitoringPsm(paths as DataDrivenMonitoringPsmPaths);
  }
}

/** Builds a Task from a loaded DomainManifest. */
export function loadTaskFromManifest(manifest: DomainManifest): Task {
  return {
    name: manifest.task,
    psm: createPsmInstance(manifest),
    ...(manifest.input !== undefined && { inputSchema: manifest.input }),
    ...(manifest.output !== undefined && { outputSchema: manifest.output }),
  };
}
