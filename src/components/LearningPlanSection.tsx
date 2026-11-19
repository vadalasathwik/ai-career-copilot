"use client"

import { useEffect, useState } from "react"

interface LearningResource {
  label: string
  url: string
  kind: "video" | "tutorial"
}

interface LearningPlanItem {
  skill: string
  whyItMatters: string
  practiceTask: string
  estimatedEffort: string
  resources: LearningResource[]
}

export default function LearningPlanSection({ missingSkills }: { missingSkills: string[] }) {
  const [plan, setPlan] = useState<LearningPlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadPlan() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/learning-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ missingSkills }),
          signal: controller.signal
        })
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.message || "Could not build learning plan.")
        setPlan(data.plan)
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Could not build learning plan.")
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    if (missingSkills.length) loadPlan()

    return () => controller.abort()
  }, [missingSkills])

  if (!missingSkills.length) return null

  return (
    <section className="bg-indigo-950/20 p-5 rounded-2xl border border-indigo-900/70 flex flex-col gap-4">
      <div className="border-b border-indigo-900/60 pb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">📚 Close your skill gaps</h3>
        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
          Start with one skill, complete a small proof-of-work project, then add only verifiable experience to your resume.
        </p>
      </div>

      {loading && <p className="text-xs text-neutral-400">Building a focused learning plan…</p>}
      {error && <p className="text-xs text-rose-300">{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plan.map((item) => (
            <article key={item.skill} className="bg-neutral-950/80 rounded-xl border border-neutral-800 p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">{item.skill}</h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Foundation target: {item.estimatedEffort}</p>
                </div>
                <span className="text-[10px] rounded-full px-2 py-1 bg-indigo-950 text-indigo-200 border border-indigo-800">Skill gap</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">{item.whyItMatters}</p>
              <p className="text-xs text-neutral-300 leading-relaxed">{item.practiceTask}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {item.resources.map((resource) => (
                  <a
                    key={resource.url}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-neutral-900 text-emerald-300 border border-neutral-700 hover:border-emerald-700 hover:text-emerald-200 transition"
                  >
                    {resource.kind === "video" ? "▶ " : "↗ "}{resource.label}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
