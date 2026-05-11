"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useUser } from "@/app/(app)/user-context"
import { PEDAGOGI_LABELS, TAKZIVI_LABELS } from "@/lib/shiyuch"

interface OrgOption {
  id:              string
  name:            string
  city:            string
  shiyuchPedagogi: string
  shiyuchTakzivi:  string
}

interface PersonOption {
  id:    string
  name:  string
  roles: string[]
  active: boolean
}

function NewWorkshopForm() {
  const user      = useUser()
  const router    = useRouter()
  const params    = useSearchParams()
  const isManager = user.roles.includes("MANAGER")

  const [orgs, setOrgs]               = useState<OrgOption[]>([])
  const [facilitators, setFacilitators] = useState<PersonOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  const [orgId,             setOrgId]             = useState(params.get("orgId") ?? "")
  const [groupName,         setGroupName]         = useState("")
  const [date,              setDate]              = useState("")
  const [startTime,         setStartTime]         = useState("")
  const [endTime,           setEndTime]           = useState("")
  const [numRooms,          setNumRooms]          = useState("1")
  const [locationType,      setLocationType]      = useState<"CENTER" | "EXTERNAL">("CENTER")
  const [locationName,      setLocationName]      = useState("")
  const [authorId,          setAuthorId]          = useState("")
  const [directorRequested, setDirectorRequested] = useState(false)
  const [tentative,         setTentative]         = useState(false)
  const [notes,             setNotes]             = useState("")
  const [saving,            setSaving]            = useState(false)
  const [error,             setError]             = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/irgunnim").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]).then(([orgsData, usersData]) => {
      setOrgs(orgsData)
      setFacilitators((usersData as PersonOption[]).filter((u) => u.roles.includes("FACILITATOR") && u.active))
      setLoadingOptions(false)
    })
  }, [])

  if (!isManager) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-500">אין הרשאה לדף זה.</p>
      </div>
    )
  }

  const selectedOrg = orgs.find((o) => o.id === orgId)
  const canSubmit   = orgId && groupName.trim() && date && startTime && endTime && numRooms

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    const res = await fetch("/api/sadnaot", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        organizationId:   orgId,
        groupName:        groupName.trim(),
        date,
        startTime,
        endTime,
        numRooms:         parseInt(numRooms),
        locationType,
        locationName:     locationType === "EXTERNAL" ? locationName.trim() || null : null,
        authorId:         authorId || null,
        directorRequested,
        tentative,
        notes:            notes.trim() || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "שגיאה בשמירה"); setSaving(false); return }
    router.push("/sadnaot")
  }

  const inputCls = "w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-8 pt-5 pb-2 text-sm text-gray-400 shrink-0">
        <Link href="/sadnaot" className="hover:text-gray-700">סדנאות</Link>
        {" / "}
        <span className="text-gray-700">סדנה חדשה</span>
      </div>

      <div className="px-8 pb-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">סדנה חדשה</h1>
        <p className="text-sm text-gray-400 mb-6">שדות חובה: ארגון, קבוצה, תאריך, שעות, מספר חדרים</p>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Organization */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">ארגון *</label>
            <div className="flex items-center gap-2">
              <select
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                disabled={loadingOptions}
                required
              >
                <option value="">{loadingOptions ? "טוען..." : "בחר/י ארגון"}</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} — {o.city}</option>
                ))}
              </select>
              <Link
                href="/irgunnim/new?returnTo=/sadnaot/new"
                className="text-sm text-navy hover:underline whitespace-nowrap"
              >
                ארגון חדש?
              </Link>
            </div>
            {selectedOrg && (
              <p className="mt-1.5 text-xs text-gray-400">
                {PEDAGOGI_LABELS[selectedOrg.shiyuchPedagogi] ?? selectedOrg.shiyuchPedagogi}
                {" · "}
                {TAKZIVI_LABELS[selectedOrg.shiyuchTakzivi] ?? selectedOrg.shiyuchTakzivi}
              </p>
            )}
          </div>

          {/* Participant group */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">שם קבוצה *</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className={inputCls}
              required
            />
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">תאריך *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required dir="ltr" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">שעת התחלה *</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} required dir="ltr" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">שעת סיום *</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} required dir="ltr" />
            </div>
          </div>

          {/* Estimated rooms */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">מספר חדרים משוער *</label>
            <input
              type="number" min="1" max="10" value={numRooms}
              onChange={(e) => setNumRooms(e.target.value)}
              className="w-24 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              required dir="ltr"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm text-gray-700 mb-2">מיקום *</label>
            <div className="flex gap-6 mb-2">
              {(["CENTER", "EXTERNAL"] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="locationType" value={t} checked={locationType === t} onChange={() => setLocationType(t)} className="accent-navy" />
                  <span className="text-sm text-gray-700">{t === "CENTER" ? "מרכז" : "חיצוני"}</span>
                </label>
              ))}
            </div>
            {locationType === "EXTERNAL" && (
              <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} className={inputCls} placeholder="כתובת / שם המקום" />
            )}
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">מתחקר/ת (כותב/ת תרחיש)</label>
            <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} className={inputCls} disabled={loadingOptions}>
              <option value="">ללא שיוך</option>
              {facilitators.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={tentative} onChange={(e) => setTentative(e.target.checked)} className="accent-navy" />
              <span className="text-sm text-gray-700">סדנה אפשרית (טנטטיבי) — לא אושרה עדיין</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={directorRequested} onChange={(e) => setDirectorRequested(e.target.checked)} className="accent-navy" />
              <span className="text-sm text-gray-700">נדרש/ת במאי/ת</span>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">הערות</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-4 pt-2">
            <button type="submit" disabled={saving || !canSubmit} className="px-5 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark disabled:opacity-40 transition-colors">
              {saving ? "שומר..." : "יצירת סדנה"}
            </button>
            <Link href="/sadnaot" className="text-sm text-gray-500 hover:text-gray-800">ביטול</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NewWorkshopPage() {
  return (
    <Suspense>
      <NewWorkshopForm />
    </Suspense>
  )
}