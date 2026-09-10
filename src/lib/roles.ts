export const ROLE_LABELS: Record<string, string> = {
  MANAGER: "מנהלת",
  TECH: "מפעילה טכנית",
  SENIOR_TECH: "מפעילה טכנית בכירה",
  CASTER: "מלהקת",
  FEEDBACK_DOCUMENTER: "מתעד/ת פידבק",
  FACILITATOR: "מתחקר/ת",
}

// Roles that can log into the system
export const LOGIN_ROLES = ["MANAGER", "TECH", "SENIOR_TECH", "CASTER", "FEEDBACK_DOCUMENTER", "FACILITATOR"] as const

// ─── Role implication ────────────────────────────────────────────────────────
//
// A senior Tech is a Tech who may also open organizations and workshops. Rather
// than teach the ~30 route handlers and pages that test for "TECH" about a
// second role name — and lose a right the first time one of them is missed —
// the implication is expanded ONCE, at the login boundary in src/lib/auth.ts.
// Everything downstream (middleware, route guards, page gates) sees both roles
// and needs no change.
//
// Store SENIOR_TECH alone on the Person. Do not also tick TECH.
//
// ⚠ The one place this does NOT reach is a Prisma query that filters on the
// role column, e.g. `roles: { some: { role: "TECH" } }`. Such a query finds
// only people whose stored role is literally TECH. Today only the facilitator
// lookups filter that way, so nothing is affected — but a future query on TECH
// must spell out both values itself.
const ROLE_IMPLIES: Record<string, string[]> = {
  SENIOR_TECH: ["TECH"],
}

// Stored roles → effective roles. Order is preserved and duplicates removed, so
// a person stored as SENIOR_TECH comes back as [SENIOR_TECH, TECH].
// Deliberately not generic: the returned array holds role names the argument
// did not, so a signature promising the caller's own literal type back would be
// a lie — the whole point is that ["SENIOR_TECH"] comes back carrying "TECH".
// The one caller narrows to Role[] itself.
export function expandRoles(roles: string[]): string[] {
  const out = [...roles]
  for (const role of roles) {
    for (const implied of ROLE_IMPLIES[role] ?? []) {
      if (!out.includes(implied)) out.push(implied)
    }
  }
  return out
}

// The roles worth showing a person. Drops anything held only by implication, so
// the header badge reads "מפעילה טכנית בכירה" rather than listing both.
export function displayRoles<T extends string>(roles: T[]): T[] {
  const implied = impliedRoles(roles)
  return roles.filter((r) => !implied.has(r))
}

// The roles this set of roles grants for free. The users screen uses it to show
// an implied checkbox as ticked and locked, so the Manager can see that
// מפעילה טכנית בכירה already carries מפעילה טכנית with it.
export function impliedRoles(roles: string[]): Set<string> {
  return new Set(roles.flatMap((r) => ROLE_IMPLIES[r] ?? []))
}

// ─── Capabilities ────────────────────────────────────────────────────────────
//
// Named lists for the rights that separate a senior Tech from a Tech, so the
// grant lives in one place instead of as a string literal in each guard.
// Enforce with hasAny() in the API route, never only in the UI.

// Create an organization, edit its details, add a participant group to it.
export const CAN_MANAGE_ORGS = ["MANAGER", "SENIOR_TECH"]

// Open a new workshop (/sadnaot/new and POST /api/sadnaot).
export const CAN_CREATE_WORKSHOP = ["MANAGER", "SENIOR_TECH"]

// Cancel a workshop, and clear the postponement warning a date change raises.
export const CAN_CANCEL_WORKSHOP = ["MANAGER", "SENIOR_TECH"]

export function hasAny(roles: string[], allowed: readonly string[]): boolean {
  return allowed.some((r) => roles.includes(r))
}

export const NAV_ITEMS = [
  {
    href: "/sadnaot",
    label: "סדנאות",
    roles: ["MANAGER", "TECH", "FEEDBACK_DOCUMENTER", "FACILITATOR"],
  },
  {
    href: "/irgunnim",
    label: "ארגונים",
    roles: ["MANAGER", "TECH"],
  },
  {
    href: "/luach",
    label: "לוח שנה",
    roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER", "FACILITATOR"],
  },
  {
    href: "/lihukim",
    label: "ליהוק",
    roles: ["MANAGER", "CASTER"],
  },
  {
    href: "/shakhanim",
    label: "שחקנים",
    roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER"],
  },
  {
    href: "/omas",
    label: "עומס מתחקרים",
    roles: ["MANAGER"],
  },
  {
    href: "/nosim",
    label: "רשימות מערכת",
    roles: ["MANAGER", "TECH"],
  },
  {
    href: "/yaadot",
    label: "טבלאות פיבוט",
    roles: ["MANAGER", "TECH"],
  },
  {
    href: "/users",
    label: "ניהול משתמשים",
    roles: ["MANAGER"],
  },
  {
    href: "/settings",
    label: "הגדרות",
    roles: ["MANAGER"],
  },
]

// Where each role lands after login. Checked in this order, so a user holding
// several roles lands on the first one listed — CASTER is last because a
// Manager who also casts still wants the workshops table as her home.
// Every login used to go to /sadnaot, a page the Caster has no business on.
const ROLE_HOME: { role: string; href: string }[] = [
  { role: "MANAGER",             href: "/sadnaot" },
  { role: "SENIOR_TECH",         href: "/sadnaot" },
  { role: "TECH",                href: "/sadnaot" },
  { role: "FEEDBACK_DOCUMENTER", href: "/sadnaot" },
  { role: "FACILITATOR",         href: "/sadnaot" },
  { role: "CASTER",              href: "/lihukim" },
]

// The landing page for a set of roles. Falls back to the first nav item the
// user can reach, so a role added to NAV_ITEMS but forgotten in ROLE_HOME
// still lands somewhere it is allowed to be.
export function homePathFor(roles: string[]): string {
  const home = ROLE_HOME.find((h) => roles.includes(h.role))
  if (home) return home.href

  const first = NAV_ITEMS.find((item) => item.roles.some((r) => roles.includes(r)))
  return first?.href ?? "/login"
}
