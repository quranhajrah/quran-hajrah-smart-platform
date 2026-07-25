import { describe, expect, it } from 'vitest';
import { conflictForProposal } from './prisma-store.js';

const completeObjective = {
  id: 'proposal-1',
  importTargetType: 'STRATEGIC_OBJECTIVE' as const,
  proposedData: {
    code: 'SO-01',
    title: 'رفع جودة البرامج التعليمية',
    strategicAxis: 'التميز التعليمي',
    startDate: '2026-01-01',
    endDate: '2031-12-31',
  },
  editedData: null,
};

describe('document-analysis conflict detection', () => {
  it('defaults duplicate target records to skip and offers explicit resolutions', async () => {
    const client = {
      sourceEvidenceReference: { findFirst: async () => null },
      strategicObjective: { findFirst: async () => ({ id: 'objective-existing' }) },
    };

    const result = await conflictForProposal(client as never, completeObjective);

    expect(result).toMatchObject({
      status: 'conflict',
      existingRecordId: 'objective-existing',
      defaultAction: 'skip',
      allowedActions: ['skip', 'update', 'create', 'merge'],
    });
  });

  it('prevents a previously imported proposal from being replayed', async () => {
    const client = {
      sourceEvidenceReference: {
        findFirst: async () => ({ targetRecordId: 'objective-imported' }),
      },
    };

    const result = await conflictForProposal(client as never, completeObjective);

    expect(result).toMatchObject({
      status: 'already_imported',
      existingRecordId: 'objective-imported',
      allowedActions: ['skip'],
      defaultAction: 'skip',
    });
  });

  it('requires missing target fields to be supplied during human review', async () => {
    const client = {
      sourceEvidenceReference: { findFirst: async () => null },
    };

    const result = await conflictForProposal(client as never, {
      ...completeObjective,
      proposedData: { title: completeObjective.proposedData.title },
    });

    expect(result.status).toBe('incomplete');
    expect(result.allowedActions).toEqual(['skip']);
    expect(result.reason).toContain('code');
    expect(result.reason).toContain('startDate');
  });
});
