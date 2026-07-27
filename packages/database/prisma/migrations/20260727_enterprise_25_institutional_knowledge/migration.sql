CREATE TYPE "KnowledgeIndexStatus" AS ENUM ('QUEUED', 'PROCESSING', 'INDEXED', 'PARTIAL', 'FAILED', 'UNSUPPORTED');
CREATE TYPE "KnowledgeSourceKind" AS ENUM ('DOCUMENT_CONTENT', 'DOCUMENT_METADATA', 'ANALYSIS_TEXT');
CREATE TYPE "KnowledgeRelationType" AS ENUM ('SHARES_TOPIC', 'REFERENCES', 'SUPERSEDES', 'RELATED');
CREATE TYPE "KnowledgeAnswerStatus" AS ENUM ('ANSWERED', 'INSUFFICIENT_EVIDENCE');

CREATE TABLE "KnowledgeDocumentIndex" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,
    "status" "KnowledgeIndexStatus" NOT NULL DEFAULT 'QUEUED',
    "sourceKind" "KnowledgeSourceKind" NOT NULL DEFAULT 'DOCUMENT_METADATA',
    "indexVersion" TEXT NOT NULL,
    "embeddingProvider" TEXT NOT NULL,
    "embeddingDimensions" INTEGER NOT NULL,
    "contentHash" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "indexedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeDocumentIndex_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
    "id" UUID NOT NULL,
    "indexId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "documentVersionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "section" TEXT,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "embedding" DOUBLE PRECISION[],
    "tokenCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeDocumentRelation" (
    "id" UUID NOT NULL,
    "sourceDocumentId" UUID NOT NULL,
    "targetDocumentId" UUID NOT NULL,
    "sourceVersionId" UUID NOT NULL,
    "targetVersionId" UUID NOT NULL,
    "relationType" "KnowledgeRelationType" NOT NULL,
    "score" DECIMAL(5,4) NOT NULL,
    "sharedTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rationale" TEXT,
    "discoveredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeDocumentRelation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeDocumentRelation_no_self_relation" CHECK ("sourceDocumentId" <> "targetDocumentId")
);

CREATE TABLE "KnowledgeQueryLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "queryHash" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "answerStatus" "KnowledgeAnswerStatus" NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeQueryLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeIndexConfiguration" (
    "key" TEXT NOT NULL,
    "indexVersion" TEXT NOT NULL,
    "embeddingProvider" TEXT NOT NULL,
    "embeddingDimensions" INTEGER NOT NULL,
    "chunkSize" INTEGER NOT NULL,
    "chunkOverlap" INTEGER NOT NULL,
    "minimumScore" DOUBLE PRECISION NOT NULL,
    "maxResults" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeIndexConfiguration_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "KnowledgeDocumentIndex_documentVersionId_indexVersion_key"
ON "KnowledgeDocumentIndex"("documentVersionId", "indexVersion");
CREATE INDEX "KnowledgeDocumentIndex_documentId_isCurrent_status_idx"
ON "KnowledgeDocumentIndex"("documentId", "isCurrent", "status");
CREATE INDEX "KnowledgeDocumentIndex_status_createdAt_idx"
ON "KnowledgeDocumentIndex"("status", "createdAt");
CREATE INDEX "KnowledgeDocumentIndex_indexedAt_idx"
ON "KnowledgeDocumentIndex"("indexedAt");

CREATE UNIQUE INDEX "KnowledgeChunk_indexId_sequence_key" ON "KnowledgeChunk"("indexId", "sequence");
CREATE INDEX "KnowledgeChunk_documentId_documentVersionId_idx" ON "KnowledgeChunk"("documentId", "documentVersionId");
CREATE INDEX "KnowledgeChunk_documentVersionId_pageNumber_idx" ON "KnowledgeChunk"("documentVersionId", "pageNumber");
CREATE INDEX "KnowledgeChunk_contentHash_idx" ON "KnowledgeChunk"("contentHash");
CREATE INDEX "KnowledgeChunk_terms_gin_idx" ON "KnowledgeChunk" USING GIN ("terms");

CREATE UNIQUE INDEX "KnowledgeDocumentRelation_sourceVersionId_targetVersionId_relationType_key"
ON "KnowledgeDocumentRelation"("sourceVersionId", "targetVersionId", "relationType");
CREATE INDEX "KnowledgeDocumentRelation_sourceDocumentId_score_idx"
ON "KnowledgeDocumentRelation"("sourceDocumentId", "score");
CREATE INDEX "KnowledgeDocumentRelation_targetDocumentId_score_idx"
ON "KnowledgeDocumentRelation"("targetDocumentId", "score");
CREATE INDEX "KnowledgeDocumentRelation_relationType_score_idx"
ON "KnowledgeDocumentRelation"("relationType", "score");

CREATE INDEX "KnowledgeQueryLog_userId_createdAt_idx" ON "KnowledgeQueryLog"("userId", "createdAt");
CREATE INDEX "KnowledgeQueryLog_answerStatus_createdAt_idx" ON "KnowledgeQueryLog"("answerStatus", "createdAt");
CREATE INDEX "KnowledgeQueryLog_queryHash_idx" ON "KnowledgeQueryLog"("queryHash");

ALTER TABLE "KnowledgeDocumentIndex"
ADD CONSTRAINT "KnowledgeDocumentIndex_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocumentIndex"
ADD CONSTRAINT "KnowledgeDocumentIndex_documentVersionId_fkey"
FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk"
ADD CONSTRAINT "KnowledgeChunk_indexId_fkey"
FOREIGN KEY ("indexId") REFERENCES "KnowledgeDocumentIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocumentRelation"
ADD CONSTRAINT "KnowledgeDocumentRelation_sourceDocumentId_fkey"
FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocumentRelation"
ADD CONSTRAINT "KnowledgeDocumentRelation_targetDocumentId_fkey"
FOREIGN KEY ("targetDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocumentRelation"
ADD CONSTRAINT "KnowledgeDocumentRelation_sourceVersionId_fkey"
FOREIGN KEY ("sourceVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocumentRelation"
ADD CONSTRAINT "KnowledgeDocumentRelation_targetVersionId_fkey"
FOREIGN KEY ("targetVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeQueryLog"
ADD CONSTRAINT "KnowledgeQueryLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
