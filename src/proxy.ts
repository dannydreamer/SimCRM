import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { CAN_CREATE_WORKSHOP, CAN_MANAGE_ORGS } from "@/lib/roles"

// Routes with restricted access. Paths are prefix-matched.
// Any authenticated route NOT listed here is accessible to all logged-in users.
//
// NOTE: All middleware logic lives HERE in proxy.ts.
// Do NOT create a separate src/middleware.ts with its own logic — it will conflict.
//
// The token already carries expanded roles (see expandRoles in lib/roles.ts), so
// a rule listing TECH also admits a Senior Tech. Only rules that grant something
// a plain Tech must not have need to name SENIOR_TECH.
const ROUTE_PERMISSIONS: { prefix: string; roles: string[] }[] = [
  { prefix: "/sadnaot/new",   roles: CAN_CREATE_WORKSHOP },
  // More specific first — the table is scanned in order and the first prefix
  // match wins, so /irgunnim/new must precede /irgunnim.
  { prefix: "/irgunnim/new",  roles: CAN_MANAGE_ORGS },
  { prefix: "/irgunnim",      roles: ["MANAGER", "TECH"] },
  { prefix: "/nosim",         roles: ["MANAGER", "TECH"] },
  { prefix: "/shakhanim",     roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER"] },
  { prefix: "/lihukim",       roles: ["MANAGER", "CASTER"] },
  { prefix: "/luach",         roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER", "FACILITATOR"] },
  // טבלאות פיבוט is open to Tech; only the יעד שנתי PATCH stays Manager-only,
  // and that is enforced in the route handler.
  { prefix: "/yaadot",        roles: ["MANAGER", "TECH"] },
  { prefix: "/api/yaadot",   roles: ["MANAGER", "TECH"] },
  { prefix: "/omas",          roles: ["MANAGER"] },
  { prefix: "/api/omas",     roles: ["MANAGER"] },
  { prefix: "/users",          roles: ["MANAGER"] },
  { prefix: "/settings",       roles: ["MANAGER"] },
  { prefix: "/api/settings",   roles: ["MANAGER"] },
  // Feedback entry page + API — MANAGER and FEEDBACK_DOCUMENTER only
  { prefix: "/feedback",                  roles: ["MANAGER", "FEEDBACK_DOCUMENTER"] },
  { prefix: "/api/feedback",              roles: ["MANAGER", "FEEDBACK_DOCUMENTER"] },
  // Feedback export endpoints — MANAGER and FEEDBACK_DOCUMENTER only
  // (single-actor /api/shakhanim/[id]/export also enforced in its own handler)
  { prefix: "/api/shakhanim/export",      roles: ["MANAGER", "FEEDBACK_DOCUMENTER"] },
]

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Force password change before accessing anything else
    if (
      token?.mustChangePassword &&
      pathname !== "/change-password" &&
      !pathname.startsWith("/api/auth") &&
      pathname !== "/api/change-password"
    ) {
      return NextResponse.redirect(new URL("/change-password", req.url))
    }

    // Route-level permission check
    const userRoles = (token?.roles ?? []) as string[]
    const rule = ROUTE_PERMISSIONS.find((r) => pathname.startsWith(r.prefix))
    if (rule && !rule.roles.some((r) => userRoles.includes(r))) {
      return NextResponse.redirect(new URL("/unauthorized", req.url))
    }

    return NextResponse.next()
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized({ token }) {
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|logo.png).*)",
  ],
}
