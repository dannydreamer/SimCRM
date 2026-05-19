"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/app/(app)/user-context"

interface PendingWorkshop {
  id: string
  date: string
  startTime: string
  groupName: string
  orgName: string
  cancelled: boolean
  castingTotal: number
  castingFilled: number
  roomCancelledLogs: { id: string; detail: string }[]
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

function isComplete(w: PendingWorkshop) {
  return w.castingTotal > 0 && w.castingFilled === w.castingTotal
}

function isPending(w: PendingWorkshop) {
  return !w.cancelled && !isComplete(w)
}

const LS_DISMISSED_CANCELLATIONS = (userId: string) =>
  `simcrm:dismissed-cancellations:${userId}`

// Same key as the detail page — dismissal is shared
const LS_DISMISSED_LOGS = "simcrm:dismissed-logs"

export default function LihukimLandingPage() {
  const router = useRouter()
  const user   = useUser()
  const [workshops, setWorkshops] = useState<PendingWorkshop[]>([])
  const [loading,   setLoading]   = useState(true)
  const [pendingOnly, setPendingOnly] = useState(false)
  const [dismissedCancelIds, setDismissedCancelIds] = useState<Set<string>>(new Set())
  // Dismissed change-log IDs (shared with detail page via same LS key)
  const [dismissedLogIds, setDismissedLogIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/lihukim", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setWorkshops(list)
        setLoading(false)
      })
  }, [])

  // Load dismissed cancellation IDs from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_DISMISSED_CANCELLATIONS(user.id)) ?? "[]")
      setDismissedCancelIds(new Set(Array.isArray(stored) ? stored : []))
    } catch { /* ignore */ }
  }, [user.id])

  // Load dismissed change-log IDs (shared key with detail page)
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_DISMISSED_LOGS) ?? "[]")
      setDismissedLogIds(new Set(Array.isArray(stored) ? stored : []))
    } catch { /* ignore */ }
  }, [])

  const newlyCancelledWorkshops = useMemo(
    () => workshops.filter((w) => w.cancelled && !dismissedCancelIds.has(w.id)),
    [workshops, dismissedCancelIds]
  )

  function dismissCancellations() {
    const next = new Set([...dismissedCancelIds, ...newlyCancelledWorkshops.map((w) => w.id)])
    setDismissedCancelIds(next)
    try {
      localStorage.setItem(LS_DISMISSED_CANCELLATIONS(user.id), JSON.stringify([...next]))
    } catch { /* ignore */ }
  }

  // Workshops that are complete but have undismissed ROOM_CANCELLED logs
  const roomCancelledWarnings = useMemo(
    () => workshops.filter((w) =>
      !w.cancelled &&
      w.roomCancelledLogs.some((l) => !dismissedLogIds.has(l.id))
    ),
    [workshops, dismissedLogIds]
  )

  function dismissRoomCancellations() {
    const logIds = roomCancelledWarnings.flatMap((w) =>
      w.roomCancelledLogs.filter((l) => !dismissedLogIds.has(l.id)).map((l) => l.id)
    )
    const next = new Set([...dismissedLogIds, ...logIds])
    setDismissedLogIds(next)
    try {
      localStorage.setItem(LS_DISMISSED_LOGS, JSON.stringify([...next]))
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">טוען...</p>
      </div>
    )
  }

  const pendingCount    = workshops.filter(isPending).length
  const displayWorkshops = pendingOnly ? workshops.filter(isPending) : workshops

  return (
    <div className="flex flex-col h-full">

      {/* Room-cancellation warning banner */}
      {!loading && roomCancelledWarnings.length > 0 && (
        <div className="mx-8 mt-4 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-start justify-between gap-3 text-sm text-amber-800 shrink-0">
          <div>
            <p className="font-semibold mb-0.5">חדר בוטל בסדנה שכבר לוהקה — יש לעדכן את השחקנים</p>
            <ul className="text-xs text-amber-700 space-y-0.5 mt-1">
              {roomCancelledWarnings.map((w) => (
                <li key={w.id}>
                  {fmtDate(w.date)} · {w.groupName} —{" "}
                  {w.roomCancelledLogs
                    .filter((l) => !dismissedLogIds.has(l.id))
                    .map((l) => l.detail)
                    .join(", ")}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={dismissRoomCancellations}
            className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors">
            הבנתי
          </button>
        </div>
      )}

      {/* Workshop-cancellation banner */}
      {!loading && newlyCancelledWorkshops.length > 0 && (
        <div className="mx-8 mt-4 bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-start justify-between gap-3 text-sm text-red-800 shrink-0">
          <div>
            <p className="font-semibold mb-0.5">
              {newlyCancelledWorkshops.length === 1 ? "סדנה בוטלה" : `${newlyCancelledWorkshops.length} סדנאות בוטלו`} — יש להפסיק את עבודת הליהוק
            </p>
            <ul className="text-xs text-red-700 space-y-0.5 mt-1">
              {newlyCancelledWorkshops.map((w) => (
                <li key={w.id}>
                  {fmtDate(w.date)} · {w.groupName} ({w.orgName})
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={dismissCancellations}
            className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 border border-red-300 text-red-700 hover:bg-red-100 transition-colors">
            הבנתי
          </button>
        </div>
      )}

      <div className="px-8 pt-6 pb-3 shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ליהוק</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {pendingCount === 0
                ? "אין סדנאות הממתינות לליהוק"
                : `${pendingCount} סדנאות ממתינות לליהוק`}
              {workshops.length > pendingCount && (
                <span className="mr-2 text-gray-300">· {workshops.length} סה״כ</span>
              )}
            </p>
          </div>
          {workshops.length > 0 && (
            <button
              onClick={() => setPendingOnly((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                pendingOnly
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}>
              {pendingOnly ? "✓ ממתינות בלבד" : "ממתינות בלבד"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 pb-8">
        {displayWorkshops.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            {pendingOnly ? "אין סדנאות ממתינות לליהוק." : "כשסדנאות ישלחו לליהוק הן יופיעו כאן."}
          </p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-right text-xs text-gray-500 font-medium">
                  <th className="px-4 py-2.5">תאריך</th>
                  <th className="px-4 py-2.5">קבוצה · ארגון</th>
                  <th className="px-4 py-2.5 text-center">שיבוץ</th>
                </tr>
              </thead>
              <tbody>
                {displayWorkshops.map((w) => {
                  const complete = isComplete(w)
                  const hasRoomWarning = !w.cancelled &&
                    w.roomCancelledLogs.some((l) => !dismissedLogIds.has(l.id))
                  return (
                    <tr key={w.id}
                      onClick={() => router.push(`/lihukim/${w.id}`)}
                      className={`border-b border-gray-100 last:border-0 transition-colors cursor-pointer ${
                        w.cancelled ? "bg-red-50/40 opacity-70 hover:bg-red-50/60" : "hover:bg-gray-50"
                      }`}>
                      <td className="px-4 py-2.5 whitespace-nowrap font-medium text-gray-900">
                        {fmtDate(w.date)}
                        <span className="block text-xs text-gray-400 font-normal">{w.startTime}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-gray-800">{w.groupName}</span>
                        <span className="text-gray-400"> · </span>
                        <span className="text-gray-500">{w.orgName}</span>
                        {w.cancelled && (
                          <span className="mr-2 px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-600">בוטל</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {w.cancelled ? (
                          <span className="text-xs text-red-500 font-medium">בוטל</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`text-sm font-medium ${complete ? "text-green-600" : "text-amber-600"}`}>
                              {complete ? "✓ הושלם" : `${w.castingFilled}/${w.castingTotal}`}
                            </span>
                            {hasRoomWarning && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-bold leading-none">⚠</span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
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
