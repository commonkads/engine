import { LocalFileStore } from '../../../../provider/local/local-file-store.js';
import { VitalSignsAssessmentPsm } from './vital-signs-assessment-psm.js';

export interface VitalSignsAssessmentSetup {
  psm: VitalSignsAssessmentPsm;
  fileStore: LocalFileStore;
}

/** Wires up the Vital Signs Assessment PSM against the local knowledge base. */
export function createVitalSignsAssessment(knowledgeRoot: string): VitalSignsAssessmentSetup {
  return {
    psm: new VitalSignsAssessmentPsm({
      ontologyPath: 'ontology/health-domain.yml',
      normsPath: 'health/vital-signs-assessment/norms.yml',
      abstractionPath: 'health/vital-signs-assessment/abstraction.md',
      evaluationPath: 'health/vital-signs-assessment/evaluation.md',
      selectionPath: 'health/vital-signs-assessment/selection.md',
    }),
    fileStore: new LocalFileStore(knowledgeRoot),
  };
}
