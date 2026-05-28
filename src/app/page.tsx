import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session?.user.roles.includes("CASTER") && !session.user.roles.includes("MANAGER")) {
    redirect("/lihukim")
  }
  redirect("/sadnaot")
}
