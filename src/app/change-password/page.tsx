"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function ChangePasswordPage() {
  const { data: session, update } = useSession()
  const router = useRouter()

  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (next.length < 8) {
      setError("הסיסמה חייבת להכיל לפחות 8 תווים")
      return
    }
    if (next !== confirm) {
      setError("הסיסמאות אינן תואמות")
      return
    }

    setLoading(true)
    const res = await fetch("/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.message || "אירעה שגיאה")
      return
    }

    // Update JWT so mustChangePassword becomes false
    await update({ mustChangePassword: false })
    router.push("/sadnaot")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-xl font-bold text-gray-900 text-center mb-2">
            שינוי סיסמה
          </h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            {session?.user?.mustChangePassword
              ? "יש לשנות את הסיסמה הזמנית לפני הכניסה למערכת"
              : "עדכון סיסמה"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                סיסמה נוכחית
              </label>
              <input
                type="password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
                dir="ltr"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                סיסמה חדשה
              </label>
              <input
                type="password"
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
                dir="ltr"
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-400 mt-1">לפחות 8 תווים</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                אימות סיסמה חדשה
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
                dir="ltr"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy hover:bg-navy-dark text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "שומר..." : "שמירה וכניסה"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">v1.0.0</p>
      </div>
    </div>
  )
}
