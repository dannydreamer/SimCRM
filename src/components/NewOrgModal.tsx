"use client"

import { useState } from "react"
import { PEDAGOGI_LABELS, PEDAGOGI_VALUES, TAKZIVI_LABELS, TAKZIVI_VALUES } from "@/lib/shiyuch"

export interface CreatedOrg {
  id:              string
  name:            string
  city:            string
  shiyuchPedagogi: string
  shiyuchTakzivi:  string
}

interface Props {
  onCreated: (org: CreatedOrg) => void
  onClose:   () => void
}

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

export function NewOrgModal({ onCreated, onClose }: Props) {
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
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "שגיאה בשמירה"); setSaving(false); return }
    onCreated({
      id:              data.id,
      name:            form.name.trim(),
      city:            form.city.trim(),
      shiyuchPedagogi: form.shiyuchPedagogi,
      shiyuchTakzivi:  form.shiyuchTakzivi,
    })
  }

  const canSubmit = form.name.trim() && form.city.trim() && form.shiyuchPedagogi && form.shiyuchTakzivi
  const inputCls  = "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-md bg-white shadow-xl flex flex-col overflow-y-auto" dir="rtl">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">ארגון חדש</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">

          {/* Name + City */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">שם ארגון *</label>
              <input
                type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
                className={inputCls} placeholder="שם הארגון" required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">עיר *</label>
              <input
                type="text" value={form.city} onChange={(e) => set("city", e.target.value)}
                className={inputCls} placeholder="עיר" required
              />
            </div>
          </div>

          {/* Shiyuch Pedagogi */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">שיוך פדגוגי *</label>
            <select value={form.shiyuchPedagogi} onChange={(e) => set("shiyuchPedagogi", e.target.value)} className={inputCls} required>
              <option value="">בחר/י שיוך פדגוגי</option>
              {PEDAGOGI_VALUES.map((v) => <option key={v} value={v}>{PEDAGOGI_LABELS[v]}</option>)}
            </select>
          </div>

          {/* Shiyuch Takzivi */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">שיוך תקציבי *</label>
            <select value={form.shiyuchTakzivi} onChange={(e) => set("shiyuchTakzivi", e.target.value)} className={inputCls} required>
              <option value="">בחר/י שיוך תקציבי</option>
              {TAKZIVI_VALUES.map((v) => <option key={v} value={v}>{TAKZIVI_LABELS[v]}</option>)}
            </select>
          </div>

          {/* POC */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">איש/אשת קשר</p>
            <div className="space-y-2">
              <input type="text"  value={form.pocName}  onChange={(e) => set("pocName",  e.target.value)} className={inputCls} placeholder="שם" />
              <input type="tel"   value={form.pocPhone} onChange={(e) => set("pocPhone", e.target.value)} className={inputCls} placeholder="טלפון" dir="ltr" />
              <input type="email" value={form.pocEmail} onChange={(e) => set("pocEmail", e.target.value)} className={inputCls} placeholder="אימייל" dir="ltr" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">הערות</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3 pt-1 pb-4">
            <button
              type="submit" disabled={saving || !canSubmit}
              className="px-5 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark disabled:opacity-40 transition-colors"
            >
              {saving ? "שומר..." : "יצירת ארגון"}
            </button>
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}