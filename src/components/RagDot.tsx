export function RagDot({ color, size = "md" }: { color: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"
  const cls =
    color === "GREEN"  ? "bg-brand-green" :
    color === "YELLOW" ? "bg-amber-400" :
    color === "RED"    ? "bg-red-500" :
    "bg-gray-300"
  return <span className={`inline-block rounded-full ${sz} ${cls} shrink-0`} />
}

export function RagBar({ counts }: { counts: { GREEN: number; YELLOW: number; RED: number } }) {
  const total = counts.GREEN + counts.YELLOW + counts.RED
  if (total === 0) return <span className="text-xs text-gray-300">אין נתונים</span>
  const gPct = (counts.GREEN  / total) * 100
  const yPct = (counts.YELLOW / total) * 100
  const rPct = (counts.RED    / total) * 100
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 w-full">
        {counts.GREEN  > 0 && <div className="bg-brand-green"  style={{ width: `${gPct}%` }} />}
        {counts.YELLOW > 0 && <div className="bg-amber-400"    style={{ width: `${yPct}%` }} />}
        {counts.RED    > 0 && <div className="bg-red-500"      style={{ width: `${rPct}%` }} />}
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {counts.GREEN} ירוק · {counts.YELLOW} צהוב · {counts.RED} אדום
      </p>
    </div>
  )
}
