// Alphabetical ordering, substring search, and duplicate-name detection over
// organizations.
//
// Pure functions, deliberately kept out of the component so they can be checked
// without a browser: `npm run check:orgsearch`.

export interface OrgSearchable {
  id:   string
  name: string
  city: string
}

/**
 * Search key for a term. Case-folded, with the punctuation staff type
 * inconsistently stripped, so `ביס` finds `בי"ס` and `בית-ספר` finds `בית ספר`.
 */
export function orgSearchKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/["'`״׳’‘“”]/g, "")
    .replace(/[-–—_.,()[\]/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Hebrew collation, city as the tie-break for two orgs of the same name. */
export function sortOrgs<T extends OrgSearchable>(orgs: T[]): T[] {
  return [...orgs].sort(
    (a, b) => a.name.localeCompare(b.name, "he") || a.city.localeCompare(b.city, "he")
  )
}

/**
 * Alphabetical list, narrowed to the orgs whose name or city *contains* the
 * query anywhere — `אב` keeps `אבן גבירול` and `מכללת אבן ספיר` alike, not only
 * the names that start with it. An empty query returns everything.
 */
export function filterOrgs<T extends OrgSearchable>(orgs: T[], query: string): T[] {
  const sorted = sortOrgs(orgs)
  const q = orgSearchKey(query)
  if (!q) return sorted
  return sorted.filter((o) => orgSearchKey(`${o.name} ${o.city}`).includes(q))
}

/**
 * `exact` — the two names differ only in the punctuation `orgSearchKey` folds
 * away, so they are the same organization entered twice.
 * `contains` — one name's words sit whole inside the other's (`אורט חולון`
 * against `בי"ס אורט חולון`). Probably the same organization, but not certainly.
 */
export type DuplicateKind = "exact" | "contains"

export interface OrgDuplicate<T> {
  org:  T
  kind: DuplicateKind
}

/** True when the shorter word run appears whole and contiguous inside the longer. */
function wordsContained(a: string[], b: string[]): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  for (let i = 0; i + short.length <= long.length; i++) {
    if (short.every((w, j) => w === long[i + j])) return true
  }
  return false
}

/**
 * Organizations already on file that `name` looks like a second copy of, exact
 * matches first and each group alphabetical. `excludeId` drops the organization
 * being renamed, which otherwise always matches itself.
 *
 * Advisory only — two schools really can share a name in two cities, so the
 * caller warns and lets the user override rather than refusing the name.
 */
export function findDuplicateOrgs<T extends OrgSearchable>(
  name: string,
  orgs: T[],
  excludeId?: string
): OrgDuplicate<T>[] {
  const key = orgSearchKey(name)
  if (!key) return []
  const words = key.split(" ")

  const exact:    OrgDuplicate<T>[] = []
  const contains: OrgDuplicate<T>[] = []

  for (const org of sortOrgs(orgs)) {
    if (excludeId && org.id === excludeId) continue
    const otherKey = orgSearchKey(org.name)
    if (!otherKey) continue
    if (otherKey === key) { exact.push({ org, kind: "exact" }); continue }
    // Two characters is too little to mean anything — it would flag every org
    // whose name happens to contain a short word.
    if (key.length < 3 || otherKey.length < 3) continue
    if (wordsContained(words, otherKey.split(" "))) contains.push({ org, kind: "contains" })
  }

  return [...exact, ...contains]
}
