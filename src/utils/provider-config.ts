import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse } from 'yaml';

/** Minimum set of fields that every provider config file may contain. */
export interface ProviderFileConfig {
  modelId?: string;
  apiKey?: string;
}

/**
 * Reads `~/.commonkads/providers/<provider>.yml` (or `configFile` when given)
 * and returns its contents cast to `T`.
 *
 * - Explicit path, file missing  → throws `Error('Config file not found: <path>')`
 * - Default path, file missing   → returns `{}` silently
 * - File found                   → parsed YAML cast to `T`; unknown keys are silently ignored
 *
 * The base directory for the default path resolves as:
 *   1. `configFile` argument (overrides everything)
 *   2. `COMMONKADS_CONFIG_DIR` env var  → `$COMMONKADS_CONFIG_DIR/<provider>.yml`
 *   3. `~/.commonkads/providers/<provider>.yml`
 */
export function loadProviderConfig<T extends ProviderFileConfig>(
  provider: string,
  configFile?: string,
): T {
  const configDir =
    process.env['COMMONKADS_CONFIG_DIR'] ?? join(homedir(), '.commonkads', 'providers');
  const filePath = configFile ?? join(configDir, `${provider}.yml`);

  if (!existsSync(filePath)) {
    if (configFile !== undefined) {
      throw new Error(`Config file not found: ${filePath}`);
    }
    return {} as T;
  }

  const text = readFileSync(filePath, 'utf8');
  return (parse(text) ?? {}) as T;
}
