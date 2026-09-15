// Logic checks for the organization picker's ordering and substring search, and
// for the duplicate-name warning.
//
//   npm run check:orgsearch
//
// Pure functions only: no database, no browser. The picker replaced a plain
// <select>, and the two things it promises — Hebrew alphabetical order, and a
// match on the query appearing *anywhere* in the name — are exactly the two
// things a silent regression would take away. The duplicate warning has the
// opposite failure mode: too eager, and staff learn to click past it.

import {
  orgSearchKey, sortOrgs, filterOrgs, findDuplicateOrgs, type OrgSearchable,
} from "../src/lib/org-search"

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

console.log("\n── duplicate names ───────────────────────────────────────────────")

const dups = (name: string, orgs = ORGS, excludeId?: string) =>
  findDuplicateOrgs(name, orgs, excludeId).map((d) => `${d.kind}:${d.org.name}`)

check("a name nobody uses warns about nothing", dups("מקיף ז' אשדוד"), [])
check("the same name again is exact", dups("גימנסיה הרצליה"), ["exact:גימנסיה הרצליה"])
check("case and spacing do not hide it", dups("  גימנסיה   הרצליה "), ["exact:גימנסיה הרצליה"])
check("gershayim do not hide it — ביס vs בי\"ס", dups("ביס אורט"), ["exact:בי\"ס אורט"])
check("a different city is still flagged — the user decides",
  dups("אבן גבירול", [...ORGS, org("אבן גבירול", "אילת")]), ["exact:אבן גבירול", "exact:אבן גבירול"])
check("the org being renamed does not match itself",
  dups("גימנסיה הרצליה", ORGS, "גימנסיה הרצליה"), [])
check("renaming onto a *different* org's name still warns",
  dups("גימנסיה הרצליה", ORGS, "תיכון רעות"), ["exact:גימנסיה הרצליה"])
check("empty name warns about nothing", dups(""), [])
check("whitespace-only name warns about nothing", dups("   "), [])

// The softer tier: whole words of one name sitting inside the other.
check("added words flag every shorter name the new one extends",
  dups("בי\"ס אורט סינגלובסקי"), ["contains:אורט סינגלובסקי", "contains:בי\"ס אורט"])
check("dropped words flag the longer name too",
  dups("אורט", [org("אורט סינגלובסקי", "חולון")]), ["contains:אורט סינגלובסקי"])
check("exact matches are listed before merely similar ones",
  dups("אורט סינגלובסקי", [...ORGS, org("אורט סינגלובסקי חיפה", "חיפה")]),
  ["exact:אורט סינגלובסקי", "contains:אורט סינגלובסקי חיפה"])

// Half a word is not a word: `אבן` must not drag in `אבני` or `לאבן`.
check("a partial word is not a containment",
  dups("אבן", [org("אבני החושן", "צפת")]), [])
check("two characters are too little to mean anything",
  dups("בי", [org("בי\"ס אורט", "באר שבע")]), [])
check("unrelated names sharing no whole word stay quiet",
  dups("מכללת ספיר", [org("מכללת אבן ספיר", "ירושלים")]), [])

console.log(
  failures === 0
    ? "\nAll organization-search checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`
)
process.exit(failures === 0 ? 0 : 1)
