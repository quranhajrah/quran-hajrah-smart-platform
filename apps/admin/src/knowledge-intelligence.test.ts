import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Enterprise 25 knowledge intelligence UI', () => {
  it('exposes Arabic search, sourced answers, and no unsupported AI claim', async () => {
    const source = await readFile(new URL('./KnowledgeIntelligence.tsx', import.meta.url), 'utf8');
    expect(source).toContain('بحث دلالي');
    expect(source).toContain('إجابة موثقة');
    expect(source).toContain('source.reference');
    expect(source).toContain('لا يولّد حقائق خارج الأدلة المفهرسة');
    expect(source).not.toContain('ChatGPT');
  });
});
