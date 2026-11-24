---
purpose: >
  Requirements for making the strata-engine CLI generic: able to run any knowledge
  base pointed to at runtime, rather than being hard-wired to the bundled vital-signs
  example. Covers the domain manifest format, generic CLI command, and the repositioning
  of the vital-signs domain as a standalone example.
---

# Requirements — Generic CLI

## 1. Overview

The CLI shipped with `strata-engine` is currently hard-wired to the bundled
vital-signs assessment domain. Running any other knowledge base requires writing
TypeScript code that imports engine internals, compiles it, and invokes it directly.

This feature makes the CLI domain-agnostic: a user points it at a knowledge root
directory that contains a small manifest file describing which PSM template to use
and where its knowledge files live. The CLI reads the manifest, wires up the
correct PSM, and executes the task — no TypeScript required on the caller's side.

As a side-effect, the vital-signs knowledge base is repositioned as a self-contained
example that lives alongside the engine but is not its core concern. The engine's
published package still ships the example knowledge so users have something to run
out of the box, but the CLI no longer assumes it.

---

## 2. Requirements

### REQ-G1 — Domain Manifest

**As a** knowledge engineer,
**I want** to describe a domain in a single YAML file inside my knowledge root,
**so that** the CLI can wire up the correct PSM without any code.

#### Acceptance Criteria (EARS)

- WHEN a knowledge root contains a `domain.yml` at its top level, THEN the CLI
  treats it as a valid domain.
- WHEN `domain.yml` specifies `psm: assessment`, THEN the CLI instantiates
  `AssessmentPsm` (or its configured subclass).
- WHEN `domain.yml` specifies `psm: diagnosis`, THEN the CLI instantiates
  `DiagnosisPsm`.
- WHEN `domain.yml` specifies `psm: monitoring`, THEN the CLI instantiates
  `MonitoringPsm`.
- WHEN `domain.yml` is missing or does not contain a `psm` field, THEN the CLI
  exits with a clear error message before attempting execution.
- WHEN `domain.yml` lists knowledge file paths for each PSM step, THEN those
  paths are resolved relative to the knowledge root.
- WHEN a referenced knowledge file does not exist at startup, THEN the CLI exits
  with an error naming the missing path before the engine executes any step.

#### Manifest format (illustrative)

```yaml
# domain.yml
name: Vital Signs Assessment       # human label, used in CLI output
psm: assessment                    # assessment | diagnosis | monitoring

# File paths resolved relative to the knowledge root directory.
# Keys map to the constructor parameters of the chosen PSM template.
knowledge:
  ontologyPath: ontology/health-domain.yml
  normsPath: health/vital-signs-assessment/norms.yml
  abstractionPath: health/vital-signs-assessment/abstraction.md
  evaluationPath: health/vital-signs-assessment/evaluation.md
  selectionPath: health/vital-signs-assessment/selection.md
```

---

### REQ-G2 — Generic CLI Command

**As a** developer or knowledge engineer,
**I want** to run any knowledge base from the command line by pointing at its root
directory,
**so that** I can test and run domains without writing engine-specific code.

#### Acceptance Criteria (EARS)

- WHEN `--knowledge-root <path>` is provided, THEN the CLI reads `domain.yml`
  from that path and wires up the corresponding PSM and `LocalFileStore`.
- WHEN `--knowledge-root` is omitted, THEN the CLI falls back to the bundled
  vital-signs example (preserving the existing out-of-the-box behaviour).
- WHEN `--payload <jsonOrPath>` is provided, THEN it is passed as the task input
  exactly as today.
- WHEN `--provider`, `--model`, `--guardrail`, `--region`, `--api-key`,
  `--thinking`, `--log-level`, `--explain`, `--audit`, and `--timings` are
  provided, THEN they behave identically to the current implementation.
- WHEN the engine produces a result, THEN it is printed as formatted JSON to
  stdout, followed by any requested explain/audit/timings sections.
- WHEN the domain name from `domain.yml` is non-empty, THEN it is printed as a
  header line before the result so the user can confirm which domain ran.

---

### REQ-G3 — Vital-Signs Domain Repositioned as Example

**As a** new user,
**I want** a working example domain bundled with the engine,
**so that** I can run `strata-engine` immediately after installation without
providing my own knowledge base.

#### Acceptance Criteria (EARS)

- WHEN the engine package is installed, THEN the `knowledge/` directory ships
  inside it as before, containing the vital-signs example.
- WHEN `strata-engine` is invoked with no `--knowledge-root`, THEN it runs the
  bundled vital-signs example (equivalent to
  `--knowledge-root <package>/knowledge`).
- WHEN the `engine/src/domains/` directory is referenced in documentation,
  THEN it is described as an illustrative example of a domain subclass, not
  as a required pattern for using the engine.
- WHEN a domain subclass is not needed (i.e., the base PSM behaviour is
  sufficient), THEN `domain.yml` alone plus knowledge files is enough to run
  a domain — no TypeScript subclass is required.

---

### REQ-G4 — Manifest Validation Errors

**As a** knowledge engineer debugging a misconfigured domain,
**I want** the CLI to report manifest and file-existence errors clearly,
**so that** I can fix them without reading engine source code.

#### Acceptance Criteria (EARS)

- WHEN `domain.yml` contains an unrecognised `psm` value, THEN the error message
  lists the valid values (`assessment`, `diagnosis`, `monitoring`).
- WHEN a `knowledge` path listed in `domain.yml` does not exist on disk, THEN
  the error message includes the absolute path that was checked.
- WHEN multiple paths are missing, THEN all missing paths are reported in a
  single error, not one at a time.
- WHEN the YAML is malformed, THEN the error message includes the parse error
  from the YAML library.

---

## 3. Out of scope

- Remote knowledge roots (S3, HTTP). The generic CLI targets `LocalFileStore` only;
  `S3FileStore` support can be added in a follow-on.
- Dynamic PSM subclass loading (i.e., pointing the CLI at a compiled `.js` module
  that exports a custom PSM). The generator package (`strata-generator`) is the
  intended path for domains that require deterministic override hooks; those domains
  would run via their own generated entry point.
- Knowledge base discovery / listing. The CLI always requires an explicit
  `--knowledge-root` (or uses the default example); it does not scan for domains.
