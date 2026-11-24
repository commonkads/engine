---
purpose: >
  Requirements for the Knowledge Engine runtime - the core task execution loop,
  file/knowledge store abstractions, CommonKADS PSM templates (Assessment, Diagnosis,
  Monitoring), the vital signs assessment example, logging infrastructure (engine
  logging and general-purpose diagnostics logging), explain feature, audit/timing,
  the Bedrock/S3/Claude/Gemini provider implementations, and the multi-provider CLI.
---

# Requirements - Knowledge Engine Runtime

## 1. Overview

Build the runtime for the Knowledge Engine. The runtime executes knowledge tasks
using problem-solving methods (PSMs) defined in structured plain-text knowledge-base
documents. Domain knowledge (ontology, norms, abstraction logic, selection logic,
evaluation logic) is stored as files and is completely separate from engine code.

The scope covers:

- File-store and knowledge-store abstractions with local-filesystem, S3, and Bedrock
  Knowledge Base implementations.
- A core task execution engine (RuntimeEngine) that runs the Task Execution Loop.
- Three CommonKADS PSM templates: Assessment, Diagnosis, and Monitoring.
- A vital signs assessment example (knowledge base, wiring module, unit tests).
- Text inference providers for Bedrock, Claude, and Gemini, all interchangeable
  behind `ITextInference` without engine code changes.
- Logging infrastructure with level filtering for engine execution, plus a
  separate, provider-swappable diagnostics logger for general application code.
- An explain feature that requests plain-English explanations from the LLM per step.
- Audit log and step-timing instrumentation on RuntimeContext.
- A multi-provider CLI entry point (and a convenience shell wrapper) for running
  assessments against a live Bedrock, Claude, or Gemini model.
- An integration test suite that exercises the full stack against Bedrock.

---

## 2. Requirements

### REQ-1 - File Store Abstraction

**As a** knowledge engineer,
**I want** the engine to retrieve knowledge files through an abstract interface,
**so that** the storage location (local filesystem, S3, database) can be swapped
without changing engine code.

#### Acceptance Criteria (EARS)

- WHEN the engine requests a file by path, THEN the file store returns its text content.
- WHEN the requested file does not exist, THEN the file store throws a typed
  `FileNotFoundError`.
- WHEN a local file store is configured with a root directory, THEN it resolves all
  paths relative to that root.
- WHEN a new file store implementation is provided, THEN it can be injected into the
  engine without modifying engine source files.
- WHEN `readWithMeta` is called, THEN the store returns both the file content and a
  version identifier (SHA-256 hash for local files, S3 VersionId for S3 files).

---

### REQ-2 - Core Task Execution Engine

**As a** solution architect,
**I want** a core engine (RuntimeEngine) that runs the Task Execution Loop,
**so that** knowledge tasks can be executed by composing PSM templates with domain
knowledge retrieved at runtime.

The Task Execution Loop:

```txt
Task input -> map to task state
Loop until no next step:
  PSM: determine next step
  Fetch file knowledge (staticKnowledgePaths -> IFileStore)
  Fetch retrieved knowledge (knowledgeQueries -> IKnowledgeStore, optional)
  If deterministic: pass knowledge text directly to updateState
  Else: call ITextInference.infer; if explain active, unwrap explanation wrapper
  PSM: updateState with output
Map task state -> task output
Acceptance Criteria (EARS)
WHEN a task is executed, THEN the engine initialises task state from the provided
input using the PSM's input mapping.

WHEN the PSM returns a next step, THEN the engine fetches file knowledge and optional
vector knowledge in parallel, then either passes knowledge directly (deterministic) or
calls the inference capability.

WHEN an inference step completes, THEN the engine updates the task state with the
normalised output.

WHEN the PSM signals no further steps, THEN the engine maps the final task state to
the task output and returns it.

WHEN any step throws an error, THEN the engine propagates a typed TaskExecutionError
that includes the step name and original cause.

WHEN the engine is constructed, THEN it accepts IFileStore, ITextInference, and
an optional IKnowledgeStore so all providers can be swapped without changing engine
code.

WHEN context.explain is true, THEN the engine injects _explain: true into
TaskState before the loop and unwraps {result, _explanation} JSON wrappers from
LLM responses, storing explanations in context.explanations.

WHEN context.auditLog is initialised, THEN the engine appends an AuditLogEntry
(step name, deterministic flag, knowledge refs) for each step.

WHEN context.timings is initialised, THEN the engine appends a StepTiming entry
(step name, startedAt, durationMs) for each step.

REQ-3 - CommonKADS Assessment PSM Template
As a knowledge engineer,
I want a reusable Assessment PSM template,
so that any assessment task can be implemented by providing domain-specific
knowledge files without writing new orchestration code.

The Assessment PSM inference sequence:

Plaintext
obtain(case data)         <- deterministic: bind case data from input
specify(norms)            <- deterministic: select applicable norms from norms file
abstract(derived values)  <- LLM: compute derived values from abstraction knowledge
evaluate(case vs. norms)  <- LLM: evaluate each norm; return NormAssessment array
conclude(result)          <- deterministic: derive AssessmentResult from normAssessments
Acceptance Criteria (EARS)
WHEN the Assessment PSM is instantiated, THEN it accepts paths to the ontology,
norms, abstraction, and evaluation files.

WHEN each step completes, THEN its output is processed by a step-specific,
independently overridable hook - updateObtain, updateSpecify, updateAbstract,
updateEvaluate, and buildResult (conclude) - so a domain subclass can replace
any single step's output-processing logic without changing step sequencing,
prompt construction, or any other hook.

WHEN the specify step executes, THEN it passes the norms file content to
updateSpecify; subclasses can override for deterministic norm selection.

WHEN the abstract step executes, THEN it calls the LLM with the abstraction
knowledge and the default updateAbstract parses a JSON object of derived
values from the response; subclasses can override updateAbstract for more
complex derivation logic.

WHEN the evaluate step executes, THEN it calls the LLM with ontology, norms, and
evaluation knowledge and the default updateEvaluate parses a JSON array of
NormAssessment objects from the response; subclasses can override
updateEvaluate for more complex evaluation logic.

WHEN the conclude step executes, THEN the default buildResult produces an
AssessmentResult containing verdict (Pass | Review) and passed and failed
norm lists; subclasses can override buildResult for domain-specific verdict
logic.

WHEN context.explain is true, THEN the abstract and evaluate steps request the
{result, _explanation} wrapper from the LLM.

WHEN the PSM is used with a different domain, THEN only the knowledge file paths
need to change; no PSM code changes are required.

WHEN an overridden hook needs to call the inference capability itself (rather
than just process output already produced by the engine), THEN this is out of
scope for the current synchronous IPsmTemplate.updateState contract - see
Out of Scope.

REQ-4 - CommonKADS Diagnosis PSM Template
As a knowledge engineer,
I want a reusable Diagnosis PSM template,
so that fault-diagnosis tasks can be implemented by providing domain-specific
knowledge files without writing new orchestration code.

The Diagnosis PSM inference sequence:

Plaintext
observe(case data)         <- deterministic: bind observations from input
hypothesise(hypotheses)     <- deterministic: generate hypotheses from norms file
verify(hypotheses)          <- LLM: verify each hypothesis; return Hypothesis array
conclude(result)            <- deterministic: derive DiagnosisResult from hypotheses
Acceptance Criteria (EARS)
WHEN the Diagnosis PSM is instantiated, THEN it accepts paths to the ontology, norms,
abstraction, and fault-model files.

WHEN each step completes, THEN its output is processed by a step-specific,
independently overridable hook - updateObserve, updateHypothesise,
updateVerify, and buildResult (conclude) - so a domain subclass can replace
any single step's output-processing logic without changing step sequencing
or any other hook.

WHEN the verify step executes, THEN it calls the LLM with all four knowledge files
and the default updateVerify parses a JSON array of Hypothesis objects from
the response; subclasses can override updateVerify for more complex
verification logic.

WHEN the conclude step executes, THEN the default buildResult produces a
DiagnosisResult with verdict (Healthy | Fault), confirmed, refuted, and
unverified hypothesis lists; subclasses can override buildResult for
domain-specific verdict logic.

WHEN context.explain is true, THEN the verify step requests the
{result, _explanation} wrapper from the LLM.

REQ-5 - CommonKADS Monitoring PSM Template
As a knowledge engineer,
I want a reusable Monitoring PSM template,
so that continuous-monitoring tasks can be implemented by providing domain-specific
knowledge files without writing new orchestration code.

The Monitoring PSM inference sequence:

Plaintext
observe(case data)       <- deterministic: bind observations from input
compare(norms)           <- deterministic: load norms from norms file
evaluate(deviations)     <- LLM: compare observed vs. expected; return Deviation array
conclude(result)         <- deterministic: derive MonitoringResult from deviations
Acceptance Criteria (EARS)
WHEN the Monitoring PSM is instantiated, THEN it accepts paths to the ontology, norms,
abstraction, and tolerance files.

WHEN each step completes, THEN its output is processed by a step-specific,
independently overridable hook - updateObserve, updateCompare,
updateEvaluate, and buildResult (conclude) - so a domain subclass can replace
any single step's output-processing logic without changing step sequencing
or any other hook.

WHEN the evaluate step executes, THEN it calls the LLM with all four knowledge files
and the default updateEvaluate parses a JSON array of Deviation objects from
the response; subclasses can override updateEvaluate for more complex
evaluation logic.

WHEN the conclude step executes, THEN the default buildResult produces a
MonitoringResult with verdict (Normal | Warning | Breach) and the full
deviation list; subclasses can override buildResult for domain-specific
verdict logic.

WHEN context.explain is true, THEN the evaluate step requests the
{result, _explanation} wrapper from the LLM.

REQ-6 - Vital Signs Assessment - Knowledge Base
As a knowledge engineer,
I want a knowledge base for assessing vital signs validity,
so that the Assessment PSM can evaluate a patient's vital sign reading against
clinical validity norms.

The knowledge base contains four documents under
knowledge/health/vital-signs-assessment/:

Norms - the validity rules a reading must satisfy.

Abstraction - logic that derives calculated values needed by the norms.

Selection - logic that selects which norms apply to a given reading.

Evaluation - logic that evaluates each selected norm and produces a result.

A shared domain ontology lives at knowledge/ontology/health-domain.yml.

This is an illustrative, reduced rule set - not a substitute for real
clinical guidelines - chosen to exercise every mechanism the Assessment PSM
supports.

Acceptance Criteria (EARS)
WHEN the norms document is loaded, THEN it contains a norm entry for each
validity rule, each with name, fieldName, type, condition, and optional
skipWhen.

WHEN the abstraction document is loaded, THEN it describes how to derive each
calculated value referenced by the norms.

WHEN the selection document is loaded, THEN it describes the conditions under which
each conditionally-skipped norm is excluded.

WHEN the evaluation document is loaded, THEN it describes the four-step evaluation
algorithm and the pass/fail decision table.

REQ-7 - Local File Store Implementation
As a developer,
I want a local filesystem implementation of the file store,
so that the example can be run and tested without any cloud infrastructure.

Acceptance Criteria (EARS)
WHEN the local file store is constructed with a root directory path, THEN it reads
files from that directory using Node.js fs APIs.

WHEN a file is requested, THEN the store reads it asynchronously and returns its
UTF-8 text content.

WHEN the root directory does not exist at construction time, THEN the store throws
an InvalidStoreConfigError.

WHEN readWithMeta is called, THEN the store returns the content and a 12-character
SHA-256 hash of the content as the version identifier.

REQ-8 - S3 File Store Implementation
As a developer,
I want an Amazon S3 implementation of the file store,
so that the engine can read knowledge files from S3 in deployed environments.

Acceptance Criteria (EARS)
WHEN the S3 file store is constructed with a bucket name, THEN it uses the AWS SDK
S3Client to read objects.

WHEN a file is requested, THEN the store reads the S3 object and returns its UTF-8
text content.

WHEN the S3 object does not exist, THEN the store throws FileNotFoundError.

WHEN readWithMeta is called, THEN the store returns the content and the S3
VersionId as the version identifier (or 'unversioned' if absent).

REQ-9 - Bedrock Knowledge Base Store Implementation
As a developer,
I want an Amazon Bedrock Knowledge Base implementation of the knowledge store,
so that the engine can perform semantic retrieval against a vector knowledge base.

Acceptance Criteria (EARS)
WHEN the Bedrock Knowledge Base store is constructed with a knowledge base ID, THEN
it uses the BedrockAgentRuntimeClient to issue retrieve queries.

WHEN retrieve(query) is called, THEN the store returns the top-N retrieved passages
joined with \n\n---\n\n.

WHEN no results are returned, THEN the store returns an empty string.

REQ-10 - Logging Infrastructure
As a developer,
I want a structured logging interface with level filtering,
so that engine internals can be observed at configurable verbosity without coupling
to a specific logging library.

Acceptance Criteria (EARS)
WHEN a StreamLogger is constructed, THEN it writes [LEVEL] message\n to a
Writable stream (default process.stdout).

WHEN disable() is called on a StreamLogger, THEN it suppresses all output.

WHEN a LevelFilterLogger is constructed with a threshold level, THEN it forwards
only messages at or above that level to the wrapped logger.

WHEN a RuntimeContext is provided with a logger, THEN the engine logs step
names and explanations at info level.

REQ-11 - Explain Feature
As a developer,
I want the engine to optionally request plain-English explanations from the LLM
for each inference step,
so that I can understand why the engine reached a particular conclusion.

Acceptance Criteria (EARS)
WHEN context.explain is true, THEN the engine injects _explain: true into
TaskState before the loop begins.

WHEN a non-deterministic step executes with _explain active, THEN the PSM requests
a {"result": ..., "_explanation": "..."} JSON wrapper from the LLM.

WHEN the engine receives a wrapped response, THEN it extracts and stores the
_explanation in context.explanations[stepName] and passes only the inner
result to updateState.

WHEN the CLI is invoked with --explain, THEN explanations are printed after the
result as formatted markdown.

REQ-12 - Audit Log and Step Timing
As a developer,
I want the engine to record which knowledge documents were used and how long each
step took,
so that I can trace results back to specific knowledge versions and identify
performance bottlenecks.

Acceptance Criteria (EARS)
WHEN context.auditLog is initialised (empty array), THEN the engine appends an
AuditLogEntry for each step containing the step name, deterministic flag, and
knowledge refs (id + version).

WHEN context.timings is initialised (empty array), THEN the engine appends a
StepTiming entry for each step containing the step name, start timestamp, and
duration in milliseconds.

WHEN the CLI is invoked with --audit, THEN the audit log is printed after the
result as YAML.

WHEN the CLI is invoked with --timings, THEN the step timings are printed after
the result as YAML.

REQ-13 - Unit Tests
As a developer,
I want unit tests that exercise the engine, PSMs, and knowledge base without a
live LLM,
so that I can verify correctness deterministically in CI.

Acceptance Criteria (EARS)
WHEN the unit test suite runs, THEN all tests pass without any network calls.

WHEN a valid adult vital signs reading is assessed, THEN the verdict is Pass.

WHEN a reading with incomplete vitals data is assessed, THEN the verdict is Review
and the failed list contains Vitals Data Complete.

WHEN a reading with a null OxygenSaturation is assessed, THEN the verdict is
Review and the failed list contains Oxygen Saturation Reported.

WHEN a valid pediatric reading is assessed, THEN the verdict is Pass.

WHEN an adult reading with RespiratoryRate = 30 is assessed, THEN the failed list
contains Respiratory Rate Within Tolerance and the verdict is Review.

WHEN an adult reading is assessed, THEN the pediatric-only norm is excluded from the
applicable norms list.

WHEN a pediatric reading is assessed, THEN the adult-only respiratory tolerance norm
is excluded.

WHEN no previous reading is provided, THEN the previous-reading-dependent norm is
excluded.

WHEN the inference capability throws, THEN the engine wraps the error in
TaskExecutionError with the correct step name.

WHEN LlmOutput helpers are called, THEN stripFences, extractJson, and
parseJsonArray correctly handle fenced, trailing-text, and clean JSON inputs.

WHEN DiagnosisPSM is executed, THEN it sequences observe -> hypothesise -> verify ->
conclude and produces correct Healthy / Fault verdicts.

WHEN MonitoringPSM is executed, THEN it sequences observe -> compare -> evaluate ->
conclude and produces correct Normal / Warning / Breach verdicts.

WHEN the diagnostics logger's debug provider has its namespace enabled, THEN
log output is written; when the namespace is not enabled, THEN no output is
written and env-var-driven provider resolution behaves correctly.

REQ-14 - Integration Tests
As a developer,
I want integration tests that exercise the full stack against a live Bedrock model,
so that I can verify the engine produces correct results with a real LLM.

Acceptance Criteria (EARS)
WHEN the integration test suite runs against a deployed environment, THEN it uses
BedrockTextInference with a guardrail resolved from the environment name.

WHEN a valid adult reading is assessed end-to-end, THEN the verdict is Pass.

WHEN a reading with incomplete vitals data is assessed end-to-end, THEN the
verdict is Review.

WHEN a reading with a null OxygenSaturation is assessed end-to-end, THEN the
verdict is Review.

REQ-15 - CLI Entry Point
As a developer,
I want a CLI tool for running vital signs assessments against any of the
supported LLM providers,
so that I can test the engine against a live model from the command line
without editing code to switch providers.

Acceptance Criteria (EARS)
WHEN the CLI is invoked with --payload, THEN it accepts either a JSON string or a
path to a JSON file.

WHEN the CLI is invoked with --model, THEN it uses the specified model ID for the
selected provider.

WHEN the CLI is invoked with --provider, THEN it selects bedrock (default),
claude, or gemini as the inference provider; an unrecognised value is rejected
before any file or network access occurs.

WHEN the CLI is invoked with --guardrail, THEN it resolves the guardrail by name
using BedrockTextInference.withGuardrailName (Bedrock only).

WHEN the CLI is invoked with --region, THEN it is passed to the Bedrock client
(Bedrock only).

WHEN the CLI is invoked with --api-key, THEN it is passed to the Claude or
Gemini provider; omitting it falls back to the provider's own environment
variable (ANTHROPIC_API_KEY or GOOGLE_API_KEY/GEMINI_API_KEY respectively).

WHEN the CLI is invoked with --no-thinking, THEN adaptive thinking is disabled
on the Claude or Gemini provider (on by default).

WHEN the CLI is invoked with --log-level, THEN it enables engine logging at the
specified level.

WHEN the CLI is invoked with --explain, THEN explanations are printed after the
result.

WHEN the CLI is invoked with --audit, THEN the audit log is printed after the
result.

WHEN the CLI is invoked with --timings, THEN step timings are printed after the
result.

WHEN the CLI's library module (vital-signs-assessment.ts) is used standalone,
THEN a shell wrapper (bin/vital-signs-assessment.sh) can invoke the compiled CLI
with a default synthetic payload, forwarding any additional arguments (e.g.
--provider, --model) so the wrapper can be smoke-tested without hand-writing JSON.

REQ-16 - Claude Text Inference Provider
As a developer,
I want an Anthropic Claude implementation of the text inference capability,
so that the engine can run assessments against Claude models without engine
or PSM code changes.

Acceptance Criteria (EARS)
WHEN the Claude text inference provider is constructed with a model ID, THEN it
uses the Anthropic Messages API (@anthropic-ai/sdk) to perform inference.

WHEN no API key is supplied, THEN the provider falls back to the SDK's own
credential resolution (ANTHROPIC_API_KEY, an `ant auth login` profile, etc.).

WHEN the provider is constructed with the default thinking option, THEN it
requests adaptive thinking (`{type: "adaptive"}`); passing `thinking: false`
omits the thinking parameter entirely.

WHEN infer() completes, THEN it returns the concatenation of the response's
text content blocks only (thinking content is never included in the
returned string).

REQ-17 - Gemini Text Inference Provider
As a developer,
I want a Google Gemini implementation of the text inference capability,
so that the engine can run assessments against Gemini models without engine
or PSM code changes.

Acceptance Criteria (EARS)
WHEN the Gemini text inference provider is constructed with a model ID, THEN it
uses the Gemini API (@google/genai) to perform inference.

WHEN no API key is supplied, THEN the provider falls back to the SDK's own
credential resolution (GOOGLE_API_KEY, then GEMINI_API_KEY).

WHEN the provider is constructed with the default thinking option, THEN it
sets `thinkingConfig.thinkingBudget` to automatic (-1); passing `thinking:
false` sets it to disabled (0).

WHEN infer() completes, THEN it returns the response's concatenated text
(the SDK's `response.text` getter), or an empty string if none.

REQ-18 - Diagnostics Logging
As a developer,
I want a general-purpose logger for application code (CLI, providers, wiring,
etc.) that is distinct from the engine execution logger and whose backing
library can be changed without touching call sites,
so that I can add debugging visibility anywhere in the codebase without
coupling that code to a specific logging library.

Acceptance Criteria (EARS)
WHEN createDiagnosticsLogger(namespace) is called, THEN it returns an object
implementing the same ILogger contract used by the engine execution logger
(log/debug/info/warn/error).

WHEN no provider is specified, THEN the backing library is resolved from the
STRATA_LOG_PROVIDER env var (debug or pino), defaulting to pino.

WHEN the pino provider is selected, THEN messages are routed through a shared,
namespaced (child-logger) pino instance whose level is controlled by
STRATA_LOG_LEVEL (default info).

WHEN the debug provider is selected, THEN the log level is folded into the
message text and visibility is controlled by the namespace via the standard
DEBUG env var, exactly as a direct user of the `debug` package would expect.

WHEN the backing provider is changed (via STRATA_LOG_PROVIDER or a future
third provider), THEN no call site that uses createDiagnosticsLogger needs to
change, since every call site only ever depends on the ILogger contract.

3. Out of Scope
AWS CDK infrastructure for deploying the engine as a Lambda function.

Control plane API for managing knowledge files.

Data plane API for external clients.

OWL/RDF formal reasoning or SPARQL queries.

Knowledge self-validation (validating rules against the ontology).

Any service other than vital signs validity assessment.

An automated integration test suite for the Claude or Gemini providers (REQ-16,
REQ-17) - both are exercised manually via the CLI; only Bedrock has an
automated integration suite (REQ-14).

Letting a PSM's step-output hooks (REQ-3/4/5) call the inference capability
themselves. IPsmTemplate.updateState is synchronous (void) and a PSM holds
no reference to ITextInference - only RuntimeEngine does. A hook can apply
arbitrarily complex synchronous logic to the output it's given, but
triggering another LLM call from within one would require a larger change
(an async updateState contract and an injected inference capability).