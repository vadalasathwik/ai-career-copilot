type AnalyticsCardProps = {
  title: string
  value: string
}

export default function AnalyticsCard({
  title,
  value,
}: AnalyticsCardProps) {
  return (
    <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">

      <h3 className="text-neutral-400 mb-2">
        {title}
      </h3>

      <p className="text-3xl font-bold">
        {value}
      </p>

    </div>
  )
}