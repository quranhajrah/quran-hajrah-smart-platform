import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const migrationArguments = [
  'prisma',
  'migrate',
  'deploy',
  '--schema=packages/database/prisma/schema.prisma',
] as const;

type CommandRunner = (command: string, arguments_: readonly string[]) => Promise<number | null>;
type ServerStarter = () => Promise<unknown>;

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const migrationInvocation = process.platform === 'win32'
  ? { command: process.env.ComSpec ?? 'cmd.exe', arguments: ['/d', '/s', '/c', 'npx', ...migrationArguments] }
  : { command: 'npx', arguments: [...migrationArguments] };

const executeCommand: CommandRunner = (command, arguments_) => new Promise((resolve, reject) => {
  const child = spawn(command, [...arguments_], {
    cwd: repositoryRoot,
    env: process.env,
    shell: false,
    stdio: 'inherit',
  });
  child.once('error', reject);
  child.once('exit', (code) => resolve(code));
});

export const runMigrations = async (runner: CommandRunner = executeCommand) => {
  console.log(JSON.stringify({
    level: 'info',
    time: new Date().toISOString(),
    event: 'migration_deploy_started',
    schema: 'packages/database/prisma/schema.prisma',
    connectionSource: 'DIRECT_URL',
  }));
  const exitCode = await runner(migrationInvocation.command, migrationInvocation.arguments);
  if (exitCode !== 0) throw new Error(`Prisma migrate deploy exited with code ${exitCode ?? 'unknown'}.`);
  console.log(JSON.stringify({
    level: 'info',
    time: new Date().toISOString(),
    event: 'migration_deploy_completed',
  }));
};

export const startProduction = async (
  migrate: () => Promise<void> = runMigrations,
  startServer: ServerStarter = () => import('./server.js'),
) => {
  await migrate();
  await startServer();
};

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  void startProduction().catch((error: unknown) => {
    console.error(JSON.stringify({
      level: 'fatal',
      time: new Date().toISOString(),
      event: 'production_bootstrap_failed',
      error: error instanceof Error ? error.message : 'Unknown bootstrap error',
    }));
    process.exit(1);
  });
}
