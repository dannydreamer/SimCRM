import { genderCount, genderPillClass, genderWord, type Gender } from "@/lib/gender"

/**
 * מגדר as a word in a coloured pill — כחול לשחקנים, ורוד לשחקניות.
 *
 * Pass `count` for a quantity ("2 שחקנים"); leave it out for a single person
 * ("שחקנית"). See `src/lib/gender.ts` for why no ♂ / ♀ glyph appears here.
 */
export function GenderTag({
  gender,
  count,
  size = "md",
}: {
  gender: Gender | string
  count?: number
  size?: "sm" | "md"
}) {
  const text = count === undefined ? genderWord(gender, 1) : genderCount(gender, count)
  const sz   = size === "sm" ? "text-[11px] px-1.5 py-0" : "text-xs px-2 py-0.5"
  return (
    <span className={`inline-block rounded border font-medium whitespace-nowrap ${sz} ${genderPillClass(gender)}`}>
      {text}
    </span>
  )
}
