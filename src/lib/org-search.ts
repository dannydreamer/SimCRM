// Alphabetical ordering and substring search over organizations.
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
