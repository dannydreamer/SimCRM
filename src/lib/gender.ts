/**
 * מגדר שחקנים — words and colours, in one place.
 *
 * The UI used to lean on the ♂ / ♀ glyphs. Techs read them wrong under time
 * pressure, so every gender in the interface is now shown as a Hebrew word,
 * reinforced by colour: כחול לשחקנים, ורוד לשחקניות. The colour is the fast
 * signal; the word is what actually carries the meaning, so never ship the
 * colour on its own — and never bring the glyphs back alongside the word.
 *
 * The stored values (`MALE` / `FEMALE` on Actor, Casting.slotGender and
 * WorkshopConfirmedActor.gender) are untouched — this is a display layer only.
 */

export type Gender = "MALE" | "FEMALE"

/**
 * שחקן · שחקנית · שחקנים · שחקניות
 *
 * `count` selects the number, so a slot labelled "1 שחקניות" is impossible.
 * It defaults to plural, which is what nearly every call site wants.
 */
export function genderWord(gender: Gender | string, count = 2): string {
  if (gender === "MALE") return count === 1 ? "שחקן" : "שחקנים"
  return count === 1 ? "שחקנית" : "שחקניות"
}

/** "2 שחקנים" / "1 שחקנית" — the number and its word, always agreeing. */
export function genderCount(gender: Gender | string, count: number): string {
  return `${count} ${genderWord(gender, count)}`
}

/** Text colour alone, for words sitting inside a larger sentence. */
export function genderTextClass(gender: Gender | string): string {
  return gender === "MALE" ? "text-blue-600" : "text-pink-600"
}

/** Filled pill — the tag form used in tables and next to a name. */
export function genderPillClass(gender: Gender | string): string {
  return gender === "MALE"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-pink-50 text-pink-700 border-pink-200"
}

/**
 * Tint for a control that belongs to one gender — the Step 2 slot pickers,
 * where a pill per slot would push the room rows too wide.
 */
export function genderFieldClass(gender: Gender | string): string {
  return gender === "MALE"
    ? "border-blue-300 bg-blue-50/50 text-blue-900"
    : "border-pink-300 bg-pink-50/50 text-pink-900"
}
