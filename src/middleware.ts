import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

/**
 * Route-level role guards.
 * First matching prefix wins. Any authenticated user can access routes not listed here.
 */
const ROUTE_GUARDS: { prefix: string; roles: string[] }[] = [
  {
    prefix: "/luach",
    roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER", "FACILITATOR"],
  },
  {
    prefix: "/sadnaot",
    roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER", "FACILITATOR"],
  },
  { prefix: "/irgunnim",  roles: ["MANAGER", "TECH"] },
  { prefix: "/nosim",     roles: ["MANAGER", "TECH"] },
  { prefix: "/shakhanim", roles: ["MANAGER", "TECH", "CASTER", "FEEDBACK_DOCUMENTER"] },
  { prefix: "/feedback",  roles: ["MANAGER", "FEEDBACK_DOCUMENTER"] },
  { prefix: "/users",     roles: ["MANAGER"] },
  { prefix: "/yaadot",    roles: ["MANAGER"] },
  { prefix: "/omas",      roles: ["MANAGER"] },
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow the login page and public assets
  if (pathname.startsWith("/login")) return NextResponse.next()

  const token = await getToken({ req })

  // Not authenticated → login
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const roles = (token.roles as string[]) ?? []

  // Find the first matching guard
  const guard = ROUTE_GUARDS.find((g) => pathname.startsWith(g.prefix))
  if (guard && !guard.roles.some((r) => roles.includes(r))) {
    // Redirect unauthorised users to the workshops list
    return NextResponse.redirect(new URL("/sadnaot", req.url))
  }

  return NextResponse.next()
}

export const config = {
  // Run on all app routes except Next.js internals, API routes (those enforce auth themselves), and static files
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
