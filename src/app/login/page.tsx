"use client"

import { signIn } from "next-auth/react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/sadnaot"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("כתובת דוא\"ל או סיסמה שגויים")
      return
    }

    // Fetch session to check mustChangePassword
    const res = await fetch("/api/auth/session")
    const session = await res.json()

    if (session?.user?.mustChangePassword) {
      router.push("/change-password")
    } else {
      router.push(callbackUrl)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          כתובת דוא&quot;ל
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C4B9A] focus:border-transparent"
          dir="ltr"
          placeholder="name@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          סיסמה
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2C4B9A] focus:border-transparent"
          dir="ltr"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#2C4B9A] hover:bg-[#243f82] text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "מתחבר/ת..." : "כניסה"}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/logo.png"
              alt="כיתקטיקה"
              width={140}
              height={99}
              priority
            />
          </div>

          <h1 className="text-xl font-bold text-gray-900 text-center mb-1">
            מערכת ניהול
          </h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            כניסה למערכת
          </p>

          <Suspense fallback={<div className="space-y-5 animate-pulse" />}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Version footer */}
        <p className="text-center text-xs text-gray-400 mt-4">v1.0.0</p>
      </div>
    </div>
  )
}
