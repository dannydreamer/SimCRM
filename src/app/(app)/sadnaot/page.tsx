"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useUser } from "@/app/(app)/user-context"

interface WorkshopRow {
  id:         string
  date:       string
  startTime:  string
  endTime:    string
  numRooms:   number
  status:     string
  tentative:  boolean
  cancelled:  boolean
  groupName:  string
  orgId:      string
  orgName:    string
  authorName: string | null
}

const STATUS_HE: Record<string, string> = {
  NEW:       "סדנה חדשה",
  SPECIFIED: "בוצע איתור צרכים",
  READY:     "מוכן",
  CLOSING:   "בתהליך סגירה",
  CLOSED:    "סגור",
  CANCELLED: "בוטל",
}

const STATUS_COLOR: Record<string, string> = {
  NEW:       "bg-gray-100 text-gray-600",
  SPECIFIED: "bg-blue-50 text-blue-700",
  READY:     "bg-green-50 text-green-700",
  CLOSING:   "bg-amber-50 text-amber-700",
  CLOSED:    "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-50 text-red-600",
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

export default function SadnaotPage() {
  const user      = useUser()
  const isManager = user.roles.includes("MANAGER")

  const [workshops, setWorkshops] = useState<WorkshopRow[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetch("/api/sadnaot")
      .then((r) => r.json())
      .then((data) => { setWorkshops(data); setLoading(false) })
  }, [])

  const active    = workshops.filter((w) => !w.cancelled)
  const cancelled = workshops.filter((w) => w.cancelled)

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-6 pb-4 flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">סדנאות</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? "טוען..." : `${active.length} סדנאות`}
          </p>
        </div>
        {isManager && (
          <Link
            href="/sadnaot/new"
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark transition-colors"
          >
            + סדנה חדשה
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">טוען סדנאות...</p>
        ) : workshops.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">אין סדנאות במערכת</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-right text-xs text-gray-500 font-medium">
                  <th className="px-4 py-2.5">תאריך</th>
                  <th className="px-4 py-2.5">קבוצה</th>
                  <th className="px-4 py-2.5">ארגון</th>
                  <th className="px-4 py-2.5 text-center">חדרים</th>
                  <th className="px-4 py-2.5">מתחקר/ת</th>
                  <th className="px-4 py-2.5">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {active.map((w) => (
                  <tr key={w.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{fmtDate(w.date)}</span>
                        {w.tentative && (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold leading-none">?</span>
                        )}
                      </div>
                      <span className="block text-xs text-gray-400">{w.startTime}–{w.endTime}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{w.groupName}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/irgunnim/${w.orgId}`} className="text-navy hover:underline" onClick={(e) => e.stopPropagation()}>
                        {w.orgName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-500">{w.numRooms}</td>
                    <td className="px-4 py-2.5 text-gray-500">{w.authorName ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[w.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {STATUS_HE[w.status] ?? w.status}
                      </span>
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
                      <tr key={w.id} className="border-b border-gray-100 last:border-0 opacity-50">
                        <td className="px-4 py-2 line-through text-gray-500">{fmtDate(w.date)}</td>
                        <td className="px-4 py-2 line-through text-gray-500">{w.groupName}</td>
                        <td className="px-4 py-2 line-through text-gray-500">{w.orgName}</td>
                        <td className="px-4 py-2 text-center text-gray-400">{w.numRooms}</td>
                        <td className="px-4 py-2 text-gray-400">{w.authorName ?? "—"}</td>
                        <td className="px-4 py-2">
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
