import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { LogoutButton } from "@/components/LogoutButton"

export default async function SadnaotPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">סדנאות</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{session.user.name}</span>
          <LogoutButton />
        </div>
      </div>
      <p className="text-gray-500">Session 2 יבנה את הדף הזה.</p>
    </main>
  )
}
