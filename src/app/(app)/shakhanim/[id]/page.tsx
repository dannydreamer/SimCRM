"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useUser } from "@/app/(app)/user-context"
import { RagDot } from "@/components/RagDot"

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedbackRow {
  id: string
  date: string
  orgName: string
  workshopId: string
  facilitatorName: string | null
  enteredByName: string
  aspect1Color: string; aspect1Text: string | null
  aspect2Color: string; aspect2Text: string | null
  aspect3Color: string; aspect3Text: string | null
  aspect4Color: string; aspect4Text: string | null
}

interface DevLog {
  id: string
  date: string
  note: string
  enteredByName: string
}

interface ActorDetail {
  id: string
  name: string
  gender: "MALE" | "FEMALE"
  phone: string | null
  email: string | null
  languages: string | null
  specialties: string | null
  canDirect: boolean
  workshopCount: number
  lastDate: string | null
  feedbacks: FeedbackRow[]
  devLogs: DevLog[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2)
  return parts[0][0] + parts[parts.length - 1][0]
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActorProfilePage() {
  const { id }       = useParams<{ id: string }>()
  const user         = useUser()
  const isManager    = user.roles.includes("MANAGER")
  const canFeedback  = isManager || user.roles.includes("FEEDBACK_DOCUMENTER")
  const canDevLog    = isManager || user.roles.includes("FEEDBACK_DOCUMENTER")

  const [actor, setActor]   = useState<ActorDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit mode
  const [editing, setEditing]     = useState(false)
  const [editForm, setEditForm]   = useState<Partial<ActorDetail & { gender: string }>>({})
  const [editError, setEditError] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  // Expand feedback rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Dev log add
  const [newNote, setNewNote]     = useState("")
  const [addingLog, setAddingLog] = useState(false)
  const [logError, setLogError]   = useState("")

  async function fetchActor() {
    const res  = await fetch(`/api/shakhanim/${id}`)
    if (!res.ok) { setLoading(false); return }
    setActor(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchActor() }, [id])

  function openEdit() {
    if (!actor) return
    setEditForm({
      name:        actor.name,
      gender:      actor.gender,
      phone:       actor.phone        ?? "",
      email:       actor.email        ?? "",
      languages:   actor.languages    ?? "",
      specialties: actor.specialties  ?? "",
      canDirect:   actor.canDirect,
    })
    setEditError("")
    setEditing(true)
  }

  async function saveEdit() {
    setEditSaving(true); setEditError("")
    const res  = await fetch(`/api/shakhanim/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (!res.ok) { setEditError(data.error ?? "שגיאה בשמירה"); setEditSaving(false); return }
    await fetchActor(); setEditing(false); setEditSaving(false)
  }

  async function addDevLog() {
    setLogError("")
    if (!newNote.trim()) { setLogError("נא להזין תוכן"); return }
    setAddingLog(true)
    const res  = await fetch(`/api/shakhanim/${id}/devlog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: newNote }),
    })
    const data = await res.json()
    if (!res.ok) { setLogError(data.error ?? "שגיאה"); setAddingLog(false); return }
    setNewNote(""); setAddingLog(false)
    await fetchActor()
  }

  function toggleExpand(fid: string) {
    setExpanded((prev) => {
      const next = new Set(prev); next.has(fid) ? next.delete(fid) : next.add(fid); return next
    })
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">טוען...</div>
  if (!actor)  return <div className="p-8 text-sm text-red-500">שחקן/ית לא נמצא/ה</div>

  const totalFeedback = actor.feedbacks.length

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Breadcrumb */}
      <div className="px-8 pt-5 pb-2 text-sm text-gray-400 shrink-0">
        <Link href="/shakhanim" className="hover:text-gray-700">שחקנים</Link>
        {" / "}
        <span className="text-gray-700">{actor.name}</span>
      </div>

      <div className="px-8 pb-12">
        {/* Page header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-navy-light text-navy flex items-center justify-center text-lg font-bold shrink-0">
            {initials(actor.name)}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{actor.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {actor.gender === "MALE" ? "שחקן" : "שחקנית"}
                  {actor.canDirect && " · במאי/ת"}
                  {actor.lastDate && ` · פעיל/ה לאחרונה: ${fmtDate(actor.lastDate)}`}
                  {" · "}{actor.workshopCount} סדנאות
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {actor.phone     && <span className="text-xs text-gray-600" dir="ltr">📞 {actor.phone}</span>}
                  {actor.email     && <span className="text-xs text-gray-600" dir="ltr">✉ {actor.email}</span>}
                  {actor.languages && <span className="text-xs text-gray-500">🌐 {actor.languages}</span>}
                </div>
                {actor.specialties && (
                  <p className="text-sm text-gray-600 mt-1">{actor.specialties}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isManager && !editing && (
                  <button
                    onClick={openEdit}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700 transition-colors"
                  >
                    עריכה
                  </button>
                )}
                {canFeedback && (
                  <a
                    href={`/api/shakhanim/${id}/export`}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700 transition-colors"
                  >
                    ייצוא CSV
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="mb-6 border border-gray-200 rounded-lg p-5 bg-gray-50 max-w-2xl">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">עריכת פרופיל</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">שם מלא *</label>
                <input type="text" value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-2">מגדר *</label>
                <div className="flex gap-4 pt-1">
                  {(["MALE", "FEMALE"] as const).map((g) => (
                    <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="edit-gender" value={g} checked={editForm.gender === g}
                        onChange={() => setEditForm((f) => ({ ...f, gender: g }))} className="accent-navy" />
                      <span className="text-sm">{g === "MALE" ? "שחקן" : "שחקנית"}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">טלפון</label>
                <input type="tel" value={editForm.phone ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">אימייל</label>
                <input type="email" value={editForm.email ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" dir="ltr" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-600 mb-1">שפות</label>
              <input type="text" value={editForm.languages ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, languages: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-600 mb-1">התמחויות</label>
              <textarea value={editForm.specialties ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, specialties: e.target.value }))}
                rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input type="checkbox" checked={Boolean(editForm.canDirect)} onChange={(e) => setEditForm((f) => ({ ...f, canDirect: e.target.checked }))} className="accent-navy" />
              <span className="text-sm">יכול/ה לשמש במאי/ת</span>
            </label>
            {editError && <p className="text-sm text-red-600 mb-3">{editError}</p>}
            <div className="flex items-center gap-3">
              <button onClick={saveEdit} disabled={editSaving}
                className="px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark disabled:opacity-50 transition-colors">
                {editSaving ? "שומר..." : "שמירה"}
              </button>
              <button onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:text-gray-800">ביטול</button>
            </div>
          </div>
        )}

        {/* Feedback + dev log */}
        <div className="max-w-3xl">

            {/* Feedback history — Manager + Feedback Doc only */}
            {canFeedback && (
              <div className="mb-8">
                <h2 className="text-base font-semibold text-gray-800 mb-3">
                  היסטוריית פידבק
                  {totalFeedback > 0 && <span className="text-sm font-normal text-gray-400 mr-2">({totalFeedback})</span>}
                </h2>
                {totalFeedback === 0 ? (
                  <p className="text-sm text-gray-400">אין פידבק מוזן לשחקן/ית זה/ו</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-right text-xs text-gray-500 font-medium">
                          <th className="px-3 py-2">תאריך</th>
                          <th className="px-3 py-2">סדנה</th>
                          <th className="px-3 py-2">מתחקר/ת</th>
                          <th className="px-3 py-2 text-center">התכוננות</th>
                          <th className="px-3 py-2 text-center">סימולטור</th>
                          <th className="px-3 py-2 text-center">שיקוף</th>
                          <th className="px-3 py-2 text-center">מקצועיות</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {actor.feedbacks.map((f) => (
                          <>
                            <tr
                              key={f.id}
                              className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                              onClick={() => toggleExpand(f.id)}
                            >
                              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(f.date)}</td>
                              <td className="px-3 py-2.5">
                                <Link
                                  href={`/sadnaot/${f.workshopId}`}
                                  className="text-navy hover:underline text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {f.orgName}
                                </Link>
                              </td>
                              <td className="px-3 py-2.5 text-gray-500 text-xs">{f.facilitatorName ?? "—"}</td>
                              <td className="px-3 py-2.5 text-center"><RagDot color={f.aspect1Color} /></td>
                              <td className="px-3 py-2.5 text-center"><RagDot color={f.aspect2Color} /></td>
                              <td className="px-3 py-2.5 text-center"><RagDot color={f.aspect3Color} /></td>
                              <td className="px-3 py-2.5 text-center"><RagDot color={f.aspect4Color} /></td>
                              <td className="px-3 py-2.5 text-gray-400 text-xs">{expanded.has(f.id) ? "▲" : "▾"}</td>
                            </tr>
                            {expanded.has(f.id) && (
                              <tr key={`${f.id}-exp`} className="border-b border-gray-100 bg-gray-50/60">
                                <td colSpan={8} className="px-4 py-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    {[
                                      { label: "התכוננות לסדנה",   color: f.aspect1Color, text: f.aspect1Text },
                                      { label: "שחקן כסימולטור",   color: f.aspect2Color, text: f.aspect2Text },
                                      { label: "שיקוף",             color: f.aspect3Color, text: f.aspect3Text },
                                      { label: "התנהלות מקצועית",  color: f.aspect4Color, text: f.aspect4Text },
                                    ].map(({ label, color, text }) => (
                                      <div key={label} className="flex gap-2">
                                        <RagDot color={color} size="sm" />
                                        <div>
                                          <p className="text-xs font-medium text-gray-700">{label}</p>
                                          <p className="text-xs text-gray-500">{text || "אין הערות"}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-2">הוזן ע"י {f.enteredByName}</p>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Dev log — Manager + Feedback Doc only */}
            {canDevLog && (
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-3">יומן פיתוח</h2>
                {actor.devLogs.length === 0 && (
                  <p className="text-sm text-gray-400 mb-3">אין רשומות ביומן</p>
                )}
                <div className="space-y-3 mb-4">
                  {actor.devLogs.map((log) => (
                    <div key={log.id} className="border-r-2 border-gray-200 pr-3">
                      <p className="text-xs text-gray-400 mb-0.5">{fmtDate(log.date)} · {log.enteredByName}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{log.note}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                    placeholder="+ הוספת רשומה ליומן..."
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none hover:border-gray-300"
                  />
                  {newNote.trim() && (
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={addDevLog}
                        disabled={addingLog}
                        className="px-3 py-1.5 text-xs bg-navy text-white rounded hover:bg-navy-dark disabled:opacity-50 transition-colors"
                      >
                        {addingLog ? "שומר..." : "שמירה"}
                      </button>
                      <button onClick={() => setNewNote("")} className="text-xs text-gray-400 hover:text-gray-600">ביטול</button>
                    </div>
                  )}
                  {logError && <p className="text-xs text-red-500 mt-1">{logError}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  )
}
