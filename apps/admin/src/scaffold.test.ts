import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('admin scaffold', () => {
  it('provides the React mount point and entry module', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('id="root"');
    expect(html).toContain('/src/main.tsx');
  });
});
