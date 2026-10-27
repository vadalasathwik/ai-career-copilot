interface SuggestionsProps {
  suggestions?: string[]
  targetRole?: string | null
  onViewAll?: () => void
}

export default function Suggestions({
  suggestions,
  targetRole,
  onViewAll
}: SuggestionsProps) {
  const hasSuggestions = Boolean(suggestions && suggestions.length > 0)

  return (
    <div className="bg-neutral-900/80 p-6 rounded-2xl border border-neutral-800 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-amber-400 text-lg">💡</span>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Actionable Recommendations
            </h2>
            <p className="text-xs text-neutral-400">
              Evidence-based adjustments derived from your latest ATS resume scan
            </p>
          </div>
        </div>

        {targetRole && (
          <span className="text-xs bg-neutral-950 text-neutral-300 px-3 py-1 rounded-full border border-neutral-800 font-medium truncate max-w-xs">
            Role: {targetRole}
          </span>
        )}
      </div>

      {hasSuggestions ? (
        <ul className="flex flex-col gap-2.5 text-xs text-neutral-300">
          {suggestions!.map((suggestion, index) => (
            <li
              key={index}
              className="flex items-start gap-2.5 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80"
            >
              <span className="text-emerald-400 font-bold select-none">•</span>
              <span className="leading-relaxed">{suggestion}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-neutral-400 text-xs flex flex-col gap-1.5 py-3 bg-neutral-950/40 p-4 rounded-xl border border-neutral-800/60">
          <p className="text-neutral-300 font-medium">
            No resume scan recommendations generated yet.
          </p>
          <p className="text-neutral-500 text-[11px] leading-relaxed">
            Run an ATS compatibility scan against a target job to uncover verified skill gaps, high-impact wording improvements, and tailored career insights.
          </p>
        </div>
      )}

      {onViewAll && hasSuggestions && (
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition flex items-center gap-1"
          >
            Open Full Career Strategy Guide →
          </button>
        </div>
      )}
    </div>
  )
}
