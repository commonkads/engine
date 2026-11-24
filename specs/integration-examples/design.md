# Implementation Design — Integration Tests & Generic Example Runner

## 1. Shared Inference Resolver

A new module `test/integration/support/inference.ts` centralises provider selection
for all integration test files.

```typescript
// test/integration/support/inference.ts

export type ActiveProvider = 'bedrock' | 'claude' | 'gemini';

export interface IntegrationInference {
  provider: ActiveProvider;
  inference: ITextInference;
}

export function resolveIntegrationInference(): IntegrationInference | null
```

Resolution order (first match wins):

| Env var                  | Provider | Secondary vars read              |
|--------------------------|----------|----------------------------------|
| `STRATA_BEDROCK_MODEL_ID`| bedrock  | `STRATA_GUARDRAIL_NAME`, `AWS_REGION` |
| `STRATA_CLAUDE_MODEL_ID` | claude   | `ANTHROPIC_API_KEY` (SDK default) |
| `STRATA_GEMINI_MODEL_ID` | gemini   | `GOOGLE_API_KEY` / `GEMINI_API_KEY` (SDK default) |

Returns `null` when no variable is set; each test file calls `describe.skip` on null.

Each integration test file uses a single shared pattern:

```typescript
const integration = resolveIntegrationInference();
const describeIntegration = integration ? describe : describe.skip;
```

---

## 2. Domain Resolution in Integration Tests

Integration tests for car-diagnosis and server-monitoring use `loadDomainManifest`
(the same path as the generic CLI) rather than a custom wiring module. The examples
directory is resolved relative to the test file's location:

```typescript
// test/integration/support/examples.ts

export function resolveExampleRoot(domainName: string): string {
  // test/integration/ -> ../.. -> package root -> examples/<domainName>
  return fileURLToPath(new URL(`../../examples/${domainName}`, import.meta.url));
}
```

Each integration test then:
1. Calls `resolveExampleRoot('car-diagnosis')` / `resolveExampleRoot('server-monitoring')`.
2. Calls `loadDomainManifest(root)` to get the manifest and validated paths.
3. Instantiates the PSM and `LocalFileStore` directly.
4. Runs `engine.execute(psm, payload, context)`.

This confirms that the knowledge files are valid for real LLM use — not just
manifest validation.

---

## 3. Updated Vital-Signs Integration Test

`test/integration/vital-signs-assessment.integration.test.ts` is updated to:
- Import `resolveIntegrationInference` from `./support/inference.js` instead of
  hardcoding `BedrockTextInference`.
- Keep all three existing test cases unchanged.
- The `describe.skip` guard is driven by `resolveIntegrationInference()` returning null.

---

## 4. New Integration Test Files

### `test/integration/car-diagnosis.integration.test.ts`

Three test cases covering the key paths through the Diagnosis PSM:

| Case | Payload | Expected verdict | Expected confirmed |
|------|---------|------------------|--------------------|
| Dead battery | NoCrank + dim lights | `Fault` | contains "Dead or Discharged Battery" |
| Overheating (thermostat) | Overheating + full coolant + quick temperature spike | `Fault` | contains a cooling hypothesis |
| No symptoms | empty symptoms object | `Healthy` | confirmed array is empty |

Timeout: 60 000 ms per test (Diagnosis PSM has only one LLM step — verify — but it
receives a larger prompt than Assessment).

### `test/integration/server-monitoring.integration.test.ts`

Three test cases covering the three severity verdicts:

| Case | Payload | Expected verdict |
|------|---------|-----------------|
| All normal | all metrics within warning threshold | `Normal` |
| Warning | CPU at 78%, memory at 83%, others normal | `Warning` |
| Breach | CPU at 92%, error rate at 6%, latency at 1200ms | `Breach` |

Timeout: 60 000 ms per test.

---

## 5. Generic Bin Script (`bin/run-example.sh`)

The script accepts `--domain <name>` as its first argument before forwarding to
the CLI. It resolves `--knowledge-root` and `--payload` from the domain name, then
passes all remaining arguments (including a caller-supplied `--payload` override)
to the CLI.

```
Usage: bin/run-example.sh --domain <vital-signs|car-diagnosis|server-monitoring> \
                           --model <model-id> [cli-options...]
```

`--domain` defaults to `vital-signs` when omitted. The script strips `--domain`
and its value before calling `node dist/cli/index.js` — Commander does not know
about this argument.

Default payloads:
- **vital-signs**: adult with normal readings (current default in `vital-signs-assessment.sh`)
- **car-diagnosis**: `{"symptoms":["NoStart_NoCrank"],"lights":"dim","sound":"silence"}`
- **server-monitoring**: `{"CpuUsagePercent":78,"MemoryUsagePercent":83,"DiskUsagePercent":55,"DiskIoWaitPercent":4,"HttpErrorRatePercent":0.3,"HttpP99LatencyMs":420,"CpuCores":4,"LoadAverage1m":3.8}`

---

## 6. File Structure Delta

```text
bin/
  run-example.sh              # new: replaces vital-signs-assessment.sh
  vital-signs-assessment.sh   # deleted

test/integration/
  support/
    inference.ts              # new: resolveIntegrationInference()
    examples.ts               # new: resolveExampleRoot()
  vital-signs-assessment.integration.test.ts   # updated: use shared resolver
  car-diagnosis.integration.test.ts            # new
  server-monitoring.integration.test.ts        # new

docs/developer-guide.md       # updated: new env vars, run-example.sh usage
```

---

## 7. New Environment Variables

| Variable               | Purpose                                             |
|------------------------|-----------------------------------------------------|
| `STRATA_CLAUDE_MODEL_ID` | Enables Claude provider for integration tests    |
| `STRATA_GEMINI_MODEL_ID` | Enables Gemini provider for integration tests    |

Existing variables (`STRATA_BEDROCK_MODEL_ID`, `STRATA_GUARDRAIL_NAME`, `AWS_REGION`,
`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`) are unchanged.
