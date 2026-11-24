---
purpose: >
  Requirements for multi-provider integration tests across all three example domains
  (vital-signs, car-diagnosis, server-monitoring) and a generic example runner
  shell script that replaces the vital-signs-specific bin script.
---

# Requirements — Integration Tests & Generic Example Runner

## 1. Overview

The current integration test suite exercises only the vital-signs Assessment domain
and only against Bedrock. This feature extends it to:

- Run against any of the three configured inference providers (Bedrock, Claude, Gemini)
  depending on which environment variables are set.
- Exercise all three example domains — vital-signs (Assessment), car-diagnosis
  (Diagnosis), and server-monitoring (Monitoring) — with representative test cases
  for each.
- Replace the `bin/vital-signs-assessment.sh` script with a generic `bin/run-example.sh`
  that can launch any of the three examples by name.

---

## 2. Requirements

### REQ-I1 — Multi-Provider Integration Test Configuration

**As a** developer running integration tests,
**I want** the suite to pick an inference provider automatically based on environment
variables,
**so that** I can run tests against Bedrock, Claude, or Gemini without editing code.

#### Acceptance Criteria (EARS)

- WHEN `STRATA_BEDROCK_MODEL_ID` is set, THEN the integration suite uses
  `BedrockTextInference` with that model ID.
- WHEN `STRATA_CLAUDE_MODEL_ID` is set, THEN the suite uses `ClaudeTextInference`
  with that model ID (falling back to `ANTHROPIC_API_KEY` for the key).
- WHEN `STRATA_GEMINI_MODEL_ID` is set, THEN the suite uses `GeminiTextInference`
  with that model ID (falling back to `GOOGLE_API_KEY` / `GEMINI_API_KEY` for the key).
- WHEN more than one provider variable is set, THEN Bedrock takes precedence over
  Claude, which takes precedence over Gemini.
- WHEN no provider variable is set, THEN every integration test suite self-skips
  (no failure, no false green).
- WHEN `STRATA_GUARDRAIL_NAME` is set alongside `STRATA_BEDROCK_MODEL_ID`, THEN the
  Bedrock provider uses the named guardrail (existing behaviour, preserved).

---

### REQ-I2 — Car Diagnosis Integration Tests

**As a** developer,
**I want** integration tests that run the car-diagnosis domain against a live LLM,
**so that** the Diagnosis PSM and its knowledge files are exercised end to end.

#### Acceptance Criteria (EARS)

- WHEN a case with unambiguous electrical symptoms (no crank, dim lights) is submitted,
  THEN the result has verdict `Fault` with "Dead or Discharged Battery" confirmed.
- WHEN a case with cooling symptoms only (overheating, full coolant) is submitted,
  THEN the result has verdict `Fault` with a cooling hypothesis confirmed.
- WHEN a case with no reported symptoms is submitted,
  THEN the result has verdict `Healthy` with no confirmed hypotheses.

---

### REQ-I3 — Server Monitoring Integration Tests

**As a** developer,
**I want** integration tests that run the server-monitoring domain against a live LLM,
**so that** the Monitoring PSM and its knowledge files are exercised end to end.

#### Acceptance Criteria (EARS)

- WHEN all metrics are within normal thresholds, THEN the result has verdict `Normal`.
- WHEN one or more metrics exceed the warning threshold but none exceed breach,
  THEN the result has verdict `Warning`.
- WHEN one or more metrics exceed the breach threshold, THEN the result has
  verdict `Breach`.

---

### REQ-I4 — Generic Example Runner Script

**As a** developer smoke-testing the CLI,
**I want** a single shell script that can launch any of the bundled examples by name,
**so that** I do not need to hand-write payloads or remember knowledge root paths.

#### Acceptance Criteria (EARS)

- WHEN `--domain vital-signs` (or no `--domain`) is provided, THEN the script runs
  the vital-signs assessment with its default adult payload.
- WHEN `--domain car-diagnosis` is provided, THEN the script runs the car-diagnosis
  domain with a default dead-battery symptom payload.
- WHEN `--domain server-monitoring` is provided, THEN the script runs the
  server-monitoring domain with a default mixed-severity metric payload.
- WHEN an unrecognised `--domain` value is given, THEN the script prints a usage
  error and exits non-zero.
- WHEN `--payload` is supplied by the caller, THEN it overrides the default payload
  (commander last-occurrence rule already handles this).
- WHEN `--model` is not supplied, THEN the script exits with an error (unchanged).
- The script is named `bin/run-example.sh`; `bin/vital-signs-assessment.sh` is removed.
