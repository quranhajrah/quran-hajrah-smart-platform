import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalStorageProvider } from './storage.js';
import { validateDocumentFile } from './security.js';

describe('document file security', () => {
  it('generates opaque names and preserves only an allowlisted extension', () => {
    const storage = new LocalStorageProvider(path.join(process.cwd(), '.test-document-storage'));
    expect(storage.generateSafeName('محضر اجتماع.pdf')).toMatch(/^[0-9a-f-]+\.pdf$/);
    expect(storage.generateSafeName('payload.exe')).toMatch(/^[0-9a-f-]+$/);
  });

  it('rejects path traversal at the storage boundary', async () => {
    const storage = new LocalStorageProvider(path.join(process.cwd(), '.test-document-storage'));
    await expect(storage.read('../outside.pdf')).rejects.toThrow('Invalid storage path');
    await expect(storage.delete('..\\outside.pdf')).rejects.toThrow('Invalid storage path');
  });

  it('enforces the configured file size limit', () => {
    expect(() =>
      validateDocumentFile(Buffer.from('%PDF-1.7\nlarge'), 'large.pdf', 'application/pdf', 4),
    ).toThrow('too large');
  });
});
