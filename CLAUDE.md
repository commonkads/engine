# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A runtime for executing knowledge-intensive tasks by combining reusable CommonKADS
problem-solving method (PSM) templates with domain knowledge that lives entirely outside the
code (in `knowledge/`), retrieved at runtime and handed to an LLM (or evaluated
deterministically) to produce an auditable result. Full rationale: `README.md`. Original
requirements/design/task breakdown (kept in sync with the implementation): `specs/initial-engine/`.


## Architecture

### Task Execution Loop

`RuntimeEngine.execute(psm, input, context)` (`src/core/engine.ts`) is the single orchestration
loop every domain runs through: it asks the `IPsmTemplate` for the next `StepDefinition`, fetches
that step's knowledge (files via `IFileStore`, and/or semantic passages via the optional
`IKnowledgeStore`, fetched in parallel and concatenated), then either feeds the knowledge text
straight back to the PSM (`step.deterministic: true`) or sends `psm.buildPrompt(...)` to
`IInferenceProvider` and parses the JSON result (non-deterministic steps). The step's output is
folded into `TaskState` via `psm.updateState`, optionally recorded to `context.auditLog`
(knowledge doc id + version per step) and `context.timings`, and the loop repeats until
`getNextStep` returns `null`. A thrown error from any step is wrapped in `TaskExecutionError`
naming the failing step.

When `context.explain` is set, `buildPrompt` asks the LLM to wrap its answer as
`{"result": ..., "_explanation": "..."}`; the engine unwraps this itself (`unwrapExplanation`)
and stores the explanation on `context.explanations[stepName]` — PSM code only ever sees the
unwrapped `result`.

### PSM templates and the override-hooks pattern

`BasePsm` (`src/knowledge/psm/base-psm.ts`) implements step *sequencing* only: each template
(`AssessmentPsm`, `DiagnosisPsm`, `MonitoringPsm`) declares a fixed, ordered `stepNames` list
(e.g. Assessment's `obtain → specify → abstract → evaluate → conclude`), and `BasePsm` walks it
using a counter stored in `TaskState`. Subclasses implement `isDeterministic`,
`knowledgeRefs`, `knowledgeSearches`, and `applyStep` (a dispatcher switching on step name).

Every step's "how do I turn this step's output into state" decision is its own overridable
`protected updateX(output, state)` hook (e.g. `updateObtain`, `updateAbstract`, `updateEvaluate`
on `AssessmentPsm`; `buildResult` for the final `conclude` step on all three templates), with a
sensible generic default in the base template. A domain subclass overrides only the specific
hook it needs — e.g. `VitalSignsAssessmentPsm` overrides `updateSpecify` to deterministically
filter `norms.yml` down to the norms applicable to the current case (patient type, pregnancy,
etc.), using plain code rather than an LLM call. **These hooks are synchronous and have no
access to `IInferenceProvider`** — PSMs hold no inference reference at all, by design. If a step's
output-processing genuinely needs an LLM, that decision belongs in the step itself
(non-deterministic + `buildPrompt`), not in an `updateX` override.

### Providers and domains

`IFileStore`, `IKnowledgeStore`, and `IInferenceProvider` (defined in `src/core/interfaces/`) are
the only seams between the engine and the outside world. `OllamaTextInference` lives under
`src/provider/ollama/`; `LocalFileStore` lives under `src/provider/local/`. Cloud provider
implementations live in separate packages. Any provider can be swapped without touching engine or PSM code.

`registerProvider(type, builder)` in `src/provider/factory.ts` lets callers add or override
providers at startup without forking the package.

A worked example (PSM subclass + wiring) lives under `src/knowledge/psm/__fixtures__/vital-signs/` — see
`docs/developer-guide.md`'s "Adding a new domain" section for the pattern.

## Building the module

In addition to the standard guidance:

- `package.json`'s `files` field ships only `dist/` — tests and fixtures are excluded
  from the published package by that allowlist (not by `.npmignore`).

## Prerequsites

- An `ANTHROPIC_API_KEY` if you plan to exercise the Claude inference provider
- An `GEMINI_API_KEY` or `GOOGLE_API_KEY` if you plan to exercise the Gemini inference provider
- AWS credentials configured in the environment if you plan to exercise the
  Bedrock/S3 providers or run the integration suite

### Module/build conventions

- Two distinct logging facilities, deliberately kept separate — don't merge or reuse one for the
  other's purpose:
  - `ILogger`/`StreamLogger`/`LevelFilterLogger` (`src/utils/logger.ts`) — wired via
    `RuntimeContext.logger`, logs PSM step execution only (what the engine itself is doing).
  - `createDiagnosticsLogger` (`src/utils/diagnostics.ts`) — general app-code debugging, backed
    by `debug` or `pino` depending on `STRATA_LOG_PROVIDER` (default `pino`; level via
    `STRATA_LOG_LEVEL`), exposing the same `ILogger` shape so call sites never depend on the
    concrete library.
- `ConsoleWriter`/`consoleWriter` (`src/utils/console-writer.ts`) — the `console.*` replacement
  for CLI-facing output; variadic like `console.log(...args)`, colors only when the destination
  stream is a real TTY. `no-console` is an enforced lint rule (`eslint.config.mjs`) — use
  `consoleWriter` instead of raw `console.*` anywhere in `src/`.

## Coding Standards

**Read [`docs/coding-standards.md`](docs/coding-standards.md) before writing or editing any code.** It contains non-negotiable rules covering imports, architecture boundaries, and quality gates that apply to every change.

## Developer Guidance

**Read [`docs/developer-guidance-backend.md`](docs/developer-guidance-backend.md) before running any commands.** It contains the full command reference, TypeScript conventions, when to run each command, and common pitfalls.

## CI Guidance

**Read [`docs/ci-guidance.md`](docs/ci-guidance.md) before writing or modifying any GitHub Actions workflow.** It defines the required Node.js version, action pinning policy, and workflow structure standards.

## Feature Workflow

**Read [`docs/feature-workflow.md`](docs/feature-workflow.md) before starting any non-trivial feature or change.** It defines the phase gate process that must be followed. Skipping or merging phases without explicit user sign-off is not permitted.

## Starting a Feature

When the user describes a new feature or asks you to start one, **immediately read `docs/feature-workflow.md` in full before writing any code, creating any files, or making any design decisions.** Then begin Phase 0 — Pre-flight exactly as the doc describes. Never advance to the next phase without explicit user sign-off. Never skip or merge phases.

If a `/feature` skill is available, the user may invoke it with `/feature <name>` to start the workflow interactively.
