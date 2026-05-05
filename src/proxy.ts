import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

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
