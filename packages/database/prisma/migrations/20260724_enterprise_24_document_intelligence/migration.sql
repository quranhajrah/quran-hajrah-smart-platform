-- CreateEnum
CREATE TYPE "AnalysisJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'TEXT_EXTRACTED', 'PROPOSALS_READY', 'UNDER_REVIEW', 'PARTIALLY_APPROVED', 'APPROVED', 'IMPORTING', 'IMPORTED', 'FAILED', 'OCR_REQUIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExtractionProposalType" AS ENUM ('STRATEGIC_OBJECTIVE', 'KPI', 'METRIC', 'INITIATIVE', 'MILESTONE', 'RISK', 'RISK_TREATMENT', 'BUDGET', 'BUDGET_LINE', 'BENEFICIARY_GROUP', 'RESPONSIBLE_DEPARTMENT', 'DOCUMENT_DATE', 'DOCUMENT_NUMBER', 'POLICY_REQUIREMENT', 'GOVERNANCE_SCORE', 'FINANCIAL_VALUE', 'REPORTING_PERIOD', 'OTHER');

-- CreateEnum
CREATE TYPE "ProposalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EDITED');

-- CreateEnum
CREATE TYPE "ImportTargetType" AS ENUM ('STRATEGIC_OBJECTIVE', 'KPI', 'METRIC', 'METRIC_VALUE', 'INITIATIVE', 'MILESTONE', 'RISK', 'RISK_TREATMENT', 'EXECUTIVE_ALERT', 'EXECUTIVE_REPORT_SECTION', 'BUDGET_RECORD', 'BUDGET_LINE', 'NONE');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('PREVIEW', 'IMPORTING', 'IMPORTED', 'FAILED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "DocumentAnalysisJob" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "AnalysisJobStatus" NOT NULL DEFAULT 'QUEUED',
    "extractionProvider" TEXT,
    "extractionVersion" TEXT NOT NULL,
    "extractionMethod" TEXT,
    "requestedById" UUID NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "providerMetadata" JSONB,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "tableCount" INTEGER NOT NULL DEFAULT 0,
    "proposalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPage" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "hasEmbeddedText" BOOLEAN NOT NULL DEFAULT false,
    "textLength" INTEGER NOT NULL DEFAULT 0,
    "extractionQuality" DECIMAL(5,4),
    "width" DECIMAL(12,4),
    "height" DECIMAL(12,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExtractedText" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "languageHint" TEXT,
    "extractionMethod" TEXT NOT NULL,
    "extractionVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentExtractedText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExtractedTable" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "tableIndex" INTEGER NOT NULL,
    "title" TEXT,
    "sourceSection" TEXT,
    "rowCount" INTEGER NOT NULL,
    "columnCount" INTEGER NOT NULL,
    "extractionMethod" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentExtractedTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTableCell" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "columnIndex" INTEGER NOT NULL,
    "rowSpan" INTEGER NOT NULL DEFAULT 1,
    "columnSpan" INTEGER NOT NULL DEFAULT 1,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTableCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionProposal" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,
    "proposalType" "ExtractionProposalType" NOT NULL,
    "decision" "ProposalDecision" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "proposedData" JSONB NOT NULL,
    "editedData" JSONB,
    "importTargetType" "ImportTargetType" NOT NULL DEFAULT 'NONE',
    "extractionRuleId" TEXT NOT NULL,
    "extractionMethod" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "sourcePage" INTEGER,
    "sourceSection" TEXT,
    "evidenceSnippet" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExtractionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionProposalField" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "value" JSONB,
    "sourceValue" TEXT,
    "confidence" DECIMAL(5,4),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionProposalField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionReview" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" "ProposalDecision" NOT NULL,
    "comment" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionImportBatch" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PREVIEW',
    "importedById" UUID NOT NULL,
    "summary" JSONB,
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionImportItem" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "targetType" "ImportTargetType" NOT NULL,
    "targetRecordId" TEXT,
    "requestedAction" TEXT NOT NULL,
    "appliedAction" TEXT,
    "status" TEXT NOT NULL,
    "conflict" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceEvidenceReference" (
    "id" UUID NOT NULL,
    "sourceDocumentId" UUID NOT NULL,
    "sourceDocumentVersionId" UUID NOT NULL,
    "sourceProposalId" UUID NOT NULL,
    "importItemId" UUID,
    "targetType" "ImportTargetType" NOT NULL,
    "targetRecordId" TEXT NOT NULL,
    "sourcePage" INTEGER,
    "sourceSection" TEXT,
    "sourceEvidence" TEXT,
    "extractionMethod" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" UUID NOT NULL,

    CONSTRAINT "SourceEvidenceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAnalysisConfiguration" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "providerVersion" TEXT NOT NULL,
    "maxFileSizeBytes" INTEGER NOT NULL,
    "maxPages" INTEGER NOT NULL,
    "maxTables" INTEGER NOT NULL,
    "minimumTextCharacters" INTEGER NOT NULL,
    "proposalConfidence" DECIMAL(5,4) NOT NULL,
    "reviewSlaHours" INTEGER NOT NULL,
    "enabledDocumentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabledRuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAnalysisConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAnalysisAuditLog" (
    "id" UUID NOT NULL,
    "jobId" UUID,
    "proposalId" UUID,
    "importBatchId" UUID,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAnalysisAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetRecord" (
    "id" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "totalPlanned" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "department" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BudgetRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" UUID NOT NULL,
    "budgetRecordId" UUID NOT NULL,
    "code" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "plannedAmount" DECIMAL(18,2) NOT NULL,
    "actualAmount" DECIMAL(18,2),
    "department" TEXT,
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAnalysisJob_fingerprint_key" ON "DocumentAnalysisJob"("fingerprint");

-- CreateIndex
CREATE INDEX "DocumentAnalysisJob_documentId_createdAt_idx" ON "DocumentAnalysisJob"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAnalysisJob_documentVersionId_createdAt_idx" ON "DocumentAnalysisJob"("documentVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAnalysisJob_status_createdAt_idx" ON "DocumentAnalysisJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAnalysisJob_requestedById_createdAt_idx" ON "DocumentAnalysisJob"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAnalysisJob_reviewDueAt_status_idx" ON "DocumentAnalysisJob"("reviewDueAt", "status");

-- CreateIndex
CREATE INDEX "DocumentAnalysisJob_deletedAt_idx" ON "DocumentAnalysisJob"("deletedAt");

-- CreateIndex
CREATE INDEX "DocumentPage_documentId_pageNumber_idx" ON "DocumentPage"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "DocumentPage_hasEmbeddedText_idx" ON "DocumentPage"("hasEmbeddedText");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPage_jobId_pageNumber_key" ON "DocumentPage"("jobId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentExtractedText_pageId_key" ON "DocumentExtractedText"("pageId");

-- CreateIndex
CREATE INDEX "DocumentExtractedText_createdAt_idx" ON "DocumentExtractedText"("createdAt");

-- CreateIndex
CREATE INDEX "DocumentExtractedTable_jobId_pageId_idx" ON "DocumentExtractedTable"("jobId", "pageId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentExtractedTable_pageId_tableIndex_key" ON "DocumentExtractedTable"("pageId", "tableIndex");

-- CreateIndex
CREATE INDEX "DocumentTableCell_tableId_rowIndex_idx" ON "DocumentTableCell"("tableId", "rowIndex");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTableCell_tableId_rowIndex_columnIndex_key" ON "DocumentTableCell"("tableId", "rowIndex", "columnIndex");

-- CreateIndex
CREATE INDEX "ExtractionProposal_jobId_decision_proposalType_idx" ON "ExtractionProposal"("jobId", "decision", "proposalType");

-- CreateIndex
CREATE INDEX "ExtractionProposal_documentId_createdAt_idx" ON "ExtractionProposal"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "ExtractionProposal_documentVersionId_idx" ON "ExtractionProposal"("documentVersionId");

-- CreateIndex
CREATE INDEX "ExtractionProposal_reviewedById_reviewedAt_idx" ON "ExtractionProposal"("reviewedById", "reviewedAt");

-- CreateIndex
CREATE INDEX "ExtractionProposal_importTargetType_decision_idx" ON "ExtractionProposal"("importTargetType", "decision");

-- CreateIndex
CREATE INDEX "ExtractionProposal_deletedAt_idx" ON "ExtractionProposal"("deletedAt");

-- CreateIndex
CREATE INDEX "ExtractionProposalField_proposalId_sortOrder_idx" ON "ExtractionProposalField"("proposalId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionProposalField_proposalId_key_key" ON "ExtractionProposalField"("proposalId", "key");

-- CreateIndex
CREATE INDEX "ExtractionReview_proposalId_createdAt_idx" ON "ExtractionReview"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "ExtractionReview_reviewerId_createdAt_idx" ON "ExtractionReview"("reviewerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionImportBatch_idempotencyKey_key" ON "ExtractionImportBatch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ExtractionImportBatch_jobId_createdAt_idx" ON "ExtractionImportBatch"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "ExtractionImportBatch_status_createdAt_idx" ON "ExtractionImportBatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExtractionImportBatch_importedById_createdAt_idx" ON "ExtractionImportBatch"("importedById", "createdAt");

-- CreateIndex
CREATE INDEX "ExtractionImportItem_proposalId_status_idx" ON "ExtractionImportItem"("proposalId", "status");

-- CreateIndex
CREATE INDEX "ExtractionImportItem_targetType_targetRecordId_idx" ON "ExtractionImportItem"("targetType", "targetRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionImportItem_batchId_proposalId_key" ON "ExtractionImportItem"("batchId", "proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceEvidenceReference_importItemId_key" ON "SourceEvidenceReference"("importItemId");

-- CreateIndex
CREATE INDEX "SourceEvidenceReference_sourceDocumentId_sourcePage_idx" ON "SourceEvidenceReference"("sourceDocumentId", "sourcePage");

-- CreateIndex
CREATE INDEX "SourceEvidenceReference_sourceDocumentVersionId_idx" ON "SourceEvidenceReference"("sourceDocumentVersionId");

-- CreateIndex
CREATE INDEX "SourceEvidenceReference_targetType_targetRecordId_idx" ON "SourceEvidenceReference"("targetType", "targetRecordId");

-- CreateIndex
CREATE INDEX "SourceEvidenceReference_importedById_importedAt_idx" ON "SourceEvidenceReference"("importedById", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceEvidenceReference_sourceProposalId_targetType_targetR_key" ON "SourceEvidenceReference"("sourceProposalId", "targetType", "targetRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAnalysisConfiguration_key_key" ON "DocumentAnalysisConfiguration"("key");

-- CreateIndex
CREATE INDEX "DocumentAnalysisConfiguration_isActive_idx" ON "DocumentAnalysisConfiguration"("isActive");

-- CreateIndex
CREATE INDEX "DocumentAnalysisConfiguration_updatedById_idx" ON "DocumentAnalysisConfiguration"("updatedById");

-- CreateIndex
CREATE INDEX "DocumentAnalysisAuditLog_jobId_createdAt_idx" ON "DocumentAnalysisAuditLog"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAnalysisAuditLog_proposalId_createdAt_idx" ON "DocumentAnalysisAuditLog"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAnalysisAuditLog_importBatchId_createdAt_idx" ON "DocumentAnalysisAuditLog"("importBatchId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAnalysisAuditLog_userId_createdAt_idx" ON "DocumentAnalysisAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAnalysisAuditLog_action_createdAt_idx" ON "DocumentAnalysisAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "BudgetRecord_fiscalYear_deletedAt_idx" ON "BudgetRecord"("fiscalYear", "deletedAt");

-- CreateIndex
CREATE INDEX "BudgetRecord_department_idx" ON "BudgetRecord"("department");

-- CreateIndex
CREATE INDEX "BudgetRecord_createdById_idx" ON "BudgetRecord"("createdById");

-- CreateIndex
CREATE INDEX "BudgetRecord_updatedById_idx" ON "BudgetRecord"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetRecord_fiscalYear_title_key" ON "BudgetRecord"("fiscalYear", "title");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetRecordId_deletedAt_idx" ON "BudgetLine"("budgetRecordId", "deletedAt");

-- CreateIndex
CREATE INDEX "BudgetLine_department_idx" ON "BudgetLine"("department");

-- CreateIndex
CREATE INDEX "BudgetLine_createdById_idx" ON "BudgetLine"("createdById");

-- CreateIndex
CREATE INDEX "BudgetLine_updatedById_idx" ON "BudgetLine"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_budgetRecordId_category_code_key" ON "BudgetLine"("budgetRecordId", "category", "code");

-- AddForeignKey
ALTER TABLE "DocumentAnalysisJob" ADD CONSTRAINT "DocumentAnalysisJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisJob" ADD CONSTRAINT "DocumentAnalysisJob_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisJob" ADD CONSTRAINT "DocumentAnalysisJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPage" ADD CONSTRAINT "DocumentPage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DocumentAnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPage" ADD CONSTRAINT "DocumentPage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtractedText" ADD CONSTRAINT "DocumentExtractedText_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DocumentPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtractedTable" ADD CONSTRAINT "DocumentExtractedTable_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DocumentAnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtractedTable" ADD CONSTRAINT "DocumentExtractedTable_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DocumentPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTableCell" ADD CONSTRAINT "DocumentTableCell_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DocumentExtractedTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionProposal" ADD CONSTRAINT "ExtractionProposal_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DocumentAnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionProposal" ADD CONSTRAINT "ExtractionProposal_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionProposal" ADD CONSTRAINT "ExtractionProposal_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionProposal" ADD CONSTRAINT "ExtractionProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionProposalField" ADD CONSTRAINT "ExtractionProposalField_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ExtractionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionReview" ADD CONSTRAINT "ExtractionReview_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ExtractionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionReview" ADD CONSTRAINT "ExtractionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionImportBatch" ADD CONSTRAINT "ExtractionImportBatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DocumentAnalysisJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionImportBatch" ADD CONSTRAINT "ExtractionImportBatch_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionImportItem" ADD CONSTRAINT "ExtractionImportItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ExtractionImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionImportItem" ADD CONSTRAINT "ExtractionImportItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ExtractionProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvidenceReference" ADD CONSTRAINT "SourceEvidenceReference_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvidenceReference" ADD CONSTRAINT "SourceEvidenceReference_sourceDocumentVersionId_fkey" FOREIGN KEY ("sourceDocumentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvidenceReference" ADD CONSTRAINT "SourceEvidenceReference_sourceProposalId_fkey" FOREIGN KEY ("sourceProposalId") REFERENCES "ExtractionProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvidenceReference" ADD CONSTRAINT "SourceEvidenceReference_importItemId_fkey" FOREIGN KEY ("importItemId") REFERENCES "ExtractionImportItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvidenceReference" ADD CONSTRAINT "SourceEvidenceReference_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisConfiguration" ADD CONSTRAINT "DocumentAnalysisConfiguration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisConfiguration" ADD CONSTRAINT "DocumentAnalysisConfiguration_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisAuditLog" ADD CONSTRAINT "DocumentAnalysisAuditLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DocumentAnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisAuditLog" ADD CONSTRAINT "DocumentAnalysisAuditLog_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ExtractionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisAuditLog" ADD CONSTRAINT "DocumentAnalysisAuditLog_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ExtractionImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysisAuditLog" ADD CONSTRAINT "DocumentAnalysisAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRecord" ADD CONSTRAINT "BudgetRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRecord" ADD CONSTRAINT "BudgetRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetRecordId_fkey" FOREIGN KEY ("budgetRecordId") REFERENCES "BudgetRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
