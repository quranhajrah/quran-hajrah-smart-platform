import {
  adminBootstrapSuccessMessage,
  redactAdminBootstrapError,
  resolveAdminBootstrapInput,
  runAdminBootstrap,
} from './admin-bootstrap.js';

const executeBootstrap = async () => {
  if (!resolveAdminBootstrapInput(process.env)) return;

  const { database } = await import('./index.js');
  try {
    const result = await runAdminBootstrap(database, process.env);
    if (result.status === 'completed') {
      console.log(adminBootstrapSuccessMessage(result.outcome));
    }
  } finally {
    await database.$disconnect();
  }
};

try {
  await executeBootstrap();
} catch (error) {
  console.error(
    `Production super administrator bootstrap failed: ${redactAdminBootstrapError(
      error,
      process.env.ADMIN_TEMP_PASSWORD,
    )}`,
  );
  process.exitCode = 1;
}
