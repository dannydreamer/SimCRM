// Logic checks for role implication and the capability lists — spec §5.4.
//
//   npm run check:roles
//
// Pure functions only: no database, no session, nothing to set up. These exist
// because the whole Senior Tech design rests on one claim — that a person stored
// as SENIOR_TECH arrives at every guard already holding TECH. If expandRoles
// stops doing that, she silently loses the ordinary Tech rights she works with
// all day, and nothing else in the codebase would notice.
//
// The repo has no test runner. This runs on `tsx`, already a dependency for the
// seed, the same way check-casting-logic.ts does.

import {
  expandRoles, displayRoles, impliedRoles, hasAny,
  CAN_MANAGE_ORGS, CAN_CREATE_WORKSHOP, CAN_CANCEL_WORKSHOP,
  NAV_ITEMS, LOGIN_ROLES, ROLE_LABELS, homePathFor,
} from "../src/lib/roles"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) { failures++; console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`) }
  else console.log(`ok   ${name}`)
}

// What the Person table actually holds, versus what the session ends up with.
const senior = expandRoles(["SENIOR_TECH"])
const tech   = expandRoles(["TECH"])

console.log("\n── expandRoles: a Senior Tech is also a Tech ──────────────────────")

check("SENIOR_TECH alone expands to both", senior, ["SENIOR_TECH", "TECH"])
check("TECH alone gains nothing", tech, ["TECH"])
check("both ticked does not duplicate TECH", expandRoles(["SENIOR_TECH", "TECH"]), ["SENIOR_TECH", "TECH"])
check("other roles ride along untouched",
  expandRoles(["SENIOR_TECH", "CASTER"]), ["SENIOR_TECH", "CASTER", "TECH"])
check("MANAGER implies nothing — she is granted rights by name, not by rank",
  expandRoles(["MANAGER"]), ["MANAGER"])
check("no roles expands to no roles", expandRoles([]), [])

console.log("\n── the ~30 existing TECH checks keep working ─────────────────────")

// Every one of these is a literal roles.includes("TECH") somewhere in the app.
// They are the reason the implication is expanded at the login boundary rather
// than taught to each guard.
check("Senior Tech passes a plain TECH test", senior.includes("TECH"), true)
check("Senior Tech reaches every nav item a Tech reaches",
  NAV_ITEMS.filter((i) => i.roles.some((r) => tech.includes(r))).map((i) => i.href),
  NAV_ITEMS.filter((i) => i.roles.some((r) => senior.includes(r))).map((i) => i.href))
check("Senior Tech lands on the workshops table", homePathFor(senior), "/sadnaot")

console.log("\n── the capabilities that separate her from a Tech ────────────────")

for (const [label, capability] of [
  ["organizations", CAN_MANAGE_ORGS],
  ["workshop creation", CAN_CREATE_WORKSHOP],
  ["workshop cancellation", CAN_CANCEL_WORKSHOP],
] as const) {
  check(`${label}: Manager yes`,      hasAny(["MANAGER"], capability), true)
  check(`${label}: Senior Tech yes`,  hasAny(senior, capability),      true)
  check(`${label}: plain Tech no`,    hasAny(tech, capability),        false)
  check(`${label}: Caster no`,        hasAny(["CASTER"], capability),  false)
}

console.log("\n── how she is described back to the user ─────────────────────────")

check("the header badge names the rank, not both roles", displayRoles(senior), ["SENIOR_TECH"])
check("a plain Tech still reads as a Tech", displayRoles(tech), ["TECH"])
check("a Senior Tech who also casts keeps the caster label",
  displayRoles(expandRoles(["SENIOR_TECH", "CASTER"])), ["SENIOR_TECH", "CASTER"])
check("the users screen locks the TECH box under SENIOR_TECH",
  [...impliedRoles(["SENIOR_TECH"])], ["TECH"])
check("nothing is locked for a plain Tech", [...impliedRoles(["TECH"])], [])

console.log("\n── every login role can be rendered and picked ───────────────────")

check("SENIOR_TECH is offered in ניהול משתמשים", LOGIN_ROLES.includes("SENIOR_TECH"), true)
check("every login role has a Hebrew label",
  LOGIN_ROLES.filter((r) => !ROLE_LABELS[r]), [])

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
