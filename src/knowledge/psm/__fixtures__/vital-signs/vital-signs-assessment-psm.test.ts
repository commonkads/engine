import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { RuntimeContext, type RuntimeContextOptions } from '../../../../core/context.js';
import { RuntimeEngine } from '../../../../core/engine.js';
import type { ICatalog } from '../../../../catalog/i-catalog.js';
import type { InferenceProvider } from '../../../../core/index.js';
import type { InferenceOptions } from '../../../../core/index.js';
import { createVitalSignsAssessment } from './wiring.js';
import type { VitalSignsInput } from './types.js';
import type { AssessmentResult } from '../../assessment-with-abstraction-psm.js';

interface FakeNormResult {
  name: string;
  result: 'Pass' | 'Fail';
  reason: string;
}

function evaluateNorm(
  name: string,
  input: VitalSignsInput,
  derived: Record<string, unknown>,
): FakeNormResult {
  switch (name) {
    case 'Vitals Data Complete':
      return {
        name,
        result: input.VitalsDataIncomplete ? 'Fail' : 'Pass',
        reason: 'checked VitalsDataIncomplete',
      };
    case 'Oxygen Saturation Reported':
      return {
        name,
        result: input.OxygenSaturation === null ? 'Fail' : 'Pass',
        reason: 'checked OxygenSaturation',
      };
    case 'Heart Rate Within Bounds':
      return {
        name,
        result: input.HeartRate >= 40 && input.HeartRate <= 180 ? 'Pass' : 'Fail',
        reason: 'checked HeartRate',
      };
    case 'Pediatric Heart Rate Within Bounds':
      return {
        name,
        result: input.HeartRate >= 70 && input.HeartRate <= 120 ? 'Pass' : 'Fail',
        reason: 'checked HeartRate',
      };
    case 'Pregnancy Blood Pressure Threshold':
      return {
        name,
        result: input.BloodPressureSystolic < 140 ? 'Pass' : 'Fail',
        reason: 'checked BloodPressureSystolic',
      };
    case 'Respiratory Rate Within Tolerance':
      return {
        name,
        result: input.RespiratoryRate <= 24 ? 'Pass' : 'Fail',
        reason: 'checked RespiratoryRate',
      };
    case 'Heart Rate Trend Stable':
      return {
        name,
        result:
          Math.abs(input.HeartRate - (input.PreviousVitals?.HeartRate ?? input.HeartRate)) <= 20
            ? 'Pass'
            : 'Fail',
        reason: 'checked HeartRate trend',
      };
    case 'Temperature Deviation Within Bounds': {
      const deviation = derived.TemperatureDeviationFromNormal as number | undefined;
      return {
        name,
        result: deviation !== undefined && deviation <= 1.5 ? 'Pass' : 'Fail',
        reason: 'checked deviation',
      };
    }
    default:
      throw new Error(`no fake evaluator for norm "${name}"`);
  }
}

/** Stands in for the LLM: deterministically evaluates whichever norms the PSM actually selected. */
function createFakeVitalsInference(input: VitalSignsInput): InferenceProvider {
  const derived: Record<string, unknown> =
    input.Temperature === null || input.Temperature === undefined
      ? {}
      : { TemperatureDeviationFromNormal: Math.abs(input.Temperature - 37.0) };

  return {
    async infer(prompt: string, options?: InferenceOptions) {
      const isEvaluateStep = prompt.includes('## Derived Values');
      const value = isEvaluateStep
        ? Array.from(prompt.matchAll(/^- ([^(]+) \(field:/gm)).map((m) =>
            evaluateNorm(m[1].trim(), input, derived),
          )
        : derived;

      return options?.explain
        ? JSON.stringify({ result: value, _explanation: 'stub explanation' })
        : JSON.stringify(value);
    },
  };
}

async function assess(
  input: VitalSignsInput,
  contextOptions: RuntimeContextOptions = {},
): Promise<{ result: AssessmentResult; context: RuntimeContext }> {
  const require = createRequire(import.meta.url);
  const knowledgeRoot = join(
    dirname(require.resolve('@commonkads/knowledge-examples/package.json')),
    'knowledge/vital-signs',
  );
  const { psm, fileStore } = createVitalSignsAssessment(knowledgeRoot);
  const engine = new RuntimeEngine(createFakeVitalsInference(input));
  const catalog: ICatalog = {
    getTask: () => Promise.reject(new Error('getTask not used in PSM tests')),
    getModel: (id) => fileStore.readWithVersion(id),
  };
  const context = new RuntimeContext({ ...contextOptions, catalog });
  const result = (await engine.execute(
    { name: 'assessment', psm },
    input,
    context,
  )) as AssessmentResult;
  return { result, context };
}

const validAdult: VitalSignsInput = {
  PatientType: 'Adult',
  HeartRate: 75,
  BloodPressureSystolic: 118,
  RespiratoryRate: 16,
  Temperature: 37.0,
  OxygenSaturation: 98,
  IsPregnant: false,
  VitalsDataIncomplete: false,
};

const validPediatric: VitalSignsInput = {
  PatientType: 'Pediatric',
  HeartRate: 95,
  BloodPressureSystolic: 100,
  RespiratoryRate: 22,
  Temperature: 37.0,
  OxygenSaturation: 99,
  VitalsDataIncomplete: false,
};

describe('VitalSignsAssessmentPsm', () => {
  it('passes a valid adult reading', async () => {
    const { result } = await assess(validAdult);
    assert.strictEqual(result.verdict, 'Pass');
  });

  it('sends incomplete vitals data to Review', async () => {
    const { result } = await assess({ ...validAdult, VitalsDataIncomplete: true });
    assert.strictEqual(result.verdict, 'Review');
    assert.ok(result.failed.includes('Vitals Data Complete'));
  });

  it('sends a null OxygenSaturation to Review', async () => {
    const { result } = await assess({ ...validAdult, OxygenSaturation: null });
    assert.strictEqual(result.verdict, 'Review');
    assert.ok(result.failed.includes('Oxygen Saturation Reported'));
  });

  it('excludes the temperature deviation norm when Temperature is null', async () => {
    const { result } = await assess({ ...validAdult, Temperature: null });
    const all = [...result.passed, ...result.failed];
    assert.ok(!all.includes('Temperature Deviation Within Bounds'));
  });

  it('passes a valid pediatric reading', async () => {
    const { result } = await assess(validPediatric);
    assert.strictEqual(result.verdict, 'Pass');
  });

  it('sends an elevated RespiratoryRate to Review', async () => {
    const { result } = await assess({ ...validAdult, RespiratoryRate: 30 });
    assert.ok(result.failed.includes('Respiratory Rate Within Tolerance'));
    assert.strictEqual(result.verdict, 'Review');
  });

  it('flags a pregnancy blood pressure threshold breach as Review', async () => {
    const { result } = await assess({
      ...validAdult,
      IsPregnant: true,
      BloodPressureSystolic: 150,
    });
    assert.ok(result.failed.includes('Pregnancy Blood Pressure Threshold'));
    assert.strictEqual(result.verdict, 'Review');
  });

  it('excludes the pregnancy norm when IsPregnant is not true', async () => {
    const { result } = await assess(validAdult);
    const all = [...result.passed, ...result.failed];
    assert.ok(!all.includes('Pregnancy Blood Pressure Threshold'));
  });

  it('excludes the pediatric-only norm for an adult reading', async () => {
    const { result } = await assess(validAdult);
    const all = [...result.passed, ...result.failed];
    assert.ok(!all.includes('Pediatric Heart Rate Within Bounds'));
  });

  it('excludes the adult-only respiratory tolerance norm for a pediatric reading', async () => {
    const { result } = await assess(validPediatric);
    const all = [...result.passed, ...result.failed];
    assert.ok(!all.includes('Respiratory Rate Within Tolerance'));
  });

  it('excludes the previous-reading-dependent norm when none is provided', async () => {
    const { result } = await assess(validAdult);
    const all = [...result.passed, ...result.failed];
    assert.ok(!all.includes('Heart Rate Trend Stable'));
  });

  it('evaluates the previous-reading-dependent norm when a previous reading is provided', async () => {
    const { result } = await assess({ ...validAdult, PreviousVitals: { HeartRate: 78 } });
    assert.ok(result.passed.includes('Heart Rate Trend Stable'));
  });

  it('collects explanations for the abstract and evaluate steps when explain is enabled', async () => {
    const { context } = await assess(validAdult, { explain: true });
    assert.strictEqual(context.explanations.abstract, 'stub explanation');
    assert.strictEqual(context.explanations.evaluate, 'stub explanation');
  });
});
