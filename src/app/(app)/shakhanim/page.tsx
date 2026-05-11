"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useUser } from "@/app/(app)/user-context"

interface ActorRow {
  id: string
  name: string
  gender: "MALE" | "FEMALE"
  specialties: string | null
  canDirect: boolean
  lastDate: string | null
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

type GenderFilter = "all" | "MALE" | "FEMALE"

export default function ShakhanimPage() {
  const user      = useUser()
  const isManager = user.roles.includes("MANAGER")

  const [actors, setActors]   = useState<ActorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ]             = useState("")
  const [gender, setGender]   = useState<GenderFilter>("all")

  useEffect(() => {
    fetch("/api/shakhanim")
      .then((r) => r.json())
      .then((data) => { setActors(data); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    return actors.filter((a) => {
      if (gender !== "all" && a.gender !== gender) return false
      if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [actors, q, gender])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">שחקנים</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? "טוען..." : `${filtered.length} שחקנים`}
          </p>
        </div>
        {isManager && (
          <Link
            href="/shakhanim/new"
            className="px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark transition-colors"
          >
            + שחקן/ית חדש/ה
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="px-8 pb-4 flex items-center gap-3 shrink-0">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי שם"
          className="border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30 w-52"
        />
        <div className="flex items-center gap-1">
          {(
            [
              { key: "all",    label: "הכל" },
              { key: "MALE",   label: "שחקנים" },
              { key: "FEMALE", label: "שחקניות" },
            ] as { key: GenderFilter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setGender(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                gender === key
                  ? "bg-navy text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">טוען שחקנים...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">לא נמצאו שחקנים</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden max-w-3xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-right text-xs text-gray-500 font-medium">
                  <th className="px-4 py-2.5">שם</th>
                  <th className="px-4 py-2.5">התמחות</th>
                  <th className="px-4 py-2.5 text-center">במאי?</th>
                  <th className="px-4 py-2.5">פעילות אחרונה</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((actor) => (
                  <tr
                    key={actor.id}
                    onClick={() => (window.location.href = `/shakhanim/${actor.id}`)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900">{actor.name}</span>
                      <span className="text-xs text-gray-400 mr-2">
                        {actor.gender === "MALE" ? "שחקן" : "שחקנית"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">
                      {actor.specialties || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {actor.canDirect
                        ? <span className="text-brand-green font-medium">✓</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {actor.lastDate ? fmtDate(actor.lastDate) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
