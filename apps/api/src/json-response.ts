export type JsonResponseValue<Value> = Value extends bigint
  ? number | string
  : Value extends Date
    ? Date
    : Value extends readonly (infer Item)[]
      ? JsonResponseValue<Item>[]
      : Value extends object
        ? { [Key in keyof Value]: JsonResponseValue<Value[Key]> }
        : Value;

const normalizeBigInt = (value: bigint) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) ? numeric : value.toString(10);
};

const isTraversableObject = (value: object) => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const normalizeValue = (value: unknown, seen: WeakMap<object, unknown>): unknown => {
  if (typeof value === 'bigint') return normalizeBigInt(value);
  if (value === null || value === undefined || value instanceof Date) return value;
  if (Array.isArray(value)) {
    const existing = seen.get(value);
    if (existing) return existing;
    const normalized: unknown[] = [];
    normalized.length = value.length;
    seen.set(value, normalized);
    value.forEach((item, index) => {
      normalized[index] = normalizeValue(item, seen);
    });
    return normalized;
  }
  if (typeof value !== 'object' || !isTraversableObject(value)) return value;
  const existing = seen.get(value);
  if (existing) return existing;
  const normalized = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>;
  seen.set(value, normalized);
  for (const [key, item] of Object.entries(value)) {
    normalized[key] = normalizeValue(item, seen);
  }
  return normalized;
};

export const normalizeJsonResponse = <Value>(value: Value): JsonResponseValue<Value> =>
  normalizeValue(value, new WeakMap()) as JsonResponseValue<Value>;
