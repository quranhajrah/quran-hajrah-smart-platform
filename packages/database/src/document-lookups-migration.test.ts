import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../prisma/migrations/20260724_fix_knowledge_center_lookups/migration.sql',
  import.meta.url,
);
const seedUrl = new URL('../prisma/seed.ts', import.meta.url);

const categories = [
  'الخطط الاستراتيجية',
  'الخطط التشغيلية',
  'الموازنات',
  'اللوائح والسياسات',
  'الحوكمة والامتثال',
  'التقارير',
  'محاضر الاجتماعات',
  'الخطابات',
  'العقود',
  'البرامج والمبادرات',
  'الشؤون التعليمية',
  'الشؤون المالية',
  'الموارد البشرية',
  'الإعلام',
  'الأوقاف',
  'ملفات أخرى',
];

const departments = [
  'الإدارة التنفيذية',
  'الشؤون التعليمية',
  'الشؤون المالية',
  'تنمية الموارد',
  'الحوكمة',
  'الإعلام',
  'الموارد البشرية',
  'مجلس الإدارة',
];

describe('Knowledge Center lookup production migration', () => {
  it('creates and safely populates every required lookup', async () => {
    const migration = await readFile(fileURLToPath(migrationUrl), 'utf8');

    expect(migration).toContain('CREATE TABLE "OwningDepartment"');
    for (const name of [...categories, ...departments]) {
      expect(migration).toContain(`'${name}'`);
    }
    expect(migration.match(/ON CONFLICT \("slug"\) DO UPDATE/g)).toHaveLength(2);
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);
  });

  it('keeps the same lookup values in the idempotent production seed', async () => {
    const seed = await readFile(fileURLToPath(seedUrl), 'utf8');

    for (const name of [...categories, ...departments]) {
      expect(seed).toContain(`'${name}'`);
    }
    expect(seed).toContain('prisma.documentCategory.upsert');
    expect(seed).toContain('prisma.owningDepartment.upsert');
  });
});
