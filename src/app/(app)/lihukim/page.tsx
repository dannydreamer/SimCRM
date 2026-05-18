"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface PendingWorkshop {
  id: string
  date: string
  startTime: string
  groupName: string
  orgName: string
  cancelled: boolean
  castingTotal: number
  castingFilled: number
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

export default function LihukimLandingPage() {
  const router = useRouter()
  const [workshops, setWorkshops] = useState<PendingWorkshop[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    fetch("/api/lihukim", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setWorkshops(list)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">טוען...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-6 pb-3 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">ליהוק</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {workshops.length === 0 ? "אין סדנאות הממתינות לליהוק" : `${workshops.length} סדנאות ממתינות לליהוק`}
        </p>
      </div>

      <div className="flex-1 overflow-auto px-8 pb-8">
        {workshops.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            כשסדנאות ישלחו לליהוק הן יופיעו כאן.
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
                {workshops.map((w) => {
                  const complete = w.castingTotal > 0 && w.castingFilled === w.castingTotal
                  return (
                    <tr key={w.id}
                      onClick={() => !w.cancelled && router.push(`/lihukim/${w.id}`)}
                      className={`border-b border-gray-100 last:border-0 transition-colors ${
                        w.cancelled ? "bg-red-50/40 opacity-70" : "hover:bg-gray-50 cursor-pointer"
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
                          <span className={`text-sm font-medium ${complete ? "text-green-600" : "text-amber-600"}`}>
                            {complete ? "✓ הושלם" : `${w.castingFilled}/${w.castingTotal}`}
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
