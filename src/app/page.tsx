import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { NAV_ITEMS } from "@/lib/roles"

export default async function Home() {
  const session = await getServerSession(authOptions)
  const roles = session?.user.roles ?? []

  // Redirect to the first nav item this user's roles can access.
  // This handles every role correctly without hardcoded special cases.
  const first = NAV_ITEMS.find((item) => item.roles.some((r) => (roles as string[]).includes(r)))
  redirect(first?.href ?? "/login")
}
