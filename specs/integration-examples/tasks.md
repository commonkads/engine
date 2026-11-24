# Implementation Tasks — Integration Tests & Generic Example Runner

Based on [requirements](./requirements.md) and [design](./design.md).

## Milestone 1: Shared Infrastructure

- [ ] **Task 1.1: Implement `test/integration/support/inference.ts`**
  - Export `resolveIntegrationInference()` returning the first matching provider
    or `null` when no provider env var is set.
  - Resolution order: Bedrock → Claude → Gemini.
  - Preserve `STRATA_GUARDRAIL_NAME` / `AWS_REGION` for Bedrock.
  - *Reference: REQ-I1; design §1*

- [ ] **Task 1.2: Implement `test/integration/support/examples.ts`**
  - Export `resolveExampleRoot(domainName)` resolving `examples/<domainName>`
    relative to the package root from the test file's location.
  - *Reference: design §2*

- [ ] **Task 1.3: Update `vital-signs-assessment.integration.test.ts`**
  - Replace hardcoded `BedrockTextInference` construction with
    `resolveIntegrationInference()` from the new support module.
  - Drive `describeIntegration` from the resolver returning non-null.
  - Keep all three existing test cases unchanged.
  - *Reference: REQ-I1; design §3*

## Milestone 2: New Integration Test Suites

- [ ] **Task 2.1: Implement `car-diagnosis.integration.test.ts`**
  - Use `resolveExampleRoot` + `loadDomainManifest` to load the domain.
  - Instantiate `DiagnosisPsm` and `LocalFileStore` directly.
  - Three test cases: dead battery (Fault), overheating/thermostat (Fault), no
    symptoms (Healthy).
  - Timeout: 60 000 ms per test.
  - *Reference: REQ-I2; design §4*

- [ ] **Task 2.2: Implement `server-monitoring.integration.test.ts`**
  - Use `resolveExampleRoot` + `loadDomainManifest` to load the domain.
  - Instantiate `MonitoringPsm` and `LocalFileStore` directly.
  - Three test cases: all normal (Normal), warning-level metrics (Warning),
    breach-level metrics (Breach).
  - Timeout: 60 000 ms per test.
  - *Reference: REQ-I3; design §4*

## Milestone 3: Generic Bin Script

- [ ] **Task 3.1: Write `bin/run-example.sh`**
  - Parse `--domain` from arguments; default to `vital-signs`.
  - Map domain name to `--knowledge-root` path and default `--payload`.
  - Validate domain name; print usage and exit 1 on unrecognised value.
  - Strip `--domain <value>` before forwarding to `node dist/cli/index.js`.
  - *Reference: REQ-I4; design §5*

- [ ] **Task 3.2: Delete `bin/vital-signs-assessment.sh`**
  - *Reference: REQ-I4*

## Milestone 4: Documentation

- [ ] **Task 4.1: Update `docs/developer-guide.md`**
  - Add `STRATA_CLAUDE_MODEL_ID` and `STRATA_GEMINI_MODEL_ID` to the integration
    test environment variable table.
  - Replace `bin/vital-signs-assessment.sh` references with `bin/run-example.sh`
    and show all three `--domain` options.
  - *Reference: design §7*
