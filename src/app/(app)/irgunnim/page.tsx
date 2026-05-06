"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useUser } from "@/app/(app)/user-context"
import { PEDAGOGI_LABELS, PEDAGOGI_VALUES, TAKZIVI_LABELS, TAKZIVI_VALUES } from "@/lib/shiyuch"

interface OrgCard {
  id: string
  name: string
  city: string
  shiyuchPedagogi: string
  shiyuchTakzivi: string
  pocName: string | null
  workshopCount: number
  lastWorkshopDate: string | null
  groups: { id: string; name: string }[]
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

type Sort = "lastWorkshop" | "name" | "workshopCount"

export default function IrgunnimPage() {
  const user      = useUser()
  const isManager = user.roles.includes("MANAGER")

  const [orgs, setOrgs]         = useState<OrgCard[]>([])
  const [loading, setLoading]   = useState(true)
  const [q, setQ]               = useState("")
  const [pedagogi, setPedagogi] = useState("")
  const [takzivi, setTakzivi]   = useState("")
  const [sort, setSort]         = useState<Sort>("lastWorkshop")

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ sort })
    if (q)       params.set("q", q)
    if (pedagogi) params.set("pedagogi", pedagogi)
    if (takzivi)  params.set("takzivi",  takzivi)
    fetch(`/api/irgunnim?${params}`)
      .then((r) => r.json())
      .then((data) => { setOrgs(data); setLoading(false) })
  }, [q, pedagogi, takzivi, sort])

  const totalGroups = orgs.reduce((sum, o) => sum + o.groups.length, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ארגונים וקבוצות</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? "טוען..." : `${orgs.length} ארגונים, ${totalGroups} קבוצות`}
          </p>
        </div>
        {isManager && (
          <Link
            href="/irgunnim/new"
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark transition-colors"
          >
            + ארגון חדש
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="px-8 pb-4 flex flex-wrap items-center gap-3 shrink-0">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי שם ארגון או קבוצה"
          className="border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30 w-60"
        />
        <select
          value={pedagogi}
          onChange={(e) => setPedagogi(e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30"
        >
          <option value="">שיוך פדגוגי: הכל</option>
          {PEDAGOGI_VALUES.map((v) => (
            <option key={v} value={v}>{PEDAGOGI_LABELS[v]}</option>
          ))}
        </select>
        <select
          value={takzivi}
          onChange={(e) => setTakzivi(e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30"
        >
          <option value="">שיוך תקציבי: הכל</option>
          {TAKZIVI_VALUES.map((v) => (
            <option key={v} value={v}>{TAKZIVI_LABELS[v]}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30"
        >
          <option value="lastWorkshop">מיון: סדנה אחרונה</option>
          <option value="name">מיון: שם</option>
          <option value="workshopCount">מיון: מספר סדנאות</option>
        </select>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">טוען ארגונים...</p>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">לא נמצאו ארגונים</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 max-w-4xl">
            {orgs.map((org) => (
              <OrgCardView key={org.id} org={org} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OrgCardView({ org }: { org: OrgCard }) {
  return (
    <Link
      href={`/irgunnim/${org.id}`}
      className="block border border-gray-200 rounded-lg p-5 hover:border-navy/40 hover:shadow-sm transition-all bg-white"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-gray-900 mb-1.5">{org.name}</h2>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-navy-light text-navy">
              {PEDAGOGI_LABELS[org.shiyuchPedagogi] ?? org.shiyuchPedagogi}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {TAKZIVI_LABELS[org.shiyuchTakzivi] ?? org.shiyuchTakzivi}
            </span>
          </div>

          {/* Contact + city */}
          <p className="text-sm text-gray-500 mb-3">
            {org.pocName ? `${org.pocName} · ` : ""}{org.city}
          </p>

          {/* Group pills */}
          {org.groups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {org.groups.map((g) => (
                <span
                  key={g.id}
                  className="px-2 py-0.5 rounded text-xs bg-gray-50 border border-gray-200 text-gray-600"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Workshop count + last date */}
        <div className="text-left shrink-0 text-sm text-gray-500">
          <p className="font-medium text-gray-700">{org.workshopCount} סדנאות</p>
          {org.lastWorkshopDate && (
            <p className="text-xs mt-0.5">אחרונה: {fmtDate(org.lastWorkshopDate)}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
