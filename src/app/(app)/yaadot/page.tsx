"use client"

import { useEffect, useState } from "react"
import { TAKZIVI_LABELS } from "@/lib/shiyuch"

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoalRow {
  shiyuchTakzivi: string
  allocation: number
  utilized: number
  planned: number
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i)

export default function YaadotPage() {
  const [year, setYear]   = useState(CURRENT_YEAR)
  const [rows, setRows]   = useState<GoalRow[]>([])
  const [loading, setLoading] = useState(true)
  // Local allocation edits keyed by shiyuchTakzivi
  const [allocs, setAllocs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  async function fetchRows(y: number) {
    setLoading(true)
    const res  = await fetch(`/api/yaadot?year=${y}`)
    const data: GoalRow[] = await res.json()
    setRows(data)
    // Initialise local allocation inputs from fetched data
    const init: Record<string, string> = {}
    data.forEach((r) => { init[r.shiyuchTakzivi] = String(r.allocation) })
    setAllocs(init)
    setLoading(false)
  }

  useEffect(() => { fetchRows(year) }, [year])

  async function saveAlloc(tv: string) {
    const raw = allocs[tv]
    const value = Math.max(0, Number(raw) || 0)
    // Normalise the displayed value
    setAllocs((prev) => ({ ...prev, [tv]: String(value) }))
    setSaving((prev) => ({ ...prev, [tv]: true }))
    await fetch("/api/yaadot", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, shiyuchTakzivi: tv, allocation: value }),
    })
    setRows((prev) =>
      prev.map((r) => r.shiyuchTakzivi === tv ? { ...r, allocation: value } : r)
    )
    setSaving((prev) => ({ ...prev, [tv]: false }))
  }

  // Totals
  const totAlloc    = rows.reduce((s, r) => s + r.allocation, 0)
  const totUtilized = rows.reduce((s, r) => s + r.utilized,  0)
  const totPlanned  = rows.reduce((s, r) => s + r.planned,   0)
  const totTotal    = totUtilized + totPlanned
  const totRemain   = totAlloc - totTotal

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">יעדי סדנאות</h1>
            <p className="text-sm text-gray-400 mt-0.5">הקצאה שנתית מול ביצוע בפועל, לפי שיוך תקציבי</p>
          </div>

          {/* Year selector */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm text-gray-500 ml-2">שנה:</span>
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  year === y
                    ? "bg-navy text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">טוען...</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden max-w-3xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-right text-xs text-gray-500 font-medium">
                  <th className="px-4 py-2.5">שיוך תקציבי</th>
                  <th className="px-4 py-2.5 text-center">הקצאה שנתית</th>
                  <th className="px-4 py-2.5 text-center">נוצלו</th>
                  <th className="px-4 py-2.5 text-center">עתידי</th>
                  <th className="px-4 py-2.5 text-center">סה"כ</th>
                  <th className="px-4 py-2.5 text-center">נותרו</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const total  = row.utilized + row.planned
                  const remain = row.allocation - total
                  return (
                    <tr
                      key={row.shiyuchTakzivi}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50"
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {TAKZIVI_LABELS[row.shiyuchTakzivi] ?? row.shiyuchTakzivi}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          value={allocs[row.shiyuchTakzivi] ?? ""}
                          onChange={(e) =>
                            setAllocs((prev) => ({ ...prev, [row.shiyuchTakzivi]: e.target.value }))
                          }
                          onBlur={() => saveAlloc(row.shiyuchTakzivi)}
                          disabled={saving[row.shiyuchTakzivi]}
                          className="w-20 border border-gray-200 rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-700 font-medium">{row.utilized}</td>
                      <td className="px-4 py-2.5 text-center text-gray-500">{row.planned}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700 font-semibold">{total}</td>
                      <td className={`px-4 py-2.5 text-center font-semibold ${remain < 0 ? "text-red-600" : "text-gray-700"}`}>
                        {remain}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-800">
                  <td className="px-4 py-2.5 text-sm">סה"כ</td>
                  <td className="px-4 py-2.5 text-center">{totAlloc}</td>
                  <td className="px-4 py-2.5 text-center">{totUtilized}</td>
                  <td className="px-4 py-2.5 text-center">{totPlanned}</td>
                  <td className="px-4 py-2.5 text-center">{totTotal}</td>
                  <td className={`px-4 py-2.5 text-center ${totRemain < 0 ? "text-red-600" : "text-gray-800"}`}>
                    {totRemain}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
