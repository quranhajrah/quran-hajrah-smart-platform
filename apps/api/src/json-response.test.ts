import { describe, expect, it } from 'vitest';
import { normalizeJsonResponse } from './json-response.js';

describe('JSON response normalization', () => {
  it('normalizes nested BigInt values and BigInt values inside arrays', () => {
    const normalized = normalizeJsonResponse({
      nested: { value: 42n },
      values: [1n, { value: 2n }],
    });

    expect(normalized).toEqual({
      nested: { value: 42 },
      values: [1, { value: 2 }],
    });
    expect(() => JSON.stringify(normalized)).not.toThrow();
  });

  it('converts safe BigInt values to numbers and unsafe values to decimal strings', () => {
    const safe = BigInt(Number.MAX_SAFE_INTEGER);
    const unsafe = safe + 1n;

    const normalized = normalizeJsonResponse({ safe, unsafe });

    expect(normalized.safe).toBe(Number.MAX_SAFE_INTEGER);
    expect(typeof normalized.safe).toBe('number');
    expect(normalized.unsafe).toBe(unsafe.toString(10));
    expect(typeof normalized.unsafe).toBe('string');
  });

  it('preserves dates, null, undefined, and ordinary numeric values', () => {
    const occurredAt = new Date('2026-07-29T12:00:00.000Z');
    const normalized = normalizeJsonResponse({
      occurredAt,
      nullable: null,
      optional: undefined,
      integer: 27,
      decimal: 26.1,
    });

    expect(normalized.occurredAt).toBe(occurredAt);
    expect(normalized.occurredAt.toISOString()).toBe('2026-07-29T12:00:00.000Z');
    expect(normalized.nullable).toBeNull();
    expect(normalized.optional).toBeUndefined();
    expect(normalized.integer).toBe(27);
    expect(normalized.decimal).toBe(26.1);
  });
});
