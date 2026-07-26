import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TxtTextExtractionProvider } from '../analysis/providers.js';
import { resolveDocumentStorageRoot } from '../config.js';
import { LocalStorageProvider, type StorageProvider } from './storage.js';

const temporaryDirectories: string[] = [];

const readBuffer = async (storage: StorageProvider, storagePath: string) => {
  const chunks: Buffer[] = [];
  for await (const chunk of await storage.read(storagePath)) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('production document storage pipeline', () => {
  it('uploads, retrieves, analyzes, and deletes through a persistent provider root', async () => {
    const hostHome = await mkdtemp(path.join(tmpdir(), 'qh-host-home-'));
    temporaryDirectories.push(hostHome);
    const firstRelease = path.join(hostHome, 'domains', 'app', 'builds', 'release-a');
    const secondRelease = path.join(hostHome, 'domains', 'app', 'builds', 'release-b');
    const firstRoot = resolveDocumentStorageRoot({
      isProduction: true,
      workingDirectory: firstRelease,
      homeDirectory: hostHome,
    });
    const secondRoot = resolveDocumentStorageRoot({
      isProduction: true,
      workingDirectory: secondRelease,
      homeDirectory: hostHome,
    });
    expect(secondRoot).toBe(firstRoot);

    const uploadStorage = new LocalStorageProvider(firstRoot);
    const content = Buffer.from(
      [
        'Operational plan 2026',
        'Objective: improve educational program quality',
        'Indicator: program completion rate',
      ].join('\n'),
      'utf8',
    );
    const stored = await uploadStorage.save({
      safeName: uploadStorage.generateSafeName('operational-plan-2026.txt'),
      data: content,
      directory: 'document-id',
    });
    expect(path.isAbsolute(stored.path)).toBe(false);

    const productionStorage = new LocalStorageProvider(secondRoot);
    await expect(productionStorage.exists(stored.path)).resolves.toBe(true);
    await expect(readBuffer(productionStorage, stored.path)).resolves.toEqual(content);

    const analysisInput = await readBuffer(productionStorage, stored.path);
    const extraction = await new TxtTextExtractionProvider().extractDocument({
      fileName: 'operational-plan-2026.txt',
      mimeType: 'text/plain',
      data: analysisInput,
      maximumBytes: 1024 * 1024,
      maximumPages: 10,
      maximumTables: 10,
    });
    expect(extraction.pages).toHaveLength(1);
    expect(extraction.pages[0]?.text).toContain('Operational plan 2026');

    await productionStorage.delete(stored.path);
    await expect(productionStorage.exists(stored.path)).resolves.toBe(false);
  });
});
