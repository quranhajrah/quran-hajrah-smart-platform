import { describe, expect, it, vi } from 'vitest';
import { migrationArguments, runMigrations, startProduction } from './start.js';

describe('production bootstrap', () => {
  it('executes the exact Prisma migration command', async () => {
    const runner = vi.fn(async () => 0);
    await runMigrations(runner);
    const expectedMigration = ['prisma', 'migrate', 'deploy', '--schema=packages/database/prisma/schema.prisma'];
    if (process.platform === 'win32') {
      expect(runner).toHaveBeenCalledWith(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npx', ...expectedMigration]);
    } else {
      expect(runner).toHaveBeenCalledWith('npx', expectedMigration);
    }
    expect(migrationArguments).toHaveLength(4);
  });

  it('starts the existing server only after migrations succeed', async () => {
    const order: string[] = [];
    await startProduction(
      async () => { order.push('migrations'); },
      async () => { order.push('server'); },
    );
    expect(order).toEqual(['migrations', 'server']);
  });

  it('does not start the server when migrations fail', async () => {
    const startServer = vi.fn(async () => undefined);
    await expect(startProduction(
      async () => { throw new Error('migration failed'); },
      startServer,
    )).rejects.toThrow('migration failed');
    expect(startServer).not.toHaveBeenCalled();
  });
});
