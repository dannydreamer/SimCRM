"use client"

import { useEffect, useMemo, useState } from "react"
import { OrgCombobox } from "@/components/OrgCombobox"
import { planGroupFold } from "@/lib/org-merge"
import { TAKZIVI_LABELS } from "@/lib/shiyuch"

interface OrgListRow {
  id:             string
  name:           string
  city:           string
  shiyuchTakzivi: string
  groups:         { id: string; name: string }[]
}

interface Props {
  org: {
    id:             string
    name:           string
    city:           string
    shiyuchTakzivi: string
    groups:         { id: string; name: string }[]
  }
  onClose:   () => void
  onDeleted: () => void
}

/**
 * Deleting an organization, and — when it has history — handing that history to
 * the organization that survives.
 *
 * An organization's past workshops, rooms, casting and feedback all hang off its
 * participant groups, so there is no version of this that simply discards them.
 * The dialog therefore has two faces: a plain confirmation for an organization
 * nobody has used yet, and a destination picker for one that has been.
 */
export default function DeleteOrgDialog({ org, onClose, onDeleted }: Props) {
  const hasHistory = org.groups.length > 0

  const [orgs,     setOrgs]     = useState<OrgListRow[] | null>(null)
  const [targetId, setTargetId] = useState("")
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState("")

  useEffect(() => {
    if (!hasHistory) return
    fetch("/api/irgunnim")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: OrgListRow[]) => setOrgs(rows.filter((o) => o.id !== org.id)))
      .catch(() => setOrgs([]))
  }, [hasHistory, org.id])

  const target = orgs?.find((o) => o.id === targetId) ?? null

  // What the merge will do to the groups, worked out with the same function the
  // server uses. Workshop counts only decide *which* of several same-named
  // groups receives, never whether a group folds at all, so the preview is exact
  // without them.
  const fold = useMemo(() => {
    if (!target) return null
    const count = (gs: { id: string; name: string }[]) =>
      gs.map((g) => ({ ...g, workshopCount: 0 }))
    const plan = planGroupFold(count(org.groups), count(target.groups))
    const nameOf = (gid: string) => org.groups.find((g) => g.id === gid)?.name ?? ""
    return {
      folded: plan.folds.map((f) => nameOf(f.fromGroupId)),
      moved:  plan.moves.map(nameOf),
    }
  }, [target, org.groups])

  const takziviDiffers = target !== null && target.shiyuchTakzivi !== org.shiyuchTakzivi

  async function submit() {
    setBusy(true)
    setError("")
    const res = await fetch(`/api/irgunnim/${org.id}`, {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(hasHistory ? { mergeIntoId: targetId } : {}),
    })
    if (res.ok) { onDeleted(); return }
    const data = await res.json().catch(() => ({}))
    setError(data.error ?? "שגיאה במחיקת הארגון")
    setBusy(false)
  }

  const canSubmit = !busy && (!hasHistory || targetId !== "")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/30" onClick={busy ? undefined : onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">מחיקת ארגון</h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none disabled:opacity-40"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm">
          <p className="text-gray-700">
            למחוק את הארגון <span className="font-semibold">{org.name}</span>
            {" "}({org.city})?
          </p>

          {!hasHistory && (
            <p className="text-gray-500">
              לארגון זה אין קבוצות ואין סדנאות, ולכן אפשר למחוק אותו לגמרי.
              הפעולה אינה הפיכה.
            </p>
          )}

          {hasHistory && (
            <>
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
                <p className="font-medium mb-1">לארגון הזה יש היסטוריה שאי אפשר למחוק.</p>
                <p className="text-amber-800">
                  {org.groups.length} קבוצות תלויות בו, ואיתן כל הסדנאות שלהן — קודמות
                  ועתידיות — החדרים, הליהוקים והפידבקים. יש לבחור את הארגון שיקבל אותן.
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  הארגון שיקבל את ההיסטוריה *
                </label>
                <div className="flex">
                  <OrgCombobox
                    orgs={orgs ?? []}
                    value={targetId}
                    onChange={setTargetId}
                    loading={orgs === null}
                    disabled={busy}
                  />
                </div>
              </div>

              {fold && (
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-1.5 text-gray-700">
                  <p className="font-medium text-gray-800">מה יקרה לקבוצות:</p>
                  {fold.moved.length > 0 && (
                    <p>
                      <span className="text-gray-500">יעברו כמו שהן: </span>
                      {fold.moved.join(", ")}
                    </p>
                  )}
                  {fold.folded.length > 0 && (
                    <p>
                      <span className="text-gray-500">יאוחדו עם קבוצה קיימת באותו שם: </span>
                      {fold.folded.join(", ")}
                    </p>
                  )}
                </div>
              )}

              {/* The one effect of a merge that reaches the annual report: the
                  survivor's budget category governs every workshop that moves,
                  so rooms already counted change column in טבלאות פיבוט. */}
              {takziviDiffers && target && (
                <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-900">
                  <p className="font-medium mb-1">שימי לב — השיוך התקציבי שונה.</p>
                  <p className="text-amber-800">
                    «{org.name}» משויך ל{TAKZIVI_LABELS[org.shiyuchTakzivi] ?? org.shiyuchTakzivi},
                    ו«{target.name}» ל{TAKZIVI_LABELS[target.shiyuchTakzivi] ?? target.shiyuchTakzivi}.
                    אחרי המיזוג כל הסדנאות — גם אלה שכבר בוצעו — ייספרו לפי
                    {" "}{TAKZIVI_LABELS[target.shiyuchTakzivi] ?? target.shiyuchTakzivi},
                    וטבלאות הפיבוט ישתנו בהתאם.
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-500">
                פרטי הארגון הנמחק — איש הקשר וההערות — יישמרו כהערה אצל הארגון המקבל.
                הפעולה אינה הפיכה.
              </p>
            </>
          )}

          {error && <p className="text-red-600">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex items-center gap-3">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {busy ? "מוחק..." : hasHistory ? "מחיקה והעברת ההיסטוריה" : "מחיקת הארגון"}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-40"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
