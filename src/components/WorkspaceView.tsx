"use client"

import { useState } from "react"
import Navbar from "./Navbar"
import MyResumeSection from "./MyResumeSection"
import JobMatchSection from "./JobMatchSection"
import InterviewPrepSection from "./InterviewPrepSection"
import RecommendedJobsSection from "./RecommendedJobsSection"

interface AuthenticatedUser { id: number; name: string; email: string; image: string | null; provider: string }
interface ResumeSummary { id: number; fileName: string; fileSize?: number; skills?: string[] }
type WorkspaceViewName = "resume" | "match" | "interview" | "jobs"
const views: { id: WorkspaceViewName; label: string; hint: string }[] = [
  { id: "resume", label: "Resume Review", hint: "Improve your foundation" }, { id: "match", label: "Job Match", hint: "Compare a target role" }, { id: "interview", label: "Interview Prep", hint: "Practice with evidence" }, { id: "jobs", label: "Jobs For You", hint: "Find relevant openings" }
]

export default function WorkspaceView({ user }: { user: AuthenticatedUser }) {
  const [activeView, setActiveView] = useState<WorkspaceViewName>("resume")
  const [activeResume, setActiveResume] = useState<ResumeSummary | null>(null)
  const [interviewContext, setInterviewContext] = useState<{ resumeId: number; jobDescription: string; role?: string } | null>(null)
  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0
    if (!direction) return
    event.preventDefault()
    const nextIndex = (index + direction + views.length) % views.length
    setActiveView(views[nextIndex].id)
    document.querySelector<HTMLButtonElement>(`[data-workspace-tab="${views[nextIndex].id}"]`)?.focus()
  }
  return <div className="career-workspace min-h-screen bg-stone-50 text-slate-900 font-sans"><Navbar user={user} /><main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
    <header className="mb-4 flex min-w-0 items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-stone-200"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm text-indigo-700">⌁</span><div className="min-w-0"><p className="text-[11px] font-medium text-slate-500">Selected resume</p><p className="truncate text-sm font-semibold text-slate-800">{activeResume?.fileName ?? "No resume selected"}</p></div></header>
    <nav aria-label="Workspace sections" className="mb-5"><div role="tablist" aria-label="Career workspace" className="grid grid-cols-2 gap-2 lg:grid-cols-4">{views.map((view, index) => <button key={view.id} data-workspace-tab={view.id} type="button" role="tab" aria-selected={activeView === view.id} aria-controls={`${view.id}-panel`} onClick={() => setActiveView(view.id)} onKeyDown={(event) => handleTabKeyDown(event, index)} className={`group min-w-0 rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${activeView === view.id ? "border-indigo-600 bg-indigo-50 shadow-sm" : "border-stone-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"}`}><span className="flex items-center gap-2"><span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs ${activeView === view.id ? "bg-indigo-600 text-white" : "bg-stone-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700"}`}>{["↗", "⌁", "?", "⌕"][index]}</span><span className="truncate text-sm font-semibold text-slate-900">{view.label}</span></span><span className={`mt-2 block border-b-2 pb-1 text-xs leading-4 ${activeView === view.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>{view.hint}</span></button>)}</div></nav>
    <div className="min-w-0"><section id="resume-panel" role="tabpanel" hidden={activeView !== "resume"}><MyResumeSection onActiveResumeChange={setActiveResume} /></section><section id="match-panel" role="tabpanel" hidden={activeView !== "match"}><JobMatchSection currentResume={activeResume} onPrepareForInterview={(context) => { setInterviewContext(context); setActiveView("interview") }} /></section><section id="interview-panel" role="tabpanel" hidden={activeView !== "interview"}><InterviewPrepSection context={interviewContext} activeResume={activeResume} /></section><section id="jobs-panel" role="tabpanel" hidden={activeView !== "jobs"}><RecommendedJobsSection resumeId={activeResume?.id} /></section></div>
  </main></div>
}
