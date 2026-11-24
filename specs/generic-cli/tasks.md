# Implementation Tasks — Generic CLI

Based on [requirements](./requirements.md) and [design](./design.md).

## Milestone 1: Manifest Infrastructure

- [ ] **Task 1.1: Add `domain.yml` to bundled knowledge example**
  - Create `knowledge/domain.yml` with `psm: assessment` and paths matching
    the current `createVitalSignsAssessment()` wiring.
  - *Reference: REQ-G3*

- [ ] **Task 1.2: Implement `DomainManifest` type and `DomainManifestError`**
  - Create `src/cli/manifest.ts`.
  - Define `PsmType` union, `DomainManifest` interface, `DomainManifestError` class.
  - *Reference: REQ-G1, REQ-G4; design §3.1*

- [ ] **Task 1.3: Implement `loadDomainManifest`**
  - Read and parse `domain.yml` from the knowledge root (YAML).
  - Validate `psm` value against the allowed union.
  - Validate all required `knowledge` keys for the chosen PSM type are present.
  - Resolve and check all knowledge file paths exist on disk; collect all missing
    paths before throwing.
  - *Reference: REQ-G1, REQ-G4; design §3.1*

- [ ] **Task 1.4: Unit-test `loadDomainManifest`**
  - Valid manifest for each PSM type resolves successfully.
  - Missing `domain.yml` → error message names the file.
  - Malformed YAML → error includes the parse error.
  - Unknown `psm` value → error lists valid values.
  - Missing required `knowledge` key → error names all missing keys at once.
  - One or more knowledge files not found on disk → error names all missing paths.
  - *Reference: REQ-G4*

## Milestone 2: Generic Runner

- [ ] **Task 2.1: Extract `buildInference` to `src/cli/inference-factory.ts`**
  - Move the function from `vital-signs-assessment.ts` into the new module.
  - Update `vital-signs-assessment.ts` to import from it.
  - *Reference: design §3.3*

- [ ] **Task 2.2: Implement `runDomain` in `src/cli/domain-runner.ts`**
  - Call `loadDomainManifest`, instantiate PSM via factory switch, construct
    `LocalFileStore`, delegate to shared output logic.
  - Print `## <name>` header when `manifest.name` is non-empty.
  - *Reference: REQ-G2; design §3.2*

- [ ] **Task 2.3: Update `src/cli/index.ts`**
  - Add `--knowledge-root <path>` optional option.
  - Update description to "Run a knowledge task against a PSM-driven knowledge base".
  - Dispatch to `runDomain` when `--knowledge-root` is provided; fall back to
    `runVitalSignsAssessment` otherwise.
  - Catch `DomainManifestError` and call `program.error()` for clean exit(1).
  - *Reference: REQ-G2; design §4*

## Milestone 3: Validation & Smoke Test

- [ ] **Task 3.1: Smoke-test the generic path end-to-end**
  - Run `strata-engine --knowledge-root ./knowledge --payload <json> --model <id>`
    against the bundled example and confirm it produces the same result as the
    no-arg path.
  - Confirm `--knowledge-root` with a missing `domain.yml` exits with a clear error.
  - Confirm `--knowledge-root` with an unknown `psm` value exits with a clear error.

- [ ] **Task 3.2: Update developer-guide**
  - Add a "Running a custom domain" section showing the `domain.yml` format and
    a sample invocation.
  - Update the "Adding a new domain" section to note that a TypeScript subclass is
    only needed for deterministic override hooks.
  - *Reference: REQ-G3*
