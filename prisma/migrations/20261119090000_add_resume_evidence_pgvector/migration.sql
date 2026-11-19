-- Requires the pgvector extension to be installed by the PostgreSQL server.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "ResumeEvidenceChunk" (
    "id" SERIAL NOT NULL,
    "resumeId" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeEvidenceChunk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResumeEvidenceChunk_resumeId_startOffset_endOffset_embeddingModel_key"
      UNIQUE ("resumeId", "startOffset", "endOffset", "embeddingModel")
);

CREATE INDEX "ResumeEvidenceChunk_resumeId_embeddingModel_idx"
  ON "ResumeEvidenceChunk"("resumeId", "embeddingModel");

CREATE INDEX "ResumeEvidenceChunk_embedding_hnsw_idx"
  ON "ResumeEvidenceChunk" USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "ResumeEvidenceChunk"
  ADD CONSTRAINT "ResumeEvidenceChunk_resumeId_fkey"
  FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
