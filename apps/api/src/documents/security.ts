import path from 'node:path';
import { AppError } from '../http.js';
import type { DocumentRecord } from './types.js';
import type { IdentityUser } from '../identity/types.js';
import type { DocumentStore } from './store.js';

type FileRule = {
  extensions: string[];
  signature?: (buffer: Buffer) => boolean;
};

const startsWith = (signature: number[]) => (buffer: Buffer) =>
  buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte);

const isText = (buffer: Buffer) => !buffer.subarray(0, 4096).includes(0);

const fileRules: Record<string, FileRule> = {
  'application/pdf': {
    extensions: ['.pdf'],
    signature: (buffer) => buffer.subarray(0, 5).toString() === '%PDF-',
  },
  'application/msword': {
    extensions: ['.doc'],
    signature: startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['.docx'],
    signature: startsWith([0x50, 0x4b, 0x03, 0x04]),
  },
  'application/vnd.ms-excel': {
    extensions: ['.xls'],
    signature: startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extensions: ['.xlsx'],
    signature: startsWith([0x50, 0x4b, 0x03, 0x04]),
  },
  'application/vnd.ms-powerpoint': {
    extensions: ['.ppt'],
    signature: startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    extensions: ['.pptx'],
    signature: startsWith([0x50, 0x4b, 0x03, 0x04]),
  },
  'image/png': {
    extensions: ['.png'],
    signature: startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], signature: startsWith([0xff, 0xd8, 0xff]) },
  'text/plain': { extensions: ['.txt'], signature: isText },
  'text/csv': { extensions: ['.csv'], signature: isText },
};

export const allowedDocumentMimeTypes = Object.freeze(Object.keys(fileRules));

export const decodeFileNameHeader = (rawValue?: string) => {
  if (!rawValue) throw new AppError(400, 'File name is required.', 'FILE_NAME_REQUIRED');
  try {
    return decodeURIComponent(rawValue);
  } catch {
    throw new AppError(400, 'File name is invalid.', 'INVALID_FILE_NAME');
  }
};

export const validateDocumentFile = (
  data: unknown,
  originalFileName: string,
  mimeType: string,
  maximumBytes: number,
) => {
  if (!Buffer.isBuffer(data) || data.length === 0) {
    throw new AppError(400, 'A non-empty document file is required.', 'FILE_REQUIRED');
  }
  if (data.length > maximumBytes)
    throw new AppError(413, 'The document file is too large.', 'FILE_TOO_LARGE');

  const normalizedName = originalFileName.normalize('NFC').trim();
  const containsControlCharacter = [...normalizedName].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (
    !normalizedName ||
    normalizedName.length > 255 ||
    containsControlCharacter ||
    normalizedName.includes('/') ||
    normalizedName.includes('\\') ||
    path.basename(normalizedName) !== normalizedName
  ) {
    throw new AppError(400, 'File name is invalid.', 'INVALID_FILE_NAME');
  }

  const normalizedMime = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  const rule = fileRules[normalizedMime];
  const extension = path.extname(normalizedName).toLowerCase();
  if (!rule || !rule.extensions.includes(extension)) {
    throw new AppError(415, 'This document file type is not allowed.', 'FILE_TYPE_NOT_ALLOWED');
  }
  if (rule.signature && !rule.signature(data)) {
    throw new AppError(
      415,
      'The document content does not match its declared type.',
      'FILE_SIGNATURE_INVALID',
    );
  }
  return { data, originalFileName: normalizedName, mimeType: normalizedMime };
};

const confidentialRoles = new Set([
  'super_admin',
  'board_chair',
  'executive_director',
  'operations_manager',
  'governance_officer',
]);
const highlyConfidentialRoles = new Set(['super_admin', 'board_chair', 'executive_director']);

export const allowedConfidentialityLevels = (user: IdentityUser) => {
  const names = user.roles.map((role) => role.name);
  if (names.some((name) => highlyConfidentialRoles.has(name))) {
    return ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL'] as const;
  }
  if (names.some((name) => confidentialRoles.has(name))) {
    return ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'] as const;
  }
  return ['PUBLIC', 'INTERNAL'] as const;
};

export type DocumentCapability = 'view' | 'download' | 'edit';

export const canAccessDocument = async (
  store: DocumentStore,
  document: DocumentRecord,
  user: IdentityUser,
  capability: DocumentCapability,
) => {
  if (user.roles.some((role) => role.name === 'super_admin')) return true;
  if (allowedConfidentialityLevels(user).includes(document.confidentialityLevel as never))
    return true;
  return store.hasAccessRule(
    document.id,
    user.id,
    user.roles.map((role) => role.id),
    capability,
  );
};

export const requireDocumentAccess = async (
  store: DocumentStore,
  document: DocumentRecord,
  user: IdentityUser,
  capability: DocumentCapability,
) => {
  if (!(await canAccessDocument(store, document, user, capability))) {
    throw new AppError(404, 'Document not found.', 'NOT_FOUND');
  }
};
