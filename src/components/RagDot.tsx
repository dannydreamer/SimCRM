export function RagDot({ color, size = "md" }: { color: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"
  const cls =
    color === "GREEN"  ? "bg-brand-green" :
    color === "YELLOW" ? "bg-amber-400" :
    color === "RED"    ? "bg-red-500" :
    "bg-gray-300"
  return <span className={`inline-block rounded-full ${sz} ${cls} shrink-0`} />
}
