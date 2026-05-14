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
    roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER", "FACILITATOR"],
  },
  {
    href: "/irgunnim",
    label: "ארגונים",
    roles: ["MANAGER", "TECH"],
  },
  {
    href: "/nosim",
    label: "נושאים",
    roles: ["MANAGER", "TECH"],
  },
  {
    href: "/shakhanim",
    label: "שחקנים",
    roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER"],
  },
  {
    href: "/luach",
    label: "לוח שנה",
    roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER", "FACILITATOR"],
  },
  {
    href: "/yaadot",
    label: "יעדי סדנאות",
    roles: ["MANAGER"],
  },
  {
    href: "/omas",
    label: "עומס מתחקרים",
    roles: ["MANAGER"],
  },
  {
    href: "/users",
    label: "ניהול משתמשים",
    roles: ["MANAGER"],
  },
]
