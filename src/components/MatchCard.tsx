type MatchCardProps = {
  company: string
  role: string
}

export default function MatchCard({
  company,
  role,
}: MatchCardProps) {
  return (
    <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">

      <h2 className="text-xl font-semibold">
        {company}
      </h2>

      <p className="text-neutral-400 mt-2">
        {role}
      </p>

    </div>
  )
}