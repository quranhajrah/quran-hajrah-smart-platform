import { describe, expect, it } from 'vitest';
import { runAtomicImport, type TransactionRunner } from './transaction.js';

class MemoryTransactionRunner implements TransactionRunner<{ records: string[] }> {
  records: string[] = [];

  async $transaction<Result>(operation: (transaction: { records: string[] }) => Promise<Result>) {
    const working = { records: [...this.records] };
    const result = await operation(working);
    this.records = working.records;
    return result;
  }
}

describe('transactional import coordinator', () => {
  it('commits all import items as one batch', async () => {
    const runner = new MemoryTransactionRunner();
    await runAtomicImport(runner, async (transaction) => {
      transaction.records.push('objective', 'kpi', 'source-reference');
      return transaction.records.length;
    });
    expect(runner.records).toEqual(['objective', 'kpi', 'source-reference']);
  });

  it('rolls back the complete import batch when one item fails', async () => {
    const runner = new MemoryTransactionRunner();
    runner.records = ['existing-record'];
    await expect(
      runAtomicImport(runner, async (transaction) => {
        transaction.records.push('new-objective');
        throw new Error('simulated target constraint failure');
      }),
    ).rejects.toThrow('simulated target constraint failure');
    expect(runner.records).toEqual(['existing-record']);
  });
});
