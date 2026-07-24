-- Enterprise 23 Executive Intelligence is an additive migration.
CREATE TYPE "MetricDataType" AS ENUM ('NUMBER', 'PERCENTAGE', 'CURRENCY', 'TEXT');
CREATE TYPE "MetricFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'ON_DEMAND');
CREATE TYPE "KpiStatus" AS ENUM ('NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED');
CREATE TYPE "InitiativeStatus" AS ENUM ('PLANNED', 'ACTIVE', 'AT_RISK', 'DELAYED', 'COMPLETED', 'CANCELLED', 'ON_HOLD');
CREATE TYPE "RiskLikelihood" AS ENUM ('RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN');
CREATE TYPE "RiskImpact" AS ENUM ('INSIGNIFICANT', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE');
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'UNDER_TREATMENT', 'ACCEPTED', 'CLOSED');
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ExecutiveReportStatus" AS ENUM ('DRAFT', 'GENERATED', 'APPROVED', 'ARCHIVED');
CREATE TYPE "ExecutiveReportType" AS ENUM ('BOARD', 'MONTHLY_PERFORMANCE', 'QUARTERLY_PERFORMANCE', 'OPERATIONAL_PLAN', 'RISKS', 'GOVERNANCE', 'KNOWLEDGE_CENTER', 'COMPREHENSIVE');

CREATE TABLE "InstitutionalMetric" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "description" TEXT,
  "unit" TEXT,
  "dataType" "MetricDataType" NOT NULL,
  "frequency" "MetricFrequency" NOT NULL,
  "responsibleDepartment" TEXT,
  "targetValue" DECIMAL(18,4),
  "warningThreshold" DECIMAL(18,4),
  "criticalThreshold" DECIMAL(18,4),
  "currentNumericValue" DECIMAL(18,4),
  "currentTextValue" TEXT,
  "currentMeasuredAt" TIMESTAMP(3),
  "sourceType" TEXT,
  "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "InstitutionalMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetricValue" (
  "id" UUID NOT NULL,
  "metricId" UUID NOT NULL,
  "numericValue" DECIMAL(18,4),
  "textValue" TEXT,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "sourceType" TEXT,
  "sourceDocumentId" UUID,
  "notes" TEXT,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "MetricValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategicObjective" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "strategicAxis" TEXT NOT NULL,
  "baseline" DECIMAL(18,4),
  "target" DECIMAL(18,4),
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "ownerId" UUID,
  "status" "KpiStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "weight" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "progress" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "StrategicObjective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategicKpi" (
  "id" UUID NOT NULL,
  "objectiveId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "formula" TEXT,
  "baseline" DECIMAL(18,4),
  "target" DECIMAL(18,4) NOT NULL,
  "currentValue" DECIMAL(18,4),
  "unit" TEXT,
  "frequency" "MetricFrequency" NOT NULL,
  "ownerId" UUID,
  "dataSource" TEXT,
  "status" "KpiStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "weight" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "StrategicKpi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KpiMeasurement" (
  "id" UUID NOT NULL,
  "kpiId" UUID NOT NULL,
  "value" DECIMAL(18,4) NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "sourceDocumentId" UUID,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "KpiMeasurement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalInitiative" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "objectiveId" UUID,
  "department" TEXT NOT NULL,
  "ownerId" UUID,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "budget" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "actualSpending" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "progress" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "status" "InitiativeStatus" NOT NULL DEFAULT 'PLANNED',
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "OperationalInitiative_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InitiativeMilestone" (
  "id" UUID NOT NULL,
  "initiativeId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueDate" DATE NOT NULL,
  "completedAt" TIMESTAMP(3),
  "progress" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "status" "KpiStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "InitiativeMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InitiativeUpdate" (
  "id" UUID NOT NULL,
  "initiativeId" UUID NOT NULL,
  "summary" TEXT NOT NULL,
  "progress" DECIMAL(5,2) NOT NULL,
  "status" "InitiativeStatus" NOT NULL,
  "actualSpending" DECIMAL(18,2),
  "updateDate" DATE NOT NULL,
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "InitiativeUpdate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InitiativeEvidence" (
  "initiativeId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "addedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InitiativeEvidence_pkey" PRIMARY KEY ("initiativeId", "documentId")
);

CREATE TABLE "InstitutionalRisk" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "cause" TEXT,
  "consequence" TEXT,
  "likelihood" "RiskLikelihood" NOT NULL,
  "impact" "RiskImpact" NOT NULL,
  "inherentScore" INTEGER NOT NULL,
  "existingControls" TEXT,
  "residualLikelihood" "RiskLikelihood" NOT NULL,
  "residualImpact" "RiskImpact" NOT NULL,
  "residualScore" INTEGER NOT NULL,
  "ownerId" UUID,
  "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
  "dueDate" DATE,
  "reviewDate" DATE,
  "objectiveId" UUID,
  "initiativeId" UUID,
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "InstitutionalRisk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskTreatment" (
  "id" UUID NOT NULL,
  "riskId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "ownerId" UUID,
  "dueDate" DATE NOT NULL,
  "completedAt" TIMESTAMP(3),
  "progress" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "status" "KpiStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "RiskTreatment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskEvidence" (
  "riskId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "addedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskEvidence_pkey" PRIMARY KEY ("riskId", "documentId")
);

CREATE TABLE "ExecutiveAlert" (
  "id" UUID NOT NULL,
  "severity" "AlertSeverity" NOT NULL,
  "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "sourceModule" TEXT NOT NULL,
  "sourceRecordId" TEXT,
  "fingerprint" TEXT,
  "dueDate" TIMESTAMP(3),
  "assignedUserId" UUID,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" UUID,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" UUID,
  "dismissedAt" TIMESTAMP(3),
  "dismissedById" UUID,
  "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ExecutiveAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutiveDashboardPreference" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "userId" UUID,
  "healthWeights" JSONB NOT NULL,
  "layout" JSONB,
  "quickActions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdById" UUID,
  "updatedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ExecutiveDashboardPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutiveHealthSnapshot" (
  "id" UUID NOT NULL,
  "score" DECIMAL(5,2),
  "coverage" DECIMAL(5,2) NOT NULL,
  "rating" TEXT,
  "components" JSONB NOT NULL,
  "missingData" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "explanation" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExecutiveHealthSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutiveReport" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "reportType" "ExecutiveReportType" NOT NULL,
  "status" "ExecutiveReportStatus" NOT NULL DEFAULT 'DRAFT',
  "periodStart" DATE,
  "periodEnd" DATE,
  "generatedAt" TIMESTAMP(3),
  "preparedById" UUID NOT NULL,
  "approvedById" UUID,
  "approvedAt" TIMESTAMP(3),
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ExecutiveReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutiveReportSection" (
  "id" UUID NOT NULL,
  "reportId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "sourceReferences" JSONB,
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ExecutiveReportSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstitutionalMetric_key_key" ON "InstitutionalMetric"("key");
CREATE INDEX "InstitutionalMetric_isActive_deletedAt_idx" ON "InstitutionalMetric"("isActive", "deletedAt");
CREATE INDEX "InstitutionalMetric_responsibleDepartment_idx" ON "InstitutionalMetric"("responsibleDepartment");
CREATE INDEX "InstitutionalMetric_currentMeasuredAt_idx" ON "InstitutionalMetric"("currentMeasuredAt");
CREATE INDEX "InstitutionalMetric_createdById_idx" ON "InstitutionalMetric"("createdById");
CREATE INDEX "InstitutionalMetric_updatedById_idx" ON "InstitutionalMetric"("updatedById");
CREATE INDEX "MetricValue_metricId_measuredAt_idx" ON "MetricValue"("metricId", "measuredAt");
CREATE INDEX "MetricValue_sourceDocumentId_idx" ON "MetricValue"("sourceDocumentId");
CREATE INDEX "MetricValue_createdById_idx" ON "MetricValue"("createdById");
CREATE INDEX "MetricValue_deletedAt_idx" ON "MetricValue"("deletedAt");
CREATE UNIQUE INDEX "StrategicObjective_code_key" ON "StrategicObjective"("code");
CREATE INDEX "StrategicObjective_strategicAxis_status_idx" ON "StrategicObjective"("strategicAxis", "status");
CREATE INDEX "StrategicObjective_ownerId_status_idx" ON "StrategicObjective"("ownerId", "status");
CREATE INDEX "StrategicObjective_startDate_endDate_idx" ON "StrategicObjective"("startDate", "endDate");
CREATE INDEX "StrategicObjective_deletedAt_idx" ON "StrategicObjective"("deletedAt");
CREATE INDEX "StrategicObjective_createdById_idx" ON "StrategicObjective"("createdById");
CREATE INDEX "StrategicObjective_updatedById_idx" ON "StrategicObjective"("updatedById");
CREATE UNIQUE INDEX "StrategicKpi_code_key" ON "StrategicKpi"("code");
CREATE INDEX "StrategicKpi_objectiveId_status_idx" ON "StrategicKpi"("objectiveId", "status");
CREATE INDEX "StrategicKpi_ownerId_status_idx" ON "StrategicKpi"("ownerId", "status");
CREATE INDEX "StrategicKpi_frequency_status_idx" ON "StrategicKpi"("frequency", "status");
CREATE INDEX "StrategicKpi_deletedAt_idx" ON "StrategicKpi"("deletedAt");
CREATE INDEX "StrategicKpi_createdById_idx" ON "StrategicKpi"("createdById");
CREATE INDEX "StrategicKpi_updatedById_idx" ON "StrategicKpi"("updatedById");
CREATE INDEX "KpiMeasurement_kpiId_measuredAt_idx" ON "KpiMeasurement"("kpiId", "measuredAt");
CREATE INDEX "KpiMeasurement_sourceDocumentId_idx" ON "KpiMeasurement"("sourceDocumentId");
CREATE INDEX "KpiMeasurement_createdById_idx" ON "KpiMeasurement"("createdById");
CREATE INDEX "KpiMeasurement_deletedAt_idx" ON "KpiMeasurement"("deletedAt");
CREATE UNIQUE INDEX "OperationalInitiative_code_key" ON "OperationalInitiative"("code");
CREATE INDEX "OperationalInitiative_objectiveId_status_idx" ON "OperationalInitiative"("objectiveId", "status");
CREATE INDEX "OperationalInitiative_department_status_idx" ON "OperationalInitiative"("department", "status");
CREATE INDEX "OperationalInitiative_ownerId_status_idx" ON "OperationalInitiative"("ownerId", "status");
CREATE INDEX "OperationalInitiative_startDate_endDate_idx" ON "OperationalInitiative"("startDate", "endDate");
CREATE INDEX "OperationalInitiative_deletedAt_idx" ON "OperationalInitiative"("deletedAt");
CREATE INDEX "OperationalInitiative_createdById_idx" ON "OperationalInitiative"("createdById");
CREATE INDEX "OperationalInitiative_updatedById_idx" ON "OperationalInitiative"("updatedById");
CREATE INDEX "InitiativeMilestone_initiativeId_dueDate_idx" ON "InitiativeMilestone"("initiativeId", "dueDate");
CREATE INDEX "InitiativeMilestone_status_dueDate_idx" ON "InitiativeMilestone"("status", "dueDate");
CREATE INDEX "InitiativeMilestone_deletedAt_idx" ON "InitiativeMilestone"("deletedAt");
CREATE INDEX "InitiativeMilestone_createdById_idx" ON "InitiativeMilestone"("createdById");
CREATE INDEX "InitiativeMilestone_updatedById_idx" ON "InitiativeMilestone"("updatedById");
CREATE INDEX "InitiativeUpdate_initiativeId_updateDate_idx" ON "InitiativeUpdate"("initiativeId", "updateDate");
CREATE INDEX "InitiativeUpdate_status_updateDate_idx" ON "InitiativeUpdate"("status", "updateDate");
CREATE INDEX "InitiativeUpdate_deletedAt_idx" ON "InitiativeUpdate"("deletedAt");
CREATE INDEX "InitiativeUpdate_createdById_idx" ON "InitiativeUpdate"("createdById");
CREATE INDEX "InitiativeUpdate_updatedById_idx" ON "InitiativeUpdate"("updatedById");
CREATE INDEX "InitiativeEvidence_documentId_idx" ON "InitiativeEvidence"("documentId");
CREATE INDEX "InitiativeEvidence_addedById_idx" ON "InitiativeEvidence"("addedById");
CREATE UNIQUE INDEX "InstitutionalRisk_code_key" ON "InstitutionalRisk"("code");
CREATE INDEX "InstitutionalRisk_status_residualScore_idx" ON "InstitutionalRisk"("status", "residualScore");
CREATE INDEX "InstitutionalRisk_category_status_idx" ON "InstitutionalRisk"("category", "status");
CREATE INDEX "InstitutionalRisk_ownerId_status_idx" ON "InstitutionalRisk"("ownerId", "status");
CREATE INDEX "InstitutionalRisk_objectiveId_idx" ON "InstitutionalRisk"("objectiveId");
CREATE INDEX "InstitutionalRisk_initiativeId_idx" ON "InstitutionalRisk"("initiativeId");
CREATE INDEX "InstitutionalRisk_dueDate_idx" ON "InstitutionalRisk"("dueDate");
CREATE INDEX "InstitutionalRisk_reviewDate_idx" ON "InstitutionalRisk"("reviewDate");
CREATE INDEX "InstitutionalRisk_deletedAt_idx" ON "InstitutionalRisk"("deletedAt");
CREATE INDEX "InstitutionalRisk_createdById_idx" ON "InstitutionalRisk"("createdById");
CREATE INDEX "InstitutionalRisk_updatedById_idx" ON "InstitutionalRisk"("updatedById");
CREATE INDEX "RiskTreatment_riskId_status_idx" ON "RiskTreatment"("riskId", "status");
CREATE INDEX "RiskTreatment_ownerId_status_idx" ON "RiskTreatment"("ownerId", "status");
CREATE INDEX "RiskTreatment_dueDate_status_idx" ON "RiskTreatment"("dueDate", "status");
CREATE INDEX "RiskTreatment_deletedAt_idx" ON "RiskTreatment"("deletedAt");
CREATE INDEX "RiskTreatment_createdById_idx" ON "RiskTreatment"("createdById");
CREATE INDEX "RiskTreatment_updatedById_idx" ON "RiskTreatment"("updatedById");
CREATE INDEX "RiskEvidence_documentId_idx" ON "RiskEvidence"("documentId");
CREATE INDEX "RiskEvidence_addedById_idx" ON "RiskEvidence"("addedById");
CREATE UNIQUE INDEX "ExecutiveAlert_fingerprint_key" ON "ExecutiveAlert"("fingerprint");
CREATE INDEX "ExecutiveAlert_status_severity_idx" ON "ExecutiveAlert"("status", "severity");
CREATE INDEX "ExecutiveAlert_sourceModule_sourceRecordId_idx" ON "ExecutiveAlert"("sourceModule", "sourceRecordId");
CREATE INDEX "ExecutiveAlert_assignedUserId_status_idx" ON "ExecutiveAlert"("assignedUserId", "status");
CREATE INDEX "ExecutiveAlert_dueDate_status_idx" ON "ExecutiveAlert"("dueDate", "status");
CREATE INDEX "ExecutiveAlert_deletedAt_idx" ON "ExecutiveAlert"("deletedAt");
CREATE INDEX "ExecutiveAlert_createdById_idx" ON "ExecutiveAlert"("createdById");
CREATE INDEX "ExecutiveAlert_updatedById_idx" ON "ExecutiveAlert"("updatedById");
CREATE UNIQUE INDEX "ExecutiveDashboardPreference_key_key" ON "ExecutiveDashboardPreference"("key");
CREATE UNIQUE INDEX "ExecutiveDashboardPreference_userId_key" ON "ExecutiveDashboardPreference"("userId");
CREATE INDEX "ExecutiveDashboardPreference_isDefault_deletedAt_idx" ON "ExecutiveDashboardPreference"("isDefault", "deletedAt");
CREATE INDEX "ExecutiveDashboardPreference_createdById_idx" ON "ExecutiveDashboardPreference"("createdById");
CREATE INDEX "ExecutiveDashboardPreference_updatedById_idx" ON "ExecutiveDashboardPreference"("updatedById");
CREATE INDEX "ExecutiveHealthSnapshot_capturedAt_idx" ON "ExecutiveHealthSnapshot"("capturedAt");
CREATE INDEX "ExecutiveHealthSnapshot_createdById_idx" ON "ExecutiveHealthSnapshot"("createdById");
CREATE INDEX "ExecutiveReport_reportType_status_idx" ON "ExecutiveReport"("reportType", "status");
CREATE INDEX "ExecutiveReport_preparedById_status_idx" ON "ExecutiveReport"("preparedById", "status");
CREATE INDEX "ExecutiveReport_approvedById_idx" ON "ExecutiveReport"("approvedById");
CREATE INDEX "ExecutiveReport_generatedAt_idx" ON "ExecutiveReport"("generatedAt");
CREATE INDEX "ExecutiveReport_deletedAt_idx" ON "ExecutiveReport"("deletedAt");
CREATE INDEX "ExecutiveReport_createdById_idx" ON "ExecutiveReport"("createdById");
CREATE INDEX "ExecutiveReport_updatedById_idx" ON "ExecutiveReport"("updatedById");
CREATE INDEX "ExecutiveReportSection_reportId_sortOrder_idx" ON "ExecutiveReportSection"("reportId", "sortOrder");
CREATE INDEX "ExecutiveReportSection_deletedAt_idx" ON "ExecutiveReportSection"("deletedAt");
CREATE INDEX "ExecutiveReportSection_createdById_idx" ON "ExecutiveReportSection"("createdById");
CREATE INDEX "ExecutiveReportSection_updatedById_idx" ON "ExecutiveReportSection"("updatedById");

ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100);
ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_weight_check" CHECK ("weight" >= 0 AND "weight" <= 100);
ALTER TABLE "StrategicKpi" ADD CONSTRAINT "StrategicKpi_weight_check" CHECK ("weight" >= 0 AND "weight" <= 100);
ALTER TABLE "OperationalInitiative" ADD CONSTRAINT "OperationalInitiative_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100);
ALTER TABLE "OperationalInitiative" ADD CONSTRAINT "OperationalInitiative_budget_check" CHECK ("budget" >= 0 AND "actualSpending" >= 0);
ALTER TABLE "InitiativeMilestone" ADD CONSTRAINT "InitiativeMilestone_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100);
ALTER TABLE "InitiativeUpdate" ADD CONSTRAINT "InitiativeUpdate_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100);
ALTER TABLE "InstitutionalRisk" ADD CONSTRAINT "InstitutionalRisk_score_check" CHECK ("inherentScore" BETWEEN 1 AND 25 AND "residualScore" BETWEEN 1 AND 25);
ALTER TABLE "RiskTreatment" ADD CONSTRAINT "RiskTreatment_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100);
ALTER TABLE "ExecutiveHealthSnapshot" ADD CONSTRAINT "ExecutiveHealthSnapshot_score_check" CHECK (("score" IS NULL OR ("score" >= 0 AND "score" <= 100)) AND "coverage" >= 0 AND "coverage" <= 100);

ALTER TABLE "InstitutionalMetric" ADD CONSTRAINT "InstitutionalMetric_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstitutionalMetric" ADD CONSTRAINT "InstitutionalMetric_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetricValue" ADD CONSTRAINT "MetricValue_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "InstitutionalMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricValue" ADD CONSTRAINT "MetricValue_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetricValue" ADD CONSTRAINT "MetricValue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrategicObjective" ADD CONSTRAINT "StrategicObjective_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrategicKpi" ADD CONSTRAINT "StrategicKpi_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "StrategicObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrategicKpi" ADD CONSTRAINT "StrategicKpi_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StrategicKpi" ADD CONSTRAINT "StrategicKpi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrategicKpi" ADD CONSTRAINT "StrategicKpi_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KpiMeasurement" ADD CONSTRAINT "KpiMeasurement_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "StrategicKpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KpiMeasurement" ADD CONSTRAINT "KpiMeasurement_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KpiMeasurement" ADD CONSTRAINT "KpiMeasurement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalInitiative" ADD CONSTRAINT "OperationalInitiative_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "StrategicObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalInitiative" ADD CONSTRAINT "OperationalInitiative_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalInitiative" ADD CONSTRAINT "OperationalInitiative_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalInitiative" ADD CONSTRAINT "OperationalInitiative_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InitiativeMilestone" ADD CONSTRAINT "InitiativeMilestone_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "OperationalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InitiativeMilestone" ADD CONSTRAINT "InitiativeMilestone_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InitiativeMilestone" ADD CONSTRAINT "InitiativeMilestone_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InitiativeUpdate" ADD CONSTRAINT "InitiativeUpdate_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "OperationalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InitiativeUpdate" ADD CONSTRAINT "InitiativeUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InitiativeUpdate" ADD CONSTRAINT "InitiativeUpdate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InitiativeEvidence" ADD CONSTRAINT "InitiativeEvidence_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "OperationalInitiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InitiativeEvidence" ADD CONSTRAINT "InitiativeEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InitiativeEvidence" ADD CONSTRAINT "InitiativeEvidence_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstitutionalRisk" ADD CONSTRAINT "InstitutionalRisk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstitutionalRisk" ADD CONSTRAINT "InstitutionalRisk_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "StrategicObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstitutionalRisk" ADD CONSTRAINT "InstitutionalRisk_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "OperationalInitiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstitutionalRisk" ADD CONSTRAINT "InstitutionalRisk_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstitutionalRisk" ADD CONSTRAINT "InstitutionalRisk_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskTreatment" ADD CONSTRAINT "RiskTreatment_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "InstitutionalRisk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskTreatment" ADD CONSTRAINT "RiskTreatment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiskTreatment" ADD CONSTRAINT "RiskTreatment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskTreatment" ADD CONSTRAINT "RiskTreatment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskEvidence" ADD CONSTRAINT "RiskEvidence_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "InstitutionalRisk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskEvidence" ADD CONSTRAINT "RiskEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskEvidence" ADD CONSTRAINT "RiskEvidence_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutiveAlert" ADD CONSTRAINT "ExecutiveAlert_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveAlert" ADD CONSTRAINT "ExecutiveAlert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveAlert" ADD CONSTRAINT "ExecutiveAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveAlert" ADD CONSTRAINT "ExecutiveAlert_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveAlert" ADD CONSTRAINT "ExecutiveAlert_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveAlert" ADD CONSTRAINT "ExecutiveAlert_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveDashboardPreference" ADD CONSTRAINT "ExecutiveDashboardPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveDashboardPreference" ADD CONSTRAINT "ExecutiveDashboardPreference_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveDashboardPreference" ADD CONSTRAINT "ExecutiveDashboardPreference_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveHealthSnapshot" ADD CONSTRAINT "ExecutiveHealthSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReport" ADD CONSTRAINT "ExecutiveReport_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReport" ADD CONSTRAINT "ExecutiveReport_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReport" ADD CONSTRAINT "ExecutiveReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReport" ADD CONSTRAINT "ExecutiveReport_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReportSection" ADD CONSTRAINT "ExecutiveReportSection_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ExecutiveReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReportSection" ADD CONSTRAINT "ExecutiveReportSection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReportSection" ADD CONSTRAINT "ExecutiveReportSection_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
