"use client"

import { useEffect, useRef, useState } from "react"

interface Question { question: string; jobRequirement: string; resumeExcerpt: string | null; evidenceStatus: "evidence" | "gap"; questionGeneration: "gemini" | "template"; gapExplanation?: string }
interface Context { resumeId: number; jobDescription: string; role?: string }
interface Resume { id: number; fileName: string }

export default function InterviewPrepSection({ context, activeResume }: { context: Context | null; activeResume: Resume | null }) {
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  useEffect(() => () => controller.current?.abort(), [])
  async function generate() {
    if (!context) return
    const id = ++requestId.current; controller.current?.abort(); const next = new AbortController(); controller.current = next
    setLoading(true); setError(null)
    try { const response = await fetch("/api/interview-prep", { method: "POST", headers: { "Content-Type": "application/json" }, signal: next.signal, body: JSON.stringify({ resumeId: context.resumeId, jobDescription: context.jobDescription }) }); const data = await response.json(); if (id !== requestId.current) return; if (!response.ok || !data.success) throw new Error(data.message || "Could not generate practice questions."); setQuestions(Array.isArray(data.questions) ? data.questions : []); setFallback(Boolean(data.retrieval?.questionGenerationFallbackUsed)) } catch (err) { if (err instanceof DOMException && err.name === "AbortError") return; if (id === requestId.current) setError(err instanceof Error ? err.message : "Could not generate practice questions.") } finally { if (id === requestId.current) setLoading(false) }
  }
  if (!context || context.resumeId !== activeResume?.id) return <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-200"><h2 className="text-lg font-bold text-slate-900">Prepare for a matched role</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Run a Job Match first, then choose “Prepare for this interview.” We’ll carry your selected resume and the role’s requirements here.</p></div>
  return <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-7"><div className="flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Interview prep</p><h2 className="mt-1 text-xl font-bold text-slate-950">Practice for {context.role || "this role"}</h2><p className="mt-1 text-sm text-slate-600">Evidence is shown only when it appears verbatim in {activeResume.fileName}.</p></div><button type="button" onClick={generate} disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50">{loading ? "Generating…" : questions ? "Generate again" : "Generate questions"}</button></div>
    {error && <div role="alert" className="mt-5 flex items-center justify-between gap-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><span>{error}</span><button type="button" onClick={generate} className="font-semibold underline">Retry</button></div>}
    {fallback && <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Some questions use a reliable practice template because the generated version could not validate its evidence.</p>}
    {questions && <ol className="mt-5 space-y-4">{questions.length === 0 ? <li className="text-sm text-slate-600">No clear requirements were found. Add more detail to the job description and try again.</li> : questions.map((item, index) => <li key={`${item.jobRequirement}-${index}`} className="rounded-xl border border-stone-200 p-4"><p className="text-sm font-semibold leading-6 text-slate-900"><span className="mr-2 text-indigo-600">{index + 1}.</span>{item.question}</p>{item.evidenceStatus === "evidence" && item.resumeExcerpt ? <blockquote className="mt-3 border-l-2 border-indigo-500 bg-indigo-50 px-3 py-2 text-sm leading-6 text-slate-800"><span className="font-semibold">From your resume</span><br />“{item.resumeExcerpt}”</blockquote> : <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950"><span className="font-semibold">Topic to practice</span><br />{item.gapExplanation || item.jobRequirement}</div>}</li>)}</ol>}
  </div>
}
