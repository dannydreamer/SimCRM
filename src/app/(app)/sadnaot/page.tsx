"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useUser } from "@/app/(app)/user-context"

interface Facilitator { id: string; name: string }

interface WorkshopRow {
  id: string; date: string; startTime: string; endTime: string
  numRooms: number; status: string; tentative: boolean; cancelled: boolean
  groupName: string; orgId: string; orgName: string
  authorId: string | null; authorName: string | null
  roomFacilitators: Facilitator[]
  slottingFilled: number; slottingTotal: number; slottingTentative: boolean
  castingFilled: number; castingTotal: number
  scenarioWritten: boolean
  feedbackFormAdded: boolean
  pptFilled: number; pptTotal: number
  letterFilled: number; letterTotal: number
  feedbackMissing: number
}

const STATUS_HE: Record<string, string> = {
  NEW: "סדנה חדשה", SPECIFIED: "בוצע איתור צרכים",
  READY: "מוכן", CLOSING: "בתהליך סגירה",
  CLOSED: "סגור", CANCELLED: "בוטל",
}
const STATUS_COLOR: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-600", SPECIFIED: "bg-blue-50 text-blue-700",
  READY: "bg-green-50 text-green-700", CLOSING: "bg-amber-50 text-amber-700",
  CLOSED: "bg-gray-100 text-gray-500", CANCELLED: "bg-red-50 text-red-600",
}
const ALL_STATUSES = ["NEW", "SPECIFIED", "READY", "CLOSING", "CLOSED"]

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

function isPast(iso: string) {
  return new Date(iso) < new Date(new Date().toDateString())
}

// ── Badge helpers ──────────────────────────────────────────────────────────────

function CheckBadge({ ok, warn, href }: { ok: boolean; warn?: boolean; href?: string }) {
  if (ok)   return <span className="text-brand-green font-bold">✓</span>
  if (warn) {
    const inner = <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold">⚠</span>
    return href ? <Link href={href}>{inner}</Link> : inner
  }
  return <span className="text-gray-300 text-xs">—</span>
}

function FractionBadge({ filled, total, href }: { filled: number; total: number; href?: string }) {
  if (total === 0) return <span className="text-gray-300 text-xs">—</span>
  const complete = filled === total
  const inner = (
    <span className={`text-xs font-medium ${complete ? "text-brand-green" : "text-amber-700"}`}>
      {complete ? "✓" : `${filled}/${total}`}
    </span>
  )
  if (!complete && href) return <Link href={href} className="hover:underline">{inner}</Link>
  return inner
}

function FeedbackBadge({ missing, castingTotal, href }: { missing: number; castingTotal: number; href?: string }) {
  if (castingTotal === 0) return <span className="text-gray-300 text-xs">—</span>
  if (missing === 0) return <span className="text-brand-green font-bold">✓</span>
  const inner = (
    <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold">
      ⚠ {missing}
    </span>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SadnaotPage() {
  const user      = useUser()
  const isManager = user.roles.includes("MANAGER")

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([])
  const [loading, setLoading]     = useState(true)

  // Filters
  const [statusFilter,    setStatusFilter]    = useState<string>("all")
  const [facilitatorFilter, setFacilitatorFilter] = useState<string>("all")
  const [dateFrom,        setDateFrom]        = useState("")
  const [dateTo,          setDateTo]          = useState("")
  const [castingPending,  setCastingPending]  = useState(false)
  const [feedbackPending, setFeedbackPending] = useState(false)

  useEffect(() => {
    fetch("/api/sadnaot")
      .then((r) => r.json())
      .then((data) => { setWorkshops(data); setLoading(false) })
  }, [])

  // Unique facilitators across all workshops (authors + room facilitators)
  const facilitatorOptions = useMemo(() => {
    const map = new Map<string, string>()
    workshops.forEach((w) => {
      if (w.authorId && w.authorName) map.set(w.authorId, w.authorName)
      w.roomFacilitators.forEach((f) => map.set(f.id, f.name))
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "he"))
  }, [workshops])

  const { active, cancelled } = useMemo(() => {
    const filter = (w: WorkshopRow) => {
      if (statusFilter !== "all" && w.status !== statusFilter) return false
      if (facilitatorFilter !== "all") {
        const involved = w.authorId === facilitatorFilter ||
          w.roomFacilitators.some((f) => f.id === facilitatorFilter)
        if (!involved) return false
      }
      if (dateFrom && w.date < dateFrom) return false
      if (dateTo   && w.date > dateTo + "T23:59:59") return false
      if (castingPending  && w.castingFilled >= w.castingTotal && w.castingTotal > 0) return false
      if (feedbackPending && w.feedbackMissing === 0) return false
      return true
    }
    const all = workshops.filter(filter)
    return {
      active:    all.filter((w) => !w.cancelled),
      cancelled: all.filter((w) =>  w.cancelled),
    }
  }, [workshops, statusFilter, facilitatorFilter, dateFrom, dateTo, castingPending, feedbackPending])

  const upcomingCount = active.filter((w) => !isPast(w.date)).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-6 pb-3 flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">סדנאות</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? "טוען..." : `${upcomingCount} קרובות · ${active.length} סה״כ פעילות`}
          </p>
        </div>
        {isManager && (
          <Link href="/sadnaot/new" className="px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark transition-colors">
            + סדנה חדשה
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="px-8 pb-3 flex flex-wrap items-center gap-2 shrink-0">
        {/* Status chips */}
        <div className="flex items-center gap-1">
          {[{ key: "all", label: "הכל" }, ...ALL_STATUSES.map((s) => ({ key: s, label: STATUS_HE[s] }))].map(({ key, label }) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === key ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Facilitator filter */}
        <select value={facilitatorFilter} onChange={(e) => setFacilitatorFilter(e.target.value)}
          className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30">
          <option value="all">כל המתחקרים</option>
          {facilitatorOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        {/* Date range */}
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30" dir="ltr" />
        <span className="text-xs text-gray-400">—</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30" dir="ltr" />

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Pending toggles */}
        {[
          { label: "ליהוק חסר",  val: castingPending,  set: setCastingPending },
          { label: "פידבק חסר",  val: feedbackPending, set: setFeedbackPending },
        ].map(({ label, val, set }) => (
          <button key={label} onClick={() => set(!val)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${val ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">טוען סדנאות...</p>
        ) : active.length === 0 && cancelled.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">אין סדנאות</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden min-w-max">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-right text-xs text-gray-500 font-medium whitespace-nowrap">
                  <th className="px-3 py-2.5">תאריך</th>
                  <th className="px-3 py-2.5">קבוצה</th>
                  <th className="px-3 py-2.5">ארגון</th>
                  <th className="px-3 py-2.5 text-center">חד׳</th>
                  <th className="px-3 py-2.5">סטטוס</th>
                  <th className="px-3 py-2.5 text-center">ליהוק</th>
                  <th className="px-3 py-2.5 text-center">שיבוץ</th>
                  <th className="px-3 py-2.5 text-center">תרחיש</th>
                  <th className="px-3 py-2.5 text-center">טופס</th>
                  <th className="px-3 py-2.5 text-center">מצגות</th>
                  <th className="px-3 py-2.5 text-center">מכתבים</th>
                  <th className="px-3 py-2.5 text-center">פידבק</th>
                </tr>
              </thead>
              <tbody>
                {active.map((w) => (
                  <tr key={w.id}
                    onClick={() => window.location.href = `/sadnaot/${w.id}`}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${isPast(w.date) ? "opacity-70" : ""}`}>

                    {/* Date */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-medium ${isPast(w.date) ? "text-gray-500" : "text-gray-900"}`}>{fmtDate(w.date)}</span>
                        {w.tentative && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold leading-none">?</span>}
                      </div>
                      <span className="block text-xs text-gray-400">{w.startTime}–{w.endTime}</span>
                    </td>

                    {/* Group */}
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{w.groupName}</td>

                    {/* Org */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link href={`/irgunnim/${w.orgId}`} className="text-navy hover:underline" onClick={(e) => e.stopPropagation()}>
                        {w.orgName}
                      </Link>
                    </td>

                    {/* Rooms */}
                    <td className="px-3 py-2.5 text-center text-gray-500">{w.numRooms}</td>

                    {/* Status */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[w.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {STATUS_HE[w.status] ?? w.status}
                      </span>
                    </td>

                    {/* Casting */}
                    <td className="px-3 py-2.5 text-center">
                      <FractionBadge filled={w.castingFilled} total={w.castingTotal} href={`/sadnaot/${w.id}#casting`} />
                    </td>

                    {/* Slotting */}
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FractionBadge filled={w.slottingFilled} total={w.slottingTotal} href={`/sadnaot/${w.id}#rooms`} />
                        {w.slottingTentative && (
                          <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold leading-none">?</span>
                        )}
                      </div>
                    </td>

                    {/* Scenario written */}
                    <td className="px-3 py-2.5 text-center">
                      <CheckBadge
                        ok={w.scenarioWritten}
                        warn={!w.scenarioWritten && w.slottingTotal > 0}
                        href={`/sadnaot/${w.id}#scenarios`}
                      />
                    </td>

                    {/* Feedback form */}
                    <td className="px-3 py-2.5 text-center">
                      <CheckBadge ok={w.feedbackFormAdded} warn={!w.feedbackFormAdded && w.castingTotal > 0} />
                    </td>

                    {/* PPT */}
                    <td className="px-3 py-2.5 text-center">
                      <FractionBadge filled={w.pptFilled} total={w.pptTotal} href={`/sadnaot/${w.id}#rooms`} />
                    </td>

                    {/* Letters */}
                    <td className="px-3 py-2.5 text-center">
                      <FractionBadge filled={w.letterFilled} total={w.letterTotal} href={`/sadnaot/${w.id}#rooms`} />
                    </td>

                    {/* Feedback */}
                    <td className="px-3 py-2.5 text-center">
                      <FeedbackBadge missing={w.feedbackMissing} castingTotal={w.castingTotal} href={`/sadnaot/${w.id}#feedback`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cancelled */}
            {cancelled.length > 0 && (
              <details className="border-t border-gray-200">
                <summary className="px-4 py-2 text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                  {cancelled.length} סדנאות מבוטלות
                </summary>
                <table className="w-full text-sm">
                  <tbody>
                    {cancelled.map((w) => (
                      <tr key={w.id} className="border-b border-gray-100 last:border-0 opacity-40">
                        <td className="px-3 py-2 line-through text-gray-500 whitespace-nowrap">{fmtDate(w.date)}</td>
                        <td className="px-3 py-2 line-through text-gray-500">{w.groupName}</td>
                        <td className="px-3 py-2 line-through text-gray-500">{w.orgName}</td>
                        <td className="px-3 py-2 text-center text-gray-400" colSpan={9}>
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-400">בוטל</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}