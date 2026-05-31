"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  castingSentAt: string | null
  postponedWarning: boolean
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

type ViewFilter = "open" | "closed" | "all"
const VIEW_BUTTONS: { key: ViewFilter; label: string }[] = [
  { key: "open",   label: "עתידיות + פתוחות" },
  { key: "closed", label: "עברו ונסגרו" },
  { key: "all",    label: "הכל" },
]

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

// ── Badge helpers ──────────────────────────────────────────────────────────────

function CheckBadge({ ok, warn, href }: { ok: boolean; warn?: boolean; href?: string }) {
  if (ok)   return <span className="text-brand-green font-bold text-base">✓</span>
  if (warn) {
    const inner = <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold">⚠</span>
    return href ? <Link href={href} onClick={(e) => e.stopPropagation()}>{inner}</Link> : inner
  }
  return <span className="text-gray-300 text-xs">—</span>
}

function FractionBadge({ filled, total, href, alwaysFraction }: { filled: number; total: number; href?: string; alwaysFraction?: boolean }) {
  if (total === 0) return <span className="text-gray-300 text-xs">—</span>
  const complete = filled === total
  const showCheck = complete && !alwaysFraction
  const inner = (
    <span className={`text-xs font-medium ${complete ? "text-brand-green" : "text-amber-700"}`}>
      {showCheck ? "✓" : `${filled}/${total}`}
    </span>
  )
  if (!complete && href) return <Link href={href} className="hover:underline" onClick={(e) => e.stopPropagation()}>{inner}</Link>
  return inner
}

function FeedbackBadge({ missing, castingTotal, href }: { missing: number; castingTotal: number; href?: string }) {
  if (castingTotal === 0) return <span className="text-gray-300 text-xs">—</span>
  if (missing === 0) return <span className="text-brand-green font-bold text-base">✓</span>
  const inner = (
    <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold">⚠ {missing}</span>
  )
  return href ? <Link href={href} onClick={(e) => e.stopPropagation()}>{inner}</Link> : inner
}

const LS_DISMISSED_CANCELLATIONS = (userId: string) =>
  `simcrm:dismissed-cancellations:${userId}`

// ── Main component ─────────────────────────────────────────────────────────────

export default function SadnaotPage() {
  const router    = useRouter()
  const user      = useUser()
  const isManager = user.roles.includes("MANAGER")
  const isCaster  = user.roles.includes("CASTER")

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [dismissedCancelIds, setDismissedCancelIds] = useState<Set<string>>(new Set())

  const [viewFilter,        setViewFilter]        = useState<ViewFilter>("open")
  const [facilitatorFilter, setFacilitatorFilter] = useState<string>("all")
  const [dateFrom,          setDateFrom]          = useState("")
  const [dateTo,            setDateTo]            = useState("")
  const [sortDir,           setSortDir]           = useState<"asc" | "desc">("asc")

  useEffect(() => {
    fetch("/api/sadnaot", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { setWorkshops(data); setLoading(false) })
  }, [])

  // Load dismissed cancellation IDs from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_DISMISSED_CANCELLATIONS(user.id)) ?? "[]")
      setDismissedCancelIds(new Set(Array.isArray(stored) ? stored : []))
    } catch { /* ignore */ }
  }, [user.id])

  const newlyCancelledWorkshops = useMemo(
    () => workshops.filter((w) => w.cancelled && !dismissedCancelIds.has(w.id)),
    [workshops, dismissedCancelIds]
  )

  function dismissCancellation(workshopId: string) {
    const next = new Set([...dismissedCancelIds, workshopId])
    setDismissedCancelIds(next)
    try {
      localStorage.setItem(LS_DISMISSED_CANCELLATIONS(user.id), JSON.stringify([...next]))
    } catch { /* ignore */ }
  }

  const facilitatorOptions = useMemo(() => {
    const map = new Map<string, string>()
    workshops.forEach((w) => {
      if (w.authorId && w.authorName) map.set(w.authorId, w.authorName)
      w.roomFacilitators.forEach((f) => map.set(f.id, f.name))
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "he"))
  }, [workshops])

  const { active, cancelled } = useMemo(() => {
    const passes = (w: WorkshopRow) => {
      if (viewFilter === "open"   && (w.status === "CLOSED" || w.status === "CANCELLED")) return false
      if (viewFilter === "closed" && w.status !== "CLOSED") return false
      if (facilitatorFilter !== "all") {
        const involved = w.authorId === facilitatorFilter ||
          w.roomFacilitators.some((f) => f.id === facilitatorFilter)
        if (!involved) return false
      }
      if (dateFrom && w.date < dateFrom) return false
      if (dateTo   && w.date > dateTo + "T23:59:59") return false
      return true
    }
    const all = workshops.filter(passes)
    const sorted = [...all].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
      return sortDir === "asc" ? diff : -diff
    })
    return {
      active:    sorted.filter((w) => !w.cancelled),
      cancelled: viewFilter === "all" ? sorted.filter((w) => w.cancelled) : [],
    }
  }, [workshops, viewFilter, facilitatorFilter, dateFrom, dateTo, sortDir])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-6 pb-3 flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">סדנאות</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? "טוען..." : `${active.length} סדנאות`}
          </p>
        </div>
        {isManager && (
          <Link href="/sadnaot/new"
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark transition-colors">
            + סדנה חדשה
          </Link>
        )}
      </div>

      {/* Cancellation alert banners — one per workshop */}
      {!loading && newlyCancelledWorkshops.map((cw) => (
        <div key={cw.id} className="mx-8 mb-1 bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-start justify-between gap-3 text-sm text-red-800 shrink-0">
          <div>
            <p className="font-semibold mb-0.5">סדנה בוטלה — יש לעדכן את כל הגורמים הרלוונטיים</p>
            <p className="text-xs text-red-700">{fmtDate(cw.date)} · {cw.groupName} ({cw.orgName})</p>
          </div>
          <button
            onClick={() => dismissCancellation(cw.id)}
            className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 border border-red-300 text-red-700 hover:bg-red-100 transition-colors">
            הבנתי
          </button>
        </div>
      ))}

      {/* Filters */}
      <div className="px-8 pb-3 flex flex-wrap items-center gap-3 shrink-0">
        {/* View filter buttons */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {VIEW_BUTTONS.map(({ key, label }) => (
            <button key={key} onClick={() => setViewFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewFilter === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Facilitator filter */}
        <select value={facilitatorFilter} onChange={(e) => setFacilitatorFilter(e.target.value)}
          className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30">
          <option value="all">כל המתחקרים</option>
          {facilitatorOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30" dir="ltr" />
          <span className="text-xs text-gray-400">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30" dir="ltr" />
        </div>
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
                  {/* Date — sortable */}
                  <th className="px-3 py-2.5">
                    <button
                      onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
                      className="flex items-center gap-1 hover:text-gray-800 transition-colors">
                      תאריך
                      <span className="text-gray-400">{sortDir === "asc" ? "↑" : "↓"}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2.5">ארגון — קבוצה</th>
                  <th className="px-3 py-2.5 text-center">חד׳</th>
                  <th className="px-3 py-2.5">סטטוס</th>
                  <th className="px-3 py-2.5 text-center">ליהוק</th>
                  <th className="px-3 py-2.5 text-center">שובצו מתחקרים</th>
                  <th className="px-3 py-2.5 text-center">תרחישים</th>
                  <th className="px-3 py-2.5 text-center">משוב משתתפים</th>
                  <th className="px-3 py-2.5 text-center">מצגות</th>
                  <th className="px-3 py-2.5 text-center">מכתבים</th>
                  <th className="px-3 py-2.5 text-center">הזנת פידבק</th>
                </tr>
              </thead>
              <tbody>
                {active.map((w) => (
                  <tr key={w.id}
                    onClick={() => router.push(`/sadnaot/${w.id}`)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors">

                    {/* Date */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900">{fmtDate(w.date)}</span>
                        {w.tentative && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold leading-none">?</span>
                        )}
                        {w.postponedWarning && (
                          <span title="תאריך שונה — יש להודיע לגורמים הרלוונטיים"
                            className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-semibold leading-none">↷</span>
                        )}
                      </div>
                      <span className="block text-xs text-gray-400">{w.startTime}–{w.endTime}</span>
                    </td>

                    {/* Org — Group */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link href={`/irgunnim/${w.orgId}`} className="text-navy hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}>
                        {w.orgName}
                      </Link>
                      <span className="text-gray-400"> — </span>
                      <span className="text-gray-700">{w.groupName}</span>
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
                      <FractionBadge
                        filled={w.castingFilled}
                        total={w.castingTotal}
                        href={(isCaster || isManager) && w.castingSentAt ? `/lihukim/${w.id}` : `/sadnaot/${w.id}#casting`}
                      />
                    </td>

                    {/* Slotting */}
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FractionBadge filled={w.slottingFilled} total={w.slottingTotal} href={`/sadnaot/${w.id}#rooms`} alwaysFraction />
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

            {/* Cancelled — only shown in "הכל" view */}
            {cancelled.length > 0 && (
              <details className="border-t border-gray-200">
                <summary className="px-4 py-2 text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                  {cancelled.length} סדנאות מבוטלות
                </summary>
                <table className="w-full text-sm">
                  <tbody>
                    {cancelled.map((w) => (
                      <tr key={w.id}
                        onClick={() => router.push(`/sadnaot/${w.id}`)}
                        className="border-b border-gray-100 last:border-0 bg-red-50/20 cursor-pointer hover:bg-red-50/40 transition-colors">
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap font-medium line-through">{fmtDate(w.date)}</td>
                        <td className="px-3 py-2 text-gray-400 line-through">
                          {w.orgName} — {w.groupName}
                        </td>
                        <td className="px-3 py-2 text-center" colSpan={9}>
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-600 font-semibold">⛔ בוטל</span>
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