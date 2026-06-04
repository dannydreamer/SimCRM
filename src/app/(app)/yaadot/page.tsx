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
  const [year, setYear]     = useState(CURRENT_YEAR)
  const [rows, setRows]     = useState<GoalRow[]>([])
  const [loading, setLoading] = useState(true)

  // Allocation edit flow
  const [showConfirm, setShowConfirm] = useState(false)
  const [editingAlloc, setEditingAlloc] = useState(false)
  const [draftAllocs, setDraftAllocs]   = useState<Record<string, string>>({})
  const [savingAlloc, setSavingAlloc]   = useState(false)

  async function fetchRows(y: number) {
    setLoading(true)
    const res  = await fetch(`/api/yaadot?year=${y}`)
    const data: GoalRow[] = await res.json()
    setRows(data)
    setLoading(false)
  }

  useEffect(() => {
    setEditingAlloc(false)
    setShowConfirm(false)
    fetchRows(year)
  }, [year])

  function openConfirm() { setShowConfirm(true) }

  function onConfirmEdit() {
    const draft: Record<string, string> = {}
    rows.forEach((r) => { draft[r.shiyuchTakzivi] = String(r.allocation) })
    setDraftAllocs(draft)
    setShowConfirm(false)
    setEditingAlloc(true)
  }

  function onCancelEdit() {
    setEditingAlloc(false)
    setDraftAllocs({})
  }

  async function onSaveAlloc() {
    setSavingAlloc(true)
    await Promise.all(
      rows.map((r) => {
        const value = Math.max(0, Number(draftAllocs[r.shiyuchTakzivi]) || 0)
        return fetch("/api/yaadot", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year, shiyuchTakzivi: r.shiyuchTakzivi, allocation: value }),
        })
      })
    )
    setSavingAlloc(false)
    setEditingAlloc(false)
    setDraftAllocs({})
    await fetchRows(year)
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

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="px-8 pb-4 shrink-0">
          <div className="max-w-3xl border border-amber-200 bg-amber-50 rounded-lg px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-amber-800 font-medium">
              האם ברצונך לערוך את ערכי ההקצאה השנתית?
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={onConfirmEdit}
                className="px-4 py-1.5 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark transition-colors"
              >
                עריכה
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-1.5 border border-gray-300 text-sm text-gray-600 rounded hover:bg-gray-50 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit mode action bar */}
      {editingAlloc && (
        <div className="px-8 pb-4 shrink-0">
          <div className="max-w-3xl border border-navy/20 bg-navy/5 rounded-lg px-5 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-navy font-medium">מצב עריכת הקצאה שנתית</p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={onSaveAlloc}
                disabled={savingAlloc}
                className="px-4 py-1.5 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark disabled:opacity-50 transition-colors"
              >
                {savingAlloc ? "שומר..." : "אישור"}
              </button>
              <button
                onClick={onCancelEdit}
                disabled={savingAlloc}
                className="px-4 py-1.5 border border-gray-300 text-sm text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <th className="px-4 py-2.5 text-center">
                    <button
                      onClick={openConfirm}
                      disabled={editingAlloc}
                      className="hover:text-navy transition-colors disabled:pointer-events-none"
                      title="לחץ לעריכת הקצאה שנתית"
                    >
                      הקצאה שנתית
                      <span className="mr-1">✎</span>
                    </button>
                  </th>
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
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {TAKZIVI_LABELS[row.shiyuchTakzivi] ?? row.shiyuchTakzivi}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {editingAlloc ? (
                          <input
                            type="number"
                            min={0}
                            value={draftAllocs[row.shiyuchTakzivi] ?? ""}
                            onChange={(e) =>
                              setDraftAllocs((prev) => ({
                                ...prev,
                                [row.shiyuchTakzivi]: e.target.value,
                              }))
                            }
                            className="w-20 border border-navy/40 rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                            autoFocus={row === rows[0]}
                          />
                        ) : (
                          <span className="font-medium text-gray-700">{row.allocation}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 font-medium">{row.utilized}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{row.planned}</td>
                      <td className="px-4 py-3 text-center text-gray-700 font-semibold">{total}</td>
                      <td className={`px-4 py-3 text-center font-semibold ${remain < 0 ? "text-red-600" : "text-gray-700"}`}>
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
