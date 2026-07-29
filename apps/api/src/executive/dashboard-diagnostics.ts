const redactCredentials = (value: string) =>
  value.replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgresql://[redacted]@');

export class ExecutiveDashboardOperationError extends Error {
  constructor(
    readonly operation: string,
    readonly originalError: unknown,
  ) {
    const message = originalError instanceof Error ? originalError.message : String(originalError);
    super(`Executive dashboard operation "${operation}" failed: ${message}`);
    this.name = 'ExecutiveDashboardOperationError';
  }
}

export const runExecutiveDashboardOperation = async <Result>(
  operation: string,
  task: () => Result | Promise<Result>,
): Promise<Result> => {
  try {
    return await task();
  } catch (error) {
    if (error instanceof ExecutiveDashboardOperationError) throw error;
    throw new ExecutiveDashboardOperationError(operation, error);
  }
};

export const runExecutiveDashboardOperationSync = <Result>(
  operation: string,
  task: () => Result,
): Result => {
  try {
    return task();
  } catch (error) {
    if (error instanceof ExecutiveDashboardOperationError) throw error;
    throw new ExecutiveDashboardOperationError(operation, error);
  }
};

const originalErrorDetails = (error: unknown) => {
  if (!(error instanceof Error)) {
    return {
      name: 'UnknownError',
      message: redactCredentials(String(error)),
    };
  }
  const errorRecord = error as Error & {
    code?: unknown;
    clientVersion?: unknown;
  };
  return {
    name: error.name,
    message: redactCredentials(error.message),
    ...(error.stack ? { stack: redactCredentials(error.stack) } : {}),
    ...(typeof errorRecord.code === 'string' ? { code: errorRecord.code } : {}),
    ...(typeof errorRecord.clientVersion === 'string'
      ? { clientVersion: errorRecord.clientVersion }
      : {}),
  };
};

export const executiveDashboardFailure = (error: unknown) => {
  const operationError = error instanceof ExecutiveDashboardOperationError ? error : undefined;
  const originalError = operationError?.originalError ?? error;
  return {
    failingOperation: operationError?.operation ?? 'executive.dashboard.unclassified',
    stack: error instanceof Error && error.stack ? redactCredentials(error.stack) : undefined,
    originalError: originalErrorDetails(originalError),
  };
};
