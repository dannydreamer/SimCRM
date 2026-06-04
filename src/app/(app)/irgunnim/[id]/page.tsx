"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useUser } from "@/app/(app)/user-context"
import { StatusPill } from "@/components/StatusPill"
import { PEDAGOGI_LABELS, PEDAGOGI_VALUES, TAKZIVI_LABELS, TAKZIVI_VALUES } from "@/lib/shiyuch"

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkshopRow {
  id: string
  date: string
  status: string
  cancelled: boolean
  roomCount: number
  facilitators: string[]
}

interface Group {
  id: string
  name: string
  workshopCount: number
  lastWorkshopDate: string | null
  workshops: WorkshopRow[]
}

interface OrgDetail {
  id: string
  name: string
  city: string
  shiyuchPedagogi: string
  shiyuchTakzivi: string
  pocName: string | null
  pocPhone: string | null
  pocEmail: string | null
  notes: string | null
  totalRoomsDone: number
  totalRoomsPlanned: number
  groups: Group[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const user      = useUser()
  const isManager = user.roles.includes("MANAGER")

  const [org, setOrg]           = useState<OrgDetail | null>(null)
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(false)
  const [editForm, setEditForm] = useState<Partial<OrgDetail>>({})
  const [saving, setSaving]     = useState(false)
  const [editError, setEditError] = useState("")

  // Inline notes editing (Manager only, auto-save on blur)
  const [notesValue, setNotesValue]   = useState<string | null>(null)
  const [notesDirty, setNotesDirty]   = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [newGroupName, setNewGroupName]     = useState("")
  const [addingGroup, setAddingGroup]       = useState(false)
  const [groupError, setGroupError]         = useState("")

  async function fetchOrg() {
    const res  = await fetch(`/api/irgunnim/${id}`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setOrg(data)
    setNotesValue(data.notes ?? "")
    setLoading(false)
  }

  useEffect(() => { fetchOrg() }, [id])

  async function saveNotes() {
    if (!notesDirty) return
    setNotesSaving(true)
    await fetch(`/api/irgunnim/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesValue }),
    })
    setNotesDirty(false)
    setNotesSaving(false)
  }

  function openEdit() {
    if (!org) return
    setEditForm({
      name:            org.name,
      city:            org.city,
      shiyuchPedagogi: org.shiyuchPedagogi,
      shiyuchTakzivi:  org.shiyuchTakzivi,
      pocName:         org.pocName  ?? "",
      pocPhone:        org.pocPhone ?? "",
      pocEmail:        org.pocEmail ?? "",
    })
    setEditError("")
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)
    setEditError("")
    const res  = await fetch(`/api/irgunnim/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (!res.ok) { setEditError(data.error ?? "שגיאה בשמירה"); setSaving(false); return }
    await fetchOrg()
    setEditing(false)
    setSaving(false)
  }

  function toggleGroup(gid: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(gid) ? next.delete(gid) : next.add(gid)
      return next
    })
  }

  async function addGroup() {
    setGroupError("")
    if (!newGroupName.trim()) { setGroupError("נא להזין שם קבוצה"); return }
    setAddingGroup(true)
    const res = await fetch(`/api/irgunnim/${id}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName }),
    })
    const data = await res.json()
    if (!res.ok) { setGroupError(data.error ?? "שגיאה"); setAddingGroup(false); return }
    setNewGroupName("")
    setAddingGroup(false)
    await fetchOrg()
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">טוען...</div>
  if (!org)    return <div className="p-8 text-sm text-red-500">ארגון לא נמצא</div>

  const totalWorkshops = org.groups.reduce((s, g) => s + g.workshopCount, 0)
  const now = new Date()
  const allDates = org.groups.flatMap((g) =>
    g.workshops
      .filter((w) => !w.cancelled && new Date(w.date) <= now)
      .map((w) => w.date)
  )
  const lastDate = allDates.length ? allDates.sort().reverse()[0] : null

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Breadcrumb */}
      <div className="px-8 pt-5 pb-2 text-sm text-gray-400 shrink-0">
        <Link href="/irgunnim" className="hover:text-gray-700">ארגונים וקבוצות</Link>
        {" / "}
        <span className="text-gray-700">{org.name}</span>
      </div>

      <div className="px-8 pb-12 max-w-3xl">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{org.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-navy-light text-navy">
                {PEDAGOGI_LABELS[org.shiyuchPedagogi] ?? org.shiyuchPedagogi}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                {TAKZIVI_LABELS[org.shiyuchTakzivi] ?? org.shiyuchTakzivi}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {totalWorkshops} סדנאות
              {lastDate && ` · אחרונה: ${fmtDate(lastDate)}`}
            </p>
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
            {isManager && (
              <Link
                href={`/sadnaot/new?orgId=${org.id}`}
                className="px-3 py-1.5 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark transition-colors"
              >
                + סדנה חדשה
              </Link>
            )}
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="mb-6 border border-gray-200 rounded-lg p-5 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">עריכת פרטי ארגון</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">שם ארגון *</label>
                <input
                  type="text"
                  value={editForm.name ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">עיר</label>
                <input
                  type="text"
                  value={editForm.city ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">שיוך פדגוגי *</label>
                <select
                  value={editForm.shiyuchPedagogi ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, shiyuchPedagogi: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                >
                  {PEDAGOGI_VALUES.map((v) => (
                    <option key={v} value={v}>{PEDAGOGI_LABELS[v]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">שיוך תקציבי *</label>
                <select
                  value={editForm.shiyuchTakzivi ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, shiyuchTakzivi: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                >
                  {TAKZIVI_VALUES.map((v) => (
                    <option key={v} value={v}>{TAKZIVI_LABELS[v]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">שם איש/אשת קשר</label>
                <input
                  type="text"
                  value={editForm.pocName ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, pocName: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">טלפון</label>
                <input
                  type="tel"
                  value={editForm.pocPhone ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, pocPhone: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">אימייל</label>
                <input
                  type="email"
                  value={editForm.pocEmail ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, pocEmail: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                  dir="ltr"
                />
              </div>
            </div>
            {editError && <p className="text-sm text-red-600 mb-3">{editError}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark disabled:opacity-50 transition-colors"
              >
                {saving ? "שומר..." : "שמירה"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {/* Org details row */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-gray-100 rounded-lg p-4 mb-4 bg-gray-50 text-sm">
          {org.pocName  && <InfoRow label="איש/אשת קשר" value={org.pocName} />}
          {org.pocPhone && <InfoRow label="טלפון" value={org.pocPhone} ltr />}
          {org.pocEmail && <InfoRow label="אימייל" value={org.pocEmail} ltr />}
          <InfoRow label="עיר" value={org.city} />
          <InfoRow label="שיוך פדגוגי" value={PEDAGOGI_LABELS[org.shiyuchPedagogi] ?? org.shiyuchPedagogi} />
          <InfoRow label="שיוך תקציבי" value={TAKZIVI_LABELS[org.shiyuchTakzivi] ?? org.shiyuchTakzivi} />
        </div>

        {/* Rooms summary */}
        <p className="text-sm text-gray-500 mb-4">
          סה"כ חדרים שבוצעו: <span className="font-medium text-gray-700">{org.totalRoomsDone}</span>
          {" | "}
          חדרים מתוכננים: <span className="font-medium text-gray-700">{org.totalRoomsPlanned}</span>
        </p>

        {/* Notes — inline editable for Manager, read-only for Tech */}
        {(org.notes || isManager) && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-700">הערות</h3>
              {notesSaving && <span className="text-xs text-gray-400">שומר...</span>}
            </div>
            {isManager ? (
              <textarea
                value={notesValue ?? ""}
                onChange={(e) => { setNotesValue(e.target.value); setNotesDirty(true) }}
                onBlur={saveNotes}
                rows={3}
                placeholder="הוסיפי הערות לארגון זה..."
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none hover:border-gray-300 transition-colors"
              />
            ) : (
              org.notes
                ? <p className="text-sm text-gray-600 whitespace-pre-line">{org.notes}</p>
                : <p className="text-sm text-gray-300 italic">אין הערות</p>
            )}
          </div>
        )}

        {/* Groups */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-800 mb-3">קבוצות משתתפות</h3>
          {org.groups.length === 0 && (
            <p className="text-sm text-gray-400 mb-4">אין קבוצות רשומות לארגון זה</p>
          )}
          <div className="space-y-2">
            {org.groups.map((group) => (
              <GroupSection
                key={group.id}
                group={group}
                orgId={org.id}
                expanded={expandedGroups.has(group.id)}
                onToggle={() => toggleGroup(group.id)}
                isManager={isManager}
              />
            ))}
          </div>
        </div>

        {/* Add group — Manager only */}
        {isManager && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">+ קבוצה חדשה תחת ארגון זה</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGroup()}
                placeholder="שם הקבוצה (למשל: מורים, מנהלים)"
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 w-64"
              />
              <button
                onClick={addGroup}
                disabled={addingGroup}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700 disabled:opacity-50 transition-colors"
              >
                {addingGroup ? "שומר..." : "הוספה"}
              </button>
            </div>
            {groupError && <p className="text-xs text-red-500 mt-1">{groupError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <span className="text-gray-400">{label}: </span>
      <span className={`text-gray-700 ${ltr ? "dir-ltr" : ""}`} dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  )
}

function GroupSection({
  group, orgId, expanded, onToggle, isManager,
}: {
  group: Group
  orgId: string
  expanded: boolean
  onToggle: () => void
  isManager: boolean
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Group header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-right"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-800">{group.name}</span>
          <span className="text-xs text-gray-400">
            {group.workshopCount} סדנאות
            {group.lastWorkshopDate && ` · אחרונה: ${fmtDate(group.lastWorkshopDate)}`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isManager && (
            <Link
              href={`/sadnaot/new?orgId=${orgId}&groupId=${group.id}`}
              onClick={(e) => e.stopPropagation()}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white text-gray-600 transition-colors"
            >
              + סדנה
            </Link>
          )}
          <span className="text-gray-400 text-xs">{expanded ? "▲" : "▾"}</span>
        </div>
      </button>

      {/* Expanded workshop table */}
      {expanded && group.workshops.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-right text-xs text-gray-500 bg-white">
                <th className="px-4 py-2 font-medium">תאריך</th>
                <th className="px-4 py-2 font-medium">סטטוס</th>
                <th className="px-4 py-2 font-medium">מתחקר/ת</th>
                <th className="px-4 py-2 font-medium">חדרים</th>
              </tr>
            </thead>
            <tbody>
              {group.workshops.map((w) => (
                <tr
                  key={w.id}
                  onClick={() => window.location.href = `/sadnaot/${w.id}`}
                  className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${w.cancelled ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <span className={`text-sim-teal font-medium ${w.cancelled ? "line-through" : ""}`}>
                      {fmtDate(w.date)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={w.cancelled ? "CANCELLED" : w.status} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {w.facilitators.length > 0 ? w.facilitators.join(", ") : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{w.roomCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {expanded && group.workshops.length === 0 && (
        <p className="px-4 py-3 text-sm text-gray-400">אין סדנאות לקבוצה זו</p>
      )}
    </div>
  )
}
