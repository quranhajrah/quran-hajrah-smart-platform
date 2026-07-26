-- Enterprise 24.1 adds semantic proposal relationships and preserves raw text.
-- All changes are additive and retain existing production records.

ALTER TABLE "DocumentExtractedText"
ADD COLUMN "rawText" TEXT;

ALTER TABLE "StrategicObjective"
ADD COLUMN "objectiveLevel" TEXT NOT NULL DEFAULT 'STRATEGIC';

CREATE TABLE "ExtractionProposalRelation" (
    "id" UUID NOT NULL,
    "parentProposalId" UUID NOT NULL,
    "childProposalId" UUID NOT NULL,
    "relationType" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionProposalRelation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExtractionProposalRelation_parent_child_type_key"
ON "ExtractionProposalRelation"("parentProposalId", "childProposalId", "relationType");

CREATE INDEX "ExtractionProposalRelation_parent_type_idx"
ON "ExtractionProposalRelation"("parentProposalId", "relationType");

CREATE INDEX "ExtractionProposalRelation_child_type_idx"
ON "ExtractionProposalRelation"("childProposalId", "relationType");

ALTER TABLE "ExtractionProposalRelation"
ADD CONSTRAINT "ExtractionProposalRelation_parentProposalId_fkey"
FOREIGN KEY ("parentProposalId") REFERENCES "ExtractionProposal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExtractionProposalRelation"
ADD CONSTRAINT "ExtractionProposalRelation_childProposalId_fkey"
FOREIGN KEY ("childProposalId") REFERENCES "ExtractionProposal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
