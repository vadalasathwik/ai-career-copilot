import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { generateToken } from "../src/backend/auth/jwt.ts";

console.log("==================================================================");
console.log("  AI Career Copilot: PDF & DOCX Diagnostic Regression Test Suite  ");
console.log("==================================================================\n");

const FIXTURES_DIR = path.join(process.cwd(), "tests", "fixtures");
const PDF_FIXTURE_PATH = path.join(FIXTURES_DIR, "known_good_resume.pdf");
const DOCX_FIXTURE_PATH = path.join(FIXTURES_DIR, "known_good_resume.docx");

// Ensure globalThis.pdfjsWorker is initialized identically to resumeService.ts
async function initWorker() {
  const g = globalThis;
  if (!g.pdfjsWorker?.WorkerMessageHandler) {
    try {
      const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      g.pdfjsWorker = worker;
    } catch {
      const worker = await import("pdfjs-dist/build/pdf.worker.mjs");
      g.pdfjsWorker = worker;
    }
  }
}

// -------------------------------------------------------------------------
// PATH A: Extract text from known-good PDF on disk directly
// -------------------------------------------------------------------------
console.log("PATH A: Extracting text directly from disk fixture...");
assert.ok(fs.existsSync(PDF_FIXTURE_PATH), "PDF fixture must exist on disk");
const diskPdfBuffer = fs.readFileSync(PDF_FIXTURE_PATH);

await initWorker();
const diskParser = new PDFParse({ data: diskPdfBuffer });
const diskResult = await diskParser.getText();
await diskParser.destroy();

const pathAText = diskResult.text.trim();
console.log("   Path A Extracted Text:", JSON.stringify(pathAText));
assert.ok(
  pathAText.includes("Alex Morgan") &&
  pathAText.includes("React") &&
  pathAText.includes("TypeScript"),
  "Path A must extract candidate name and key skills"
);
console.log("   ✓ PATH A PASSED: Direct disk extraction succeeded without worker resolution errors.\n");

// -------------------------------------------------------------------------
// PATH B: Extract text through the HTTP upload route
// -------------------------------------------------------------------------
console.log("PATH B: Uploading PDF bytes through HTTP route (POST /api/resumes/upload)...");
const authToken = generateToken(1); // User ID 1 (Sathwik)

function buildMultipartBody(boundary, fieldName, filename, contentType, fileBuffer) {
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([header, fileBuffer, footer]);
}

const boundary = "----TestBoundary" + Math.random().toString(36).substring(2);
const multipartBody = buildMultipartBody(
  boundary,
  "file",
  "alex_morgan_resume.pdf",
  "application/pdf",
  diskPdfBuffer
);

const uploadResponse = await fetch("http://localhost:3000/api/resumes/upload", {
  method: "POST",
  headers: {
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Cookie": `token=${authToken}`
  },
  body: multipartBody
});

const uploadData = await uploadResponse.json();
console.log("   HTTP Status:", uploadResponse.status);
console.log("   API Response:", JSON.stringify(uploadData, null, 2));

assert.equal(uploadResponse.status, 201, "Upload route must return HTTP 201 Created");
assert.equal(uploadData.success, true, "Response success flag must be true");
assert.ok(uploadData.resume.id > 0, "Resume record must have valid database ID");
assert.equal(uploadData.resume.fileName, "alex_morgan_resume.pdf");
assert.equal(uploadData.resume.fileType, "application/pdf");
assert.ok(uploadData.resume.skills.includes("React"), "Skills must include React");
assert.ok(uploadData.resume.skills.includes("TypeScript"), "Skills must include TypeScript");
assert.ok(uploadData.resume.skills.includes("Python"), "Skills must include Python");
assert.ok(uploadData.resume.skills.includes("Docker"), "Skills must include Docker");
assert.equal(uploadData.resume.filePath, undefined, "Internal filePath must never be exposed");
console.log("   ✓ PATH B PASSED: Real HTTP multipart route extraction and persistence succeeded.\n");

const uploadedPdfId = uploadData.resume.id;

// -------------------------------------------------------------------------
// PATH C: DOCX Upload & Extraction
// -------------------------------------------------------------------------
console.log("PATH C: Uploading DOCX fixture through HTTP route...");
const docxBuffer = fs.readFileSync(DOCX_FIXTURE_PATH);
const docxBoundary = "----DocxBoundary" + Math.random().toString(36).substring(2);
const docxMultipartBody = buildMultipartBody(
  docxBoundary,
  "file",
  "alex_backend.docx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  docxBuffer
);

const docxRes = await fetch("http://localhost:3000/api/resumes/upload", {
  method: "POST",
  headers: {
    "Content-Type": `multipart/form-data; boundary=${docxBoundary}`,
    "Cookie": `token=${authToken}`
  },
  body: docxMultipartBody
});

const docxData = await docxRes.json();
assert.equal(docxRes.status, 201, "DOCX upload must return HTTP 201");
assert.equal(docxData.success, true);
assert.ok(docxData.resume.skills.includes("Node.js"));
assert.ok(docxData.resume.skills.includes("PostgreSQL"));
assert.ok(docxData.resume.skills.includes("AWS"));
assert.ok(docxData.resume.skills.includes("Kubernetes"));
console.log("   ✓ PATH C PASSED: DOCX extraction verified.\n");

const uploadedDocxId = docxData.resume.id;

// -------------------------------------------------------------------------
// PATH D: Negative Testing (Corrupt, Oversized, Unauthenticated)
// -------------------------------------------------------------------------
console.log("PATH D: Security and validation negative tests...");

// D1: Unauthenticated upload attempt
const unauthRes = await fetch("http://localhost:3000/api/resumes/upload", {
  method: "POST",
  body: multipartBody
});
assert.equal(unauthRes.status, 401, "Unauthenticated upload must return 401");
console.log("   ✓ Unauthenticated upload correctly blocked with HTTP 401");

// D2: Corrupt PDF
const corruptBoundary = "----CorruptBoundary" + Math.random().toString(36).substring(2);
const corruptBody = buildMultipartBody(
  corruptBoundary,
  "file",
  "corrupt.pdf",
  "application/pdf",
  Buffer.from("NOT_A_VALID_PDF_STREAM")
);
const corruptRes = await fetch("http://localhost:3000/api/resumes/upload", {
  method: "POST",
  headers: {
    "Content-Type": `multipart/form-data; boundary=${corruptBoundary}`,
    "Cookie": `token=${authToken}`
  },
  body: corruptBody
});
assert.equal(corruptRes.status, 400, "Corrupt file must return 400");
const corruptData = await corruptRes.json();
assert.ok(corruptData.message.includes("Invalid file content"), "Message must explain header mismatch");
console.log("   ✓ Corrupted file correctly rejected with HTTP 400");

// -------------------------------------------------------------------------
// CLEANUP: Delete uploaded test resumes via DELETE /api/resumes/[id]
// -------------------------------------------------------------------------
console.log("\nCLEANUP: Removing test resumes from database and disk...");
for (const id of [uploadedPdfId, uploadedDocxId]) {
  const delRes = await fetch(`http://localhost:3000/api/resumes/${id}`, {
    method: "DELETE",
    headers: { "Cookie": `token=${authToken}` }
  });
  assert.equal(delRes.status, 200, `Delete ${id} must succeed`);
  console.log(`   ✓ Successfully deleted test resume ID ${id}`);
}

console.log("\n==================================================================");
console.log("  ALL DIAGNOSTIC AND REGRESSION TESTS COMPLETED SUCCESSFULLY!  ");
console.log("==================================================================");
