export interface TransactionRunner<Transaction> {
  $transaction<Result>(operation: (transaction: Transaction) => Promise<Result>): Promise<Result>;
}

export const runAtomicImport = <Transaction, Result>(
  runner: TransactionRunner<Transaction>,
  operation: (transaction: Transaction) => Promise<Result>,
) => runner.$transaction(operation);
