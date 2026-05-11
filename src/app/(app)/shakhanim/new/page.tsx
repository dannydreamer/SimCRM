"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUser } from "@/app/(app)/user-context"

const EMPTY = {
  name:        "",
  gender:      "" as "" | "MALE" | "FEMALE",
  phone:       "",
  email:       "",
  languages:   "",
  specialties: "",
  canDirect:   false,
}

export default function NewActorPage() {
  const user      = useUser()
  const router    = useRouter()
  const isManager = user.roles.includes("MANAGER")

  const [form, setForm]     = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  if (!isManager) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-500">אין הרשאה לדף זה.</p>
      </div>
    )
  }

  function set<K extends keyof typeof EMPTY>(field: K, value: typeof EMPTY[K]) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.gender) { setError("יש לבחור מגדר"); return }
    setSaving(true)
    const res  = await fetch("/api/shakhanim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "שגיאה בשמירה"); setSaving(false); return }
    router.push(`/shakhanim/${data.id}`)
  }

  const canSubmit = form.name.trim() && form.gender

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-8 pt-5 pb-2 text-sm text-gray-400 shrink-0">
        <Link href="/shakhanim" className="hover:text-gray-700">שחקנים</Link>
        {" / "}
        <span className="text-gray-700">שחקן/ית חדש/ה</span>
      </div>

      <div className="px-8 pb-8 max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">שחקן/ית חדש/ה</h1>
        <p className="text-sm text-gray-400 mb-6">שדות חובה: שם ומגדר</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">שם מלא *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              placeholder="שם מלא"
              required
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">מגדר *</label>
            <div className="flex gap-4">
              {(["MALE", "FEMALE"] as const).map((g) => (
                <label key={g} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={form.gender === g}
                    onChange={() => set("gender", g)}
                    className="accent-navy"
                  />
                  <span className="text-sm text-gray-700">
                    {g === "MALE" ? "שחקן" : "שחקנית"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">טלפון</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">אימייל</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                dir="ltr"
              />
            </div>
          </div>

          {/* Languages */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">שפות</label>
            <input
              type="text"
              value={form.languages}
              onChange={(e) => set("languages", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              placeholder="עברית, ערבית, אנגלית..."
            />
          </div>

          {/* Specialties */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">התמחויות</label>
            <textarea
              value={form.specialties}
              onChange={(e) => set("specialties", e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
              placeholder="תיאור חופשי של תחומי התמחות"
            />
          </div>

          {/* Can direct */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.canDirect}
              onChange={(e) => set("canDirect", e.target.checked)}
              className="accent-navy"
            />
            <span className="text-sm text-gray-700">יכול/ה לשמש במאי/ת</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="px-5 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark disabled:opacity-40 transition-colors"
            >
              {saving ? "שומר..." : "יצירת שחקן/ית"}
            </button>
            <Link href="/shakhanim" className="text-sm text-gray-500 hover:text-gray-800">
              ביטול
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
