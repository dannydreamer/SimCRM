"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PEDAGOGI_LABELS, PEDAGOGI_VALUES, TAKZIVI_LABELS, TAKZIVI_VALUES } from "@/lib/shiyuch"

const EMPTY = {
  name:            "",
  city:            "",
  shiyuchPedagogi: "",
  shiyuchTakzivi:  "",
  pocName:         "",
  pocPhone:        "",
  pocEmail:        "",
  notes:           "",
}

export default function NewOrgPage() {
  const router = useRouter()
  const [form, setForm]     = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  function set(field: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.shiyuchPedagogi) { setError("יש לבחור שיוך פדגוגי"); return }
    if (!form.shiyuchTakzivi)  { setError("יש לבחור שיוך תקציבי"); return }
    setSaving(true)
    const res  = await fetch("/api/irgunnim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "שגיאה בשמירה"); setSaving(false); return }
    router.push(`/irgunnim/${data.id}`)
  }

  const canSubmit = form.name.trim() && form.city.trim() && form.shiyuchPedagogi && form.shiyuchTakzivi

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Breadcrumb */}
      <div className="px-8 pt-5 pb-2 text-sm text-gray-400 shrink-0">
        <Link href="/irgunnim" className="hover:text-gray-700">ארגונים וקבוצות</Link>
        {" / "}
        <span className="text-gray-700">ארגון חדש</span>
      </div>

      <div className="px-8 pb-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">ארגון חדש</h1>
        <p className="text-sm text-gray-400 mb-6">שדות חובה: שם ארגון, עיר, שיוך פדגוגי, שיוך תקציבי</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name + City */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">שם ארגון *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                placeholder="שם הארגון"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">עיר *</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                placeholder="עיר"
                required
              />
            </div>
          </div>

          {/* Pedagogi */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">שיוך פדגוגי *</label>
            <select
              value={form.shiyuchPedagogi}
              onChange={(e) => set("shiyuchPedagogi", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              required
            >
              <option value="">בחר/י שיוך פדגוגי</option>
              {PEDAGOGI_VALUES.map((v) => (
                <option key={v} value={v}>{PEDAGOGI_LABELS[v]}</option>
              ))}
            </select>
          </div>

          {/* Takzivi */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">שיוך תקציבי *</label>
            <select
              value={form.shiyuchTakzivi}
              onChange={(e) => set("shiyuchTakzivi", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              required
            >
              <option value="">בחר/י שיוך תקציבי</option>
              {TAKZIVI_VALUES.map((v) => (
                <option key={v} value={v}>{TAKZIVI_LABELS[v]}</option>
              ))}
            </select>
          </div>

          {/* POC */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">איש/אשת קשר</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">שם</label>
                <input
                  type="text"
                  value={form.pocName}
                  onChange={(e) => set("pocName", e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">טלפון</label>
                <input
                  type="tel"
                  value={form.pocPhone}
                  onChange={(e) => set("pocPhone", e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">אימייל</label>
                <input
                  type="email"
                  value={form.pocEmail}
                  onChange={(e) => set("pocEmail", e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">הערות</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="px-5 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark disabled:opacity-40 transition-colors"
            >
              {saving ? "שומר..." : "יצירת ארגון"}
            </button>
            <Link href="/irgunnim" className="text-sm text-gray-500 hover:text-gray-800">
              ביטול
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
