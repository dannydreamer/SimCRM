import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function SadnaotPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">סדנאות</h1>
      <p className="text-gray-400 text-sm">Session 3 יבנה את הדף הזה.</p>
    </div>
  )
}
