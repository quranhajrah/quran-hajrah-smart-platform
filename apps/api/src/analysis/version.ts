import { createHash, randomUUID } from 'node:crypto';

export const semanticExtractionVersion = '24.2.1';

type AnalysisFingerprintInput = {
  documentId: string;
  documentVersionId: string;
  checksum: string;
  enabledRuleIds: readonly string[];
  extractionVersion?: string;
};

export const createStableAnalysisFingerprint = ({
  documentId,
  documentVersionId,
  checksum,
  enabledRuleIds,
  extractionVersion = semanticExtractionVersion,
}: AnalysisFingerprintInput) =>
  createHash('sha256')
    .update(
      [
        documentId,
        documentVersionId,
        checksum,
        extractionVersion,
        [...enabledRuleIds].sort().join(','),
      ].join('|'),
    )
    .digest('hex');

export const createForcedAnalysisFingerprint = (stableFingerprint: string) =>
  createHash('sha256').update(`${stableFingerprint}|${randomUUID()}`).digest('hex');
