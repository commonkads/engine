import { parse as parseYaml } from 'yaml';

import type { TaskState } from '@robproper/strata-engine';
import { AssessmentWithAbstractionPsm } from '../../../index.js';
import type { VitalSignsInput, VitalSignsNorm } from './types.js';

type SkipPredicate = (caseData: VitalSignsInput) => boolean;

/**
 * Deterministic skip predicates for the conditionally-excluded norms.
 * `norms.yml`'s `skipWhen` field documents these conditions in prose;
 * this is the executable form.
 */
const SKIP_PREDICATES: Record<string, SkipPredicate> = {
  'Pediatric Heart Rate Within Bounds': (c) => c.PatientType !== 'Pediatric',
  'Pregnancy Blood Pressure Threshold': (c) => !c.IsPregnant,
  'Respiratory Rate Within Tolerance': (c) => c.PatientType === 'Pediatric',
  'Heart Rate Trend Stable': (c) => c.PreviousVitals === undefined,
  'Temperature Deviation Within Bounds': (c) =>
    c.Temperature === null || c.Temperature === undefined,
};

export interface VitalSignsAssessmentPsmPaths {
  ontologyPath: string;
  normsPath: string;
  abstractionPath: string;
  evaluationPath: string;
  selectionPath: string;
}

/**
 * Vital signs validity Assessment PSM. Uses an illustrative, reduced
 * knowledge base - see `knowledge/health/vital-signs-assessment/norms.yml`.
 * Every norm either passes or fails; a failing norm always sends the
 * verdict to Review (no soft-fail/tolerance distinction), so this only
 * needs to override `updateSpecify` and can rely on the base class's
 * default `buildResult`.
 */
export class VitalSignsAssessmentPsm extends AssessmentWithAbstractionPsm {
  /**
   * `vitalsPaths.selectionPath` is not fetched here: it's prose
   * documentation of the skip conditions below, not a second source of
   * truth the engine needs to join into the `specify` step's knowledge
   * text - doing so would merge two YAML/markdown documents into one
   * unparseable blob.
   */
  constructor(private readonly vitalsPaths: VitalSignsAssessmentPsmPaths) {
    super(vitalsPaths);
  }

  protected override updateSpecify(normsFileContent: string, state: TaskState): string {
    const caseData = state.caseData as VitalSignsInput;
    const parsed = parseYaml(normsFileContent) as { norms: VitalSignsNorm[] };

    const applicable = parsed.norms.filter((norm) => {
      const skip = SKIP_PREDICATES[norm.name];
      return !skip || !skip(caseData);
    });

    return applicable
      .map((norm) => `- ${norm.name} (field: ${norm.fieldName}): ${norm.condition}`)
      .join('\n');
  }
}
