export const ROLE_LABELS: Record<string, string> = {
  MANAGER: "מנהלת",
  TECH: "מפעילה טכנית",
  CASTER: "מלהקת",
  FEEDBACK_DOCUMENTER: "מתעד/ת פידבק",
  FACILITATOR: "מתחקר/ת",
}

// Roles that can log into the system
export const LOGIN_ROLES = ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER", "FACILITATOR"] as const

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
