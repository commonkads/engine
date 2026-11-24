# Implementation Tasks - Knowledge Engine Runtime

This document outlines the tasks required to implement the Knowledge Engine Runtime based on the [Requirements](./requirements.md) and [Design](./design.md).

## Milestone 1: Core Foundation & File Storage

- [x] **Task 1.1: Define Core Interfaces and Types**
  - Define `IFileStore`, `ITextInference`, `IKnowledgeStore`, and `IPsmTemplate`.
  - Define `TaskState`, `StepDefinition`, `AuditLogEntry`, and `StepTiming` types.
  - *Reference: REQ-1, REQ-2*

- [x] **Task 1.2: Implement Local File Storage**
  - Create `LocalFileStore` using Node.js `fs`.
  - Implement SHA-256 version identifier for `readWithMeta`.
  - *Reference: REQ-7*

- [x] **Task 1.3: Implement Logging Infrastructure**
  - Create `StreamLogger` and `LevelFilterLogger`.
  - Ensure support for log levels (info, debug, error).
  - *Reference: REQ-10*

- [x] **Task 1.4: Implement Runtime Context**
  - Create `RuntimeContext` class to track `auditLog`, `timings`, and `explanations`.
  - *Reference: REQ-12*

## Milestone 2: Runtime Engine & PSM Templates

- [x] **Task 2.1: Implement Runtime Engine Core Loop**
  - Implement the Task Execution Loop in `RuntimeEngine`.
  - Handle parallel knowledge fetching (File + Knowledge stores).
  - Integrate audit logging and timing instrumentation.
  - *Reference: REQ-2*

- [x] **Task 2.2: Implement LLM Helper Utilities**
  - Create helpers to strip Markdown fences and parse JSON from LLM strings.
  - Implement the "Explain" unwrapper logic for the engine.
  - *Reference: REQ-11, REQ-13*

- [x] **Task 2.3: Implement Assessment PSM Template**
  - Implement `AssessmentPsm` (obtain -> specify -> abstract -> evaluate -> conclude).
  - *Reference: REQ-3*

- [x] **Task 2.4: Implement Diagnosis and Monitoring PSM Templates**
  - Implement `DiagnosisPsm` (observe -> hypothesise -> verify -> conclude).
  - Implement `MonitoringPsm` (observe -> compare -> evaluate -> conclude).
  - *Reference: REQ-4, REQ-5*

## Milestone 3: AWS & Inference Providers

- [x] **Task 3.1: Implement Bedrock Text Inference**
  - Create `BedrockTextInference` using `@aws-sdk/client-bedrock-runtime`.
  - Support system prompts, a named-guardrail factory, and JSON formatting.
  - *Reference: REQ-11, REQ-16 class diagram*

- [x] **Task 3.2: Implement S3 File Store**
  - Create `S3FileStore` using `@aws-sdk/client-s3`.
  - Support S3 VersionId for metadata.
  - *Reference: REQ-8*

- [x] **Task 3.3: Implement Bedrock Knowledge Base Store**
  - Create `BedrockKnowledgeStore` using `@aws-sdk/client-bedrock-agent-runtime`.
  - *Reference: REQ-9*

## Milestone 4: Domain Knowledge & CLI

- [x] **Task 4.1: Author Vital Signs Assessment Knowledge Base**
  - Create the norms, abstraction rules, and selection/evaluation logic in plaintext files.
  - Place in `knowledge/health/vital-signs-assessment/`.
  - *Reference: REQ-6*

- [x] **Task 4.2: Implement CLI Entry Point**
  - Build the CLI tool using `commander`.
  - Support `--payload`, `--model`, `--explain`, `--audit`, and `--timings`.
  - *Reference: REQ-15*

## Milestone 5: Testing

- [x] **Task 5.1: Implement Unit Test Suite**
  - Test all PSM templates with deterministic mocks.
  - Test `RuntimeEngine` error handling and loop logic.
  - Test File Store resolution and versioning.
  - *Reference: REQ-13*

- [x] **Task 5.2: Implement Integration Test Suite**
  - Run end-to-end assessments against a live Bedrock model.
  - *Reference: REQ-14*

## Milestone 6: Additional Providers, Multi-Provider CLI & Tooling

- [x] **Task 6.1: Implement Claude Text Inference Provider**
  - Create `ClaudeTextInference` using `@anthropic-ai/sdk`, adaptive thinking on by default.
  - *Reference: REQ-16*

- [x] **Task 6.2: Implement Gemini Text Inference Provider**
  - Create `GeminiTextInference` using `@google/genai`, automatic thinking budget by default.
  - *Reference: REQ-17*

- [x] **Task 6.3: Add Multi-Provider Selection to the CLI**
  - Add `--provider bedrock|claude|gemini`, `--api-key`, and `--no-thinking` to both the
    commander entry point and the underlying `vital-signs-assessment.ts` module.
  - *Reference: REQ-15*

- [x] **Task 6.4: Add `bin/vital-signs-assessment.sh` Wrapper Script**
  - Supplies a default synthetic payload and forwards all other arguments to the
    compiled CLI, so it can be smoke-tested without hand-writing JSON.
  - *Reference: REQ-15*

- [x] **Task 6.5: Implement Diagnostics Logging**
  - Create `createDiagnosticsLogger(namespace)` in `src/utils/diagnostics.ts`, backed by
    `debug` or `pino` depending on `STRATA_LOG_PROVIDER` (default `pino`), sharing the
    `ILogger` contract with the engine execution logger.
  - Wire it into the three inference providers and the CLI as representative call sites.
  - *Reference: REQ-18*

- [x] **Task 6.6: Reorganise `src/` Around Directory Barrels**
  - Add an `index.ts` barrel to every multi-file directory under `src/` (except `cli/`,
    whose `index.ts` is the actual bin executable).
  - Rewrite every cross-directory import to go through the target directory's barrel;
    same-directory sibling imports stay direct to avoid circular imports through the barrel.
  - *Reference: design.md §5 (File Structure)*

- [x] **Task 6.7: Generalise Per-Step Override Hooks Across All PSM Templates**
  - Add `updateObtain`/`updateAbstract`/`updateEvaluate` to `AssessmentPsm` and the
    analogous `updateObserve`/`updateHypothesise`/`updateVerify`/`updateCompare` hooks to
    `DiagnosisPsm`/`MonitoringPsm`, so every step's output-processing decision is
    independently overridable, matching the existing `updateSpecify`/`buildResult` pattern.
    `applyStep` is now a thin dispatcher with no inline logic.
  - *Reference: REQ-3, REQ-4, REQ-5; design.md §3.4*
