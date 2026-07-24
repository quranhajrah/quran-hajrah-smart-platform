-- CreateTable
CREATE TABLE "OwningDepartment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwningDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwningDepartment_name_key" ON "OwningDepartment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OwningDepartment_slug_key" ON "OwningDepartment"("slug");

-- CreateIndex
CREATE INDEX "OwningDepartment_isActive_sortOrder_idx" ON "OwningDepartment"("isActive", "sortOrder");

-- Guarantee the Knowledge Center reference data even before the idempotent seed runs.
INSERT INTO "DocumentCategory"
    ("id", "name", "slug", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid(), 'الخطط الاستراتيجية', 'strategic-plans', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الخطط التشغيلية', 'operational-plans', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الموازنات', 'budgets', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'اللوائح والسياسات', 'policies-regulations', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الحوكمة والامتثال', 'governance-compliance', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'التقارير', 'reports', true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'محاضر الاجتماعات', 'meeting-minutes', true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الخطابات', 'letters-correspondence', true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'العقود', 'contracts', true, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'البرامج والمبادرات', 'programs-initiatives', true, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الشؤون التعليمية', 'education', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الشؤون المالية', 'finance', true, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الموارد البشرية', 'human-resources', true, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الإعلام', 'media-brand', true, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الأوقاف', 'endowments-sustainability', true, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'ملفات أخرى', 'other', true, 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "isActive" = true,
    "sortOrder" = EXCLUDED."sortOrder",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "OwningDepartment"
    ("id", "name", "slug", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid(), 'الإدارة التنفيذية', 'executive-management', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الشؤون التعليمية', 'education-affairs', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الشؤون المالية', 'finance-affairs', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'تنمية الموارد', 'resource-development', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الحوكمة', 'governance', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الإعلام', 'media', true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'الموارد البشرية', 'human-resources', true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'مجلس الإدارة', 'board-of-directors', true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "isActive" = true,
    "sortOrder" = EXCLUDED."sortOrder",
    "updatedAt" = CURRENT_TIMESTAMP;
