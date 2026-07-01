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
  roomCancelledWarning: boolean
  topics: { id: string; name: string }[]
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
const STATUS_ORDER = ["NEW", "SPECIFIED", "READY", "CLOSING", "CLOSED", "CANCELLED"]

type ViewFilter = "open" | "closed" | "all"
type SortCol   = "date" | "orgName" | "status"

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

function SortTh({ col, label, sortCol, sortDir, onSort, className = "" }: {
  col: SortCol; label: string; sortCol: SortCol; sortDir: "asc" | "desc"
  onSort: (col: SortCol) => void; className?: string
}) {
  const active = sortCol === col
  return (
    <th className={`px-3 py-2.5 ${className}`}>
      <button
        onClick={() => onSort(col)}
        className="flex items-center gap-1 hover:text-gray-800 transition-colors"
      >
        {label}
        <span className={`text-xs ${active ? "text-gray-700" : "text-gray-300"}`}>
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  )
}

const LS_DISMISSED_CANCELLATIONS  = (userId: string) => `simcrm:dismissed-cancellations:${userId}`
const LS_DISMISSED_POSTPONEMENTS  = (userId: string) => `simcrm:dismissed-postponements:${userId}`
const LS_DISMISSED_ROOM_CANCELLED = (userId: string) => `simcrm:dismissed-room-cancelled:${userId}`

// ── Main component ─────────────────────────────────────────────────────────────

export default function SadnaotPage() {
  const router    = useRouter()
  const user      = useUser()
  const isManager = user.roles.includes("MANAGER")
  const isTech    = user.roles.includes("TECH")
  const isCaster  = user.roles.includes("CASTER")

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [dismissedCancelIds,        setDismissedCancelIds]        = useState<Set<string>>(new Set())
  const [dismissedPostponedIds,     setDismissedPostponedIds]     = useState<Set<string>>(new Set())
  const [dismissedRoomCancelledIds, setDismissedRoomCancelledIds] = useState<Set<string>>(new Set())

  const [viewFilter,        setViewFilter]        = useState<ViewFilter>("open")
  const [facilitatorFilter, setFacilitatorFilter] = useState<string>("all")
  const [topicFilter,       setTopicFilter]       = useState<string>("all")
  const [dateFrom,          setDateFrom]          = useState("")
  const [dateTo,            setDateTo]            = useState("")
  const [castingPending,    setCastingPending]    = useState(false)
  const [feedbackPending,   setFeedbackPending]   = useState(false)
  const [sortCol,           setSortCol]           = useState<SortCol>("date")
  const [sortDir,           setSortDir]           = useState<"asc" | "desc">("asc")

  useEffect(() => {
    fetch("/api/sadnaot", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { setWorkshops(data); setLoading(false) })
  }, [])

  useEffect(() => {
    try {
      const load = (key: string) => {
        const stored = JSON.parse(localStorage.getItem(key) ?? "[]")
        return new Set<string>(Array.isArray(stored) ? stored : [])
      }
      setDismissedCancelIds(load(LS_DISMISSED_CANCELLATIONS(user.id)))
      setDismissedPostponedIds(load(LS_DISMISSED_POSTPONEMENTS(user.id)))
      setDismissedRoomCancelledIds(load(LS_DISMISSED_ROOM_CANCELLED(user.id)))
    } catch { /* ignore */ }
  }, [user.id])

  const newlyCancelledWorkshops = useMemo(
    () => workshops.filter((w) => w.cancelled && !dismissedCancelIds.has(w.id)),
    [workshops, dismissedCancelIds]
  )
  const newlyPostponedWorkshops = useMemo(
    () => (isManager || isTech)
      ? workshops.filter((w) => !w.cancelled && w.postponedWarning && !dismissedPostponedIds.has(w.id))
      : [],
    [workshops, dismissedPostponedIds, isManager, isTech]
  )
  const newlyRoomCancelledWorkshops = useMemo(
    () => (isManager || isTech)
      ? workshops.filter((w) => !w.cancelled && w.roomCancelledWarning && !dismissedRoomCancelledIds.has(w.id))
      : [],
    [workshops, dismissedRoomCancelledIds, isManager, isTech]
  )

  function dismissCancellation(workshopId: string) {
    const next = new Set([...dismissedCancelIds, workshopId])
    setDismissedCancelIds(next)
    try { localStorage.setItem(LS_DISMISSED_CANCELLATIONS(user.id), JSON.stringify([...next])) } catch { /* ignore */ }
  }
  function dismissPostponement(workshopId: string) {
    const next = new Set([...dismissedPostponedIds, workshopId])
    setDismissedPostponedIds(next)
    try { localStorage.setItem(LS_DISMISSED_POSTPONEMENTS(user.id), JSON.stringify([...next])) } catch { /* ignore */ }
  }
  function dismissRoomCancelled(workshopId: string) {
    const next = new Set([...dismissedRoomCancelledIds, workshopId])
    setDismissedRoomCancelledIds(next)
    try { localStorage.setItem(LS_DISMISSED_ROOM_CANCELLED(user.id), JSON.stringify([...next])) } catch { /* ignore */ }
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc")
    else { setSortCol(col); setSortDir("asc") }
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

  const topicOptions = useMemo(() => {
    const map = new Map<string, string>()
    workshops.forEach((w) => w.topics.forEach((t) => map.set(t.id, t.name)))
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
      if (topicFilter !== "all" && !w.topics.some((t) => t.id === topicFilter)) return false
      if (dateFrom && w.date < dateFrom) return false
      if (dateTo   && w.date > dateTo + "T23:59:59") return false
      if (castingPending  && !(w.castingTotal > 0 && w.castingFilled < w.castingTotal)) return false
      if (feedbackPending && w.feedbackMissing === 0) return false
      return true
    }

    const all = workshops.filter(passes)

    const sorted = [...all].sort((a, b) => {
      let cmp = 0
      if (sortCol === "date")    cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (sortCol === "orgName") cmp = a.orgName.localeCompare(b.orgName, "he")
      if (sortCol === "status")  cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      return sortDir === "asc" ? cmp : -cmp
    })

    return {
      active:    sorted.filter((w) => !w.cancelled),
      cancelled: viewFilter === "all" ? sorted.filter((w) => w.cancelled) : [],
    }
  }, [workshops, viewFilter, facilitatorFilter, topicFilter, dateFrom, dateTo, castingPending, feedbackPending, sortCol, sortDir])

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

      {/* Alert banners */}
      {!loading && newlyCancelledWorkshops.map((cw) => (
        <div key={cw.id} className="mx-8 mb-1 bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-start justify-between gap-3 text-sm text-red-800 shrink-0">
          <div>
            <p className="font-semibold mb-0.5">סדנה בוטלה — יש לעדכן את כל הגורמים הרלוונטיים</p>
            <p className="text-xs text-red-700">{fmtDate(cw.date)} · {cw.groupName} ({cw.orgName})</p>
          </div>
          <button onClick={() => dismissCancellation(cw.id)}
            className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 border border-red-300 text-red-700 hover:bg-red-100 transition-colors">
            הבנתי
          </button>
        </div>
      ))}
      {!loading && newlyPostponedWorkshops.map((pw) => (
        <div key={pw.id} className="mx-8 mb-1 bg-orange-50 border border-orange-300 rounded-lg px-4 py-3 flex items-start justify-between gap-3 text-sm text-orange-800 shrink-0">
          <div>
            <p className="font-semibold mb-0.5">הסדנה נדחתה — יש להודיע לגורמים הרלוונטיים</p>
            <p className="text-xs text-orange-700">{fmtDate(pw.date)} · {pw.groupName} ({pw.orgName})</p>
          </div>
          <button onClick={() => dismissPostponement(pw.id)}
            className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 border border-orange-300 text-orange-700 hover:bg-orange-100 transition-colors">
            הבנתי
          </button>
        </div>
      ))}
      {!loading && newlyRoomCancelledWorkshops.map((rw) => (
        <div key={rw.id} className="mx-8 mb-1 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-start justify-between gap-3 text-sm text-amber-800 shrink-0">
          <div>
            <p className="font-semibold mb-0.5">חדר בוטל — יש להודיע למתחקר/ת</p>
            <p className="text-xs text-amber-700">{fmtDate(rw.date)} · {rw.groupName} ({rw.orgName})</p>
          </div>
          <button onClick={() => dismissRoomCancelled(rw.id)}
            className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors">
            הבנתי
          </button>
        </div>
      ))}

      {/* Filters — row 1 */}
      <div className="px-8 pb-1.5 flex flex-wrap items-center gap-3 shrink-0">
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {VIEW_BUTTONS.map(({ key, label }) => (
            <button key={key} onClick={() => setViewFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewFilter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Facilitator */}
        <select value={facilitatorFilter} onChange={(e) => setFacilitatorFilter(e.target.value)}
          className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30">
          <option value="all">כל המתחקרים</option>
          {facilitatorOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        {/* Topic */}
        {topicOptions.length > 0 && (
          <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30">
            <option value="all">כל הנושאים</option>
            {topicOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30" dir="ltr" />
          <span className="text-xs text-gray-400">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30" dir="ltr" />
        </div>
      </div>

      {/* Filters — row 2: pending toggles */}
      <div className="px-8 pb-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => setCastingPending((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            castingPending ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          ⏳ ממתין לליהוק
        </button>
        <button
          onClick={() => setFeedbackPending((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            feedbackPending ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          ⏳ פידבק חסר
        </button>
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
                  <SortTh col="date"    label="תאריך"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="orgName" label="ארגון — קבוצה" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2.5 text-center">חד׳</th>
                  <SortTh col="status"  label="סטטוס"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
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

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900">{fmtDate(w.date)}</span>
                        {w.tentative && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold leading-none">?</span>
                        )}
                      </div>
                      <span className="block text-xs text-gray-400">{w.startTime}–{w.endTime}</span>
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link href={`/irgunnim/${w.orgId}`} className="text-navy hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}>
                        {w.orgName}
                      </Link>
                      <span className="text-gray-400"> — </span>
                      <span className="text-gray-700">{w.groupName}</span>
                    </td>

                    <td className="px-3 py-2.5 text-center text-gray-500">{w.numRooms}</td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[w.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {STATUS_HE[w.status] ?? w.status}
                      </span>
                      {w.status === "NEW" && new Date(w.date) < new Date() && (
                        <span className="block mt-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">
                          ⚠ תאריך עבר ולא בוצע איתור צרכים
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <FractionBadge
                        filled={w.castingFilled}
                        total={w.castingTotal}
                        href={(isCaster || isManager) && w.castingSentAt ? `/lihukim/${w.id}` : `/sadnaot/${w.id}#casting`}
                      />
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FractionBadge filled={w.slottingFilled} total={w.slottingTotal} href={`/sadnaot/${w.id}#rooms`} alwaysFraction />
                        {w.slottingTentative && (
                          <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold leading-none">?</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <CheckBadge ok={w.scenarioWritten} warn={!w.scenarioWritten && w.slottingTotal > 0} href={`/sadnaot/${w.id}#scenarios`} />
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <CheckBadge ok={w.feedbackFormAdded} warn={!w.feedbackFormAdded && w.castingTotal > 0} />
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <FractionBadge filled={w.pptFilled} total={w.pptTotal} href={`/sadnaot/${w.id}#rooms`} />
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <FractionBadge filled={w.letterFilled} total={w.letterTotal} href={`/sadnaot/${w.id}#rooms`} />
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <FeedbackBadge missing={w.feedbackMissing} castingTotal={w.castingTotal} href={`/sadnaot/${w.id}#feedback`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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
                        <td className="px-3 py-2 text-gray-400 line-through">{w.orgName} — {w.groupName}</td>
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
