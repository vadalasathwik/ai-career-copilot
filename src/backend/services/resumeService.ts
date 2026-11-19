import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import mammoth from "mammoth"
import { PDFParse } from "pdf-parse"
import { prisma } from "@/backend/db/prisma"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const STORAGE_DIR = path.join(process.cwd(), "storage", "resumes")

/** Errors caused by the uploaded document that callers may safely report as 400. */
export class ResumeInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ResumeInputError"
  }
}

function isRecognizedInvalidDocumentError(error: unknown, ext: string): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  if (ext === ".pdf") {
    return (
      error.name === "InvalidPDFException" ||
      error.name === "PasswordException" ||
      message.includes("invalid pdf") ||
      message.includes("password") ||
      message.includes("no readable text")
    )
  }

  return (
    message.includes("corrupt") ||
    message.includes("zip") ||
    message.includes("end of central directory") ||
    message.includes("no readable text")
  )
}

// Curated dictionary of technical skills for initial skill tagging
const COMMON_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin",
  "React", "React Native", "Next.js", "Vue", "Angular", "Svelte", "Node.js", "Express", "NestJS", "FastAPI",
  "Django", "Flask", "Spring Boot", "GraphQL", "REST API", "HTML", "CSS", "Tailwind CSS",
  "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Elasticsearch", "Prisma",
  "Docker", "Kubernetes", "AWS", "Google Cloud", "Azure", "Terraform", "CI/CD", "Git", "Linux"
]

export interface SafeResumeMetadata {
  id: number
  fileName: string
  fileSize: number
  fileType: string
  skills: string[]
  createdAt: Date
  updatedAt: Date
  textSnippet?: string
  latestAnalysis?: {
    id: number
    atsScore: number
    targetRole: string | null
  } | null
}

/**
 * Extracts a normalized list of common skills found in the text.
 */
export function extractSkillsFromText(text: string): string[] {
  const lowerText = text.toLowerCase()
  const matched = new Set<string>()

  for (const skill of COMMON_SKILLS) {
    // Word boundary or non-alphanumeric boundary check
    const regex = new RegExp(`(^|[^a-zA-Z0-9#+])${escapeRegex(skill.toLowerCase())}($|[^a-zA-Z0-9#+])`, "i")
    if (regex.test(lowerText)) {
      matched.add(skill)
    }
  }

  return Array.from(matched)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Validates file buffer size, extension, and magic bytes.
 */
export function validateFileBuffer(buffer: Buffer, originalName: string): { ext: string; mimeType: string } {
  if (!buffer || buffer.length === 0) {
    throw new ResumeInputError("The uploaded file is empty.")
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new ResumeInputError("File exceeds the maximum allowed size of 5 MB.")
  }

  const ext = path.extname(originalName).toLowerCase()
  if (ext !== ".pdf" && ext !== ".docx") {
    throw new ResumeInputError("Unsupported file type. Only PDF and DOCX files are accepted.")
  }

  // Magic bytes validation
  if (ext === ".pdf") {
    // PDF files must start with '%PDF-' (0x25 0x50 0x44 0x46)
    const isPdf =
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46

    if (!isPdf) {
      throw new ResumeInputError("Invalid file content: The file header does not match a valid PDF document.")
    }

    return { ext: ".pdf", mimeType: "application/pdf" }
  } else {
    // DOCX files are ZIP packages starting with 'PK\x03\x04' (0x50 0x4B 0x03 0x04)
    const isZip =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04

    if (!isZip) {
      throw new ResumeInputError("Invalid file content: The file header does not match a valid DOCX document.")
    }

    return {
      ext: ".docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }
  }
}

/**
 * Ensures the PDF.js fake worker is properly initialized in-process.
 * Next.js bundlers (Turbopack/Webpack) relocate chunks at runtime, which breaks
 * pdfjs-dist's default relative import of 'pdf.worker.mjs'. Pre-assigning
 * globalThis.pdfjsWorker provides the worker handler directly without chunk resolution.
 */
async function ensurePdfWorkerInitialized() {
  const g = globalThis as unknown as { pdfjsWorker?: { WorkerMessageHandler?: unknown } }
  if (!g.pdfjsWorker?.WorkerMessageHandler) {
    try {
      const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs")
      g.pdfjsWorker = worker
    } catch {
      try {
        const worker = await import("pdfjs-dist/build/pdf.worker.mjs")
        g.pdfjsWorker = worker
      } catch {
        // Fallback to default behavior if explicit worker cannot be loaded
      }
    }
  }
}

/**
 * Extracts readable text from PDF or DOCX buffers.
 */
export async function extractText(buffer: Buffer, ext: string): Promise<string> {
  if (ext === ".pdf") {
    try {
      await ensurePdfWorkerInitialized()
      const parser = new PDFParse({ data: buffer })
      const res = await parser.getText()
      await parser.destroy()

      const text = res.text?.trim() ?? ""
      if (!text || text.length === 0) {
        throw new ResumeInputError(
          "No readable text could be extracted from this PDF. Please ensure it is not password-protected or an image-only scan."
        )
      }
      return text
    } catch (err) {
      if (err instanceof ResumeInputError) {
        throw err
      }
      if (isRecognizedInvalidDocumentError(err, ext)) {
        throw new ResumeInputError("Failed to parse the PDF document. Please upload a valid, text-based PDF.")
      }
      throw err
    }
  } else {
    try {
      const result = await mammoth.extractRawText({ buffer })
      const text = result.value?.trim() ?? ""
      if (!text || text.length === 0) {
        throw new ResumeInputError(
          "No readable text could be extracted from this DOCX file. Please ensure the document contains readable text."
        )
      }
      return text
    } catch (err) {
      if (err instanceof ResumeInputError) {
        throw err
      }
      if (isRecognizedInvalidDocumentError(err, ext)) {
        throw new ResumeInputError("Failed to parse the DOCX document. The file may be corrupt or invalid.")
      }
      throw err
    }
  }
}

/**
 * Sanitizes original filename (removes directory separators and path traversal attempts).
 */
export function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._\- ]/g, "_")
  return base.slice(0, 255) || "resume_upload"
}

/**
 * Processes an uploaded resume:
 * 1. Validates file size, extension, and magic bytes
 * 2. Extracts readable text
 * 3. Saves original file to secure storage directory with UUID filename
 * 4. Persists record to PostgreSQL
 * 5. Cleans up file if database insertion fails
 */
export async function processAndSaveResume({
  buffer,
  originalName,
  userId
}: {
  buffer: Buffer
  originalName: string
  userId: number
}): Promise<SafeResumeMetadata> {
  if (!userId || typeof userId !== "number" || userId <= 0) {
    throw new Error("A valid numeric user ID is required")
  }

  // 1. Validate file
  const { ext, mimeType } = validateFileBuffer(buffer, originalName)

  // 2. Extract text
  const extractedText = await extractText(buffer, ext)
  const skills = extractSkillsFromText(extractedText)

  // 3. Ensure storage directory exists
  await fs.promises.mkdir(STORAGE_DIR, { recursive: true })

  // 4. Save file to disk with UUID filename
  const safeStorageName = `${crypto.randomUUID()}${ext}`
  const absolutePath = path.join(STORAGE_DIR, safeStorageName)

  await fs.promises.writeFile(absolutePath, buffer)

  // 5. Persist record to database
  try {
    const resume = await prisma.resume.create({
      data: {
        userId,
        fileName: sanitizeFileName(originalName),
        fileSize: buffer.length,
        fileType: mimeType,
        filePath: absolutePath,
        extractedText,
        skills
      }
    })

    return {
      id: resume.id,
      fileName: resume.fileName,
      fileSize: resume.fileSize,
      fileType: resume.fileType,
      skills: resume.skills,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
      textSnippet: extractedText.slice(0, 200)
    }
  } catch (dbError) {
    // Clean up uploaded file if database persistence fails
    await fs.promises.unlink(absolutePath).catch(() => {})
    throw dbError
  }
}

/**
 * Lists resumes belonging strictly to the authenticated user.
 * Internal file paths are never exposed.
 */
export async function getUserResumes(userId: number): Promise<SafeResumeMetadata[]> {
  if (!userId || typeof userId !== "number" || userId <= 0) {
    throw new Error("A valid numeric user ID is required")
  }

  const resumes = await prisma.resume.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      fileType: true,
      skills: true,
      createdAt: true,
      updatedAt: true,
      analyses: {
        select: {
          id: true,
          atsScore: true,
          targetRole: true
        },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  })

  return resumes.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    fileSize: r.fileSize,
    fileType: r.fileType,
    skills: r.skills,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    latestAnalysis: r.analyses.length > 0 ? r.analyses[0] : null
  }))
}

/**
 * Deletes a resume with strict ownership verification.
 * Removes both the database record and the file from disk.
 */
export async function deleteUserResume(
  resumeId: number,
  userId: number
): Promise<{ success: boolean; status: "NOT_FOUND" | "FORBIDDEN" | "DELETED" }> {
  if (!resumeId || typeof resumeId !== "number" || resumeId <= 0) {
    throw new Error("A valid resume ID is required")
  }
  if (!userId || typeof userId !== "number" || userId <= 0) {
    throw new Error("A valid user ID is required")
  }

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId }
  })

  if (!resume) {
    return { success: false, status: "NOT_FOUND" }
  }

  // Strict ownership check
  if (resume.userId !== userId) {
    return { success: false, status: "FORBIDDEN" }
  }

  // Delete from database
  await prisma.resume.delete({
    where: { id: resumeId }
  })

  // Delete physical file from disk
  if (resume.filePath) {
    await fs.promises.unlink(resume.filePath).catch(() => {
      // Ignore if file was already removed
    })
  }

  return { success: true, status: "DELETED" }
}
