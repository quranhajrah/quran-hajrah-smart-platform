import { createHash } from 'node:crypto';
import {
  LOCAL_EMBEDDING_DIMENSIONS,
  LOCAL_EMBEDDING_PROVIDER,
  type KnowledgeEmbeddingProvider,
} from './types.js';

const arabicDiacritics = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;
const punctuation = /[^\p{L}\p{N}%]+/gu;
const stopWords = new Set([
  'في',
  'من',
  'إلى',
  'على',
  'عن',
  'هذا',
  'هذه',
  'ذلك',
  'التي',
  'الذي',
  'the',
  'and',
  'for',
  'with',
]);

export const normalizeKnowledgeText = (value: string) =>
  value
    .normalize('NFKC')
    .replace(arabicDiacritics, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ـ/g, '')
    .replace(punctuation, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const stemArabic = (token: string) => {
  let result = token;
  if (result.length > 4 && result.startsWith('ال')) result = result.slice(2);
  if (result.length > 4 && /[هة]$/.test(result)) result = result.slice(0, -1);
  if (result.length > 5 && /(?:ات|ون|ين)$/.test(result)) result = result.slice(0, -2);
  return result;
};

export const knowledgeTerms = (value: string) => [
  ...new Set(
    normalizeKnowledgeText(value)
      .split(' ')
      .filter((token) => token.length > 1 && !stopWords.has(token))
      .map(stemArabic),
  ),
];

const featureHash = (feature: string, dimensions: number) => {
  const digest = createHash('sha256').update(feature).digest();
  return {
    index: digest.readUInt32BE(0) % dimensions,
    sign: digest[4]! % 2 === 0 ? 1 : -1,
  };
};

export class LocalArabicHybridEmbeddingProvider implements KnowledgeEmbeddingProvider {
  readonly name = LOCAL_EMBEDDING_PROVIDER;
  readonly dimensions = LOCAL_EMBEDDING_DIMENSIONS;

  embed(text: string) {
    const vector = Array<number>(this.dimensions).fill(0);
    const normalized = normalizeKnowledgeText(text);
    const terms = knowledgeTerms(normalized);
    const features = [
      ...terms.map((term) => `w:${term}`),
      ...terms.flatMap((term) => {
        const padded = `_${term}_`;
        return Array.from(
          { length: Math.max(0, padded.length - 2) },
          (_, index) => `g:${padded.slice(index, index + 3)}`,
        );
      }),
    ];
    for (const feature of features) {
      const { index, sign } = featureHash(feature, this.dimensions);
      vector[index] = (vector[index] ?? 0) + sign;
    }
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    return magnitude === 0 ? vector : vector.map((value) => value / magnitude);
  }
}

export const cosineSimilarity = (left: number[], right: number[]) => {
  const size = Math.min(left.length, right.length);
  let value = 0;
  for (let index = 0; index < size; index += 1) value += left[index]! * right[index]!;
  return Math.max(-1, Math.min(1, value));
};

export const lexicalOverlap = (left: string[], right: string[]) => {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const matches = new Set(left.filter((term) => rightSet.has(term))).size;
  return matches / Math.sqrt(new Set(left).size * rightSet.size);
};
