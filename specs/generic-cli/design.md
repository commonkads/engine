# Implementation Design — Generic CLI

## 1. Overview

Three changes deliver the generic CLI:

1. A `domain.yml` manifest is added to the bundled `knowledge/` example so the
   existing vital-signs domain is self-describing.
2. A new `src/cli/manifest.ts` module reads, validates, and types the manifest.
3. `src/cli/index.ts` gains a `--knowledge-root` option; when provided it
   delegates to a new generic `runDomain` function; when absent it falls back to
   the existing `runVitalSignsAssessment`.

`vital-signs-assessment.ts` is kept as-is: the fallback path keeps the existing
out-of-the-box experience exactly unchanged.

---

## 2. Manifest Schema

```typescript
// src/cli/manifest.ts (types only — see §3 for runtime code)

type PsmType = 'assessment' | 'diagnosis' | 'monitoring';

interface DomainManifest {
  name: string;
  psm: PsmType;
  knowledge: Record<string, string>;  // key → relative file path
}
```

Each PSM type has a fixed set of required `knowledge` keys, validated at load
time against the `*Paths` interface it maps to:

| `psm`        | Required `knowledge` keys                                              |
|--------------|------------------------------------------------------------------------|
| `assessment` | `ontologyPath`, `normsPath`, `abstractionPath`, `evaluationPath`       |
| `diagnosis`  | `ontologyPath`, `normsPath`, `abstractionPath`, `faultModelPath`       |
| `monitoring` | `ontologyPath`, `normsPath`, `abstractionPath`, `tolerancePath`        |

`selectionPath` on Assessment PSM is optional — it is present in
`VitalSignsAssessmentPsm` but not required by `AssessmentPsmPaths`. The manifest
can include it; extra keys are passed through (not rejected).

---

## 3. New Modules

### 3.1 `src/cli/manifest.ts`

```
loadDomainManifest(knowledgeRoot: string): DomainManifest
```

Steps:
1. Read `<knowledgeRoot>/domain.yml` — throw `DomainManifestError` if missing.
2. Parse YAML — throw `DomainManifestError` on parse failure (include the YAML
   error message).
3. Validate `psm` is one of `assessment | diagnosis | monitoring` — throw listing
   valid values.
4. Validate all required `knowledge` keys exist in the object — collect all
   missing keys, throw once with the full list.
5. Resolve each `knowledge` path to an absolute path and confirm the file exists
   via `fs.existsSync` — collect all missing paths, throw once with all of them.
6. Return the validated, path-resolved `DomainManifest`.

Error type: `DomainManifestError extends Error` — a plain subclass with no extra
fields, just a descriptive message. The CLI catches it and calls `program.error()`
to get Commander's consistent exit(1) formatting.

### 3.2 `src/cli/domain-runner.ts`

```
runDomain(options: DomainRunnerOptions): Promise<void>
```

Where `DomainRunnerOptions` = the shared inference/output fields already present
in `VitalSignsAssessmentCliOptions` plus `knowledgeRoot: string`.

Steps:
1. Call `loadDomainManifest(knowledgeRoot)` — error propagates to CLI handler.
2. Instantiate the correct PSM via a small factory switch on `manifest.psm`,
   passing `manifest.knowledge` cast to the appropriate `*Paths` type.
3. Construct `LocalFileStore(knowledgeRoot)`.
4. Build inference provider (same `buildInference` logic — extract to a shared
   helper in `src/cli/inference-factory.ts` so both runners use it).
5. Build `RuntimeContext`, call `engine.execute`, print result — identical to
   the existing `runVitalSignsAssessment` output section.
6. If `manifest.name` is non-empty, print a `## <name>` header before the result.

### 3.3 `src/cli/inference-factory.ts`

Extract the existing `buildInference` function from `vital-signs-assessment.ts`
into its own module so both `vital-signs-assessment.ts` and `domain-runner.ts`
share it without one importing from the other.

---

## 4. CLI Changes (`src/cli/index.ts`)

Add one optional option:

```
--knowledge-root <path>   Path to a knowledge root containing domain.yml
                          (default: bundled vital-signs example)
```

The `.action` handler changes from a direct `runVitalSignsAssessment` call to:

```typescript
.action(async (options) => {
  if (options.knowledgeRoot) {
    await runDomain(options);
  } else {
    await runVitalSignsAssessment(options);
  }
});
```

The description is updated from "Run a vital signs validity assessment" to
"Run a knowledge task against a PSM-driven knowledge base".

---

## 5. Bundled Example Update

Add `knowledge/domain.yml`:

```yaml
name: Vital Signs Assessment
psm: assessment
knowledge:
  ontologyPath: ontology/health-domain.yml
  normsPath: health/vital-signs-assessment/norms.yml
  abstractionPath: health/vital-signs-assessment/abstraction.md
  evaluationPath: health/vital-signs-assessment/evaluation.md
  selectionPath: health/vital-signs-assessment/selection.md
```

This makes the bundled example a valid `--knowledge-root` target (i.e.
`--knowledge-root ./knowledge` works) in addition to the no-arg default path.

---

## 6. File Structure Delta

```text
src/cli/
├── index.ts                   # updated: --knowledge-root option, dispatch
├── inference-factory.ts       # new: extracted buildInference()
├── domain-runner.ts           # new: generic runDomain()
├── manifest.ts                # new: DomainManifest type + loadDomainManifest()
└── vital-signs-assessment.ts  # updated: imports buildInference from factory

knowledge/
└── domain.yml                 # new: manifest for bundled vital-signs example
```

---

## 7. What Is Not Changed

- `AssessmentPsm`, `DiagnosisPsm`, `MonitoringPsm` — no changes.
- `VitalSignsAssessmentPsm` and `wiring.ts` — no changes.
- All existing CLI flags — same names, same behaviour.
- Published package shape — `knowledge/` already ships in `files`; `domain.yml`
  is added automatically.
