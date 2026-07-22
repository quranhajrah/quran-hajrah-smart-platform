import { checkDatabaseConnection, disconnectDatabase } from './index.js';

try {
  await checkDatabaseConnection();
  console.log('Database connectivity check passed.');
} catch {
  console.error('Database connectivity check failed.');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
