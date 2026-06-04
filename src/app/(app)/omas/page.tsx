"use client"

import { Fragment, useEffect, useMemo, useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkshopEntry {
  id: string
  date: string
  groupName: string
  orgName: string
  rooms: number[]
  asAuthor: boolean
}

interface FacilitatorRow {
  id: string
  name: string
  roomCount: number
  authorCount: number
  workshops: WorkshopEntry[]
}

type SortCol = "name" | "roomCount" | "authorCount"
type SortDir = "asc" | "desc"

type Window = "1" | "2" | "3" | "4" | "all"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`
}

const WINDOW_OPTIONS: { value: Window; label: string }[] = [
  { value: "1",   label: "שבוע" },
  { value: "2",   label: "שבועיים" },
  { value: "3",   label: "3 שבועות" },
  { value: "4",   label: "4 שבועות" },
  { value: "all", label: "הכל" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OmasPage() {
  const [window_, setWindow]      = useState<Window>("2")
  const [rows, setRows]           = useState<FacilitatorRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())
  const [sortCol, setSortCol]     = useState<SortCol>("roomCount")
  const [sortDir, setSortDir]     = useState<SortDir>("desc")

  useEffect(() => {
    setLoading(true)
    fetch(`/api/omas?weeks=${window_}`)
      .then((r) => r.json())
      .then((data) => { setRows(data); setLoading(false) })
  }, [window_])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortCol(col)
      setSortDir(col === "name" ? "asc" : "desc")
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0
      if (sortCol === "name")        cmp = a.name.localeCompare(b.name, "he")
      else if (sortCol === "roomCount")   cmp = a.roomCount - b.roomCount
      else if (sortCol === "authorCount") cmp = a.authorCount - b.authorCount
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [rows, sortCol, sortDir])

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-navy ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
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

          {/* Window selector */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm text-gray-500 ml-2">חלון זמן:</span>
            {WINDOW_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setWindow(value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  window_ === value
                    ? "bg-navy text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">טוען...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">לא נמצאו מתחקרים פעילים</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden max-w-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-right text-xs text-gray-500 font-medium">
                  <th
                    className="px-4 py-2.5 cursor-pointer select-none hover:text-gray-800"
                    onClick={() => handleSort("name")}
                  >
                    שם <SortIcon col="name" />
                  </th>
                  <th
                    className="px-4 py-2.5 text-center cursor-pointer select-none hover:text-gray-800"
                    onClick={() => handleSort("roomCount")}
                  >
                    תחקור
                    {" "}<SortIcon col="roomCount" />
                  </th>
                  <th
                    className="px-4 py-2.5 text-center cursor-pointer select-none hover:text-gray-800"
                    onClick={() => handleSort("authorCount")}
                  >
                    כתיבת תרחישים
                    {" "}<SortIcon col="authorCount" />
                  </th>
                  <th className="px-4 py-2.5 w-6" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const isExpanded = expanded.has(row.id)
                  return (
                    <Fragment key={row.id}>
                      <tr
                        onClick={() => toggleExpand(row.id)}
                        className="border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors"
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
                        <td className="px-4 py-2.5 text-gray-400 text-xs text-center">
                          {row.workshops.length > 0 ? (isExpanded ? "▲" : "▾") : ""}
                        </td>
                      </tr>

                      {isExpanded && row.workshops.length > 0 && (
                        <tr className="border-b border-gray-100">
                          <td colSpan={4} className="px-6 py-3 bg-gray-50/60">
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
