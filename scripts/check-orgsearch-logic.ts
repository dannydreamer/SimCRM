// Logic checks for the organization picker's ordering and substring search.
//
//   npm run check:orgsearch
//
// Pure functions only: no database, no browser. The picker replaced a plain
// <select>, and the two things it promises — Hebrew alphabetical order, and a
// match on the query appearing *anywhere* in the name — are exactly the two
// things a silent regression would take away.

import { orgSearchKey, sortOrgs, filterOrgs, type OrgSearchable } from "../src/lib/org-search"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) { failures++; console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`) }
  else console.log(`ok   ${name}`)
}

const org = (name: string, city: string): OrgSearchable => ({ id: name, name, city })

const ORGS: OrgSearchable[] = [
  org("תיכון רעות", "חיפה"),
  org("אבן גבירול", "רמת גן"),
  org("מכללת אבן ספיר", "ירושלים"),
  org("בי\"ס אורט", "באר שבע"),
  org("גימנסיה הרצליה", "חולון"),
  org("אורט סינגלובסקי", "חולון"),
]
const names = (rows: OrgSearchable[]) => rows.map((o) => o.name)

console.log("\n── alphabetical, Hebrew collation ────────────────────────────────")

check("sorted by name, not by insertion order", names(sortOrgs(ORGS)), [
  "אבן גבירול", "אורט סינגלובסקי", "בי\"ס אורט",
  "גימנסיה הרצליה", "מכללת אבן ספיר", "תיכון רעות",
])
check("sortOrgs does not mutate its input", names(ORGS)[0], "תיכון רעות")
check("empty query returns the whole list, still sorted",
  names(filterOrgs(ORGS, "")), names(sortOrgs(ORGS)))
check("whitespace-only query counts as empty",
  names(filterOrgs(ORGS, "   ")), names(sortOrgs(ORGS)))

console.log("\n── substring, not prefix ─────────────────────────────────────────")

// The point of the whole change: א must bring up the orgs that merely *contain*
// א, not only those that start with it.
check("א matches anywhere in the name", names(filterOrgs(ORGS, "א")), [
  "אבן גבירול", "אורט סינגלובסקי", "בי\"ס אורט", "מכללת אבן ספיר",
])
check("אב narrows to the two אבן orgs",
  names(filterOrgs(ORGS, "אב")), ["אבן גבירול", "מכללת אבן ספיר"])
check("אורט matches mid-name as well as at the start",
  names(filterOrgs(ORGS, "אורט")), ["אורט סינגלובסקי", "בי\"ס אורט"])
check("results stay alphabetical after filtering",
  names(filterOrgs(ORGS, "אורט")), names(sortOrgs(filterOrgs(ORGS, "אורט"))))
check("no match returns empty, never everything", names(filterOrgs(ORGS, "זזז")), [])

console.log("\n── city is searchable too, and punctuation is forgiven ───────────")

check("city matches", names(filterOrgs(ORGS, "ירושלים")), ["מכללת אבן ספיר"])
check("ביס finds בי\"ס — gershayim ignored", names(filterOrgs(ORGS, "ביס")), ["בי\"ס אורט"])
check("the quoted form still finds itself", names(filterOrgs(ORGS, "בי\"ס")), ["בי\"ס אורט"])
check("latin query is case-insensitive",
  names(filterOrgs([org("Tel Aviv Academy", "Tel Aviv")], "aviv acad")), ["Tel Aviv Academy"])
check("hyphen and space are interchangeable",
  names(filterOrgs([org("בית-ספר יובל", "לוד")], "בית ספר")), ["בית-ספר יובל"])
check("orgSearchKey collapses runs of whitespace", orgSearchKey("  בית   ספר  "), "בית ספר")

console.log(
  failures === 0
    ? "\nAll organization-search checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`
)
process.exit(failures === 0 ? 0 : 1)
