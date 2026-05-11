"use client"

import { useEffect, useRef, useState } from "react"
import { useUser } from "@/app/(app)/user-context"

interface TopicRow {
  id: string
  name: string
  active: boolean
  scenarioCount: number
}

export default function NosimPage() {
  const user      = useUser()
  const isManager = user.roles.includes("MANAGER")

  const [topics, setTopics]   = useState<TopicRow[]>([])
  const [loading, setLoading] = useState(true)

  // Add-new state
  const [newName, setNewName]   = useState("")
  const [adding, setAdding]     = useState(false)
  const [addError, setAddError] = useState("")
  const addInputRef             = useRef<HTMLInputElement>(null)

  // Inline-rename state: topicId → draft name
  const [renamingId, setRenamingId]     = useState<string | null>(null)
  const [renameDraft, setRenameDraft]   = useState("")
  const [renameError, setRenameError]   = useState("")
  const [renameSaving, setRenameSaving] = useState(false)

  // Deactivate-confirm state
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function fetchTopics() {
    const res  = await fetch("/api/nosim")
    const data = await res.json()
    setTopics(data)
    setLoading(false)
  }

  useEffect(() => { fetchTopics() }, [])

  async function handleAdd() {
    setAddError("")
    if (!newName.trim()) return
    setAdding(true)
    const res  = await fetch("/api/nosim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error ?? "שגיאה"); setAdding(false); return }
    setNewName("")
    setAdding(false)
    await fetchTopics()
    addInputRef.current?.focus()
  }

  function startRename(topic: TopicRow) {
    setRenamingId(topic.id)
    setRenameDraft(topic.name)
    setRenameError("")
  }

  async function commitRename(id: string) {
    if (!renameDraft.trim()) { setRenameError("שם לא יכול להיות ריק"); return }
    const current = topics.find((t) => t.id === id)
    if (current?.name === renameDraft.trim()) { setRenamingId(null); return }
    setRenameSaving(true)
    const res  = await fetch(`/api/nosim/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameDraft }),
    })
    const data = await res.json()
    setRenameSaving(false)
    if (!res.ok) { setRenameError(data.error ?? "שגיאה"); return }
    setRenamingId(null)
    await fetchTopics()
  }

  async function toggleActive(topic: TopicRow) {
    setConfirmId(null)
    await fetch(`/api/nosim/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !topic.active }),
    })
    await fetchTopics()
  }

  const active   = topics.filter((t) => t.active)
  const inactive = topics.filter((t) => !t.active)

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">נושאים</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? "טוען..." : `${active.length} נושאים פעילים`}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">טוען נושאים...</p>
      ) : (
        <>
          {/* Active topics */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-right text-gray-500 text-xs font-medium">
                  <th className="px-4 py-2.5">שם הנושא</th>
                  <th className="px-4 py-2.5 text-left">תרחישים</th>
                  {isManager && <th className="px-4 py-2.5"></th>}
                </tr>
              </thead>
              <tbody>
                {active.length === 0 && (
                  <tr>
                    <td colSpan={isManager ? 3 : 2} className="px-4 py-6 text-center text-sm text-gray-400">
                      אין נושאים פעילים
                    </td>
                  </tr>
                )}
                {active.map((topic) => (
                  <TopicRowView
                    key={topic.id}
                    topic={topic}
                    isManager={isManager}
                    isRenaming={renamingId === topic.id}
                    renameDraft={renameDraft}
                    renameError={renameError}
                    renameSaving={renameSaving}
                    confirmId={confirmId}
                    onStartRename={() => startRename(topic)}
                    onRenameDraftChange={(v) => { setRenameDraft(v); setRenameError("") }}
                    onCommitRename={() => commitRename(topic.id)}
                    onCancelRename={() => setRenamingId(null)}
                    onRequestConfirm={() => setConfirmId(topic.id)}
                    onCancelConfirm={() => setConfirmId(null)}
                    onToggleActive={() => toggleActive(topic)}
                  />
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
                          placeholder="+ נושא חדש"
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

          {/* Inactive topics */}
          {inactive.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">
                נושאים לא פעילים ({inactive.length})
              </h2>
              <div className="border border-gray-200 rounded-lg overflow-hidden opacity-60">
                <table className="w-full text-sm">
                  <tbody>
                    {inactive.map((topic) => (
                      <TopicRowView
                        key={topic.id}
                        topic={topic}
                        isManager={isManager}
                        isRenaming={renamingId === topic.id}
                        renameDraft={renameDraft}
                        renameError={renameError}
                        renameSaving={renameSaving}
                        confirmId={confirmId}
                        onStartRename={() => startRename(topic)}
                        onRenameDraftChange={(v) => { setRenameDraft(v); setRenameError("") }}
                        onCommitRename={() => commitRename(topic.id)}
                        onCancelRename={() => setRenamingId(null)}
                        onRequestConfirm={() => setConfirmId(topic.id)}
                        onCancelConfirm={() => setConfirmId(null)}
                        onToggleActive={() => toggleActive(topic)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Row component ─────────────────────────────────────────────────────────────

function TopicRowView({
  topic,
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
  topic: TopicRow
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
            className={`text-gray-800 ${isManager ? "cursor-pointer hover:text-navy" : ""} ${!topic.active ? "line-through text-gray-400" : ""}`}
            onClick={isManager ? onStartRename : undefined}
            title={isManager ? "לחץ לשינוי שם" : undefined}
          >
            {topic.name}
          </span>
        )}
      </td>

      {/* Scenario count */}
      <td className="px-4 py-2.5 text-left text-gray-500 text-xs">
        {topic.scenarioCount > 0 ? `${topic.scenarioCount} תרחישים` : "—"}
      </td>

      {/* Actions — Manager only */}
      {isManager && (
        <td className="px-4 py-2.5 text-left">
          {confirmId === topic.id ? (
            <span className="flex items-center gap-2 justify-end">
              <span className="text-xs text-gray-600">
                {topic.active ? "להשבית?" : "להפעיל?"}
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
              {topic.active ? "השבתה" : "הפעלה"}
            </button>
          )}
        </td>
      )}
    </tr>
  )
}
