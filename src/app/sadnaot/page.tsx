import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function SadnaotPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">סדנאות</h1>
      <p className="text-gray-500 mt-2">
        שלום, {session.user.name} — Session 2 יבנה את הדף הזה.
      </p>
    </main>
  )
}
