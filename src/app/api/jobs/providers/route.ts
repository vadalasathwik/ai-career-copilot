import { NextResponse } from "next/server"
import { authenticateApiUser } from "@/backend/auth/session"
import { getDiscoveryProvidersStatus } from "@/backend/services/jobProviders/jobDiscoveryService"

export async function GET() {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }

  const providers = await getDiscoveryProvidersStatus()

  return NextResponse.json(
    {
      success: true,
      matchingEngine: {
        name: "Local Deterministic Matching Engine",
        type: "TypeScript Heuristic Scorer",
        status: "ACTIVE",
        cost: "₹0 Free",
        description: "Evaluates candidates deterministically across required skills (45%), preferred skills (20%), experience (20%), seniority (10%), and work mode (5%)."
      },
      jobProviders: providers
    },
    { status: 200 }
  )
}
