interface AnalyticsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: string
  badge?: string
  onClick?: () => void
}

export default function AnalyticsCard({
  title,
  value,
  subtitle,
  icon,
  badge,
  onClick
}: AnalyticsCardProps) {
  const isTextValue =
    typeof value === "string" && isNaN(Number(value)) && !value.endsWith("%")

  return (
    <div
      onClick={onClick}
      className={`bg-neutral-900/80 p-6 rounded-2xl border border-neutral-800 flex flex-col justify-between transition group relative overflow-hidden ${
        onClick ? "cursor-pointer hover:border-neutral-700 hover:bg-neutral-900" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider block mb-1">
            {title}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <p
              className={
                isTextValue
                  ? "text-xl font-bold text-neutral-200 tracking-tight"
                  : "text-3xl font-extrabold text-white tracking-tight"
              }
            >
              {value}
            </p>
            {badge && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
                {badge}
              </span>
            )}
          </div>
        </div>

        {icon && (
          <div className="w-10 h-10 rounded-xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center text-lg text-neutral-300 group-hover:scale-105 transition">
            {icon}
          </div>
        )}
      </div>

      {subtitle && (
        <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
          <p className="truncate font-medium">{subtitle}</p>
          {onClick && (
            <span className="text-emerald-400 group-hover:translate-x-0.5 transition font-semibold text-[11px]">
              View →
            </span>
          )}
        </div>
      )}
    </div>
  )
}
