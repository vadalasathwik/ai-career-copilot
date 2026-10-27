import { prisma } from "@/backend/db/prisma"

const SAMPLE_DEV_JOBS = [
  {
    title: "Frontend Engineer (Sample)",
    company: "TechCorp Labs",
    location: "Remote",
    description: "Sample development listing for testing resume matching algorithms. Core technologies include modern React, TypeScript, and Tailwind CSS.",
    skills: ["React", "TypeScript", "Tailwind CSS", "Next.js"],
    source: "Sample Development Dataset",
    isSample: true
  },
  {
    title: "Full Stack Engineer (Sample)",
    company: "DataFlow Systems",
    location: "Hybrid - New York, NY",
    description: "Sample development listing for testing full-stack skill gap detection. Technologies include Node.js, PostgreSQL, and Prisma.",
    skills: ["Node.js", "TypeScript", "PostgreSQL", "Prisma", "React"],
    source: "Sample Development Dataset",
    isSample: true
  },
  {
    title: "Backend Platform Engineer (Sample)",
    company: "CloudScale Systems",
    location: "Remote",
    description: "Sample development listing for testing backend infrastructure matching. Technologies include Python, Docker, and PostgreSQL.",
    skills: ["Python", "Docker", "PostgreSQL", "AWS", "API Design"],
    source: "Sample Development Dataset",
    isSample: true
  }
]

export async function ensureDevJobsSeeded() {
  try {
    const count = await prisma.job.count()
    if (count === 0) {
      await prisma.job.createMany({
        data: SAMPLE_DEV_JOBS
      })
    }
  } catch {
    // Gracefully handle if DB is unavailable during build/offline
  }
}
