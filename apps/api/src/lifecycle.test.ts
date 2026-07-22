import { describe, expect, it, vi } from 'vitest';
import { gracefulShutdown } from './lifecycle.js';
import type { Logger } from './logger.js';

describe('graceful shutdown', () => {
  it('stops accepting requests and disconnects Prisma', async () => {
    const order: string[] = [];
    const server = { close: (callback: (error?: Error) => void) => { order.push('server'); callback(); return server; } };
    const disconnect = vi.fn(async () => { order.push('database'); });
    const logger: Logger = { info: vi.fn(), error: vi.fn() };
    await gracefulShutdown(server, disconnect, logger, 'test');
    expect(order).toEqual(['server', 'database']);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
