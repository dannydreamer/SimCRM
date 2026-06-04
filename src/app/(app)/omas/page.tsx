"use client"

import { Fragment, useEffect, useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkshopEntry {
  id: string
  date: string
  groupName: string
  orgName: string
  rooms: number[]    // room numbers where they facilitate
  asAuthor: boolean
}

interface FacilitatorRow {
  id: string
  name: string
  roomCount: number
  authorCount: number
  workshops: WorkshopEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`
}

// Color thresholds based on total load (rooms + authored workshops).
// Scaled by the selected week window so 1 week and 4 weeks feel proportional.
function loadColor(total: number, weeks: number): "green" | "amber" | "red" | "none" {
  if (total === 0) return "none"
  const perWeek = total / weeks
  if (perWeek <= 1.5) return "green"
  if (perWeek <= 3)   return "amber"
  return "red"
}

const LOAD_STYLES = {
  none:  { row: "bg-white",           badge: "bg-gray-100 text-gray-400",     label: "אין עומס"     },
  green: { row: "bg-green-50/40",     badge: "bg-green-100 text-green-700",   label: "עומס נמוך"    },
  amber: { row: "bg-amber-50/40",     badge: "bg-amber-100 text-amber-700",   label: "עומס בינוני"  },
  red:   { row: "bg-red-50/40",       badge: "bg-red-100 text-red-700",       label: "עומס גבוה"    },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OmasPage() {
  const [weeks, setWeeks]           = useState(2)
  const [rows, setRows]             = useState<FacilitatorRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    fetch(`/api/omas?weeks=${weeks}`)
      .then((r) => r.json())
      .then((data) => { setRows(data); setLoading(false) })
  }, [weeks])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">עומס מתחקרים</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {loading ? "טוען..." : `${rows.length} מתחקרים פעילים`}
            </p>
          </div>

          {/* Week selector */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm text-gray-500 ml-2">חלון זמן:</span>
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                onClick={() => setWeeks(w)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  weeks === w
                    ? "bg-navy text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {w} {w === 1 ? "שבוע" : "שבועות"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-8 pb-3 flex items-center gap-4 text-xs text-gray-500 shrink-0">
        <span>עומס (חדרים + כתיבה לשבוע):</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block"/>עד 1.5</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"/>עד 3</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"/>מעל 3</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">טוען...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">לא נמצאו מתחקרים פעילים</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden max-w-3xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-right text-xs text-gray-500 font-medium">
                  <th className="px-4 py-2.5">שם</th>
                  <th className="px-4 py-2.5 text-center">מתחקר/ת<br/><span className="font-normal text-gray-400">(חדרים)</span></th>
                  <th className="px-4 py-2.5 text-center">כותב/ת תרחיש<br/><span className="font-normal text-gray-400">(סדנאות)</span></th>
                  <th className="px-4 py-2.5 text-center">סה"כ</th>
                  <th className="px-4 py-2.5 text-center">עומס</th>
                  <th className="px-4 py-2.5 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const total = row.roomCount + row.authorCount
                  const color = loadColor(total, weeks)
                  const styles = LOAD_STYLES[color]
                  const isExpanded = expanded.has(row.id)

                  return (
                    <Fragment key={row.id}>
                      <tr
                        onClick={() => toggle(row.id)}
                        className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors hover:brightness-95 ${styles.row}`}
                      >
                        <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-base font-semibold ${row.roomCount > 0 ? "text-gray-800" : "text-gray-300"}`}>
                            {row.roomCount}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-base font-semibold ${row.authorCount > 0 ? "text-gray-800" : "text-gray-300"}`}>
                            {row.authorCount}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-base font-bold ${total > 0 ? "text-gray-900" : "text-gray-300"}`}>
                            {total}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles.badge}`}>
                            {styles.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs text-center">
                          {row.workshops.length > 0 ? (isExpanded ? "▲" : "▾") : ""}
                        </td>
                      </tr>

                      {isExpanded && row.workshops.length > 0 && (
                        <tr className="border-b border-gray-100">
                          <td colSpan={6} className="px-6 py-3 bg-gray-50/60">
                            <div className="space-y-1.5">
                              {row.workshops.map((ws) => (
                                <div key={ws.id} className="flex items-start gap-3 text-xs text-gray-600">
                                  <span className="text-gray-400 whitespace-nowrap w-16 shrink-0">
                                    {fmtDate(ws.date)}
                                  </span>
                                  <span className="font-medium text-gray-700 shrink-0">
                                    {ws.orgName}
                                  </span>
                                  <span className="text-gray-400">{ws.groupName}</span>
                                  <div className="flex gap-1 mr-auto flex-wrap">
                                    {ws.rooms.sort((a, b) => a - b).map((rn) => (
                                      <span
                                        key={rn}
                                        className="px-1.5 py-0.5 bg-navy/10 text-navy rounded text-xs"
                                      >
                                        חדר {rn}
                                      </span>
                                    ))}
                                    {ws.asAuthor && (
                                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                        כותב/ת תרחיש
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
