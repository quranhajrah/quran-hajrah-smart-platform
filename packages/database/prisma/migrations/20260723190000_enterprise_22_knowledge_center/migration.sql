-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConfidentialityLevel" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('STRATEGIC_PLAN', 'OPERATIONAL_PLAN', 'BUDGET', 'POLICY', 'REGULATION', 'REPORT', 'MINUTES', 'LETTER', 'CONTRACT', 'GOVERNANCE', 'FINANCIAL', 'PROGRAM', 'EMPLOYEE', 'EDUCATIONAL', 'MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentAuditAction" AS ENUM ('CREATED', 'UPLOADED', 'VIEWED', 'DOWNLOADED', 'UPDATED', 'VERSION_UPLOADED', 'ARCHIVED', 'RESTORED', 'DELETED');

-- CreateTable
CREATE TABLE "DocumentCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalFileName" TEXT,
    "storedFileName" TEXT,
    "mimeType" TEXT,
    "fileSize" BIGINT,
    "storagePath" TEXT,
    "categoryId" UUID NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentNumber" TEXT,
    "documentDate" DATE,
    "effectiveDate" DATE,
    "expiryDate" DATE,
    "versionNumber" INTEGER NOT NULL DEFAULT 0,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "confidentialityLevel" "ConfidentialityLevel" NOT NULL DEFAULT 'INTERNAL',
    "owningDepartment" TEXT NOT NULL,
    "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTag" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTagAssignment" (
    "documentId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentTagAssignment_pkey" PRIMARY KEY ("documentId","tagId")
);

-- CreateTable
CREATE TABLE "DocumentAccessRule" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "userId" UUID,
    "roleId" UUID,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canDownload" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentAccessRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DocumentAccessRule_principal_check" CHECK (
      ("userId" IS NOT NULL AND "roleId" IS NULL)
      OR ("userId" IS NULL AND "roleId" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "DocumentAuditLog" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionId" UUID,
    "userId" UUID,
    "action" "DocumentAuditAction" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCategory_name_key" ON "DocumentCategory"("name");
CREATE UNIQUE INDEX "DocumentCategory_slug_key" ON "DocumentCategory"("slug");
CREATE INDEX "DocumentCategory_isActive_sortOrder_idx" ON "DocumentCategory"("isActive", "sortOrder");
CREATE UNIQUE INDEX "Document_storagePath_key" ON "Document"("storagePath");
CREATE INDEX "Document_categoryId_status_idx" ON "Document"("categoryId", "status");
CREATE INDEX "Document_documentType_status_idx" ON "Document"("documentType", "status");
CREATE INDEX "Document_confidentialityLevel_status_idx" ON "Document"("confidentialityLevel", "status");
CREATE INDEX "Document_owningDepartment_status_idx" ON "Document"("owningDepartment", "status");
CREATE INDEX "Document_documentDate_idx" ON "Document"("documentDate");
CREATE INDEX "Document_expiryDate_status_idx" ON "Document"("expiryDate", "status");
CREATE INDEX "Document_isArchived_deletedAt_idx" ON "Document"("isArchived", "deletedAt");
CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");
CREATE INDEX "Document_createdById_idx" ON "Document"("createdById");
CREATE INDEX "Document_updatedById_idx" ON "Document"("updatedById");
CREATE UNIQUE INDEX "DocumentVersion_storagePath_key" ON "DocumentVersion"("storagePath");
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");
CREATE INDEX "DocumentVersion_documentId_createdAt_idx" ON "DocumentVersion"("documentId", "createdAt");
CREATE INDEX "DocumentVersion_createdById_idx" ON "DocumentVersion"("createdById");
CREATE UNIQUE INDEX "DocumentTag_name_key" ON "DocumentTag"("name");
CREATE UNIQUE INDEX "DocumentTag_slug_key" ON "DocumentTag"("slug");
CREATE INDEX "DocumentTagAssignment_tagId_idx" ON "DocumentTagAssignment"("tagId");
CREATE UNIQUE INDEX "DocumentAccessRule_documentId_userId_key" ON "DocumentAccessRule"("documentId", "userId");
CREATE UNIQUE INDEX "DocumentAccessRule_documentId_roleId_key" ON "DocumentAccessRule"("documentId", "roleId");
CREATE INDEX "DocumentAccessRule_userId_documentId_idx" ON "DocumentAccessRule"("userId", "documentId");
CREATE INDEX "DocumentAccessRule_roleId_documentId_idx" ON "DocumentAccessRule"("roleId", "documentId");
CREATE INDEX "DocumentAccessRule_expiresAt_idx" ON "DocumentAccessRule"("expiresAt");
CREATE INDEX "DocumentAccessRule_createdById_idx" ON "DocumentAccessRule"("createdById");
CREATE INDEX "DocumentAuditLog_documentId_createdAt_idx" ON "DocumentAuditLog"("documentId", "createdAt");
CREATE INDEX "DocumentAuditLog_userId_createdAt_idx" ON "DocumentAuditLog"("userId", "createdAt");
CREATE INDEX "DocumentAuditLog_action_createdAt_idx" ON "DocumentAuditLog"("action", "createdAt");
CREATE INDEX "DocumentAuditLog_versionId_idx" ON "DocumentAuditLog"("versionId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocumentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentTagAssignment" ADD CONSTRAINT "DocumentTagAssignment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentTagAssignment" ADD CONSTRAINT "DocumentTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "DocumentTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAccessRule" ADD CONSTRAINT "DocumentAccessRule_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAccessRule" ADD CONSTRAINT "DocumentAccessRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAccessRule" ADD CONSTRAINT "DocumentAccessRule_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAccessRule" ADD CONSTRAINT "DocumentAccessRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentAuditLog" ADD CONSTRAINT "DocumentAuditLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAuditLog" ADD CONSTRAINT "DocumentAuditLog_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentAuditLog" ADD CONSTRAINT "DocumentAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
