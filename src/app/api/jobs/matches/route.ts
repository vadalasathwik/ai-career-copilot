import { NextResponse } from "next/server"
import { authenticateApiUser } from "@/backend/auth/session"
import { matchUserToAllActiveJobs } from "@/backend/services/matchingEngine"
import { getDiscoveryProvidersStatus } from "@/backend/services/jobProviders/jobDiscoveryService"

export async function GET(req: Request) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  const url = new URL(req.url)
  const resumeIdParam = url.searchParams.get("resumeId")
  const minScoreParam = url.searchParams.get("minScore")
  const remoteOnlyParam = url.searchParams.get("remoteOnly")
  const locationParam = url.searchParams.get("location")
  const roleParam = url.searchParams.get("role")

  const resumeId = resumeIdParam ? parseInt(resumeIdParam, 10) : undefined
  const minScore = minScoreParam ? Math.max(0, Math.min(100, parseInt(minScoreParam, 10))) : 0
  const remoteOnly = remoteOnlyParam === "true" || remoteOnlyParam === "1"
  const locationFilter = locationParam?.trim() || undefined
  const roleFilter = roleParam?.trim() || undefined

  try {
    const [result, providers] = await Promise.all([
      matchUserToAllActiveJobs({
        userId: user.id,
        resumeId: isNaN(Number(resumeId)) ? undefined : resumeId,
        minScore,
        remoteOnly,
        locationFilter,
        roleFilter
      }),
      getDiscoveryProvidersStatus()
    ])

    return NextResponse.json(
      {
        success: true,
        resume: result.resume,
        matches: result.matches,
        count: result.matches.length,
        providers: {
          jobProviders: providers
        }
      },
      { status: 200 }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to compute job matches."
      },
      { status: 500 }
    )
  }
}
