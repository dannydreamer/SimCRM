"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkshopBlock {
  id: string
  date: string
  startTime: string
  endTime: string
  numRooms: number
  status: string
  tentative: boolean
  cancelled: boolean
  groupName: string
  orgName: string
  facilitators: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

type RangeType = "week" | "twoWeeks" | "month"

const RANGE_LABELS: Record<RangeType, string> = {
  week:     "שבוע",
  twoWeeks: "שבועיים",
  month:    "חודש",
}

const STATUS_COLORS: Record<string, string> = {
  NEW:       "bg-gray-100 border-gray-300 text-gray-700",
  SPECIFIED: "bg-blue-50 border-blue-300 text-blue-800",
  READY:     "bg-green-50 border-green-300 text-green-800",
  CLOSING:   "bg-amber-50 border-amber-300 text-amber-800",
  CLOSED:    "bg-gray-100 border-gray-300 text-gray-500",
  CANCELLED: "bg-red-50 border-red-200 text-red-500",
}

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  const out = new Date(d); out.setHours(0, 0, 0, 0); return out
}

function addDays(d: Date, n: number) {
  const out = new Date(d); out.setDate(out.getDate() + n); return out
}

function startOfWeek(d: Date) {
  const out = startOfDay(d); out.setDate(out.getDate() - out.getDay()); return out
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function fmtMonthYear(d: Date) {
  return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" })
}

function getRangeDays(anchor: Date, range: RangeType): Date[] {
  const days: Date[] = []
  if (range === "week") {
    const start = startOfWeek(anchor)
    for (let i = 0; i < 7; i++) days.push(addDays(start, i))
  } else if (range === "twoWeeks") {
    const start = startOfWeek(anchor)
    for (let i = 0; i < 14; i++) days.push(addDays(start, i))
  } else {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()
    for (let i = 0; i < count; i++) days.push(addDays(start, i))
  }
  return days
}

function navigateAnchor(anchor: Date, range: RangeType, dir: -1 | 1): Date {
  if (range === "week")     return addDays(anchor, dir * 7)
  if (range === "twoWeeks") return addDays(anchor, dir * 14)
  const d = new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)
  return d
}

// ─── Block component ──────────────────────────────────────────────────────────

function Block({ w, onClick }: { w: WorkshopBlock; onClick: () => void }) {
  const color = w.cancelled ? STATUS_COLORS.CANCELLED : (STATUS_COLORS[w.status] ?? STATUS_COLORS.NEW)
  return (
    <button onClick={onClick}
      className={`w-full text-right border rounded px-2 py-1 mb-1 last:mb-0 text-xs leading-snug hover:brightness-95 transition-all ${color} ${w.cancelled ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-1 font-semibold truncate">
        {w.tentative && (
          <span className="shrink-0 px-1 rounded bg-amber-100 text-amber-700 font-bold text-xs">?</span>
        )}
        <span className="truncate">{w.groupName}</span>
      </div>
      <div className="truncate text-gray-500">{w.orgName}</div>
      <div className="text-gray-400">{w.startTime}–{w.endTime} · {w.numRooms} חד׳</div>
      {w.facilitators.length > 0 && (
        <div className="truncate text-gray-400">{w.facilitators.join(", ")}</div>
      )}
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LuachPage() {
  const router = useRouter()

  const [workshops, setWorkshops] = useState<WorkshopBlock[]>([])
  const [loading, setLoading]     = useState(true)
  const [range, setRange]         = useState<RangeType>("week")
  const [anchor, setAnchor]       = useState<Date>(() => new Date())
  const [facilitatorFilter, setFacilitatorFilter] = useState<string>("all")

  useEffect(() => {
    fetch("/api/luach", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { setWorkshops(data); setLoading(false) })
  }, [])

  const facilitatorOptions = useMemo(() => {
    const names = new Set<string>()
    workshops.forEach((w) => w.facilitators.forEach((f) => names.add(f)))
    return Array.from(names).sort((a, b) => a.localeCompare(b, "he"))
  }, [workshops])

  const days = useMemo(() => getRangeDays(anchor, range), [anchor, range])

  const workshopsByDay = useMemo(() => {
    const filtered = facilitatorFilter === "all"
      ? workshops
      : workshops.filter((w) => w.facilitators.includes(facilitatorFilter))
    const map = new Map<string, WorkshopBlock[]>()
    filtered.forEach((w) => {
      const key = w.date.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(w)
    })
    return map
  }, [workshops, facilitatorFilter])

  const rangeLabel = useMemo(() => {
    if (days.length === 0) return ""
    if (range === "month") return fmtMonthYear(days[0])
    const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
    return `${fmt(days[0])} – ${fmt(days[days.length - 1])}`
  }, [days, range])

  const today = startOfDay(new Date())

  // For month view: pad days array to start on Sunday and end on Saturday
  const gridCells = useMemo<(Date | null)[]>(() => {
    if (range !== "month") return days
    const pre  = days[0].getDay()
    const post = 6 - days[days.length - 1].getDay()
    return [
      ...Array.from({ length: pre },  () => null),
      ...days,
      ...Array.from({ length: post }, () => null),
    ]
  }, [days, range])

  // Split cells into weeks
  const weeks = useMemo<(Date | null)[][]>(() => {
    const rows: (Date | null)[][] = []
    for (let i = 0; i < gridCells.length; i += 7) rows.push(gridCells.slice(i, i + 7))
    // Pad last row to 7 if needed (week/twoWeeks views)
    if (rows.length > 0) {
      const last = rows[rows.length - 1]
      while (last.length < 7) last.push(null)
    }
    return rows
  }, [gridCells])

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <div className="px-8 pt-6 pb-3 flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">לוח שנה</h1>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Range selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {(["week", "twoWeeks", "month"] as RangeType[]).map((key) => (
              <button key={key} onClick={() => setRange(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  range === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => setAnchor((a) => navigateAnchor(a, range, -1))}
              className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-600">
              &rsaquo;
            </button>
            <button onClick={() => setAnchor(new Date())}
              className="px-3 h-8 rounded border border-gray-200 text-xs hover:bg-gray-50 text-gray-600">
              היום
            </button>
            <button onClick={() => setAnchor((a) => navigateAnchor(a, range, 1))}
              className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-600">
              &lsaquo;
            </button>
          </div>

          {/* Range label */}
          <span className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">{rangeLabel}</span>

          {/* Facilitator filter */}
          {facilitatorOptions.length > 0 && (
            <select value={facilitatorFilter} onChange={(e) => setFacilitatorFilter(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30">
              <option value="all">כל המתחקרים</option>
              {facilitatorOptions.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">טוען...</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Day-name header row */}
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {DAY_NAMES.map((name) => (
                <div key={name}
                  className="py-2 text-center text-xs font-medium text-gray-500 border-l border-gray-200 first:border-l-0">
                  {name}
                </div>
              ))}
            </div>

            {/* Week rows */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gray-200 last:border-b-0">
                {week.map((day, di) => {
                  const isToday = day ? isSameDay(day, today) : false
                  const key     = day ? day.toISOString().slice(0, 10) : `empty-${wi}-${di}`
                  const blocks  = day ? (workshopsByDay.get(day.toISOString().slice(0, 10)) ?? []) : []
                  return (
                    <div key={key}
                      className={`border-l border-gray-200 first:border-l-0 p-1.5 min-h-[96px] align-top ${!day ? "bg-gray-50/50" : ""}`}>
                      {day && (
                        <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? "bg-navy text-white" : "text-gray-500"
                        }`}>
                          {day.getDate()}
                        </div>
                      )}
                      {blocks.map((w) => (
                        <Block key={w.id} w={w} onClick={() => router.push(`/sadnaot/${w.id}`)} />
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
