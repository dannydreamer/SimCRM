import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

// Routes with restricted access. Paths are prefix-matched.
// Any authenticated route NOT listed here is accessible to all logged-in users.
//
// NOTE: All middleware logic lives HERE in proxy.ts.
// Do NOT create a separate src/middleware.ts with its own logic — it will conflict.
const ROUTE_PERMISSIONS: { prefix: string; roles: string[] }[] = [
  { prefix: "/sadnaot/new",   roles: ["MANAGER"] },
  { prefix: "/irgunnim",      roles: ["MANAGER", "TECH"] },
  { prefix: "/nosim",         roles: ["MANAGER", "TECH"] },
  { prefix: "/shakhanim",     roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER"] },
  { prefix: "/lihukim",       roles: ["MANAGER", "CASTER"] },
  { prefix: "/luach",         roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER", "FACILITATOR"] },
  { prefix: "/yaadot",        roles: ["MANAGER"] },
  { prefix: "/api/yaadot",   roles: ["MANAGER"] },
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
