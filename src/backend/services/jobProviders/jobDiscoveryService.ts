import { prisma } from "@/backend/db/prisma"
import type {
  JobDiscoveryProvider,
  JobProviderStatus,
  JobSearchParams,
  NormalizedJobListing
} from "./types"
import { databaseJobProvider } from "./databaseJobProvider"

// Registry of available job discovery providers
const registeredProviders: JobDiscoveryProvider[] = [
  databaseJobProvider
]

/**
 * Returns diagnostic status information for all registered job discovery providers.
 * Explains which providers are active, which are unconfigured, and what credentials are required.
 */
export async function getDiscoveryProvidersStatus(): Promise<JobProviderStatus[]> {
  const statuses = await Promise.all(
    registeredProviders.map((provider) => provider.getStatus())
  )
  return statuses
}

/**
 * Discovers active job opportunities across all configured and authorized providers.
 * Normalizes listings into a unified format and deduplicates across sources.
 */
export async function discoverActiveJobs(
  params?: JobSearchParams
): Promise<NormalizedJobListing[]> {
  const allResults: NormalizedJobListing[] = []

  // Query each registered provider
  for (const provider of registeredProviders) {
    try {
      const status = await provider.getStatus()
      if (status.isConfigured && status.isAuthorized) {
        const jobs = await provider.searchJobs(params)
        allResults.push(...jobs)
      }
    } catch (err) {
      console.warn(`[JobDiscoveryService] Error querying provider ${provider.name}:`, err)
    }
  }

  // Deduplicate listings across providers
  const seenKeys = new Set<string>()
  const deduplicated: NormalizedJobListing[] = []

  for (const job of allResults) {
    // Primary key: source + sourceJobId
    const primaryKey = `${job.source.toLowerCase()}::${job.sourceJobId}`
    // Secondary semantic key: company + title + location (to prevent duplicate postings across feeds)
    const semanticKey = `${job.company.toLowerCase().trim()}::${job.title.toLowerCase().trim()}::${(job.location || "").toLowerCase().trim()}`

    if (seenKeys.has(primaryKey) || seenKeys.has(semanticKey)) {
      continue
    }

    seenKeys.add(primaryKey)
    seenKeys.add(semanticKey)
    deduplicated.push(job)
  }

  return deduplicated
}

/**
 * Synchronizes newly discovered jobs into the local PostgreSQL Job database,
 * updating lastVerifiedAt and isActive state without duplicating existing records.
 */
export async function syncDiscoveredJobsToDatabase(
  jobs: NormalizedJobListing[]
): Promise<void> {
  for (const job of jobs) {
    try {
      // Check if job already exists by source and sourceJobId
      const existing = await prisma.job.findFirst({
        where: {
          source: job.source,
          sourceJobId: job.sourceJobId
        }
      })

      if (existing) {
        await prisma.job.update({
          where: { id: existing.id },
          data: {
            title: job.title,
            company: job.company,
            description: job.description,
            skills: job.skills,
            location: job.location,
            remoteStatus: job.remoteStatus,
            employmentType: job.employmentType,
            salary: job.salary,
            url: job.url,
            lastVerifiedAt: new Date(job.lastVerifiedAt),
            isActive: job.isActive
          }
        })
      } else {
        await prisma.job.create({
          data: {
            source: job.source,
            sourceJobId: job.sourceJobId,
            title: job.title,
            company: job.company,
            description: job.description,
            skills: job.skills,
            location: job.location,
            remoteStatus: job.remoteStatus,
            employmentType: job.employmentType,
            salary: job.salary,
            postedAt: job.postedAt ? new Date(job.postedAt) : null,
            url: job.url,
            lastVerifiedAt: new Date(job.lastVerifiedAt),
            isActive: job.isActive,
            isSample: job.isSample
          }
        })
      }
    } catch {
      // Continue sync even if individual job upsert fails
    }
  }
}
