import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

export type StorageSaveInput = {
  safeName: string;
  data: Buffer;
  directory?: string;
};

export type StoredFile = {
  path: string;
  size: number;
};

export interface StorageProvider {
  save(input: StorageSaveInput): Promise<StoredFile>;
  read(storagePath: string): Promise<Readable>;
  delete(storagePath: string): Promise<void>;
  exists(storagePath: string): Promise<boolean>;
  generateSafeName(originalFileName: string): string;
}

const safeExtension = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();
  const allowed = new Set([
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.png',
    '.jpg',
    '.jpeg',
    '.txt',
    '.csv',
  ]);
  return allowed.has(extension) ? extension : '';
};

export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  generateSafeName(originalFileName: string) {
    return `${randomUUID()}${safeExtension(originalFileName)}`;
  }

  async save(input: StorageSaveInput) {
    const directory = input.directory ?? new Date().toISOString().slice(0, 7).replace('-', '/');
    const relativePath = path.posix.join(directory.replaceAll('\\', '/'), input.safeName);
    const absolutePath = this.resolve(relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.data, { flag: 'wx', mode: 0o600 });
    return { path: relativePath, size: input.data.byteLength };
  }

  async read(storagePath: string) {
    const absolutePath = this.resolve(storagePath);
    await stat(absolutePath);
    return createReadStream(absolutePath);
  }

  async delete(storagePath: string) {
    await rm(this.resolve(storagePath), { force: true });
  }

  async exists(storagePath: string) {
    try {
      await stat(this.resolve(storagePath));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  private resolve(storagePath: string) {
    if (!storagePath || path.isAbsolute(storagePath) || storagePath.includes('\0')) {
      throw new Error('Invalid storage path.');
    }
    const normalized = path.normalize(storagePath.replaceAll('/', path.sep));
    const absolutePath = path.resolve(this.root, normalized);
    const relative = path.relative(this.root, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('Invalid storage path.');
    return absolutePath;
  }
}

export class MemoryStorageProvider implements StorageProvider {
  readonly files = new Map<string, Buffer>();

  generateSafeName(originalFileName: string) {
    return `${randomUUID()}${safeExtension(originalFileName)}`;
  }

  async save(input: StorageSaveInput) {
    const storagePath = path.posix.join(input.directory ?? 'memory', input.safeName);
    if (this.files.has(storagePath)) throw new Error('Storage path already exists.');
    this.files.set(storagePath, Buffer.from(input.data));
    return { path: storagePath, size: input.data.byteLength };
  }

  async read(storagePath: string) {
    const content = this.files.get(storagePath);
    if (!content) throw Object.assign(new Error('File not found.'), { code: 'ENOENT' });
    return Readable.from(content);
  }

  async delete(storagePath: string) {
    this.files.delete(storagePath);
  }

  async exists(storagePath: string) {
    return this.files.has(storagePath);
  }
}
