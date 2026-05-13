"use client"

import { useEffect, useState, useCallback } from "react"
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
  feedbackFormAdded: boolean
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
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/sadnaot/${workshopId}/scenarios/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, name, actorRequirements: req }),
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
          <td className="py-2 px-3 text-gray-600 whitespace-pre-wrap">{s.actorRequirements ?? <span className="text-gray-300">—</span>}</td>
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
  r, canAssign, canCheckPptLetter, facilitators, workshopId, onUpdate,
}: {
  r: Room
  canAssign: boolean
  canCheckPptLetter: boolean
  facilitators: Facilitator[]
  workshopId: string
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
            onChange={(e) => patchRoom({ facilitatorId: e.target.value || null } as Partial<Room>)}
            className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
          >
            <option value="">— לא שובץ —</option>
            {facilitators.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
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
          <input type="checkbox" checked={r.pptReceived}
            onChange={(e) => patchRoom({ pptReceived: e.target.checked })}
            className="w-4 h-4 accent-navy cursor-pointer" />
        ) : <Check on={r.pptReceived} />}
      </td>
      <td className="py-2 px-3 text-center">
        {canCheckPptLetter && !r.cancelled ? (
          <input type="checkbox" checked={r.letterReceived}
            onChange={(e) => patchRoom({ letterReceived: e.target.checked })}
            className="w-4 h-4 accent-navy cursor-pointer" />
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
  const [addingScenario, setAddingScenario] = useState(false)

  // Author saving
  const [authorSaving, setAuthorSaving] = useState(false)

  // Copy
  const [copied, setCopied] = useState(false)

  const roles = session?.user?.roles ?? []
  const isManager = roles.includes("MANAGER")
  const isTech = roles.includes("TECH")
  const canEditScenarios = isManager || isTech
  const canCheckPptLetter = isManager || isTech

  const load = useCallback(async () => {
    setLoading(true)
    const [wRes, tRes, fRes] = await Promise.all([
      fetch(`/api/sadnaot/${id}`),
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

  const canEdit = isManager && w !== null && !w.frozen && !w.cancelled
  const canAddScenario = canEditScenarios && w !== null && !w.frozen && !w.cancelled
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
    const res = await fetch(`/api/sadnaot/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorId }),
    })
    if (res.ok) {
      const fac = facilitators.find((f) => f.id === authorId)
      setW((prev) => prev ? { ...prev, authorId: authorId || null, authorName: fac?.name ?? null } : prev)
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
    setAddingScenario(true)
    const res = await fetch(`/api/sadnaot/${id}/scenarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: newTopicId, name: newScenarioName, actorRequirements: newScenarioReq }),
    })
    if (res.ok) {
      const s = await res.json()
      setW((prev) => prev ? { ...prev, scenarios: [...prev.scenarios, s] } : prev)
      setShowAddScenario(false)
      setNewTopicId("")
      setNewScenarioName("")
      setNewScenarioReq("")
    }
    setAddingScenario(false)
  }

  // ── Room helpers ───────────────────────────────────────────────────────────

  function updateRoom(rid: string, data: Partial<Room>) {
    setW((prev) => prev ? { ...prev, rooms: prev.rooms.map((r) => r.id === rid ? { ...r, ...data } : r) } : prev)
  }

  // ── Workshop-level actions ─────────────────────────────────────────────────

  async function patchWorkshop(data: Record<string, unknown>) {
    const res = await fetch(`/api/sadnaot/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setW((prev) => prev ? { ...prev, ...updated } : prev)
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
    return [date, w.groupName, shiyuch, uniqueTopics.join(", ")].filter(Boolean).join(" - ")
  }

  async function copyFormString() {
    await navigator.clipboard.writeText(buildFormString())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
        {w.postponedWarning && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-800 font-medium">
            ⚠️ סדנה זו נדחתה — יש לעדכן תאריך חדש
          </div>
        )}
        {w.cancelled && (
          <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-700 font-medium">
            סדנה זו בוטלה
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

          {/* Manager status actions */}
          {isManager && !hd && (
            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-3 flex-wrap">
              {w.status === "NEW" && !w.cancelled && (
                <button onClick={() => patchWorkshop({ status: "SPECIFIED" })}
                  className="px-4 py-1.5 bg-navy text-white text-sm rounded-lg hover:bg-navy/90 transition-colors">
                  סמן: בוצע איתור צרכים
                </button>
              )}
              {w.status === "SPECIFIED" && !w.cancelled && (
                <button onClick={() => patchWorkshop({ status: "NEW" })}
                  className="px-4 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 text-gray-600">
                  חזור לסדנה חדשה
                </button>
              )}
              {!w.cancelled && !w.frozen && (
                <button onClick={cancelWorkshop}
                  className="px-4 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                  ביטול סדנה
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scenarios */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">תרחישים</h2>
            {canAddScenario && (
              <button onClick={() => setShowAddScenario(true)}
                className="text-xs text-navy hover:underline">+ הוספת תרחיש</button>
            )}
          </div>

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
                <label className="block text-xs text-gray-500 mb-1">דרישות שחקנים</label>
                <textarea value={newScenarioReq} onChange={(e) => setNewScenarioReq(e.target.value)} rows={2}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
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
                      workshopId={id}
                      onUpdate={updateRoom}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Checklist + Notes */}
        <section className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {(isManager || isTech) ? (
              <input type="checkbox" id="fbForm" checked={w.feedbackFormAdded}
                onChange={toggleFeedbackForm}
                className="w-4 h-4 accent-navy cursor-pointer" />
            ) : (
              <input type="checkbox" checked={w.feedbackFormAdded} readOnly
                className="w-4 h-4 accent-navy" />
            )}
            <label htmlFor="fbForm" className="text-sm font-medium cursor-pointer">טופס פידבק נוסף</label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">הערות</span>
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
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">מחרוזת לטופס Google</span>
              <button onClick={copyFormString}
                className={`text-xs px-2 py-1 rounded border transition-colors ${copied ? "bg-green-100 border-green-300 text-green-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                {copied ? "הועתק ✓" : "העתק"}
              </button>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 font-mono select-all">
              {buildFormString() || <span className="text-gray-300">— הוסף תרחישים לקבלת המחרוזת —</span>}
            </div>
          </div>
        </section>

        {/* Feedback shortcut */}
        <div className="flex justify-start">
          <Link href={`/feedback?workshopId=${id}`}
            className="px-5 py-2.5 bg-brand-green text-white text-sm font-medium rounded-lg hover:bg-brand-green/90 transition-colors">
            הזנת פידבק לסדנה זו
          </Link>
        </div>

      </div>
    </div>
  )
}
