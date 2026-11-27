import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadDomainManifest, DomainManifestError } from './domain-manifest.js';

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'strata-manifest-test-'));
}

function writeFile(dir: string, relPath: string, content: string): void {
  const abs = join(dir, relPath);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content, 'utf-8');
}

function touchFiles(root: string, relPaths: string[]): void {
  for (const p of relPaths) writeFile(root, p, '');
}

const ASSESSMENT_PATHS = {
  ontologyPath: 'ontology/health.yml',
  normsPath: 'norms.yml',
  abstractionPath: 'abstraction.md',
  evaluationPath: 'evaluation.md',
};

function writeAssessmentManifest(root: string, extra = ''): void {
  writeFile(
    root,
    'domain.yml',
    `name: Test Domain\ntask: assessment\npsm: assessment-with-abstraction\nknowledge:\n  ontologyPath: ontology/health.yml\n  normsPath: norms.yml\n  abstractionPath: abstraction.md\n  evaluationPath: evaluation.md\n${extra}`,
  );
}

describe('loadDomainManifest', () => {
  let root: string;

  beforeEach(() => {
    root = makeTmpDir();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns a valid manifest for a correct assessment domain', () => {
    writeAssessmentManifest(root);
    touchFiles(root, Object.values(ASSESSMENT_PATHS));

    const manifest = loadDomainManifest(root);

    assert.strictEqual(manifest.name, 'Test Domain');
    assert.strictEqual(manifest.task, 'assessment');
    assert.strictEqual(manifest.psm, 'assessment-with-abstraction');
    assert.strictEqual(manifest.knowledge.ontologyPath, 'ontology/health.yml');
    assert.strictEqual(manifest.knowledge.normsPath, 'norms.yml');
  });

  it('returns a valid manifest for a diagnosis domain', () => {
    writeFile(
      root,
      'domain.yml',
      'name: Diag\ntask: diagnosis\npsm: causal-covering\nknowledge:\n  ontologyPath: o.yml\n  normsPath: n.yml\n  abstractionPath: a.md\n  faultModelPath: f.md\n',
    );
    touchFiles(root, ['o.yml', 'n.yml', 'a.md', 'f.md']);

    const manifest = loadDomainManifest(root);
    assert.strictEqual(manifest.task, 'diagnosis');
    assert.strictEqual(manifest.psm, 'causal-covering');
  });

  it('returns a valid manifest for a monitoring domain', () => {
    writeFile(
      root,
      'domain.yml',
      'name: Mon\ntask: monitoring\npsm: data-driven-monitoring\nknowledge:\n  ontologyPath: o.yml\n  normsPath: n.yml\n  abstractionPath: a.md\n  tolerancePath: t.md\n',
    );
    touchFiles(root, ['o.yml', 'n.yml', 'a.md', 't.md']);

    const manifest = loadDomainManifest(root);
    assert.strictEqual(manifest.task, 'monitoring');
    assert.strictEqual(manifest.psm, 'data-driven-monitoring');
  });

  it('passes extra knowledge keys through without error', () => {
    writeAssessmentManifest(root, '  selectionPath: selection.md\n');
    touchFiles(root, [...Object.values(ASSESSMENT_PATHS), 'selection.md']);

    const manifest = loadDomainManifest(root);
    assert.strictEqual(manifest.knowledge.selectionPath, 'selection.md');
  });

  it('throws DomainManifestError when domain.yml is missing', () => {
    assert.throws(() => loadDomainManifest(root), DomainManifestError);
    assert.throws(() => loadDomainManifest(root), /No domain\.yml found at:/);
  });

  it('includes the full manifest path in the missing-file error', () => {
    const expectedPath = join(root, 'domain.yml');
    assert.throws(
      () => loadDomainManifest(root),
      (err) => {
        assert.ok((err as Error).message.includes(expectedPath));
        return true;
      },
    );
  });

  it('throws DomainManifestError for malformed YAML', () => {
    writeFile(root, 'domain.yml', 'psm: assessment\nknowledge: [\nbad yaml');

    assert.throws(() => loadDomainManifest(root), DomainManifestError);
    assert.throws(() => loadDomainManifest(root), /Failed to parse domain\.yml:/);
  });

  it('throws DomainManifestError for an unknown psm value', () => {
    writeFile(root, 'domain.yml', 'name: X\ntask: x\npsm: unknown\nknowledge: {}\n');

    assert.throws(() => loadDomainManifest(root), DomainManifestError);
    assert.throws(
      () => loadDomainManifest(root),
      /assessment-with-abstraction, causal-covering, data-driven-monitoring/,
    );
  });

  it('reports all missing required knowledge keys at once', () => {
    writeFile(
      root,
      'domain.yml',
      'name: X\ntask: assessment\npsm: assessment-with-abstraction\nknowledge:\n  ontologyPath: o.yml\n',
    );

    let err: DomainManifestError | undefined;
    try {
      loadDomainManifest(root);
    } catch (e) {
      err = e as DomainManifestError;
    }

    assert.ok(err instanceof DomainManifestError);
    assert.ok(err.message.includes('normsPath'));
    assert.ok(err.message.includes('abstractionPath'));
    assert.ok(err.message.includes('evaluationPath'));
  });

  it('reports all missing knowledge files at once', () => {
    writeAssessmentManifest(root);
    touchFiles(root, ['ontology/health.yml']);

    let err: DomainManifestError | undefined;
    try {
      loadDomainManifest(root);
    } catch (e) {
      err = e as DomainManifestError;
    }

    assert.ok(err instanceof DomainManifestError);
    assert.ok(err.message.includes('norms.yml'));
    assert.ok(err.message.includes('abstraction.md'));
    assert.ok(err.message.includes('evaluation.md'));
    assert.ok(!err.message.includes('health.yml'));
  });
});
