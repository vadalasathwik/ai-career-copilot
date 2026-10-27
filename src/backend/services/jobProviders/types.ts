export type RemoteWorkMode = "REMOTE" | "HYBRID" | "ON_SITE"

export interface NormalizedJobListing {
  id?: number // PostgreSQL Job.id if persisted
  source: string // e.g. "Indeed", "Verified Partner Feed", "Database Repository"
  sourceJobId: string // Unique identifier in source system
  title: string
  company: string
  description: string
  skills: string[]
  location: string | null
  remoteStatus: RemoteWorkMode | null
  employmentType: string | null // e.g. "Full-time", "Contract", "Part-time"
  salary: string | null // Only if supplied by the source; never fabricated
  postedAt: string | null // ISO timestamp, only if supplied by source
  url: string | null // Official job posting URL
  lastVerifiedAt: string // ISO timestamp of when listing was confirmed active
  isActive: boolean
  isSample: boolean
}

export type JobProviderStatusCode = "ACTIVE" | "UNCONFIGURED" | "UNAUTHORIZED" | "ERROR"

export interface JobProviderStatus {
  name: string
  providerKey: string
  isConfigured: boolean
  isAuthorized: boolean
  status: JobProviderStatusCode
  description: string
  configurationInstructions: string
  officialDocUrl: string
  requiresCredentials: string[]
}

export interface JobSearchParams {
  query?: string
  location?: string
  remoteOnly?: boolean
  limit?: number
}

export interface JobDiscoveryProvider {
  name: string
  providerKey: string
  getStatus(): Promise<JobProviderStatus>
  searchJobs(params?: JobSearchParams): Promise<NormalizedJobListing[]>
}
