import { prisma } from "@/backend/db/prisma"
import type {
  JobDiscoveryProvider,
  JobProviderStatus,
  JobSearchParams,
  NormalizedJobListing
} from "./types"

export class DatabaseJobProvider implements JobDiscoveryProvider {
  name = "Database Repository"
  providerKey = "database"

  async getStatus(): Promise<JobProviderStatus> {
    try {
      const count = await prisma.job.count({ where: { isActive: true } })
      return {
        name: this.name,
        providerKey: this.providerKey,
        isConfigured: true,
        isAuthorized: true,
        status: "ACTIVE",
        description:
          count > 0
            ? `PostgreSQL job repository is operational with ${count} active vacancies.`
            : "PostgreSQL job repository is operational (0 saved vacancies). Add a job manually or paste a job description.",
        configurationInstructions: "PostgreSQL database connection is configured and active.",
        officialDocUrl: "https://www.postgresql.org/docs/",
        requiresCredentials: ["DATABASE_URL"]
      }
    } catch {
      return {
        name: this.name,
        providerKey: this.providerKey,
        isConfigured: false,
        isAuthorized: false,
        status: "ERROR",
        description: "Unable to query PostgreSQL Job repository.",
        configurationInstructions: "Verify DATABASE_URL in your .env file.",
        officialDocUrl: "https://www.postgresql.org/docs/",
        requiresCredentials: ["DATABASE_URL"]
      }
    }
  }

  async searchJobs(params?: JobSearchParams): Promise<NormalizedJobListing[]> {
    try {
      const whereClause: Record<string, unknown> = { isActive: true }

      if (params?.remoteOnly) {
        whereClause.remoteStatus = "REMOTE"
      }

      if (params?.location) {
        whereClause.location = { contains: params.location, mode: "insensitive" }
      }

      if (params?.query) {
        whereClause.OR = [
          { title: { contains: params.query, mode: "insensitive" } },
          { company: { contains: params.query, mode: "insensitive" } },
          { description: { contains: params.query, mode: "insensitive" } }
        ]
      }

      const jobs = await prisma.job.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: params?.limit || 50
      })

      return jobs.map((job) => ({
        id: job.id,
        source: job.source,
        sourceJobId: job.sourceJobId || `db_${job.id}`,
        title: job.title,
        company: job.company,
        description: job.description,
        skills: job.skills,
        location: job.location,
        remoteStatus: (job.remoteStatus as "REMOTE" | "HYBRID" | "ON_SITE") || null,
        employmentType: job.employmentType,
        salary: job.salary,
        postedAt: job.postedAt ? job.postedAt.toISOString() : null,
        url: job.url,
        lastVerifiedAt: job.lastVerifiedAt.toISOString(),
        isActive: job.isActive,
        isSample: job.isSample
      }))
    } catch (err) {
      console.error("DatabaseJobProvider error:", err)
      return []
    }
  }
}

export const databaseJobProvider = new DatabaseJobProvider()
