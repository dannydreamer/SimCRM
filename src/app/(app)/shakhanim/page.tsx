"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useUser } from "@/app/(app)/user-context"

interface ActorRow {
  id: string
  name: string
  gender: "MALE" | "FEMALE"
  specialties: string | null
  languages: string | null
  canDirect: boolean
  lastDate: string | null
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

type GenderFilter = "all" | "MALE" | "FEMALE"
type SortBy       = "name" | "lastActivity"

export default function ShakhanimPage() {
  const user      = useUser()
  const isManager = user.roles.includes("MANAGER")
  const canExport = isManager || user.roles.includes("FEEDBACK_DOCUMENTER")

  const [actors, setActors]   = useState<ActorRow[]>([])
  const [loading, setLoading] = useState(true)

  const [q,              setQ]              = useState("")
  const [gender,         setGender]         = useState<GenderFilter>("all")
  const [directorsOnly,  setDirectorsOnly]  = useState(false)
  const [languageFilter, setLanguageFilter] = useState<string>("all")
  const [sortBy,         setSortBy]         = useState<SortBy>("name")

  useEffect(() => {
    fetch("/api/shakhanim")
      .then((r) => r.json())
      .then((data) => { setActors(data); setLoading(false) })
  }, [])

  const languageOptions = useMemo(() => {
    const langs = new Set<string>()
    actors.forEach((a) => {
      if (a.languages) {
        a.languages.split(",").forEach((l) => {
          const t = l.trim()
          if (t) langs.add(t)
        })
      }
    })
    return Array.from(langs).sort((a, b) => a.localeCompare(b, "he"))
  }, [actors])

  const filtered = useMemo(() => {
    const list = actors.filter((a) => {
      if (gender !== "all" && a.gender !== gender) return false
      if (directorsOnly && !a.canDirect) return false
      if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false
      if (languageFilter !== "all") {
        if (!a.languages) return false
        const langs = a.languages.split(",").map((l) => l.trim())
        if (!langs.includes(languageFilter)) return false
      }
      return true
    })

    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "he")
      // lastActivity: most recent first; nulls last
      if (!a.lastDate && !b.lastDate) return 0
      if (!a.lastDate) return 1
      if (!b.lastDate) return -1
      return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
    })
  }, [actors, q, gender, directorsOnly, languageFilter, sortBy])

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
        <div className="flex items-center gap-2">
          {canExport && (
            <a href="/api/shakhanim/export"
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700 transition-colors">
              ייצוא CSV
            </a>
          )}
          {isManager && (
            <Link href="/shakhanim/new"
              className="px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark transition-colors">
              + שחקן/ית חדש/ה
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 pb-4 flex flex-wrap items-center gap-3 shrink-0">
        {/* Name search */}
        <input
          type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי שם"
          className="border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30 w-48"
        />

        {/* Gender */}
        <div className="flex items-center gap-1">
          {([
            { key: "all",    label: "הכל"      },
            { key: "MALE",   label: "שחקנים"   },
            { key: "FEMALE", label: "שחקניות"  },
          ] as { key: GenderFilter; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setGender(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                gender === key ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Director toggle */}
        <button onClick={() => setDirectorsOnly((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            directorsOnly ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          במאי/ת בלבד
        </button>

        {/* Language filter */}
        {languageOptions.length > 0 && (
          <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30">
            <option value="all">כל השפות</option>
            {languageOptions.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}

        <div className="w-px h-5 bg-gray-200" />

        {/* Sort */}
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30">
          <option value="name">מיון: שם</option>
          <option value="lastActivity">מיון: פעילות אחרונה</option>
        </select>
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
                  <th className="px-4 py-2.5">שפות</th>
                  <th className="px-4 py-2.5 text-center">במאי?</th>
                  <th className="px-4 py-2.5">פעילות אחרונה</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((actor) => (
                  <tr key={actor.id}
                    onClick={() => (window.location.href = `/shakhanim/${actor.id}`)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900">{actor.name}</span>
                      <span className="text-xs text-gray-400 mr-2">
                        {actor.gender === "MALE" ? "שחקן" : "שחקנית"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">
                      {actor.specialties || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {actor.languages || <span className="text-gray-300">—</span>}
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
