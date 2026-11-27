/** One entry per executed step, recording how long it took. */
export interface StepTiming {
  step: string;
  startedAt: number;
  durationMs: number;
}
