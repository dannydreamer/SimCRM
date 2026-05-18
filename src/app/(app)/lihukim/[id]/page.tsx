"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUser } from "@/app/(app)/user-context"

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Scenario {
  id: string
  name: string | null
  topicName: string
  actorRequirements: string | null
  maleActorsNeeded: number
  femaleActorsNeeded: number
  orderIndex: number
}

interface Room {
  id: string
  roomNumber: number
}

interface Actor {
  id: string
  name: string
  gender: "MALE" | "FEMALE"
  specialties: string | null
  canDirect: boolean
  available: boolean
}

interface ConfirmedActor {
  id: string
  actorId: string
  actorName: string
  gender: string
  slotIndex: number
}

interface Assignment {
  id: string
  scenarioId: string | null
  roomId: string | null
  actorId: string
  actorName: string
  isDirector: boolean
  slotGender: string | null
  slotIndex: number
}

interface ChangeLog {
  id: string
  changeType: string
  detail: string
  createdAt: string
}

interface CastingData {
  id: string
  date: string
  startTime: string
  endTime: string
  groupName: string
  orgName: string
  directorRequested: boolean
  castingMaleNeeded: number | null
  castingFemaleNeeded: number | null
  castingNotes: string | null
  castingSentAt: string | null
  status: string
  cancelled: boolean
  scenarios: Scenario[]
  rooms: Room[]
  actors: Actor[]
  confirmedActors: ConfirmedActor[]
  assignments: Assignment[]
  changeLogs: ChangeLog[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  SCENARIO_REQ:       "דרישות שחקנים עודכנו",
  SCENARIO_CANCELLED: "תרחיש בוטל",
  ROOM_CANCELLED:     "חדר בוטל",
  COUNTS_CHANGED:     "מספרים כמותיים עודכנו",
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LihukimPage() {
  const { id: workshopId } = useParams<{ id: string }>()
  const router   = useRouter()
  const user     = useUser()
  const isCaster  = user.roles.includes("CASTER")
  const isManager = user.roles.includes("MANAGER")

  const [data,    setData]    = useState<CastingData | null>(null)
  const [pending, setPending] = useState<PendingWorkshop[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  // Actor pool filters
  const [genderFilter, setGenderFilter] = useState<"all" | "MALE" | "FEMALE">("all")
  const [availOnly,    setAvailOnly]    = useState(false)
  const [actorSearch,  setActorSearch]  = useState("")

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/lihukim/${workshopId}`, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/lihukim",              { cache: "no-store" }).then((r) => r.json()),
    ]).then(([castingData, pendingList]) => {
      setData(castingData)
      setPending(Array.isArray(pendingList) ? pendingList : [])
      setLoading(false)
    })
  }, [workshopId])

  useEffect(() => { load() }, [load])

  // ── Pending tabs ──────────────────────────────────────────────────────────

  const pendingTabs = useMemo(() => {
    if (!pending.length) return []
    const nearest = pending.slice(0, 5)
    if (!nearest.some((p) => p.id === workshopId)) {
      const current = pending.find((p) => p.id === workshopId)
      if (current) nearest.push(current)
    }
    return nearest
  }, [pending, workshopId])

  // ── Derived state ─────────────────────────────────────────────────────────

  const actors         = data?.actors ?? []
  const confirmedActors = data?.confirmedActors ?? []
  const assignments    = data?.assignments ?? []

  const availableActors = useMemo(() => actors.filter((a) => a.available), [actors])

  const filteredActors = useMemo(() => {
    let list = actors
    if (genderFilter !== "all") list = list.filter((a) => a.gender === genderFilter)
    if (availOnly)               list = list.filter((a) => a.available)
    if (actorSearch.trim())      list = list.filter((a) =>
      a.name.toLowerCase().includes(actorSearch.toLowerCase())
    )
    return list
  }, [actors, genderFilter, availOnly, actorSearch])

  // Step 1 derived
  const confirmedMale   = useMemo(() =>
    confirmedActors.filter((c) => c.gender === "MALE").sort((a, b) => a.slotIndex - b.slotIndex),
    [confirmedActors]
  )
  const confirmedFemale = useMemo(() =>
    confirmedActors.filter((c) => c.gender === "FEMALE").sort((a, b) => a.slotIndex - b.slotIndex),
    [confirmedActors]
  )
  const maleTarget   = data?.castingMaleNeeded ?? 0
  const femaleTarget = data?.castingFemaleNeeded ?? 0
  const targetsSet   = data?.castingMaleNeeded !== null && data?.castingFemaleNeeded !== null

  // Director assignment must be known before step1Complete
  const directorAssignment = useMemo(
    () => assignments.find((a) => a.isDirector) ?? null,
    [assignments]
  )

  const step1Complete = targetsSet &&
    confirmedMale.length   === maleTarget &&
    confirmedFemale.length === femaleTarget &&
    (!data?.directorRequested || !!directorAssignment)

  // Step 2 derived — dropdowns use confirmed actors only
  const confirmedMaleActors   = useMemo(() =>
    confirmedMale.map((c) => actors.find((a) => a.id === c.actorId)).filter(Boolean) as Actor[],
    [confirmedMale, actors]
  )
  const confirmedFemaleActors = useMemo(() =>
    confirmedFemale.map((c) => actors.find((a) => a.id === c.actorId)).filter(Boolean) as Actor[],
    [confirmedFemale, actors]
  )
  const confirmedActorIds = useMemo(
    () => new Set(confirmedActors.map((c) => c.actorId)),
    [confirmedActors]
  )
  const availableDirectorActors = useMemo(() =>
    availableActors.filter((a) => a.canDirect && !confirmedActorIds.has(a.id)),
    [availableActors, confirmedActorIds]
  )

  const assignmentBySlot = useMemo(() => {
    const map = new Map<string, Assignment>()
    assignments.forEach((a) => {
      if (!a.isDirector && a.scenarioId && a.roomId && a.slotGender !== null) {
        map.set(`${a.scenarioId}:${a.roomId}:${a.slotGender}:${a.slotIndex}`, a)
      }
    })
    return map
  }, [assignments])

  const step2Complete = useMemo(() => {
    if (!data || !step1Complete) return false
    const scenarios = data.scenarios
    const rooms     = data.rooms
    for (const s of scenarios) {
      for (const r of rooms) {
        for (let i = 0; i < s.maleActorsNeeded; i++) {
          if (!assignmentBySlot.has(`${s.id}:${r.id}:MALE:${i}`)) return false
        }
        for (let i = 0; i < s.femaleActorsNeeded; i++) {
          if (!assignmentBySlot.has(`${s.id}:${r.id}:FEMALE:${i}`)) return false
        }
      }
    }
    return true
  }, [data, step1Complete, assignmentBySlot])

  const castingComplete = step1Complete && step2Complete

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function setConfirmedSlot(gender: string, slotIndex: number, actorId: string | null) {
    if (!isCaster || saving) return
    setSaving(true)
    const r = await fetch(`/api/lihukim/${workshopId}/confirmed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gender, slotIndex, actorId }),
    })
    if (r.ok) {
      if (!actorId) {
        // Slot cleared — remove from confirmed and clear this actor's assignments
        setData((prev) => {
          if (!prev) return prev
          const removed = prev.confirmedActors.find(
            (c) => c.gender === gender && c.slotIndex === slotIndex
          )
          return {
            ...prev,
            confirmedActors: prev.confirmedActors.filter(
              (c) => !(c.gender === gender && c.slotIndex === slotIndex)
            ),
            assignments: removed
              ? prev.assignments.filter((a) => a.actorId !== removed.actorId || a.isDirector)
              : prev.assignments,
          }
        })
      } else {
        const newConfirmed: ConfirmedActor = await r.json()
        setData((prev) => {
          if (!prev) return prev
          // Remove old entry for this slot, and clear assignments of replaced actor
          const old = prev.confirmedActors.find(
            (c) => c.gender === gender && c.slotIndex === slotIndex
          )
          const filteredConfirmed = prev.confirmedActors.filter(
            (c) => !(c.gender === gender && c.slotIndex === slotIndex)
          )
          const filteredAssignments = old && old.actorId !== actorId
            ? prev.assignments.filter((a) => a.actorId !== old.actorId || a.isDirector)
            : prev.assignments
          return {
            ...prev,
            confirmedActors: [...filteredConfirmed, newConfirmed],
            assignments: filteredAssignments,
          }
        })
      }
    }
    setSaving(false)
  }

  async function toggleAvailability(actorId: string, current: boolean) {
    if (!isCaster || saving) return
    setSaving(true)
    const r = await fetch(`/api/lihukim/${workshopId}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId, available: !current }),
    })
    if (r.ok) {
      setData((prev) => {
        if (!prev) return prev
        const newActors = prev.actors.map((a) =>
          a.id === actorId ? { ...a, available: !current } : a
        )
        const newAssignments    = current ? prev.assignments.filter((a) => a.actorId !== actorId) : prev.assignments
        const newConfirmedActors = current ? prev.confirmedActors.filter((c) => c.actorId !== actorId) : prev.confirmedActors
        return { ...prev, actors: newActors, assignments: newAssignments, confirmedActors: newConfirmedActors }
      })
    }
    setSaving(false)
  }

  async function assign(
    scenarioId: string | null, roomId: string | null,
    actorId: string, isDirector: boolean,
    slotGender?: string, slotIndex?: number
  ) {
    if (!isCaster || saving) return
    setSaving(true)
    const r = await fetch(`/api/lihukim/${workshopId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId, roomId, actorId, isDirector, slotGender, slotIndex }),
    })
    if (r.ok) {
      const newAssignment: Assignment = await r.json()
      setData((prev) => {
        if (!prev) return prev
        const filtered = prev.assignments.filter((a) => {
          if (isDirector) return !a.isDirector
          return !(
            a.scenarioId === scenarioId && a.roomId === roomId &&
            a.slotGender === slotGender && a.slotIndex === slotIndex && !a.isDirector
          )
        })
        return { ...prev, assignments: [...filtered, newAssignment] }
      })
    }
    setSaving(false)
  }

  async function unassign(castingId: string) {
    if (!isCaster || saving) return
    setSaving(true)
    const r = await fetch(`/api/lihukim/${workshopId}/assignments/${castingId}`, { method: "DELETE" })
    if (r.ok) {
      setData((prev) => prev
        ? { ...prev, assignments: prev.assignments.filter((a) => a.id !== castingId) }
        : prev
      )
    }
    setSaving(false)
  }

  async function dismissLog(logId: string) {
    if (!isCaster) return
    await fetch(`/api/lihukim/${workshopId}/changelogs/${logId}/dismiss`, { method: "POST" })
    setData((prev) => prev
      ? { ...prev, changeLogs: prev.changeLogs.filter((l) => l.id !== logId) }
      : prev
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">טוען...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-red-500">ליהוק זה לא נמצא</p>
      </div>
    )
  }

  const scenarios = data.scenarios
  const rooms     = data.rooms

  return (
    <div className="flex flex-col h-full overflow-auto">

      {/* ── Pending tabs ──────────────────────────────────────────────────── */}
      {pendingTabs.length > 0 && (
        <div className="shrink-0 bg-white border-b border-gray-200 px-4 pt-3 pb-0">
          <p className="text-xs text-gray-500 mb-2">{pending.length} סדנאות ממתינות לליהוק</p>
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
            {pendingTabs.map((p) => {
              const isCurrent = p.id === workshopId
              const complete  = p.castingTotal > 0 && p.castingFilled === p.castingTotal
              return (
                <button key={p.id}
                  onClick={() => router.push(`/lihukim/${p.id}`)}
                  className={`shrink-0 px-3 py-1.5 rounded-t-md border text-xs whitespace-nowrap transition-colors ${
                    isCurrent
                      ? "bg-white border-gray-300 border-b-white text-gray-900 font-semibold -mb-px"
                      : "bg-gray-50 border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {fmtDate(p.date)} · {p.groupName}
                  {p.cancelled ? (
                    <span className="mr-1.5 font-medium text-red-500">(בוטל)</span>
                  ) : p.castingTotal > 0 && (
                    <span className={`mr-1.5 font-medium ${complete ? "text-green-600" : "text-amber-600"}`}>
                      ({p.castingFilled}/{p.castingTotal})
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex-1 px-4 md:px-8 py-6 space-y-6">

        {/* ── Cancelled workshop banner ─────────────────────────────────── */}
        {data.cancelled && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-800 font-semibold">
            ⛔ סדנה זו בוטלה — יש להפסיק את עבודת הליהוק
          </div>
        )}

        {/* ── Change alert banners ──────────────────────────────────────── */}
        {data.changeLogs.length > 0 && (
          <div className="space-y-2">
            {data.changeLogs.map((log) => (
              <div key={log.id}
                className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5 text-sm text-amber-800">
                <span>
                  <span className="font-semibold">{CHANGE_TYPE_LABELS[log.changeType] ?? log.changeType}:</span>
                  {" "}{log.detail}
                </span>
                {isCaster && (
                  <button onClick={() => dismissLog(log.id)}
                    className="text-amber-500 hover:text-amber-700 font-bold text-lg leading-none shrink-0">×</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            Requirements reference (collapsible)
        ══════════════════════════════════════════════════════════════════ */}
        <RequirementsPanel data={data} scenarios={scenarios} />

        {/* ══════════════════════════════════════════════════════════════════
            Actor pool — availability management
        ══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-3 justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">
              👥 מאגר שחקנים
              <span className="mr-2 text-xs font-normal text-gray-500">
                {availableActors.length} מעוניינים מתוך {actors.length}
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 text-xs">
                {(["all", "MALE", "FEMALE"] as const).map((g) => (
                  <button key={g} onClick={() => setGenderFilter(g)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      genderFilter === g ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"
                    }`}>
                    {g === "all" ? "הכל" : g === "MALE" ? "♂ זכר" : "♀ נקבה"}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={availOnly} onChange={(e) => setAvailOnly(e.target.checked)} className="rounded" />
                מעוניינים בלבד
              </label>
              <input
                type="text" value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
                placeholder="חיפוש לפי שם..."
                className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/30 w-32"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-right text-xs text-gray-500 font-medium bg-gray-50/50">
                  <th className="px-4 py-2">שם</th>
                  <th className="px-4 py-2">מגדר</th>
                  <th className="px-4 py-2">התמחויות</th>
                  <th className="px-4 py-2 text-center">במאי/ת</th>
                  <th className="px-4 py-2 text-center">מעוניין/ת</th>
                </tr>
              </thead>
              <tbody>
                {filteredActors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-400">אין שחקנים</td>
                  </tr>
                ) : filteredActors.map((actor) => (
                  <tr key={actor.id}
                    className={`border-b border-gray-50 last:border-0 transition-colors ${actor.available ? "bg-green-50/30" : ""}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{actor.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {actor.gender === "MALE" ? "♂ זכר" : "♀ נקבה"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[200px] truncate">
                      {actor.specialties ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {actor.canDirect
                        ? <span className="text-purple-600 font-bold text-xs">✓</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isCaster ? (
                        <button
                          onClick={() => toggleAvailability(actor.id, actor.available)}
                          disabled={saving}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold min-w-[80px] transition-colors ${
                            actor.available
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}>
                          {actor.available ? "מעוניין/ת ✓" : "לא זמין"}
                        </button>
                      ) : (
                        <span className={`text-xs font-medium ${actor.available ? "text-green-600" : "text-gray-400"}`}>
                          {actor.available ? "מעוניין/ת" : "לא זמין"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            STEP 1 — Actor confirmation
        ══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-800 text-sm">שלב 1 — אישור הגעה פיזית</h2>
              {step1Complete ? (
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                  ✓ הושלם
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                  {confirmedMale.length + confirmedFemale.length + (data.directorRequested && directorAssignment ? 1 : 0)}/
                  {maleTarget + femaleTarget + (data.directorRequested ? 1 : 0)} מאושרים
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {fmtDate(data.date)} · {data.startTime}–{data.endTime} · {data.groupName}
            </span>
          </div>

          <div className="px-5 py-4 space-y-5">

            {!targetsSet ? (
              <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 text-sm text-amber-700">
                לא הוגדרו מספרי שחקנים — יש לשלוח לליהוק מדף הסדנה תחילה
              </div>
            ) : (
              <>
                {/* Male slots */}
                {maleTarget > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">
                      ♂ שחקנים — {maleTarget} מושבים
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {Array.from({ length: maleTarget }, (_, idx) => {
                        const confirmed = confirmedMale.find((c) => c.slotIndex === idx) ?? null
                        const taken     = new Set(confirmedMale.filter((c) => c.slotIndex !== idx).map((c) => c.actorId))
                        const pool      = availableActors.filter((a) => a.gender === "MALE" && !taken.has(a.id))
                        return (
                          <ConfirmSlot
                            key={`MALE:${idx}`}
                            label={`שחקן ${idx + 1}`}
                            confirmed={confirmed}
                            pool={pool}
                            canEdit={isCaster}
                            saving={saving}
                            onSelect={(actorId) => setConfirmedSlot("MALE", idx, actorId)}
                            onClear={() => setConfirmedSlot("MALE", idx, null)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Female slots */}
                {femaleTarget > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide mb-3">
                      ♀ שחקניות — {femaleTarget} מושבים
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {Array.from({ length: femaleTarget }, (_, idx) => {
                        const confirmed = confirmedFemale.find((c) => c.slotIndex === idx) ?? null
                        const taken     = new Set(confirmedFemale.filter((c) => c.slotIndex !== idx).map((c) => c.actorId))
                        const pool      = availableActors.filter((a) => a.gender === "FEMALE" && !taken.has(a.id))
                        return (
                          <ConfirmSlot
                            key={`FEMALE:${idx}`}
                            label={`שחקנית ${idx + 1}`}
                            confirmed={confirmed}
                            pool={pool}
                            canEdit={isCaster}
                            saving={saving}
                            onSelect={(actorId) => setConfirmedSlot("FEMALE", idx, actorId)}
                            onClear={() => setConfirmedSlot("FEMALE", idx, null)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Director slot */}
                {data.directorRequested && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-3">
                      🎬 במאי/ת — מושב נפרד
                    </p>
                    {availableDirectorActors.length === 0 ? (
                      <p className="text-xs text-amber-600">אין שחקנים זמינים המוגדרים כבמאי/ת</p>
                    ) : (
                      <DirectorPicker
                        actors={availableDirectorActors}
                        current={directorAssignment}
                        canEdit={isCaster}
                        saving={saving}
                        onAssign={(actorId) => assign(null, null, actorId, true)}
                        onClear={() => directorAssignment && unassign(directorAssignment.id)}
                      />
                    )}
                  </div>
                )}

                {data.castingNotes && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{data.castingNotes}</p>
                )}
              </>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            STEP 2 — Scenario assignment
        ══════════════════════════════════════════════════════════════════ */}
        <section className={`bg-white border rounded-xl overflow-hidden transition-colors ${
          step1Complete ? "border-gray-200" : "border-gray-100 opacity-60"
        }`}>
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-800 text-sm">שלב 2 — שיבוץ לתרחישים</h2>
              {castingComplete ? (
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                  ליהוק ✓
                </span>
              ) : step1Complete ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                  בתהליך
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">
                  ממתין לשלב 1
                </span>
              )}
            </div>
            {!isCaster && isManager && (
              <p className="text-xs text-gray-400">מנהל/ת יכול/ה לצפות בלבד</p>
            )}
          </div>

          {!step1Complete ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              יש להשלים את שלב 1 לפני שיבוץ לתרחישים
            </div>
          ) : (
            <div className="px-5 py-4 space-y-6">

              {/* Scenarios × Rooms grid */}
              {scenarios.length === 0 ? (
                <p className="text-sm text-gray-400">אין תרחישים פעילים</p>
              ) : scenarios.map((scenario, si) => {
                const noSlots = scenario.maleActorsNeeded === 0 && scenario.femaleActorsNeeded === 0
                return (
                  <div key={scenario.id}>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      תרחיש {si + 1}{scenario.name ? ` — ${scenario.name}` : ""} · {scenario.topicName}
                      <span className="mr-2 normal-case font-normal text-gray-400">
                        (♂ {scenario.maleActorsNeeded} · ♀ {scenario.femaleActorsNeeded} לחדר)
                      </span>
                    </p>

                    {noSlots ? (
                      <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 text-xs text-amber-700">
                        לא הוזנו כמויות שחקנים לתרחיש זה — יש לעדכן בדף הסדנה
                      </div>
                    ) : (
                      <div className="border border-gray-100 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-medium text-right">
                              <th className="px-4 py-2 w-16">חדר</th>
                              <th className="px-4 py-2">שחקנים</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rooms.map((room) => (
                              <tr key={room.id} className="border-b border-gray-50 last:border-0">
                                <td className="px-4 py-2.5 text-gray-500 font-medium align-top pt-3">
                                  {room.roomNumber}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: scenario.maleActorsNeeded }, (_, idx) => {
                                      const key        = `${scenario.id}:${room.id}:MALE:${idx}`
                                      const assignment = assignmentBySlot.get(key) ?? null
                                      // Exclude actors already used in this scenario+room except this slot
                                      const usedInRoom = new Set(
                                        assignments.filter((a) =>
                                          a.scenarioId === scenario.id && a.roomId === room.id && !a.isDirector &&
                                          !(a.slotGender === "MALE" && a.slotIndex === idx)
                                        ).map((a) => a.actorId)
                                      )
                                      const pool = confirmedMaleActors.filter((a) => !usedInRoom.has(a.id))
                                      return (
                                        <div key={key} className="flex items-center gap-1">
                                          <span className="text-xs text-blue-500 font-semibold">♂</span>
                                          <GenderedPicker
                                            actors={pool}
                                            current={assignment}
                                            canEdit={isCaster}
                                            saving={saving}
                                            onAssign={(actorId) => assign(scenario.id, room.id, actorId, false, "MALE", idx)}
                                            onClear={() => assignment && unassign(assignment.id)}
                                          />
                                        </div>
                                      )
                                    })}
                                    {Array.from({ length: scenario.femaleActorsNeeded }, (_, idx) => {
                                      const key        = `${scenario.id}:${room.id}:FEMALE:${idx}`
                                      const assignment = assignmentBySlot.get(key) ?? null
                                      const usedInRoom = new Set(
                                        assignments.filter((a) =>
                                          a.scenarioId === scenario.id && a.roomId === room.id && !a.isDirector &&
                                          !(a.slotGender === "FEMALE" && a.slotIndex === idx)
                                        ).map((a) => a.actorId)
                                      )
                                      const pool = confirmedFemaleActors.filter((a) => !usedInRoom.has(a.id))
                                      return (
                                        <div key={key} className="flex items-center gap-1">
                                          <span className="text-xs text-pink-500 font-semibold">♀</span>
                                          <GenderedPicker
                                            actors={pool}
                                            current={assignment}
                                            canEdit={isCaster}
                                            saving={saving}
                                            onAssign={(actorId) => assign(scenario.id, room.id, actorId, false, "FEMALE", idx)}
                                            onClear={() => assignment && unassign(assignment.id)}
                                          />
                                        </div>
                                      )
                                    })}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>


      </div>
    </div>
  )
}

// ─── Requirements panel (collapsible) ────────────────────────────────────────

function RequirementsPanel({ data, scenarios }: { data: CastingData; scenarios: Scenario[] }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-right">
        <h2 className="font-semibold text-gray-800 text-sm">📋 דרישות הסדנה (עיון)</h2>
        <span className="text-gray-400 text-xs">{open ? "▲ סגור" : "▼ פתח"}</span>
      </button>

      {open && (
        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            {data.castingMaleNeeded !== null && (
              <span className="text-gray-700">♂ <strong>{data.castingMaleNeeded}</strong> שחקנים</span>
            )}
            {data.castingFemaleNeeded !== null && (
              <span className="text-gray-700">♀ <strong>{data.castingFemaleNeeded}</strong> שחקניות</span>
            )}
            {data.directorRequested && (
              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium">🎬 דרוש/ה במאי/ת</span>
            )}
          </div>
          {data.castingNotes && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{data.castingNotes}</p>
          )}
          {scenarios.length === 0 ? (
            <p className="text-sm text-gray-400">אין תרחישים פעילים</p>
          ) : (
            <div className="space-y-3">
              {scenarios.map((s, i) => (
                <div key={s.id} className="border border-gray-100 rounded-lg px-4 py-3">
                  <p className="text-sm font-semibold text-gray-800 mb-1">
                    תרחיש {i + 1}{s.name ? ` — ${s.name}` : ""} · {s.topicName}
                    <span className="mr-2 font-normal text-gray-500 text-xs">♂ {s.maleActorsNeeded} · ♀ {s.femaleActorsNeeded} לחדר</span>
                  </p>
                  {s.actorRequirements && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{s.actorRequirements}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── ConfirmSlot — Step 1 picker ─────────────────────────────────────────────

function ConfirmSlot({
  label, confirmed, pool, canEdit, saving, onSelect, onClear,
}: {
  label: string
  confirmed: ConfirmedActor | null
  pool: Actor[]
  canEdit: boolean
  saving: boolean
  onSelect: (actorId: string) => void
  onClear: () => void
}) {
  if (!canEdit) {
    return (
      <div className={`border rounded-lg px-3 py-2 text-sm min-w-[130px] ${
        confirmed ? "border-green-300 bg-green-50 text-gray-800 font-medium" : "border-gray-200 text-gray-400"
      }`}>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        {confirmed ? confirmed.actorName : "—"}
      </div>
    )
  }
  return (
    <div className={`border rounded-lg px-3 py-2 min-w-[160px] ${
      confirmed ? "border-green-300 bg-green-50" : "border-gray-200"
    }`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="flex items-center gap-1">
        <select
          value={confirmed?.actorId ?? ""}
          onChange={(e) => { if (e.target.value) onSelect(e.target.value) }}
          disabled={saving}
          className={`flex-1 border-0 bg-transparent text-sm focus:outline-none focus:ring-0 ${
            confirmed ? "text-gray-800 font-medium" : "text-gray-500"
          }`}>
          <option value="">— בחר/י —</option>
          {confirmed && !pool.some((a) => a.id === confirmed.actorId) && (
            <option value={confirmed.actorId}>{confirmed.actorName}</option>
          )}
          {pool.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {confirmed && (
          <button onClick={onClear} disabled={saving}
            className="text-gray-300 hover:text-red-400 transition-colors font-bold text-lg leading-none shrink-0">
            ×
          </button>
        )}
      </div>
    </div>
  )
}

// ─── GenderedPicker — Step 2 slot ────────────────────────────────────────────

function GenderedPicker({
  actors, current, canEdit, saving, onAssign, onClear,
}: {
  actors: Actor[]
  current: Assignment | null
  canEdit: boolean
  saving: boolean
  onAssign: (actorId: string) => void
  onClear: () => void
}) {
  if (!canEdit) {
    return (
      <span className={`text-sm ${current ? "text-gray-800 font-medium" : "text-gray-300"}`}>
        {current?.actorName ?? "—"}
      </span>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <select
        value={current?.actorId ?? ""}
        onChange={(e) => { if (e.target.value) onAssign(e.target.value) }}
        disabled={saving}
        className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy/30 min-h-[44px]">
        <option value="">— בחר/י —</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      {current && (
        <button onClick={onClear} disabled={saving}
          className="text-gray-300 hover:text-red-400 transition-colors font-bold text-lg leading-none">×</button>
      )}
    </div>
  )
}

// ─── DirectorPicker ───────────────────────────────────────────────────────────

function DirectorPicker({
  actors, current, canEdit, saving, onAssign, onClear,
}: {
  actors: Actor[]
  current: Assignment | null
  canEdit: boolean
  saving: boolean
  onAssign: (actorId: string) => void
  onClear: () => void
}) {
  if (!canEdit) {
    return (
      <span className={`text-sm ${current ? "text-gray-800 font-medium" : "text-gray-300"}`}>
        {current?.actorName ?? "—"}
      </span>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <select
        value={current?.actorId ?? ""}
        onChange={(e) => { if (e.target.value) onAssign(e.target.value) }}
        disabled={saving}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy/30 max-w-xs min-h-[44px]">
        <option value="">— בחר/י במאי/ת —</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      {current && (
        <button onClick={onClear} disabled={saving}
          className="text-gray-300 hover:text-red-400 transition-colors font-bold text-lg leading-none">×</button>
      )}
    </div>
  )
}
