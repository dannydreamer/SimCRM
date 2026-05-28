"use client"

import { useEffect, useState, useCallback, type ReactNode } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Room {
  id: string
  roomNumber: number
  facilitatorId: string | null
  facilitatorName: string | null
  facilitatorTentative: boolean
  pptReceived: boolean
  letterReceived: boolean
  cancelled: boolean
}

interface Scenario {
  id: string
  name: string | null
  topicId: string
  topicName: string
  actorRequirements: string | null
  maleActorsNeeded: number
  femaleActorsNeeded: number
  written: boolean
  cancelled: boolean
  orderIndex: number
}

interface Workshop {
  id: string
  date: string
  startTime: string
  endTime: string
  numRooms: number
  locationType: string
  locationName: string | null
  directorRequested: boolean
  directorNotes: string | null
  castingMaleNeeded: number | null
  castingFemaleNeeded: number | null
  castingNotes: string | null
  status: string
  cancelled: boolean
  tentative: boolean
  postponedWarning: boolean
  roomCancelledWarning: boolean
  roomAddedWarning: boolean
  feedbackFormAdded: boolean
  castingSentAt: string | null
  notes: string | null
  frozen: boolean
  groupName: string
  orgId: string
  orgName: string
  orgShiyuchPedagogi: string
  authorId: string | null
  authorName: string | null
  rooms: Room[]
  scenarios: Scenario[]
  castings: CastingSlot[]
}

interface CastingSlot {
  id: string
  scenarioId: string | null
  roomId: string | null
  actorId: string
  actorName: string
  isDirector: boolean
}

interface Topic { id: string; name: string; active: boolean }
interface Facilitator { id: string; name: string }

interface HeaderDraft {
  date: string
  startTime: string
  endTime: string
  numRooms: number
  locationType: string
  locationName: string
  tentative: boolean
  directorRequested: boolean
  directorNotes: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  NEW: "סדנה חדשה",
  SPECIFIED: "בוצע איתור צרכים",
  READY: "מוכן",
  CLOSING: "בתהליך סגירה",
  CLOSED: "סגור",
  CANCELLED: "מבוטל",
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-600",
  SPECIFIED: "bg-blue-100 text-blue-700",
  READY: "bg-green-100 text-green-700",
  CLOSING: "bg-amber-100 text-amber-700",
  CLOSED: "bg-navy-light text-navy",
  CANCELLED: "bg-red-100 text-red-600",
}

const SHIYUCH_LABELS: Record<string, string> = {
  GIL_HARACH: "גיל הרך",
  YESODI: "יסודי",
  TICHON: "תיכון",
  CHINUCH_MEYUCHAD: "חינוך מיוחד",
  SHAFACH: "שפ״ח",
  MOVILEI_TECHUM: "מובילי תחום",
  IRIYAT_YERUSHALAIM: "עיריית ירושלים",
  MANCHI: "מנח״י",
  ACHER: "אחר",
}

function makeTimes() {
  const times: string[] = []
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 22 && m > 0) break
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
    }
  }
  return times
}
const TIMES = makeTimes()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function toDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 10)
}

function Check({ on }: { on: boolean }) {
  return on
    ? <span className="text-green-600 font-bold">✓</span>
    : <span className="text-gray-300">—</span>
}

// ─── ScenarioRow ──────────────────────────────────────────────────────────────

function ScenarioRow({
  s, workshopId, canEdit, canCancel, topics, onUpdate, onCancel,
}: {
  s: Scenario
  workshopId: string
  canEdit: boolean
  canCancel: boolean
  topics: Topic[]
  onUpdate: (sid: string, data: Partial<Scenario>) => void
  onCancel: (sid: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [topicId, setTopicId] = useState(s.topicId)
  const [name, setName] = useState(s.name ?? "")
  const [req, setReq] = useState(s.actorRequirements ?? "")
  const [maleCount,   setMaleCount]   = useState(String(s.maleActorsNeeded))
  const [femaleCount, setFemaleCount] = useState(String(s.femaleActorsNeeded))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/sadnaot/${workshopId}/scenarios/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topicId, name, actorRequirements: req,
        maleActorsNeeded:   Math.max(0, Number(maleCount)   || 0),
        femaleActorsNeeded: Math.max(0, Number(femaleCount) || 0),
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate(s.id, updated)
      setEditing(false)
    }
    setSaving(false)
  }

  async function toggleWritten() {
    const res = await fetch(`/api/sadnaot/${workshopId}/scenarios/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ written: !s.written }),
    })
    if (res.ok) onUpdate(s.id, { written: !s.written })
  }

  const rowClass = s.cancelled ? "opacity-40 line-through" : ""

  return (
    <tr className={`border-b border-gray-100 text-sm ${rowClass}`}>
      {editing ? (
        <>
          <td className="py-2 px-3">
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-full">
              {topics.filter((t) => t.active).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </td>
          <td className="py-2 px-3">
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-full" placeholder="שם תרחיש (אופציונלי)" />
          </td>
          <td className="py-2 px-3">
            <textarea value={req} onChange={(e) => setReq(e.target.value)} rows={2}
              className="border border-gray-300 rounded px-2 py-1 text-sm w-full" placeholder="דרישות שחקנים" />
            <div className="flex items-center gap-3 mt-1.5">
              <label className="flex items-center gap-1 text-xs text-gray-600">
                ♂
                <input type="number" min={0} value={maleCount}
                  onChange={(e) => setMaleCount(e.target.value)}
                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-12 text-center" />
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                ♀
                <input type="number" min={0} value={femaleCount}
                  onChange={(e) => setFemaleCount(e.target.value)}
                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-12 text-center" />
              </label>
            </div>
          </td>
          <td className="py-2 px-3 text-center"><Check on={s.written} /></td>
          <td className="py-2 px-3">
            <div className="flex gap-2">
              <button onClick={save} disabled={saving}
                className="px-2 py-1 bg-navy text-white rounded text-xs disabled:opacity-50">שמור</button>
              <button onClick={() => setEditing(false)}
                className="px-2 py-1 border border-gray-300 rounded text-xs">ביטול</button>
            </div>
          </td>
        </>
      ) : (
        <>
          <td className="py-2 px-3 font-medium">{s.topicName}</td>
          <td className="py-2 px-3 text-gray-600">{s.name ?? <span className="text-gray-300">—</span>}</td>
          <td className="py-2 px-3 text-gray-600 whitespace-pre-wrap">
            {s.actorRequirements ?? <span className="text-gray-300">—</span>}
            {(s.maleActorsNeeded > 0 || s.femaleActorsNeeded > 0) && (
              <div className="mt-1 flex gap-2 text-xs text-gray-500">
                {s.maleActorsNeeded > 0 && <span>♂ {s.maleActorsNeeded}</span>}
                {s.femaleActorsNeeded > 0 && <span>♀ {s.femaleActorsNeeded}</span>}
              </div>
            )}
          </td>
          <td className="py-2 px-3 text-center">
            {canEdit && !s.cancelled ? (
              <button onClick={toggleWritten} title={s.written ? "סמן כלא כתוב" : "סמן ככתוב"}
                className="text-lg leading-none">{s.written ? "✓" : "○"}</button>
            ) : <Check on={s.written} />}
          </td>
          <td className="py-2 px-3">
            <div className="flex gap-2">
              {canEdit && !s.cancelled && (
                <button onClick={() => setEditing(true)} className="text-xs text-navy hover:underline">עריכה</button>
              )}
              {canCancel && !s.cancelled && (
                <button onClick={() => onCancel(s.id)} className="text-xs text-red-500 hover:underline">ביטול</button>
              )}
            </div>
          </td>
        </>
      )}
    </tr>
  )
}

// ─── RoomRow ──────────────────────────────────────────────────────────────────

function RoomRow({
  r, canAssign, canCheckPptLetter, facilitators, allRooms, workshopId, workshopDate, anyScenarioWritten, onUpdate,
}: {
  r: Room
  canAssign: boolean
  canCheckPptLetter: boolean
  facilitators: Facilitator[]
  allRooms: Room[]
  workshopId: string
  workshopDate: string   // ISO string
  anyScenarioWritten: boolean
  onUpdate: (rid: string, data: Partial<Room>) => void
}) {
  async function patchRoom(data: Partial<Room>) {
    const res = await fetch(`/api/sadnaot/${workshopId}/rooms/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate(r.id, updated)
    }
  }

  async function changeFacilitator(facilitatorId: string | null) {
    // Auto-uncheck PPT and letter when facilitator is removed
    const patch: Partial<Room> = { facilitatorId } as Partial<Room>
    if (!facilitatorId) {
      patch.pptReceived = false
      patch.letterReceived = false
    }
    await patchRoom(patch)
  }

  // Date comparisons (date-only, no time)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const wDate = new Date(workshopDate); wDate.setHours(0, 0, 0, 0)
  const workshopPast = today > wDate      // day after workshop date
  const workshopFuture = today < wDate    // before workshop date

  // PPT: allowed before or on workshop date; blocked after; requires written scenario
  const pptBlockReason = !r.facilitatorId
    ? "יש לשבץ מתחקר/ת לפני סימון מצגת"
    : workshopPast
    ? "לא ניתן לסמן מצגת לאחר תאריך הסדנה"
    : !anyScenarioWritten
    ? "יש לסמן לפחות תרחיש אחד כנכתב לפני סימון מצגת"
    : null
  const pptDisabled = !!pptBlockReason

  // Letter: allowed on or after workshop date; blocked before
  const letterBlockReason = !r.facilitatorId
    ? "יש לשבץ מתחקר/ת לפני סימון מכתב"
    : workshopFuture
    ? "לא ניתן לסמן מכתב לפני תאריך הסדנה"
    : null
  const letterDisabled = !!letterBlockReason

  return (
    <tr className={`border-b border-gray-100 text-sm ${r.cancelled ? "opacity-40" : ""}`}>
      <td className="py-2 px-3 font-medium">
        {r.cancelled
          ? <span className="line-through text-gray-400">חדר {r.roomNumber}</span>
          : `חדר ${r.roomNumber}`}
      </td>
      <td className="py-2 px-3">
        {canAssign && !r.cancelled ? (
          <select
            value={r.facilitatorId ?? ""}
            onChange={(e) => changeFacilitator(e.target.value || null)}
            className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
          >
            <option value="">— לא שובץ —</option>
            {facilitators.map((f) => {
              const takenByOther = allRooms.some(
                (other) => !other.cancelled && other.id !== r.id && other.facilitatorId === f.id
              )
              return (
                <option key={f.id} value={f.id} disabled={takenByOther}>
                  {f.name}{takenByOther ? " (משובץ)" : ""}
                </option>
              )
            })}
          </select>
        ) : (
          <span className={r.facilitatorId ? "" : "text-gray-300"}>
            {r.facilitatorName ?? "—"}
            {r.facilitatorTentative && (
              <span className="mr-1 px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">?</span>
            )}
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-center">
        {canCheckPptLetter && !r.cancelled ? (
          <span title={pptBlockReason ?? undefined} className="inline-block">
            <input type="checkbox" checked={r.pptReceived}
              disabled={pptDisabled}
              onChange={(e) => !pptDisabled && patchRoom({ pptReceived: e.target.checked })}
              className={`w-4 h-4 accent-navy ${pptDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`} />
          </span>
        ) : <Check on={r.pptReceived} />}
      </td>
      <td className="py-2 px-3 text-center">
        {canCheckPptLetter && !r.cancelled ? (
          <span title={letterBlockReason ?? undefined} className="inline-block">
            <input type="checkbox" checked={r.letterReceived}
              disabled={letterDisabled}
              onChange={(e) => !letterDisabled && patchRoom({ letterReceived: e.target.checked })}
              className={`w-4 h-4 accent-navy ${letterDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`} />
          </span>
        ) : <Check on={r.letterReceived} />}
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkshopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()

  const [w, setW] = useState<Workshop | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [facilitators, setFacilitators] = useState<Facilitator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Header inline edit
  const [headerDraft, setHeaderDraft] = useState<HeaderDraft | null>(null)
  const [headerSaving, setHeaderSaving] = useState(false)

  // Notes edit
  const [notesEdit, setNotesEdit] = useState<string | null>(null)
  const [notesSaving, setNotesSaving] = useState(false)

  // Add scenario form
  const [showAddScenario, setShowAddScenario] = useState(false)
  const [newTopicId, setNewTopicId] = useState("")
  const [newScenarioName, setNewScenarioName] = useState("")
  const [newScenarioReq, setNewScenarioReq] = useState("")
  const [newScenarioMale, setNewScenarioMale] = useState("0")
  const [newScenarioFemale, setNewScenarioFemale] = useState("0")
  const [addingScenario, setAddingScenario] = useState(false)

  // Author saving
  const [authorSaving, setAuthorSaving] = useState(false)

  // Copy
  const [copied, setCopied] = useState(false)

  // Per-user banner dismissal (localStorage)
  const [postponedDismissed, setPostponedDismissed] = useState(false)

  // Casting actor summary collapsible
  const [castingOpen, setCastingOpen] = useState(false)

  // Send to casting overlay
  const [showCastingOverlay, setShowCastingOverlay] = useState(false)
  const [castingMale, setCastingMale] = useState("0")
  const [castingFemale, setCastingFemale] = useState("0")
  const [castingOverlayNotes, setCastingOverlayNotes] = useState("")
  const [castingSending, setCastingSending] = useState(false)

  const roles = session?.user?.roles ?? []
  const isManager = roles.includes("MANAGER")
  const isTech = roles.includes("TECH")
  const canEditScenarios = isManager || isTech
  const canCheckPptLetter = isManager || isTech

  const load = useCallback(async () => {
    setLoading(true)
    const [wRes, tRes, fRes] = await Promise.all([
      fetch(`/api/sadnaot/${id}`, { cache: "no-store" }),
      fetch("/api/nosim"),
      fetch("/api/facilitators"),
    ])
    if (!wRes.ok) { setError("שגיאה בטעינה"); setLoading(false); return }
    const [wData, tData, fData] = await Promise.all([wRes.json(), tRes.json(), fRes.json()])
    setW(wData)
    setTopics(tData)
    setFacilitators(fData)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Sync localStorage-based banner dismissal whenever w or session changes
  useEffect(() => {
    if (!w || !session?.user?.id) return
    const uid = session.user.id

    const postponedKey = `simcrm:banner:postponed:${uid}:${w.id}`
    const storedDate = localStorage.getItem(postponedKey)
    // Dismissed only if stored date matches current workshop date
    setPostponedDismissed(storedDate === w.date)

  }, [w?.id, w?.date, w?.cancelled, session?.user?.id])

  function dismissPostponedBanner() {
    if (!w || !session?.user?.id) return
    localStorage.setItem(`simcrm:banner:postponed:${session.user.id}:${w.id}`, w.date)
    setPostponedDismissed(true)
  }

  async function dismissRoomCancelledWarning() {
    if (!w) return
    setW((prev) => prev ? { ...prev, roomCancelledWarning: false } : prev)
    await fetch(`/api/sadnaot/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCancelledWarning: false }),
    })
  }

  async function dismissRoomAddedWarning() {
    if (!w) return
    setW((prev) => prev ? { ...prev, roomAddedWarning: false } : prev)
    await fetch(`/api/sadnaot/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomAddedWarning: false }),
    })
  }

  const canEdit = isManager && w !== null && !w.frozen && !w.cancelled
  const canAddScenario = canEditScenarios && w !== null && !w.frozen && !w.cancelled && w.status !== "NEW" && !!w.authorId
  const canCancelScenario = isManager && w !== null && !w.frozen && !w.cancelled

  // ── Header edit ────────────────────────────────────────────────────────────

  function openHeaderEdit() {
    if (!w) return
    setHeaderDraft({
      date: toDateInput(w.date),
      startTime: w.startTime,
      endTime: w.endTime,
      numRooms: w.numRooms,
      locationType: w.locationType,
      locationName: w.locationName ?? "",
      tentative: w.tentative,
      directorRequested: w.directorRequested,
      directorNotes: w.directorNotes ?? "",
    })
  }

  async function saveHeader() {
    if (!headerDraft || !w) return

    const activeRoomCount = w.rooms.filter((r) => !r.cancelled).length
    if (headerDraft.numRooms < activeRoomCount) {
      const roomsToCancel = w.rooms
        .filter((r) => !r.cancelled)
        .slice(headerDraft.numRooms)
        .map((r) => `חדר ${r.roomNumber}`)
        .join(", ")
      const ok = confirm(`הקטנת מספר החדרים תבטל את: ${roomsToCancel}.\nהאם להמשיך?`)
      if (!ok) return
    }

    setHeaderSaving(true)
    const res = await fetch(`/api/sadnaot/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: headerDraft.date,
        startTime: headerDraft.startTime,
        endTime: headerDraft.endTime,
        numRooms: headerDraft.numRooms,
        locationType: headerDraft.locationType,
        locationName: headerDraft.locationName,
        tentative: headerDraft.tentative,
        directorRequested: headerDraft.directorRequested,
        directorNotes: headerDraft.directorNotes,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setW((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          date: new Date(headerDraft.date).toISOString(),
          startTime: headerDraft.startTime,
          endTime: headerDraft.endTime,
          numRooms: updated.numRooms ?? headerDraft.numRooms,
          locationType: headerDraft.locationType,
          locationName: headerDraft.locationName || null,
          tentative: headerDraft.tentative,
          directorRequested: headerDraft.directorRequested,
          directorNotes: headerDraft.directorNotes || null,
          postponedWarning:     updated.postponedWarning     ?? prev.postponedWarning,
          roomCancelledWarning: updated.roomCancelledWarning ?? prev.roomCancelledWarning,
          roomAddedWarning:     updated.roomAddedWarning     ?? prev.roomAddedWarning,
          rooms: updated.rooms ?? prev.rooms,
        }
      })
      setHeaderDraft(null)
    }
    setHeaderSaving(false)
  }

  // ── Author ─────────────────────────────────────────────────────────────────

  async function saveAuthor(authorId: string) {
    setAuthorSaving(true)
    setActionError(null)
    const res = await fetch(`/api/sadnaot/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorId: authorId || null }),
    })
    if (res.ok) {
      const fac = facilitators.find((f) => f.id === authorId)
      setW((prev) => prev ? { ...prev, authorId: authorId || null, authorName: fac?.name ?? null } : prev)
    } else {
      const body = await res.json().catch(() => ({}))
      setActionError(body.error ?? `שגיאה (${res.status})`)
    }
    setAuthorSaving(false)
  }

  // ── Scenario CRUD ──────────────────────────────────────────────────────────

  function updateScenario(sid: string, data: Partial<Scenario>) {
    setW((prev) => prev ? { ...prev, scenarios: prev.scenarios.map((s) => s.id === sid ? { ...s, ...data } : s) } : prev)
  }

  async function cancelScenario(sid: string) {
    if (!confirm("לבטל תרחיש זה?")) return
    const res = await fetch(`/api/sadnaot/${id}/scenarios/${sid}`, { method: "DELETE" })
    if (res.ok) updateScenario(sid, { cancelled: true })
  }

  async function addScenario() {
    if (!newTopicId) return
    if (!newScenarioReq.trim()) return
    setAddingScenario(true)
    const res = await fetch(`/api/sadnaot/${id}/scenarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topicId: newTopicId, name: newScenarioName, actorRequirements: newScenarioReq,
        maleActorsNeeded:   Math.max(0, Number(newScenarioMale)   || 0),
        femaleActorsNeeded: Math.max(0, Number(newScenarioFemale) || 0),
      }),
    })
    if (res.ok) {
      const s = await res.json()
      setW((prev) => prev ? { ...prev, scenarios: [...prev.scenarios, s] } : prev)
      setShowAddScenario(false)
      setNewTopicId("")
      setNewScenarioName("")
      setNewScenarioReq("")
      setNewScenarioMale("0")
      setNewScenarioFemale("0")
    }
    setAddingScenario(false)
  }

  // ── Room helpers ───────────────────────────────────────────────────────────

  function updateRoom(rid: string, data: Partial<Room>) {
    setW((prev) => prev ? { ...prev, rooms: prev.rooms.map((r) => r.id === rid ? { ...r, ...data } : r) } : prev)
  }

  // ── Workshop-level actions ─────────────────────────────────────────────────

  async function patchWorkshop(data: Record<string, unknown>) {
    setActionError(null)
    const res = await fetch(`/api/sadnaot/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      // Reload fully whenever status changed — covers both manual transitions
      // and server-side auto-advances (checkAndAdvanceStatus on any PATCH)
      if (updated.status !== w?.status) {
        await load()
      } else {
        setW((prev) => prev ? { ...prev, ...updated } : prev)
      }
    } else {
      const body = await res.json().catch(() => ({}))
      setActionError(body.error ?? `שגיאה (${res.status})`)
    }
    return res
  }

  async function cancelWorkshop() {
    if (!w || !confirm("לבטל סדנה זו? פעולה זו בלתי הפיכה.")) return
    await patchWorkshop({ cancelled: true })
    setW((prev) => prev ? { ...prev, cancelled: true } : prev)
  }

  async function saveNotes() {
    if (notesEdit === null) return
    setNotesSaving(true)
    await patchWorkshop({ notes: notesEdit })
    setW((prev) => prev ? { ...prev, notes: notesEdit } : prev)
    setNotesSaving(false)
    setNotesEdit(null)
  }

  async function toggleFeedbackForm() {
    if (!w) return
    const res = await fetch(`/api/sadnaot/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackFormAdded: !w.feedbackFormAdded }),
    })
    if (res.ok) setW((prev) => prev ? { ...prev, feedbackFormAdded: !prev.feedbackFormAdded } : prev)
  }

  function buildFormString() {
    if (!w) return ""
    const date = fmtDate(w.date)
    const topicNames = w.scenarios.filter((s) => !s.cancelled).map((s) => s.topicName)
    const uniqueTopics = [...new Set(topicNames)]
    const shiyuch = SHIYUCH_LABELS[w.orgShiyuchPedagogi] ?? w.orgShiyuchPedagogi
    return [date, w.orgName, w.groupName, shiyuch, uniqueTopics.join(", ")].filter(Boolean).join(" - ")
  }

  async function copyFormString() {
    await navigator.clipboard.writeText(buildFormString())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openCastingOverlay() {
    if (!w) return
    // Pre-fill with existing values if re-send
    setCastingMale(w.castingMaleNeeded != null ? String(w.castingMaleNeeded) : "0")
    setCastingFemale(w.castingFemaleNeeded != null ? String(w.castingFemaleNeeded) : "0")
    setCastingOverlayNotes(w.castingNotes ?? "")
    setShowCastingOverlay(true)
  }

  async function confirmSendToCasting() {
    if (!w) return
    setCastingSending(true)
    const res = await fetch(`/api/sadnaot/${id}/send-to-casting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        castingMaleNeeded: Number(castingMale),
        castingFemaleNeeded: Number(castingFemale),
        castingNotes: castingOverlayNotes,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setW((prev) => prev ? {
        ...prev,
        castingSentAt: data.castingSentAt,
        castingMaleNeeded: data.castingMaleNeeded,
        castingFemaleNeeded: data.castingFemaleNeeded,
        castingNotes: data.castingNotes,
      } : prev)
      setShowCastingOverlay(false)
    }
    setCastingSending(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-8 text-sm text-gray-400">טוען...</div>
  if (error || !w) return <div className="p-8 text-sm text-red-500">{error ?? "שגיאה"}</div>

  const hd = headerDraft

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Breadcrumb */}
      <div className="px-8 pt-5 pb-2 text-sm text-gray-400 shrink-0">
        <Link href="/sadnaot" className="hover:text-gray-700">סדנאות</Link>
        {" / "}
        <span className="text-gray-700">{w.groupName} — {fmtDate(w.date)}</span>
      </div>

      <div className="px-8 pb-10 flex flex-col gap-6 max-w-4xl w-full">

        {/* Banners */}
        {w.postponedWarning && !postponedDismissed && (
          <div className="bg-amber-100 border border-amber-400 rounded-lg px-4 py-3 text-sm text-amber-800 font-semibold flex items-center justify-between gap-3">
            <span>⚠️ הסדנה נדחתה — יש להודיע למתחקרים ולמלהקת</span>
            <button onClick={dismissPostponedBanner}
              className="text-amber-600 hover:text-amber-800 text-lg leading-none shrink-0" title="סגור">×</button>
          </div>
        )}
        {w.roomCancelledWarning && (
          <div className="bg-amber-100 border border-amber-400 rounded-lg px-4 py-3 text-sm text-amber-800 font-semibold flex items-center justify-between gap-3">
            <span>⚠️ חדר בוטל — יש להודיע למתחקר/ת ולמלהקת</span>
            <button onClick={dismissRoomCancelledWarning}
              className="text-amber-600 hover:text-amber-800 text-lg leading-none shrink-0" title="סגור">×</button>
          </div>
        )}
        {w.roomAddedWarning && (
          <div className="bg-blue-50 border border-blue-300 rounded-lg px-4 py-3 text-sm text-blue-800 font-semibold flex items-center justify-between gap-3">
            <span>ℹ️ חדר נוסף — יש לשלוח מחדש לליהוק</span>
            <button onClick={dismissRoomAddedWarning}
              className="text-blue-600 hover:text-blue-800 text-lg leading-none shrink-0" title="סגור">×</button>
          </div>
        )}
        {w.cancelled && (
          <div className="bg-red-100 border-2 border-red-400 rounded-xl px-5 py-4 flex flex-col gap-1">
            <p className="text-base font-bold text-red-800">⛔ סדנה זו בוטלה — תצוגה בלבד</p>
            {(!!w.castingSentAt || w.rooms.some((r) => !r.cancelled && r.facilitatorId)) && (
              <p className="text-sm text-red-700 font-medium">יש להודיע למתחקרים ולמלהקת על הביטול</p>
            )}
          </div>
        )}

        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {w.groupName}
                {(hd ? hd.tentative : w.tentative) && (
                  <span className="mr-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-semibold leading-none">?</span>
                )}
              </h1>
              <Link href={`/irgunnim/${w.orgId}`} className="text-sm text-navy hover:underline">{w.orgName}</Link>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[w.status]}`}>
                {STATUS_LABELS[w.status]}
              </span>
              {canEdit && !hd && (
                <button onClick={openHeaderEdit}
                  className="text-xs text-navy hover:underline border border-gray-200 rounded px-2 py-1">
                  עריכה
                </button>
              )}
            </div>
          </div>

          {/* Fields */}
          {hd ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">תאריך</label>
                  <input type="date" value={hd.date}
                    onChange={(e) => setHeaderDraft({ ...hd, date: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">מספר חדרים</label>
                  <input type="number" min={1} value={hd.numRooms}
                    onChange={(e) => setHeaderDraft({ ...hd, numRooms: Number(e.target.value) })}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">שעת התחלה</label>
                  <select value={hd.startTime}
                    onChange={(e) => setHeaderDraft({ ...hd, startTime: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full">
                    {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">שעת סיום</label>
                  <select value={hd.endTime}
                    onChange={(e) => setHeaderDraft({ ...hd, endTime: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full">
                    {TIMES.filter((t) => t > hd.startTime).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">מיקום</label>
                  <select value={hd.locationType}
                    onChange={(e) => setHeaderDraft({ ...hd, locationType: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full">
                    <option value="CENTER">מרכז</option>
                    <option value="EXTERNAL">חיצוני</option>
                  </select>
                </div>
                {hd.locationType === "EXTERNAL" && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">כתובת</label>
                    <input value={hd.locationName}
                      onChange={(e) => setHeaderDraft({ ...hd, locationName: e.target.value })}
                      className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={hd.tentative}
                    onChange={(e) => setHeaderDraft({ ...hd, tentative: e.target.checked })}
                    className="w-4 h-4 accent-navy" />
                  טנטטיב (?)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={hd.directorRequested}
                    onChange={(e) => setHeaderDraft({ ...hd, directorRequested: e.target.checked })}
                    className="w-4 h-4 accent-navy" />
                  במאי/ת נדרש/ת
                </label>
              </div>
              {hd.directorRequested && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">הערות לבמאי/ת</label>
                  <input value={hd.directorNotes}
                    onChange={(e) => setHeaderDraft({ ...hd, directorNotes: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={saveHeader} disabled={headerSaving}
                  className="px-3 py-1.5 bg-navy text-white text-sm rounded disabled:opacity-50">שמור</button>
                <button onClick={() => setHeaderDraft(null)}
                  className="px-3 py-1.5 border border-gray-300 text-sm rounded">ביטול</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div><span className="text-gray-400">תאריך:</span> <span className="font-medium">{fmtDate(w.date)}</span></div>
              <div><span className="text-gray-400">שעות:</span> <span className="font-medium">{w.startTime} — {w.endTime}</span></div>
              <div>
                <span className="text-gray-400">מיקום:</span>{" "}
                <span className="font-medium">
                  {w.locationType === "CENTER" ? "מרכז" : `חיצוני${w.locationName ? ` — ${w.locationName}` : ""}`}
                </span>
              </div>
              <div><span className="text-gray-400">חדרים:</span> <span className="font-medium">{w.numRooms}</span></div>
              <div className="col-span-2">
                {w.directorRequested ? (
                  <span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">במאי/ת נדרש/ת</span>
                    {w.directorNotes && <span className="text-gray-500 mr-2 text-xs">{w.directorNotes}</span>}
                  </span>
                ) : (
                  <span className="text-gray-300 text-xs">אין דרישת במאי/ת</span>
                )}
              </div>
              {(w.castingMaleNeeded || w.castingFemaleNeeded) && (
                <div className="col-span-2 text-gray-500">
                  ליהוק:{" "}
                  {w.castingMaleNeeded ? `${w.castingMaleNeeded} גברים` : ""}
                  {w.castingMaleNeeded && w.castingFemaleNeeded ? ", " : ""}
                  {w.castingFemaleNeeded ? `${w.castingFemaleNeeded} נשים` : ""}
                  {w.castingNotes && <span className="mr-2">— {w.castingNotes}</span>}
                </div>
              )}
            </div>
          )}

          {/* Status actions — Manager + Tech */}
          {(isManager || isTech) && !hd && (
            <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col gap-3">
              {actionError && (
                <p className="text-xs text-red-600 font-medium">{actionError}</p>
              )}

              {/* Manual action buttons — only for NEW ↔ SPECIFIED */}
              <div className="flex items-start gap-3 flex-wrap">
                {w.status === "NEW" && !w.cancelled && (() => {
                  const hasAuthor = !!w.authorId
                  return (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => patchWorkshop({ status: "SPECIFIED" })}
                        disabled={!hasAuthor}
                        title={!hasAuthor ? "יש לבחור כותב/ת תרחיש לפני המעבר לשלב זה" : undefined}
                        className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                          hasAuthor
                            ? "bg-navy text-white hover:bg-navy/90"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}>
                        סמן: בוצע איתור צרכים
                      </button>
                      {!hasAuthor && (
                        <p className="text-xs text-amber-600">יש לבחור כותב/ת תרחיש תחילה</p>
                      )}
                    </div>
                  )
                })()}
                {isManager && !w.cancelled && !w.frozen && (
                  <button onClick={cancelWorkshop}
                    className="px-4 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                    ביטול סדנה
                  </button>
                )}
              </div>

              {/* Readiness checklist — shown when SPECIFIED */}
              {w.status === "SPECIFIED" && !w.cancelled && (() => {
                const activeRooms      = w.rooms.filter((r) => !r.cancelled)
                const activeScenarios  = w.scenarios.filter((s) => !s.cancelled)
                const allSlotted       = activeRooms.length > 0 && activeRooms.every((r) => r.facilitatorId)
                const allWritten       = activeScenarios.length > 0 && activeScenarios.every((s) => s.written)
                const castingSent      = !!w.castingSentAt
                const allDone          = allSlotted && allWritten && castingSent
                const Item = ({ ok, label }: { ok: boolean; label: string }) => (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={ok ? "text-brand-green font-bold" : "text-gray-300"}>
                      {ok ? "✓" : "○"}
                    </span>
                    <span className={ok ? "text-gray-600" : "text-gray-400"}>{label}</span>
                  </div>
                )
                return (
                  <div className="flex flex-col gap-1.5 bg-gray-50 rounded-lg px-4 py-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1">נדרש למעבר אוטומטי ל״מוכן״:</p>
                    <Item ok={castingSent} label="נשלח לליהוק" />
                    <Item ok={allSlotted}  label={`כל החדרים שובצו (${activeRooms.filter(r => r.facilitatorId).length}/${activeRooms.length})`} />
                    <Item ok={allWritten}  label={`כל התרחישים סומנו כנכתב (${activeScenarios.filter(s => s.written).length}/${activeScenarios.length})`} />
                    {allDone && (
                      <p className="text-xs text-brand-green font-medium mt-1">✓ כל התנאים מתקיימים — הסדנה תסומן כ״מוכן״ אוטומטית</p>
                    )}
                  </div>
                )
              })()}

              {/* System-status explanations */}
              {w.status === "READY" && !w.cancelled && (
                <p className="text-xs text-gray-400 italic">הסדנה מוכנה — תועבר ל״בתהליך סגירה״ אוטומטית לאחר תאריך הסדנה</p>
              )}
              {w.status === "CLOSING" && !w.cancelled && (() => {
                const activeRooms = w.rooms.filter((r) => !r.cancelled)
                const allLetters = activeRooms.length > 0 && activeRooms.every((r) => r.letterReceived)
                const Item = ({ ok, label }: { ok: boolean; label: string }) => (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={ok ? "text-brand-green font-bold" : "text-gray-300"}>{ok ? "✓" : "○"}</span>
                    <span className={ok ? "text-gray-600" : "text-gray-400"}>{label}</span>
                  </div>
                )
                return (
                  <div className="flex flex-col gap-1.5 bg-gray-50 rounded-lg px-4 py-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1">נדרש למעבר אוטומטי ל״סגור״:</p>
                    <Item ok={allLetters} label={`כל המכתבים סומנו (${activeRooms.filter(r => r.letterReceived).length}/${activeRooms.length})`} />
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* Rooms */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">חדרים</h2>
          {w.rooms.length === 0 ? (
            <p className="text-sm text-gray-400">אין חדרים</p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="py-2 px-3 font-medium">חדר</th>
                    <th className="py-2 px-3 font-medium">מתחקר/ת</th>
                    <th className="py-2 px-3 font-medium text-center">מצגת</th>
                    <th className="py-2 px-3 font-medium text-center">מכתב</th>
                  </tr>
                </thead>
                <tbody>
                  {w.rooms.map((r) => (
                    <RoomRow
                      key={r.id}
                      r={r}
                      canAssign={canEdit}
                      canCheckPptLetter={canCheckPptLetter && !w.cancelled}
                      facilitators={facilitators}
                      allRooms={w.rooms}
                      workshopId={id}
                      workshopDate={w.date}
                      anyScenarioWritten={w.scenarios.some((s) => !s.cancelled && s.written)}
                      onUpdate={updateRoom}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Scenarios */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">תרחישים</h2>
            {canAddScenario && (
              <button onClick={() => setShowAddScenario(true)}
                className="text-xs text-navy hover:underline">+ הוספת תרחיש</button>
            )}
          </div>
          {canEditScenarios && w.status === "NEW" && !w.frozen && !w.cancelled && (
            <p className="text-xs text-gray-400 mb-3 italic">ניתן להוסיף תרחישים לאחר ביצוע איתור צרכים</p>
          )}
          {canEditScenarios && w.status !== "NEW" && !w.frozen && !w.cancelled && !w.authorId && (
            <p className="text-xs text-gray-400 mb-3 italic">יש להגדיר כותב/ת תרחיש לפני הוספת תרחישים</p>
          )}

          {/* Author — section-level */}
          <div className="flex items-center gap-3 mb-3 text-sm">
            <span className="text-gray-400 shrink-0">כותב/ת התרחיש:</span>
            {canEdit ? (
              <select
                value={w.authorId ?? ""}
                onChange={(e) => saveAuthor(e.target.value)}
                disabled={authorSaving}
                className="border border-gray-200 rounded px-2 py-1 text-sm"
              >
                <option value="">— לא הוגדר —</option>
                {facilitators.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            ) : (
              <span className={w.authorName ? "font-medium" : "text-gray-300"}>
                {w.authorName ?? "—"}
              </span>
            )}
          </div>

          {showAddScenario && (
            <div className="mb-3 border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">נושא *</label>
                  <select value={newTopicId} onChange={(e) => setNewTopicId(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full">
                    <option value="">— בחר נושא —</option>
                    {topics.filter((t) => t.active).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">שם תרחיש (אופציונלי)</label>
                  <input value={newScenarioName} onChange={(e) => setNewScenarioName(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  דרישות שחקנים <span className="text-red-500">*</span>
                </label>
                <textarea value={newScenarioReq} onChange={(e) => setNewScenarioReq(e.target.value)} rows={2}
                  className={`border rounded px-2 py-1.5 text-sm w-full ${
                    newScenarioReq.trim() ? "border-gray-300" : "border-red-300"
                  }`} />
                <div className="flex items-center gap-4 mt-1.5">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    ♂ שחקנים נדרשים לתרחיש
                    <input type="number" min={0} value={newScenarioMale}
                      onChange={(e) => setNewScenarioMale(e.target.value)}
                      className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-14 text-center" />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    ♀ שחקניות נדרשות לתרחיש
                    <input type="number" min={0} value={newScenarioFemale}
                      onChange={(e) => setNewScenarioFemale(e.target.value)}
                      className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-14 text-center" />
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addScenario} disabled={!newTopicId || addingScenario}
                  className="px-3 py-1.5 bg-navy text-white text-sm rounded disabled:opacity-50">הוסף</button>
                <button onClick={() => setShowAddScenario(false)}
                  className="px-3 py-1.5 border border-gray-300 text-sm rounded">ביטול</button>
              </div>
            </div>
          )}

          {w.scenarios.length === 0 ? (
            <p className="text-sm text-gray-400">אין תרחישים</p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="py-2 px-3 font-medium">נושא</th>
                    <th className="py-2 px-3 font-medium">שם</th>
                    <th className="py-2 px-3 font-medium">דרישות שחקנים</th>
                    <th className="py-2 px-3 font-medium text-center">נכתב</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {w.scenarios.map((s) => (
                    <ScenarioRow
                      key={s.id}
                      s={s}
                      workshopId={id}
                      canEdit={canEditScenarios && !w.frozen && !w.cancelled}
                      canCancel={canCancelScenario}
                      topics={topics}
                      onUpdate={updateScenario}
                      onCancel={cancelScenario}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Send to casting section */}
        {(isManager || isTech) && !w.cancelled && (w.status !== "NEW") && (() => {
          const scenariosWithReq = w.scenarios.filter((s) => !s.cancelled && s.actorRequirements?.trim())
          const canSend = scenariosWithReq.length > 0
          const wasSent = !!w.castingSentAt
          return (
            <section id="casting" className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-0.5">ליהוק</h2>
                  {wasSent && (
                    <p className="text-xs text-brand-green">
                      נשלח לליהוק ✓ {new Date(w.castingSentAt!).toLocaleDateString("he-IL")}
                    </p>
                  )}
                  {!canSend && (
                    <p className="text-xs text-gray-400 mt-0.5">יש להזין דרישות שחקנים לפחות לתרחיש אחד</p>
                  )}
                </div>
                <button
                  onClick={openCastingOverlay}
                  disabled={!canSend}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    canSend
                      ? "bg-navy text-white hover:bg-navy/90"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {wasSent ? "עדכן ושלח לליהוק" : "שלח לליהוק"}
                </button>
              </div>

              {/* Collapsible actor summary — visible once casting is sent */}
              {wasSent && (() => {
                const activeScenarios = w.scenarios.filter((s) => !s.cancelled)
                const activeRooms     = w.rooms.filter((r) => !r.cancelled)
                const slotMap = new Map<string, string[]>()
                w.castings.forEach((c) => {
                  if (!c.isDirector && c.scenarioId && c.roomId) {
                    const key = `${c.scenarioId}:${c.roomId}`
                    const existing = slotMap.get(key) ?? []
                    slotMap.set(key, [...existing, c.actorName])
                  }
                })
                const dirCasting = w.castings.find((c) => c.isDirector)

                return (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <button
                      onClick={() => setCastingOpen((o) => !o)}
                      className="text-xs text-navy hover:underline font-medium">
                      {castingOpen ? "הסתר ▲" : "הצג שחקנים ▼"}
                    </button>

                    {castingOpen && (
                      <div className="mt-2 space-y-1.5 text-xs text-gray-700">
                        {/* Director line */}
                        {w.directorRequested && (
                          <div>
                            <span className="font-semibold text-gray-600">במאי/ת: </span>
                            {dirCasting
                              ? <span>{dirCasting.actorName}</span>
                              : <span className="text-red-500 font-semibold">חסר</span>
                            }
                          </div>
                        )}
                        {/* Scenario lines */}
                        {activeScenarios.map((s, si) => {
                          const expected = s.maleActorsNeeded + s.femaleActorsNeeded
                          const parts = activeRooms.map((r) => {
                            const names = slotMap.get(`${s.id}:${r.id}`) ?? []
                            const missing = expected > 0 && names.length < expected
                            return (
                              <span key={r.id}>
                                <span className="text-gray-400">חדר {r.roomNumber}: </span>
                                {names.length > 0
                                  ? <span>{names.join(", ")}{missing && <span className="text-red-500 font-semibold"> + חסר</span>}</span>
                                  : <span className="text-red-500 font-semibold">חסר</span>
                                }
                              </span>
                            )
                          })
                          return (
                            <div key={s.id} className="flex flex-wrap gap-x-3 gap-y-0.5">
                              <span className="font-semibold text-gray-600 shrink-0">
                                תרחיש {si + 1}{s.name ? ` — ${s.name}` : ""}:
                              </span>
                              {parts.reduce<ReactNode[]>((acc, el, i) => {
                                if (i > 0) acc.push(<span key={`sep-${i}`} className="text-gray-300">|</span>)
                                acc.push(el)
                                return acc
                              }, [] as ReactNode[])}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}
            </section>
          )
        })()}

        {/* משוב משתתפים */}
        {(() => {
          const hasScenario = w.scenarios.some((s) => !s.cancelled && s.topicId)
          return (
            <section className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">משוב משתתפים</h2>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">מחרוזת לטופס Google</span>
                  {hasScenario && (
                    <button onClick={copyFormString}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${copied ? "bg-green-100 border-green-300 text-green-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                      {copied ? "הועתק ✓" : "העתק"}
                    </button>
                  )}
                </div>
                {hasScenario ? (
                  <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 font-mono select-all">
                    {buildFormString()}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">המחרוזת תיווצר לאחר הזנת תרחיש עם נושא</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {(isManager || isTech) ? (
                  <span title={!hasScenario ? "יש להזין תרחיש עם נושא תחילה" : undefined} className="inline-block">
                    <input type="checkbox" id="fbForm" checked={w.feedbackFormAdded}
                      disabled={!hasScenario}
                      onChange={toggleFeedbackForm}
                      className={`w-4 h-4 accent-navy ${hasScenario ? "cursor-pointer" : "opacity-40 cursor-not-allowed"}`} />
                  </span>
                ) : (
                  <input type="checkbox" checked={w.feedbackFormAdded} readOnly
                    className="w-4 h-4 accent-navy" />
                )}
                <label htmlFor="fbForm" className={`text-sm ${hasScenario ? "cursor-pointer" : "text-gray-400"}`}>
                  משוב משתתפים נוסף לטופס
                </label>
              </div>
            </section>
          )
        })()}

        {/* Notes */}
        <section className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">הערות</h2>
            {canEdit && notesEdit === null && (
              <button onClick={() => setNotesEdit(w.notes ?? "")}
                className="text-xs text-navy hover:underline">עריכה</button>
            )}
          </div>
          {notesEdit !== null ? (
            <div className="flex flex-col gap-2">
              <textarea value={notesEdit} onChange={(e) => setNotesEdit(e.target.value)} rows={3}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full" />
              <div className="flex gap-2">
                <button onClick={saveNotes} disabled={notesSaving}
                  className="px-3 py-1.5 bg-navy text-white text-sm rounded disabled:opacity-50">שמור</button>
                <button onClick={() => setNotesEdit(null)}
                  className="px-3 py-1.5 border border-gray-300 text-sm rounded">ביטול</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {w.notes ?? <span className="text-gray-300">אין הערות</span>}
            </p>
          )}
        </section>

        {/* Feedback shortcut */}
        <div className="flex justify-start">
          <Link href={`/feedback?workshopId=${id}`}
            className="px-5 py-2.5 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-green/90 transition-colors">
            הזנת פידבק לסדנה זו
          </Link>
        </div>

      </div>

      {/* Send to casting overlay */}
      {showCastingOverlay && w && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 flex flex-col max-h-[90vh]" dir="rtl">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-bold text-gray-900 mb-3">שליחה לליהוק</h2>
              <div className="flex gap-6 text-sm">
                <span className="text-gray-500">מספר חדרים: <strong className="text-gray-800">{w.rooms.filter((r) => !r.cancelled).length}</strong></span>
                <span className="text-gray-500">מספר תרחישים: <strong className="text-gray-800">{w.scenarios.filter((s) => !s.cancelled).length}</strong></span>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">

              {/* Scenario breakdown */}
              <div className="flex flex-col gap-3">
                {w.scenarios.filter((s) => !s.cancelled).map((s, i) => (
                  <div key={s.id} className="border border-gray-200 rounded-lg p-4">
                    {/* Scenario label */}
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      תרחיש {i + 1}{s.name ? ` — ${s.name}` : ""} · {s.topicName}
                    </p>
                    {/* Actor counts — prominent */}
                    <div className="flex gap-6 mb-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-gray-800">♂ {s.maleActorsNeeded}</span>
                        <span className="text-sm text-gray-500">שחקנים</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-gray-800">♀ {s.femaleActorsNeeded}</span>
                        <span className="text-sm text-gray-500">שחקניות</span>
                      </div>
                    </div>
                    {/* Freetext below counts */}
                    {s.actorRequirements && (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{s.actorRequirements}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Director requested */}
              {w.directorRequested && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
                  <span className="font-semibold">⚠️ נדרש/ת במאי/ת</span>
                  {w.directorNotes && <span className="text-amber-700">— {w.directorNotes}</span>}
                </div>
              )}

              {/* Workshop-level totals */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">סה"כ שחקנים ושחקניות שיגיעו פיזית ביום הסדנה:</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      שחקנים (זכר) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number" min={0} value={castingMale}
                      onChange={(e) => setCastingMale(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      שחקניות (נקבה) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number" min={0} value={castingFemale}
                      onChange={(e) => setCastingFemale(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">הערות למלהקת (אופציונלי)</label>
                <textarea
                  value={castingOverlayNotes}
                  onChange={(e) => setCastingOverlayNotes(e.target.value)}
                  rows={2}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                />
              </div>

            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end shrink-0">

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCastingOverlay(false)}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
              >
                ביטול
              </button>
              <button
                onClick={confirmSendToCasting}
                disabled={(Number(castingMale) <= 0 && Number(castingFemale) <= 0) || castingSending}
                className="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {castingSending ? "שולח..." : "אשר ושלח לליהוק"}
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
