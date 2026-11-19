import crypto from "node:crypto"
import pg from "pg"
import { getGeminiEmbeddingClient } from "@/backend/services/aiService"

const { Client } = pg
export const EMBEDDING_MODEL = "gemini-embedding-001:768"
const EMBEDDING_DIMENSIONS = 768

export interface ResumeTextChunk {
  text: string
  startOffset: number
  endOffset: number
  contentHash: string
}

export interface VectorEvidenceCandidate {
  text: string
  startOffset: number
  endOffset: number
  similarity: number
}

export interface VectorRetrievalResult {
  available: boolean
  candidates: VectorEvidenceCandidate[]
  reason?: "PGVECTOR_UNAVAILABLE" | "EMBEDDING_UNAVAILABLE" | "INDEX_UNAVAILABLE"
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required for vector retrieval")
  return url
}

function hash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex")
}

function vectorLiteral(values: number[]): string {
  if (values.length !== EMBEDDING_DIMENSIONS || values.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding response had an unexpected dimension")
  }
  return `[${values.join(",")}]`
}

/** Splits readable text into short, verbatim sentence/paragraph chunks with source offsets. */
export function splitResumeTextIntoChunks(text: string): ResumeTextChunk[] {
  const chunks: ResumeTextChunk[] = []
  const separator = /(?:\r?\n)+|(?<=[.!?])\s+/g
  let start = 0
  let match: RegExpExecArray | null

  const addChunk = (raw: string, rawStart: number) => {
    const leading = raw.search(/\S/)
    const trimmed = raw.trim()
    if (!trimmed || trimmed.length < 12) return
    const startOffset = rawStart + Math.max(leading, 0)
    chunks.push({ text: trimmed, startOffset, endOffset: startOffset + trimmed.length, contentHash: hash(trimmed) })
  }

  while ((match = separator.exec(text))) {
    addChunk(text.slice(start, match.index), start)
    start = match.index + match[0].length
  }
  addChunk(text.slice(start), start)
  return chunks
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error("Embedding provider is not configured")

  const client = getGeminiEmbeddingClient()
  const response = await client.models.embedContent({
    model: "gemini-embedding-001",
    contents: texts,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS }
  })
  const embeddings = response.embeddings?.map((embedding) => embedding.values ?? []) ?? []
  if (embeddings.length !== texts.length) throw new Error("Embedding provider returned an incomplete response")
  return embeddings
}

async function pgvectorReady(client: InstanceType<typeof Client>): Promise<boolean> {
  const extension = await client.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
  if (extension.rowCount !== 1) return false
  const table = await client.query("SELECT to_regclass('\"ResumeEvidenceChunk\"') AS table_name")
  return Boolean(table.rows[0]?.table_name)
}

/**
 * Idempotently indexes a resume. Chunks are keyed by resume/version/offset and
 * replaced atomically if its extracted text changes. A failed provider leaves
 * existing chunks intact and callers can use non-vector retrieval.
 */
export async function ensureResumeEvidenceIndex(resumeId: number, extractedText: string): Promise<VectorRetrievalResult> {
  const chunks = splitResumeTextIntoChunks(extractedText)
  if (chunks.length === 0) return { available: false, candidates: [], reason: "INDEX_UNAVAILABLE" }

  const client = new Client({ connectionString: databaseUrl() })
  try {
    await client.connect()
    if (!(await pgvectorReady(client))) return { available: false, candidates: [], reason: "PGVECTOR_UNAVAILABLE" }

    const existing = await client.query<{ "contentHash": string }>(
      'SELECT "contentHash" FROM "ResumeEvidenceChunk" WHERE "resumeId" = $1 AND "embeddingModel" = $2 ORDER BY "startOffset"',
      [resumeId, EMBEDDING_MODEL]
    )
    if (existing.rows.length === chunks.length && existing.rows.every((row, index) => row.contentHash === chunks[index].contentHash)) {
      return { available: true, candidates: [] }
    }

    let embeddings: number[][]
    try {
      embeddings = await embedTexts(chunks.map((chunk) => chunk.text))
    } catch {
      return { available: false, candidates: [], reason: "EMBEDDING_UNAVAILABLE" }
    }

    await client.query("BEGIN")
    await client.query('DELETE FROM "ResumeEvidenceChunk" WHERE "resumeId" = $1 AND "embeddingModel" = $2', [resumeId, EMBEDDING_MODEL])
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index]
      await client.query(
        'INSERT INTO "ResumeEvidenceChunk" ("resumeId", "chunkText", "startOffset", "endOffset", "contentHash", "embeddingModel", "embedding") VALUES ($1, $2, $3, $4, $5, $6, $7::vector)',
        [resumeId, chunk.text, chunk.startOffset, chunk.endOffset, chunk.contentHash, EMBEDDING_MODEL, vectorLiteral(embeddings[index])]
      )
    }
    await client.query("COMMIT")
    return { available: true, candidates: [] }
  } catch {
    await client.query("ROLLBACK").catch(() => undefined)
    return { available: false, candidates: [], reason: "INDEX_UNAVAILABLE" }
  } finally {
    await client.end().catch(() => undefined)
  }
}

/** Retrieves no more than three chunks, always scoped to the selected resume. */
export async function retrieveResumeEvidenceCandidates(resumeId: number, requirement: string): Promise<VectorRetrievalResult> {
  const client = new Client({ connectionString: databaseUrl() })
  try {
    await client.connect()
    if (!(await pgvectorReady(client))) return { available: false, candidates: [], reason: "PGVECTOR_UNAVAILABLE" }

    let queryEmbedding: number[]
    try {
      ;[queryEmbedding] = await embedTexts([requirement])
    } catch {
      return { available: false, candidates: [], reason: "EMBEDDING_UNAVAILABLE" }
    }

    const result = await client.query<{ chunkText: string; startOffset: number; endOffset: number; similarity: number }>(
      'SELECT "chunkText", "startOffset", "endOffset", 1 - ("embedding" <=> $3::vector) AS similarity FROM "ResumeEvidenceChunk" WHERE "resumeId" = $1 AND "embeddingModel" = $2 ORDER BY "embedding" <=> $3::vector LIMIT 3',
      [resumeId, EMBEDDING_MODEL, vectorLiteral(queryEmbedding)]
    )
    return { available: true, candidates: result.rows.map((row) => ({ text: row.chunkText, startOffset: row.startOffset, endOffset: row.endOffset, similarity: Number(row.similarity) })) }
  } catch {
    return { available: false, candidates: [], reason: "INDEX_UNAVAILABLE" }
  } finally {
    await client.end().catch(() => undefined)
  }
}
