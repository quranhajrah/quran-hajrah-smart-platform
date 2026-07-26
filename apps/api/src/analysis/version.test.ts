import { describe, expect, it } from 'vitest';
import {
  createForcedAnalysisFingerprint,
  createStableAnalysisFingerprint,
  semanticExtractionVersion,
} from './version.js';

const fingerprintInput = {
  documentId: 'document-1',
  documentVersionId: 'version-1',
  checksum: 'checksum-1',
  enabledRuleIds: ['semantic.kpi.v2', 'semantic.operational_objective.v2'],
};

describe('Enterprise 24.2.1 analysis identity', () => {
  it('publishes and fingerprints the semantic extraction version', () => {
    expect(semanticExtractionVersion).toBe('24.2.1');
    expect(createStableAnalysisFingerprint(fingerprintInput)).toBe(
      createStableAnalysisFingerprint({
        ...fingerprintInput,
        extractionVersion: '24.2.1',
      }),
    );
  });

  it('invalidates an otherwise identical fingerprint across semantic versions', () => {
    const oldFingerprint = createStableAnalysisFingerprint({
      ...fingerprintInput,
      extractionVersion: '24.2.0',
    });
    const currentFingerprint = createStableAnalysisFingerprint(fingerprintInput);
    expect(currentFingerprint).not.toBe(oldFingerprint);
  });

  it('creates a distinct fingerprint for every forced reanalysis', () => {
    const stable = createStableAnalysisFingerprint(fingerprintInput);
    const first = createForcedAnalysisFingerprint(stable);
    const second = createForcedAnalysisFingerprint(stable);
    expect(first).not.toBe(stable);
    expect(second).not.toBe(stable);
    expect(first).not.toBe(second);
  });
});
