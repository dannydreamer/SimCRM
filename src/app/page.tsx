import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { homePathFor } from "@/lib/roles"

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  // Role-aware landing page — shared with the login and change-password
  // screens so all three agree on where a user starts.
  redirect(homePathFor(session.user.roles))
}
