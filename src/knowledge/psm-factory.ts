import type { PsmTemplate } from '../core/psm-template.js';
import type { Task } from '../core/task.js';
import type { DomainManifest } from '../catalog/domain-manifest.js';
import {
  AssessmentWithAbstractionPsm,
  type AssessmentWithAbstractionPsmPaths,
  CausalCoveringPsm,
  type CausalCoveringPsmPaths,
  DataDrivenMonitoringPsm,
  type DataDrivenMonitoringPsmPaths,
} from './psm/index.js';

function createPsmInstance(manifest: DomainManifest): PsmTemplate {
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
