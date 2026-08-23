"use client"

import { useCallback, useEffect, useState } from "react"
import { TAKZIVI_LABELS } from "@/lib/shiyuch"
import { MONTHS, monthName } from "@/lib/months"
import { useUser } from "../user-context"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnnualData {
  year: number
  today: string
  categories: string[]
  allocations: Record<string, number>
  months: { month: number; byCategory: Record<string, number> }[]
  totals: Record<string, number>
  elapsed: Record<string, number>
}

interface MonthRow {
  id: string
  date: string
  groupName: string
  models: string[]
  actualRooms: number
  countedRooms: number
  countedRoomsOverride: number | null
  shiyuchTakzivi: string
  cancelled: boolean
  cancelLabel: string | null
  pivotNotes: string | null
}

interface MonthData {
  year: number
  month: number
  rows: MonthRow[]
}

/** What the row PATCH echoes back — the server is the authority on all three. */
type RowPatch = Pick<MonthRow, "pivotNotes" | "countedRoomsOverride" | "countedRooms">

/** "סיכום" or a month number. */
type View = "summary" | number

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${String(d.getUTCFullYear()).slice(2)}`
}

function fmtDayMonth(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}`
}

function sum(rec: Record<string, number>, keys: string[]) {
  return keys.reduce((s, k) => s + (rec[k] ?? 0), 0)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PivotPage() {
  const user      = useUser()
  const isManager = user.roles.includes("MANAGER")

  const [years, setYears] = useState([CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2])
  const [year, setYear]   = useState(CURRENT_YEAR)
  const [view, setView]   = useState<View>("summary")

  const [annual, setAnnual]   = useState<AnnualData | null>(null)
  const [monthly, setMonthly] = useState<MonthData | null>(null)
  const [loading, setLoading] = useState(true)

  // The annual grid is a fold over the same rows the monthly view edits, so any
  // row edit invalidates it. Refetched lazily on the way back to סיכום.
  const [annualStale, setAnnualStale] = useState(false)

  // Allocation edit flow — Manager only, deliberate two-step (§8.12)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [editingAlloc, setEditingAlloc] = useState(false)
  const [draftAllocs, setDraftAllocs]   = useState<Record<string, string>>({})
  const [savingAlloc, setSavingAlloc]   = useState(false)

  const [showAddYear, setShowAddYear] = useState(false)
  const [showExport, setShowExport]   = useState(false)
  const nextYear = years[years.length - 1] + 1

  const categories = annual?.categories ?? []

  // ── Fetching ────────────────────────────────────────────────────────────────

  const fetchAnnual = useCallback(async (y: number) => {
    const res  = await fetch(`/api/yaadot?year=${y}`)
    const data: AnnualData = await res.json()
    setAnnual(data)
    setAnnualStale(false)
  }, [])

  const fetchMonth = useCallback(async (y: number, m: number) => {
    const res  = await fetch(`/api/yaadot/month?year=${y}&month=${m}`)
    const data: MonthData = await res.json()
    setMonthly(data)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      // The annual grid is always loaded — the month strip and the totals strip
      // below the monthly table both read from it.
      if (!annual || annual.year !== year || annualStale) await fetchAnnual(year)
      if (typeof view === "number") await fetchMonth(year, view)
      if (!cancelled) setLoading(false)
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, view])

  // Switching year or view abandons any open edit. Done in the handlers rather
  // than an effect so it happens once, on the interaction, not on every render
  // that changes those values.
  function dismissOverlays() {
    setEditingAlloc(false)
    setShowConfirm(false)
    setShowExport(false)
  }
  function selectYear(y: number) { setYear(y); dismissOverlays() }
  function selectView(v: View)   { setView(v); dismissOverlays() }

  // ── Allocation editing ──────────────────────────────────────────────────────

  function onConfirmEdit() {
    if (!annual) return
    const draft: Record<string, string> = {}
    categories.forEach((tv) => { draft[tv] = String(annual.allocations[tv] ?? 0) })
    setDraftAllocs(draft)
    setShowConfirm(false)
    setEditingAlloc(true)
  }

  async function onSaveAlloc() {
    setSavingAlloc(true)
    await Promise.all(
      categories.map((tv) =>
        fetch("/api/yaadot", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year,
            shiyuchTakzivi: tv,
            allocation: Math.max(0, Number(draftAllocs[tv]) || 0),
          }),
        })
      )
    )
    setSavingAlloc(false)
    setEditingAlloc(false)
    setDraftAllocs({})
    await fetchAnnual(year)
  }

  // ── Row editing ─────────────────────────────────────────────────────────────

  /** Returns the saved values, or null if the save failed. */
  async function patchRow(id: string, body: Record<string, unknown>): Promise<RowPatch | null> {
    const res = await fetch(`/api/yaadot/workshops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }))
      alert(error ?? "השמירה נכשלה")
      return null
    }
    const updated: RowPatch = await res.json()
    setMonthly((prev) => prev && {
      ...prev,
      rows: prev.rows.map((r) => (r.id === id ? { ...r, ...updated } : r)),
    })
    setAnnualStale(true)
    return updated
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const rows        = monthly?.rows ?? []
  const monthTotal  = rows.reduce((s, r) => s + r.countedRooms, 0)
  const monthByCat  = categories.reduce<Record<string, number>>((acc, tv) => {
    acc[tv] = rows.filter((r) => r.shiyuchTakzivi === tv).reduce((s, r) => s + r.countedRooms, 0)
    return acc
  }, {})

  const totalAlloc   = annual ? sum(annual.allocations, categories) : 0
  const totalCounted = annual ? sum(annual.totals, categories) : 0
  const totalElapsed = annual ? sum(annual.elapsed, categories) : 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-8 pt-6 pb-4 shrink-0 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">טבלאות פיבוט</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              ניצול חדרים מול הקצאה שנתית, לפי חודש ושיוך תקציבי
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Export */}
            <div className="relative">
              <button
                onClick={() => setShowExport((v) => !v)}
                className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700 transition-colors"
              >
                ייצוא לאקסל
              </button>
              {showExport && (
                <div className="absolute left-0 top-full mt-1 z-10 w-52 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  <a
                    href={`/api/yaadot/export?year=${year}&scope=summary`}
                    onClick={() => setShowExport(false)}
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                  >
                    סיכום בלבד
                    <span className="block text-xs text-gray-400">גיליון אחד</span>
                  </a>
                  <a
                    href={`/api/yaadot/export?year=${year}&scope=full`}
                    onClick={() => setShowExport(false)}
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    מלא
                    <span className="block text-xs text-gray-400">סיכום + 12 חודשים</span>
                  </a>
                </div>
              )}
            </div>

            {/* Year selector */}
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-500 ml-2">שנה:</span>
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => selectYear(y)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    year === y ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {y}
                </button>
              ))}
              {!showAddYear && (
                <button
                  onClick={() => setShowAddYear(true)}
                  className="px-2.5 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                  title={`הוספת שנת ${nextYear}`}
                >
                  +
                </button>
              )}
              {showAddYear && (
                <div className="flex items-center gap-1 mr-1 border border-gray-200 rounded-full px-3 py-1 bg-white shadow-sm">
                  <span className="text-xs text-gray-600">להוסיף {nextYear}?</span>
                  <button
                    onClick={() => { setYears((p) => [...p, nextYear]); setShowAddYear(false) }}
                    className="text-xs font-medium text-navy hover:underline mr-1"
                  >
                    כן
                  </button>
                  <button onClick={() => setShowAddYear(false)} className="text-xs text-gray-400 hover:text-gray-600">
                    ביטול
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Month strip */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => selectView("summary")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              view === "summary" ? "bg-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            סיכום
          </button>
          <span className="w-px h-5 bg-gray-200 mx-1.5" />
          {MONTHS.map((m) => (
            <button
              key={m}
              onClick={() => selectView(m)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                view === m ? "bg-navy text-white font-medium" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {monthName(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Allocation confirmation dialog */}
      {showConfirm && (
        <div className="px-8 pb-4 shrink-0">
          <div className="max-w-3xl border border-amber-200 bg-amber-50 rounded-lg px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-amber-800 font-medium">האם ברצונך לערוך את ערכי היעד השנתי?</p>
            <div className="flex gap-2 shrink-0">
              <button onClick={onConfirmEdit}
                className="px-4 py-1.5 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark transition-colors">
                עריכה
              </button>
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-1.5 border border-gray-300 text-sm text-gray-600 rounded hover:bg-gray-50 transition-colors">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allocation edit action bar */}
      {editingAlloc && (
        <div className="px-8 pb-4 shrink-0">
          <div className="max-w-3xl border border-navy/20 bg-navy/5 rounded-lg px-5 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-navy font-medium">מצב עריכת יעד שנתי</p>
            <div className="flex gap-2 shrink-0">
              <button onClick={onSaveAlloc} disabled={savingAlloc}
                className="px-4 py-1.5 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark disabled:opacity-50 transition-colors">
                {savingAlloc ? "שומר..." : "אישור"}
              </button>
              <button onClick={() => { setEditingAlloc(false); setDraftAllocs({}) }} disabled={savingAlloc}
                className="px-4 py-1.5 border border-gray-300 text-sm text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading || !annual ? (
          <p className="text-sm text-gray-400 py-8 text-center">טוען...</p>
        ) : view === "summary" ? (
          <AnnualGrid
            annual={annual}
            categories={categories}
            isManager={isManager}
            editingAlloc={editingAlloc}
            draftAllocs={draftAllocs}
            setDraftAllocs={setDraftAllocs}
            onOpenConfirm={() => setShowConfirm(true)}
            onPickMonth={(m) => selectView(m)}
            totalAlloc={totalAlloc}
            totalCounted={totalCounted}
            totalElapsed={totalElapsed}
          />
        ) : (
          <MonthTable
            rows={rows}
            categories={categories}
            monthTotal={monthTotal}
            monthByCat={monthByCat}
            onPatchRow={patchRow}
          />
        )}
      </div>
    </div>
  )
}

// ─── Annual grid — the סיכום view ─────────────────────────────────────────────

function AnnualGrid({
  annual, categories, isManager, editingAlloc, draftAllocs, setDraftAllocs,
  onOpenConfirm, onPickMonth, totalAlloc, totalCounted, totalElapsed,
}: {
  annual: AnnualData
  categories: string[]
  isManager: boolean
  editingAlloc: boolean
  draftAllocs: Record<string, string>
  setDraftAllocs: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onOpenConfirm: () => void
  onPickMonth: (m: number) => void
  totalAlloc: number
  totalCounted: number
  totalElapsed: number
}) {
  const now = new Date()
  // A month is "still ahead" only within the current year; a past year has none
  // and a future year is entirely ahead.
  const isFuture = (m: number) =>
    annual.year > now.getFullYear() ||
    (annual.year === now.getFullYear() && m > now.getMonth() + 1)

  const totalRemain = totalAlloc - totalCounted

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-right text-xs text-gray-500 font-medium">
              <th className="px-4 py-2.5">חודש</th>
              {categories.map((tv) => (
                <th key={tv} className="px-4 py-2.5 text-center">
                  {TAKZIVI_LABELS[tv] ?? tv}
                </th>
              ))}
              <th className="px-4 py-2.5 text-center">סה&quot;כ</th>
            </tr>
          </thead>

          <tbody>
            {annual.months.map(({ month, byCategory }) => {
              const rowTotal = sum(byCategory, categories)
              const ahead    = isFuture(month)
              return (
                <tr
                  key={month}
                  onClick={() => onPickMonth(month)}
                  className={`border-b border-gray-100 last:border-0 cursor-pointer hover:bg-navy/5 transition-colors ${
                    ahead ? "text-gray-400" : "text-gray-700"
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium">{monthName(month)}</td>
                  {categories.map((tv) => (
                    <td key={tv} className="px-4 py-2.5 text-center">{byCategory[tv] ?? 0}</td>
                  ))}
                  <td className="px-4 py-2.5 text-center font-semibold">{rowTotal}</td>
                </tr>
              )
            })}
          </tbody>

          <tfoot>
            {/* סה"כ */}
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-800">
              <td className="px-4 py-2.5">סה&quot;כ</td>
              {categories.map((tv) => (
                <td key={tv} className="px-4 py-2.5 text-center">{annual.totals[tv] ?? 0}</td>
              ))}
              <td className="px-4 py-2.5 text-center">{totalCounted}</td>
            </tr>

            {/* יעד שנתי */}
            <tr className="bg-gray-50 border-t border-gray-200 text-gray-700">
              <td className="px-4 py-2.5 font-medium">
                {isManager ? (
                  <button
                    onClick={onOpenConfirm}
                    disabled={editingAlloc}
                    className="hover:text-navy transition-colors disabled:pointer-events-none"
                    title="לחץ לעריכת היעד השנתי"
                  >
                    יעד שנתי<span className="mr-1">✎</span>
                  </button>
                ) : (
                  "יעד שנתי"
                )}
              </td>
              {categories.map((tv) => (
                <td key={tv} className="px-4 py-2 text-center">
                  {editingAlloc ? (
                    <input
                      type="number"
                      min={0}
                      value={draftAllocs[tv] ?? ""}
                      onChange={(e) =>
                        setDraftAllocs((prev) => ({ ...prev, [tv]: e.target.value }))
                      }
                      className="w-20 border border-navy/40 rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                      autoFocus={tv === categories[0]}
                    />
                  ) : (
                    <span className="font-medium">{annual.allocations[tv] ?? 0}</span>
                  )}
                </td>
              ))}
              <td className="px-4 py-2.5 text-center font-semibold">{totalAlloc}</td>
            </tr>

            {/* נותרו */}
            <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-800">
              <td className="px-4 py-2.5">נותרו</td>
              {categories.map((tv) => {
                const remain = (annual.allocations[tv] ?? 0) - (annual.totals[tv] ?? 0)
                return (
                  <td key={tv} dir="ltr"
                    className={`px-4 py-2.5 text-center ${remain < 0 ? "text-red-600" : ""}`}>
                    {remain}
                  </td>
                )
              })}
              <td dir="ltr"
                className={`px-4 py-2.5 text-center ${totalRemain < 0 ? "text-red-600" : ""}`}>
                {totalRemain}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-sm text-gray-500">
        חדרים שנוצלו עד {fmtDayMonth(annual.today)}:{" "}
        <span className="font-semibold text-gray-700 tabular-nums">{totalElapsed}</span>
        <span className="text-gray-400">
          {" "}מתוך {totalCounted} בכל השנה
        </span>
      </p>
      <p className="text-xs text-gray-400">לחיצה על שורת חודש פותחת את הפירוט שלו.</p>
    </div>
  )
}

// ─── Monthly detail table ─────────────────────────────────────────────────────

function MonthTable({
  rows, categories, monthTotal, monthByCat, onPatchRow,
}: {
  rows: MonthRow[]
  categories: string[]
  monthTotal: number
  monthByCat: Record<string, number>
  onPatchRow: (id: string, body: Record<string, unknown>) => Promise<RowPatch | null>
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">אין סדנאות בחודש זה.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-right text-xs text-gray-500 font-medium">
              <th className="px-4 py-2.5 whitespace-nowrap">תאריך</th>
              <th className="px-4 py-2.5">שם הקבוצה</th>
              <th className="px-4 py-2.5">מודל</th>
              <th className="px-4 py-2.5 text-center whitespace-nowrap">חדרים בפועל</th>
              <th className="px-4 py-2.5 text-center whitespace-nowrap">חדרים לספירה</th>
              <th className="px-4 py-2.5 whitespace-nowrap">שיוך תקציבי</th>
              <th className="px-4 py-2.5 whitespace-nowrap">ביטול</th>
              <th className="px-4 py-2.5">הערות</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <MonthRowCells key={r.id} row={r} onPatchRow={onPatchRow} />
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-800">
              <td className="px-4 py-2.5" colSpan={4}>סה&quot;כ</td>
              <td className="px-4 py-2.5 text-center tabular-nums">{monthTotal}</td>
              <td className="px-4 py-2.5" colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Per-category strip — the four numbers the annual grid is built from */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500">
        {categories.map((tv) => (
          <span key={tv}>
            {TAKZIVI_LABELS[tv] ?? tv}:{" "}
            <span className="font-semibold text-gray-700 tabular-nums">{monthByCat[tv] ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function MonthRowCells({
  row, onPatchRow,
}: {
  row: MonthRow
  onPatchRow: (id: string, body: Record<string, unknown>) => Promise<RowPatch | null>
}) {
  const [counted, setCounted] = useState(String(row.countedRooms))
  const [notes, setNotes]     = useState(row.pivotNotes ?? "")

  // Each field re-seeds itself from whatever the save returned — clearing the
  // override, for instance, comes back as the recomputed default rather than the
  // empty string that was typed. A failed save falls back to the last good value.
  async function commitCounted() {
    const trimmed = counted.trim()

    // Empty clears the override and hands the row back to the computed default.
    if (trimmed === "") {
      if (row.countedRoomsOverride === null) { setCounted(String(row.countedRooms)); return }
      const saved = await onPatchRow(row.id, { countedRoomsOverride: null })
      setCounted(String((saved ?? row).countedRooms))
      return
    }

    const n = Number(trimmed)
    if (!Number.isInteger(n) || n < 0) { setCounted(String(row.countedRooms)); return }
    if (n === row.countedRooms) { setCounted(String(row.countedRooms)); return }

    const saved = await onPatchRow(row.id, { countedRoomsOverride: n })
    setCounted(String((saved ?? row).countedRooms))
  }

  async function commitNotes() {
    const next = notes.trim()
    if (next === (row.pivotNotes ?? "")) { setNotes(row.pivotNotes ?? ""); return }
    const saved = await onPatchRow(row.id, { pivotNotes: next })
    setNotes((saved ?? row).pivotNotes ?? "")
  }

  const strike = row.cancelled ? "line-through" : ""

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 align-top">
      <td className={`px-4 py-2.5 whitespace-nowrap text-gray-600 tabular-nums ${strike}`}>
        {fmtDate(row.date)}
      </td>
      <td className={`px-4 py-2.5 font-medium text-gray-800 ${strike}`}>{row.groupName}</td>
      <td className={`px-4 py-2.5 text-gray-500 ${strike}`}>{row.models.join(", ") || "—"}</td>
      <td className={`px-4 py-2.5 text-center text-gray-500 tabular-nums ${strike}`}>
        {row.actualRooms}
      </td>

      {/* חדרים לספירה — editable, saves on blur */}
      <td className="px-4 py-2 text-center">
        <input
          type="number"
          min={0}
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          onBlur={commitCounted}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
          title={
            row.countedRoomsOverride !== null
              ? "ערך שהוזן ידנית. ניקוי השדה מחזיר לברירת המחדל"
              : "ברירת מחדל מחושבת"
          }
          className={`w-16 rounded px-2 py-1 text-center text-sm tabular-nums border transition-colors focus:outline-none focus:ring-2 focus:ring-navy/30 ${
            row.countedRoomsOverride !== null
              ? "border-navy/40 text-navy font-semibold"
              : "border-transparent hover:border-gray-300 text-gray-700"
          }`}
        />
      </td>

      <td className={`px-4 py-2.5 text-gray-600 whitespace-nowrap ${strike}`}>
        {TAKZIVI_LABELS[row.shiyuchTakzivi] ?? row.shiyuchTakzivi}
      </td>

      {/* ביטול — computed, never editable */}
      <td className="px-4 py-2.5 whitespace-nowrap">
        {row.cancelLabel && (
          <span className="inline-block px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium">
            {row.cancelLabel}
          </span>
        )}
      </td>

      {/* הערות — free text, saves on blur */}
      <td className="px-4 py-2">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitNotes}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
          placeholder="—"
          className="w-full min-w-40 rounded px-2 py-1 text-sm border border-transparent hover:border-gray-300 text-gray-700 placeholder:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-navy/30"
        />
      </td>
    </tr>
  )
}
