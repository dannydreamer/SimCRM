"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useUser } from "@/app/(app)/user-context"

interface ListRow {
  id: string
  name: string
  active: boolean
  scenarioCount: number
}

interface SectionLabels {
  heading:        string   // section title
  activeCount:    (n: number) => string
  columnName:     string
  emptyActive:    string
  inactiveHeader: (n: number) => string
  addPlaceholder: string
}

const TOPIC_LABELS: SectionLabels = {
  heading:        "נושאים",
  activeCount:    (n) => `${n} נושאים פעילים`,
  columnName:     "שם הנושא",
  emptyActive:    "אין נושאים פעילים",
  inactiveHeader: (n) => `נושאים לא פעילים (${n})`,
  addPlaceholder: "+ נושא חדש",
}

const MODEL_LABELS: SectionLabels = {
  heading:        "מודלי סימולציה",
  activeCount:    (n) => `${n} מודלים פעילים`,
  columnName:     "שם המודל",
  emptyActive:    "אין מודלים פעילים",
  inactiveHeader: (n) => `מודלים לא פעילים (${n})`,
  addPlaceholder: "+ מודל חדש",
}

export default function SystemListsPage() {
  const user      = useUser()
  const isManager = user.roles.includes("MANAGER")

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">רשימות מערכת</h1>

      <ManagedListSection endpoint="/api/nosim"   labels={TOPIC_LABELS} isManager={isManager} />
      <ManagedListSection endpoint="/api/modelim" labels={MODEL_LABELS} isManager={isManager} />
    </div>
  )
}

// ─── Managed list section ──────────────────────────────────────────────────────

function ManagedListSection({
  endpoint, labels, isManager,
}: {
  endpoint: string
  labels: SectionLabels
  isManager: boolean
}) {
  const [rows, setRows]       = useState<ListRow[]>([])
  const [loading, setLoading] = useState(true)

  // Add-new state
  const [newName, setNewName]   = useState("")
  const [adding, setAdding]     = useState(false)
  const [addError, setAddError] = useState("")
  const addInputRef             = useRef<HTMLInputElement>(null)

  // Inline-rename state: row id → draft name
  const [renamingId, setRenamingId]     = useState<string | null>(null)
  const [renameDraft, setRenameDraft]   = useState("")
  const [renameError, setRenameError]   = useState("")
  const [renameSaving, setRenameSaving] = useState(false)

  // Deactivate-confirm state
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const fetchRows = useCallback(async () => {
    const res  = await fetch(endpoint)
    const data = await res.json()
    setRows(data)
    setLoading(false)
  }, [endpoint])

  useEffect(() => { fetchRows() }, [fetchRows])

  async function handleAdd() {
    setAddError("")
    if (!newName.trim()) return
    setAdding(true)
    const res  = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error ?? "שגיאה"); setAdding(false); return }
    setNewName("")
    setAdding(false)
    await fetchRows()
    addInputRef.current?.focus()
  }

  function startRename(row: ListRow) {
    setRenamingId(row.id)
    setRenameDraft(row.name)
    setRenameError("")
  }

  async function commitRename(id: string) {
    if (!renameDraft.trim()) { setRenameError("שם לא יכול להיות ריק"); return }
    const current = rows.find((r) => r.id === id)
    if (current?.name === renameDraft.trim()) { setRenamingId(null); return }
    setRenameSaving(true)
    const res  = await fetch(`${endpoint}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameDraft }),
    })
    const data = await res.json()
    setRenameSaving(false)
    if (!res.ok) { setRenameError(data.error ?? "שגיאה"); return }
    setRenamingId(null)
    await fetchRows()
  }

  async function toggleActive(row: ListRow) {
    setConfirmId(null)
    await fetch(`${endpoint}/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !row.active }),
    })
    await fetchRows()
  }

  const active   = rows.filter((r) => r.active)
  const inactive = rows.filter((r) => !r.active)

  const rowProps = (row: ListRow) => ({
    row,
    isManager,
    isRenaming: renamingId === row.id,
    renameDraft,
    renameError,
    renameSaving,
    confirmId,
    onStartRename: () => startRename(row),
    onRenameDraftChange: (v: string) => { setRenameDraft(v); setRenameError("") },
    onCommitRename: () => commitRename(row.id),
    onCancelRename: () => setRenamingId(null),
    onRequestConfirm: () => setConfirmId(row.id),
    onCancelConfirm: () => setConfirmId(null),
    onToggleActive: () => toggleActive(row),
  })

  return (
    <section className="mb-10 last:mb-0">
      {/* Section header */}
      <div className="mb-3">
        <h2 className="text-base font-semibold text-gray-800">{labels.heading}</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {loading ? "טוען..." : labels.activeCount(active.length)}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">טוען...</p>
      ) : (
        <>
          {/* Active */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-right text-gray-500 text-xs font-medium">
                  <th className="px-4 py-2.5">{labels.columnName}</th>
                  <th className="px-4 py-2.5 text-left">תרחישים</th>
                  {isManager && <th className="px-4 py-2.5"></th>}
                </tr>
              </thead>
              <tbody>
                {active.length === 0 && (
                  <tr>
                    <td colSpan={isManager ? 3 : 2} className="px-4 py-6 text-center text-sm text-gray-400">
                      {labels.emptyActive}
                    </td>
                  </tr>
                )}
                {active.map((row) => (
                  <ListRowView key={row.id} {...rowProps(row)} />
                ))}

                {/* Add row — Manager only */}
                {isManager && (
                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-2.5" colSpan={3}>
                      <div className="flex items-center gap-2">
                        <input
                          ref={addInputRef}
                          type="text"
                          value={newName}
                          onChange={(e) => { setNewName(e.target.value); setAddError("") }}
                          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                          placeholder={labels.addPlaceholder}
                          className="flex-1 border border-dashed border-gray-300 rounded px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy/30"
                        />
                        {newName.trim() && (
                          <button
                            onClick={handleAdd}
                            disabled={adding}
                            className="px-3 py-1.5 text-xs bg-navy text-white rounded hover:bg-navy-dark disabled:opacity-50 transition-colors"
                          >
                            {adding ? "שומר..." : "הוספה"}
                          </button>
                        )}
                      </div>
                      {addError && <p className="text-xs text-red-500 mt-1">{addError}</p>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Inactive */}
          {inactive.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                {labels.inactiveHeader(inactive.length)}
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden opacity-60">
                <table className="w-full text-sm">
                  <tbody>
                    {inactive.map((row) => (
                      <ListRowView key={row.id} {...rowProps(row)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

// ─── Row component ─────────────────────────────────────────────────────────────

function ListRowView({
  row,
  isManager,
  isRenaming,
  renameDraft,
  renameError,
  renameSaving,
  confirmId,
  onStartRename,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  onRequestConfirm,
  onCancelConfirm,
  onToggleActive,
}: {
  row: ListRow
  isManager: boolean
  isRenaming: boolean
  renameDraft: string
  renameError: string
  renameSaving: boolean
  confirmId: string | null
  onStartRename: () => void
  onRenameDraftChange: (v: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
  onRequestConfirm: () => void
  onCancelConfirm: () => void
  onToggleActive: () => void
}) {
  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
      {/* Name / rename input */}
      <td className="px-4 py-2.5">
        {isRenaming ? (
          <div>
            <input
              autoFocus
              type="text"
              value={renameDraft}
              onChange={(e) => onRenameDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  onCommitRename()
                if (e.key === "Escape") onCancelRename()
              }}
              onBlur={onCommitRename}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 w-full"
            />
            {renameError && <p className="text-xs text-red-500 mt-0.5">{renameError}</p>}
            {renameSaving && <p className="text-xs text-gray-400 mt-0.5">שומר...</p>}
          </div>
        ) : (
          <span
            className={`text-gray-800 ${isManager ? "cursor-pointer hover:text-navy" : ""} ${!row.active ? "line-through text-gray-400" : ""}`}
            onClick={isManager ? onStartRename : undefined}
            title={isManager ? "לחץ לשינוי שם" : undefined}
          >
            {row.name}
          </span>
        )}
      </td>

      {/* Scenario count */}
      <td className="px-4 py-2.5 text-left text-gray-500 text-xs">
        {row.scenarioCount > 0 ? `${row.scenarioCount} תרחישים` : "—"}
      </td>

      {/* Actions — Manager only */}
      {isManager && (
        <td className="px-4 py-2.5 text-left">
          {confirmId === row.id ? (
            <span className="flex items-center gap-2 justify-end">
              <span className="text-xs text-gray-600">
                {row.active ? "להשבית?" : "להפעיל?"}
              </span>
              <button
                onClick={onToggleActive}
                className="text-xs text-red-600 hover:underline font-medium"
              >
                כן
              </button>
              <button
                onClick={onCancelConfirm}
                className="text-xs text-gray-400 hover:underline"
              >
                לא
              </button>
            </span>
          ) : (
            <button
              onClick={onRequestConfirm}
              className="text-xs text-gray-400 hover:text-gray-700 hover:underline"
            >
              {row.active ? "השבתה" : "הפעלה"}
            </button>
          )}
        </td>
      )}
    </tr>
  )
}
