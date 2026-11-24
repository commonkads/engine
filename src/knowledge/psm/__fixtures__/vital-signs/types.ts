export type PatientType = 'Adult' | 'Pediatric';

/** Case data for a vital signs validity assessment. */
export interface VitalSignsInput {
  PatientType: PatientType;
  HeartRate: number;
  BloodPressureSystolic: number;
  RespiratoryRate: number;
  Temperature: number | null;
  OxygenSaturation: number | null;
  IsPregnant?: boolean;
  VitalsDataIncomplete?: boolean;
  PreviousVitals?: { HeartRate: number };
}

/** One entry in `norms.yml`. */
export interface VitalSignsNorm {
  name: string;
  fieldName: string;
  type: string;
  condition: string;
  skipWhen?: string;
}
