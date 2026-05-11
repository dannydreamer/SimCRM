"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useUser } from "@/app/(app)/user-context"
import { RagDot } from "@/components/RagDot"

interface ActorRow {
  id: string
  name: string
  gender: "MALE" | "FEMALE"
  specialties: string | null
  workshopCount: number
  lastDate: string | null
  feedbackCount: number
  ragSummary: { aspect1: string; aspect2: string; aspect3: string; aspect4: string }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2)
  return parts[0][0] + parts[parts.length - 1][0]
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

      {/* Grid */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">טוען שחקנים...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">לא נמצאו שחקנים</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl">
            {filtered.map((actor) => (
              <Link
                key={actor.id}
                href={`/shakhanim/${actor.id}`}
                className="flex items-start gap-3 border border-gray-200 rounded-lg p-4 hover:border-navy/40 hover:shadow-sm transition-all bg-white"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-navy-light text-navy flex items-center justify-center text-sm font-bold shrink-0">
                  {initials(actor.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{actor.name}</p>
                  <p className="text-xs text-gray-400 mb-1">
                    {actor.gender === "MALE" ? "שחקן" : "שחקנית"}
                    {actor.lastDate && ` · ${fmtDate(actor.lastDate)}`}
                  </p>
                  {actor.specialties && (
                    <p className="text-xs text-gray-500 truncate mb-2">{actor.specialties}</p>
                  )}
                  {/* RAG dots */}
                  {actor.feedbackCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <RagDot color={actor.ragSummary.aspect1} size="sm" />
                      <RagDot color={actor.ragSummary.aspect2} size="sm" />
                      <RagDot color={actor.ragSummary.aspect3} size="sm" />
                      <RagDot color={actor.ragSummary.aspect4} size="sm" />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
