"use client"

// The facilitator-deck screen — spec §14 F-06.
//
// A Tech arrives from a workshop's rooms card. One workshop, two parts:
//
// 1. תוכן — the text every deck for the workshop is made from: the cover's
//    names, the schedule and one text per scenario. The Word files are read
//    here in the browser — they never leave it — into editable fields. Saved
//    on the workshop, so it is entered once and there on the next visit. Only
//    the fields some facilitator's template uses are shown.
// 2. מצגות — one row per facilitator slotted to the workshop: their deck's
//    state, generate (one, or everyone with a template), download, and the
//    room's מצגת box — the same box as on the rooms card.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { readDocxBlocks, parseSchedule, parseScenario, type ScheduleRow } from "@/lib/deck/docx"
import { downloadFile, type DeckFileMeta } from "@/lib/deck/transfer"
import { EMPTY_CONTENT, emptyFields, fieldsFor, type DeckContent, type ScenarioText } from "@/lib/deck/content"
import { pptBlockReason } from "@/lib/room-ppt"
import { shortDate } from "@/lib/actor-training"
import { useUser } from "@/app/(app)/user-context"

type WorkshopOption = {
  id: string; date: string; startTime: string; organization: string; group: string; facilitators: number; decks: number
}
type FacilitatorRow = {
  roomId: string
  roomNumber: number
  facilitatorId: string
  name: string
  tentative: boolean
  pptReceived: boolean
  template: { id: string; fileName: string; tokens: string[] } | null
  deck: DeckFileMeta | null
}
type WorkshopState = {
  id: string; date: string; dateIso: string; startTime: string; organization: string; group: string
  topics: string[]
  scenarios: { id: string; name: string | null; topic: string }[]
  allScenariosWritten: boolean
  blockReason: string | null
  content: DeckContent
  contentUpdatedAt: string | null
  facilitators: FacilitatorRow[]
}

const card = "border border-gray-200 rounded-lg overflow-hidden"
const cardHead = "bg-gray-50 border-b border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 flex items-center justify-between gap-3"
const primary = "px-3 py-1.5 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
const quiet = "px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
const field = "border border-gray-300 rounded px-3 py-2 text-sm"
const input = `${field} w-full`

/** D.M.YY in local time — the house date format. */
function localShortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}
function localTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
}
const without = (o: Record<string, string>, key: string) => { const n = { ...o }; delete n[key]; return n }

export function DeckStudio({ workshopId }: { workshopId: string | null }) {
  return workshopId ? <WorkshopDecks workshopId={workshopId} /> : <WorkshopPicker />
}

// ─── Without a workshop: pick one ────────────────────────────────────────────

function WorkshopPicker() {
  const router = useRouter()
  const [workshops, setWorkshops] = useState<WorkshopOption[] | null>(null)
  useEffect(() => {
    fetch("/api/matzgot").then((r) => (r.ok ? r.json() : { workshops: [] })).then((b) => setWorkshops(b.workshops))
  }, [])
  if (!workshops) return <div className="p-8 text-sm text-gray-400">טוען...</div>
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4" dir="rtl">
      <h1 className="text-xl font-bold text-gray-900">מצגות מתחקרים</h1>
      <p className="text-sm text-gray-500">בדרך כלל מגיעים לכאן מכפתור ״מצגות מתחקרים״ בדף הסדנה.</p>
      <select defaultValue="" onChange={(e) => e.target.value && router.push(`/matzgot?workshop=${e.target.value}`)} className={input}>
        <option value="">בחירת סדנה...</option>
        {workshops.map((w) => (
          <option key={w.id} value={w.id}>
            {shortDate(w.date)} · {w.organization} – {w.group}
            {w.facilitators > 0 ? ` · ${w.decks}/${w.facilitators} מצגות` : ""}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── One workshop ────────────────────────────────────────────────────────────

function WorkshopDecks({ workshopId }: { workshopId: string }) {
  const router = useRouter()
  const user = useUser()
  const isManager = user.roles.includes("MANAGER")

  const [w, setW] = useState<WorkshopState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [content, setContent] = useState<DeckContent>(EMPTY_CONTENT)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scenarioWarnings, setScenarioWarnings] = useState<Record<string, string[]>>({})

  // Per facilitator: what is in progress, and the last error.
  const [busy, setBusy] = useState<Record<string, string>>({})
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const [bulk, setBulk] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/matzgot/workshops/${workshopId}`)
    if (!res.ok) { setLoadError(res.status === 404 ? "הסדנה לא נמצאה" : "הטעינה נכשלה"); return }
    const b = (await res.json()) as WorkshopState
    setW(b)
    setContent(b.content)
    setSavedAt(b.contentUpdatedAt)
    setDirty(false)
  }, [workshopId])
  useEffect(() => { load() }, [load])

  // Unsaved text is easy to lose by navigating away; the browser asks first.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const edit = (patch: Partial<DeckContent>) => { setContent((c) => ({ ...c, ...patch })); setDirty(true) }
  const setRow = (i: number, patch: Partial<ScheduleRow>) =>
    edit({ schedule: content.schedule.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const scenarioOf = (id: string): ScenarioText =>
    content.scenarios.find((s) => s.scenarioId === id) ?? { scenarioId: id, title: "", body: "", fileName: null }
  const setScenario = (id: string, patch: Partial<ScenarioText>) => {
    setContent((c) => ({
      ...c,
      scenarios: c.scenarios.some((s) => s.scenarioId === id)
        ? c.scenarios.map((s) => (s.scenarioId === id ? { ...s, ...patch } : s))
        : [...c.scenarios, { scenarioId: id, title: "", body: "", fileName: null, ...patch }],
    }))
    setDirty(true)
  }

  const withTemplate = useMemo(() => (w?.facilitators ?? []).filter((f) => f.template), [w])
  const tokenSets = useMemo(() => withTemplate.map((f) => f.template!.tokens), [withTemplate])
  const fields = useMemo(() => fieldsFor(tokenSets), [tokenSets])
  const usesTopics = tokenSets.some((t) => t.includes("topics"))
  const usesDate = tokenSets.some((t) => t.includes("date"))

  async function onScheduleFile(file: File | undefined) {
    if (!file) return
    try {
      const rows = parseSchedule(await readDocxBlocks(await file.arrayBuffer()))
      edit({ schedule: rows, scheduleFileName: file.name })
      setScheduleError(rows.length === 0 ? "לא נמצאו בקובץ שורות עם טווח שעות — אפשר להוסיף ידנית" : null)
    } catch {
      setScheduleError("לא ניתן לקרוא את קובץ לוח הזמנים — האם זה קובץ Word ‏(‎.docx‎)?")
    }
  }

  async function onScenarioFile(id: string, file: File | undefined) {
    if (!file) return
    try {
      const s = parseScenario(await readDocxBlocks(await file.arrayBuffer()))
      setScenario(id, { fileName: file.name, title: s.title, body: s.body.join("\n") })
      setScenarioWarnings((p) => ({ ...p, [id]: s.warnings }))
    } catch {
      setScenarioWarnings((p) => ({ ...p, [id]: ["לא ניתן לקרוא את הקובץ — האם זה קובץ Word ‏(‎.docx‎)?"] }))
    }
  }

  async function save(): Promise<boolean> {
    setSaving(true)
    setSaveError(null)
    const res = await fetch(`/api/matzgot/workshops/${workshopId}/content`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    })
    setSaving(false)
    if (!res.ok) { setSaveError("השמירה נכשלה"); return false }
    const b = await res.json()
    setSavedAt(b.updatedAt)
    setDirty(false)
    return true
  }

  async function generate(targets: FacilitatorRow[]) {
    if (!w || targets.length === 0) return
    // Empty fields are allowed — they come out empty — but usually mean a file
    // nobody uploaded, so say which before generating.
    const scenarioIds = w.scenarios.map((s) => s.id)
    const empty = [...new Set(targets.flatMap((f) => emptyFields(content, scenarioIds, f.template!.tokens)))]
    if (empty.length > 0) {
      const ok = window.confirm(`השדות הבאים ריקים, ויופיעו ריקים במצגת:\n\n• ${empty.join("\n• ")}\n\nליצור בכל זאת?`)
      if (!ok) return
    }
    // The server generates from the saved text, so save what is on screen first.
    if (dirty && !(await save())) return

    setBulk(targets.length > 1)
    // One request per deck: each is 2–4 MB of work, and a Vercel function has
    // its own time and size limits.
    for (const f of targets) {
      setBusy((p) => ({ ...p, [f.facilitatorId]: "יוצר..." }))
      setRowError((p) => without(p, f.facilitatorId))
      const res = await fetch("/api/matzgot/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workshopId: w.id, facilitatorId: f.facilitatorId }),
      })
      const b = await res.json().catch(() => null)
      if (res.ok) {
        setW((prev) => prev && {
          ...prev,
          facilitators: prev.facilitators.map((x) => (x.facilitatorId === f.facilitatorId ? { ...x, deck: b.deck } : x)),
        })
      } else {
        setRowError((p) => ({ ...p, [f.facilitatorId]: b?.error ?? "יצירת המצגת נכשלה" }))
      }
      setBusy((p) => without(p, f.facilitatorId))
    }
    setBulk(false)
  }

  async function download(f: FacilitatorRow) {
    if (!f.deck) return
    setRowError((p) => without(p, f.facilitatorId))
    try {
      await downloadFile(f.deck, (done, total) => setBusy((p) => ({ ...p, [f.facilitatorId]: `מוריד ${done}/${total}` })))
    } catch (e) {
      setRowError((p) => ({ ...p, [f.facilitatorId]: (e as Error).message }))
    }
    setBusy((p) => without(p, f.facilitatorId))
  }

  // The room's מצגת box — the same field as on the rooms card, under the same
  // rules. Ticking it can move the workshop's status, so the router cache is
  // refreshed after.
  async function togglePpt(f: FacilitatorRow, next: boolean) {
    setRowError((p) => without(p, f.facilitatorId))
    const res = await fetch(`/api/sadnaot/${workshopId}/rooms/${f.roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pptReceived: next }),
    })
    const b = await res.json().catch(() => null)
    if (!res.ok) { setRowError((p) => ({ ...p, [f.facilitatorId]: b?.error ?? "השמירה נכשלה" })); return }
    setW((prev) => prev && {
      ...prev,
      facilitators: prev.facilitators.map((x) => (x.roomId === f.roomId ? { ...x, pptReceived: b.pptReceived } : x)),
    })
    router.refresh()
  }

  if (loadError) return <div className="p-8 text-sm text-red-600" dir="rtl">{loadError}</div>
  if (!w) return <div className="p-8 text-sm text-gray-400">טוען...</div>

  const anyBusy = bulk || Object.keys(busy).length > 0

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">מצגות מתחקרים</h1>
          <p className="text-sm text-gray-600 mt-1">{w.date} · {w.organization} – {w.group}</p>
        </div>
        <Link href={`/sadnaot/${w.id}`} className="text-sm text-navy hover:underline shrink-0">← חזרה לסדנה</Link>
      </div>

      {w.blockReason ? (
        <p className="text-sm text-gray-500">{w.blockReason} — אין ממה ליצור מצגות.</p>
      ) : (
        <>
          {/* 1 · Content */}
          <section className={card}>
            <div className={cardHead}>
              <span>1 · תוכן</span>
              <span className="text-xs font-normal text-gray-400">
                {dirty ? <span className="text-amber-700">יש שינויים שלא נשמרו</span>
                  : savedAt ? `נשמר ${localShortDate(savedAt)} ${localTime(savedAt)}` : ""}
              </span>
            </div>
            <div className="px-5 py-4 space-y-6 text-sm">
              {withTemplate.length === 0 ? (
                <p className="text-gray-500">
                  לאף מתחקר/ת בסדנה אין תבנית מצגת, ולכן אין מה למלא.
                  {isManager && <> אפשר להעלות תבניות ב<Link href="/settings" className="text-navy hover:underline">הגדרות</Link>.</>}
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-400">התוכן נשמר לסדנה ומשמש את המצגות של כל המתחקרים. שדה ריק יופיע ריק במצגת.</p>

                  {(fields.cover || usesDate || usesTopics) && (
                    <div className="space-y-2">
                      {fields.cover && (
                        <div className="space-y-1">
                          <div className="font-medium text-gray-700">שקף הפתיחה <span className="text-gray-400 font-normal">(אפשר לתקן — לא משנה את ה-CRM)</span></div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input value={content.organization} onChange={(e) => edit({ organization: e.target.value })}
                              placeholder={w.organization} className={`${field} flex-1 min-w-48`} />
                            <span className="text-gray-400">–</span>
                            <input value={content.group} onChange={(e) => edit({ group: e.target.value })}
                              placeholder={w.group} className={`${field} flex-1 min-w-48`} />
                          </div>
                        </div>
                      )}
                      {usesDate && <div className="text-gray-600">תאריך: <span className="text-gray-900">{w.date}</span></div>}
                      {usesTopics && <div className="text-gray-600">נושאים: <span className="text-gray-900">{w.topics.join(" · ") || "—"}</span></div>}
                    </div>
                  )}

                  {fields.schedule && (
                    <div className="space-y-2 border-t border-gray-100 pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-700">לוח זמנים</span>
                        <label className={`${quiet} cursor-pointer`}>
                          {content.scheduleFileName ? "קובץ אחר" : "בחירת קובץ Word"}
                          <input type="file" accept=".docx" className="hidden"
                            onChange={(e) => { onScheduleFile(e.target.files?.[0]); e.target.value = "" }} />
                        </label>
                      </div>
                      {content.scheduleFileName && <p className="text-xs text-gray-400">{content.scheduleFileName}</p>}
                      {content.schedule.map((r, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <textarea value={r.activity} onChange={(e) => setRow(i, { activity: e.target.value })}
                            rows={Math.max(1, r.activity.split("\n").length)} className={`${field} flex-1 min-w-0`} />
                          <input value={r.time} onChange={(e) => setRow(i, { time: e.target.value })} dir="ltr"
                            className={`${field} w-32 shrink-0 text-center`} />
                          <button onClick={() => edit({ schedule: content.schedule.filter((_, j) => j !== i) })}
                            className="px-2 py-2 text-gray-400 hover:text-red-600" title="מחיקת שורה">✕</button>
                        </div>
                      ))}
                      <button onClick={() => edit({ schedule: [...content.schedule, { activity: "", time: "" }] })}
                        className="text-xs text-navy hover:underline">
                        + הוספת שורה
                      </button>
                      {scheduleError && <p className="text-red-600">{scheduleError}</p>}
                    </div>
                  )}

                  {fields.scenarios && (
                    <>
                      <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
                        עיצוב בתרחישים: <span dir="ltr">*מודגש*</span> · <span dir="ltr">_קו תחתון_</span>
                      </p>
                      {w.scenarios.map((crm, i) => {
                        const s = scenarioOf(crm.id)
                        return (
                          <div key={crm.id} className="space-y-2 border-t border-gray-100 pt-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-gray-700">
                                תרחיש {i + 1}
                                {crm.name ? ` — ${crm.name}` : ""} <span className="text-gray-400 font-normal">· {crm.topic}</span>
                              </span>
                              <label className={`${quiet} cursor-pointer shrink-0`}>
                                {s.fileName ? "קובץ אחר" : "בחירת קובץ Word"}
                                <input type="file" accept=".docx" className="hidden"
                                  onChange={(e) => { onScenarioFile(crm.id, e.target.files?.[0]); e.target.value = "" }} />
                              </label>
                            </div>
                            {s.fileName && <p className="text-xs text-gray-400">{s.fileName}</p>}
                            {(scenarioWarnings[crm.id] ?? []).map((x) => <p key={x} className="text-xs text-amber-700">{x}</p>)}
                            <input value={s.title} onChange={(e) => setScenario(crm.id, { title: e.target.value })}
                              placeholder="שם התרחיש" className={`${input} font-semibold`} />
                            <textarea value={s.body} onChange={(e) => setScenario(crm.id, { body: e.target.value })}
                              placeholder="תקציר — כל שורה היא פסקה בשקף" rows={Math.min(14, Math.max(4, s.body.split("\n").length + 1))}
                              className={input} />
                          </div>
                        )
                      })}
                    </>
                  )}

                  <div className="flex items-center justify-end gap-3">
                    {saveError && <span className="text-red-600">{saveError}</span>}
                    <button onClick={save} disabled={saving || !dirty} className={quiet}>
                      {saving ? "שומר..." : "שמירת התוכן"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 2 · Decks */}
          <section className={card}>
            <div className={cardHead}>
              <span>2 · מצגות</span>
              <button onClick={() => generate(withTemplate)} disabled={anyBusy || withTemplate.length === 0}
                className={primary.replace("text-sm", "text-xs")}>
                {bulk ? "יוצר..." : "צור לכל מי שיש לו תבנית"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="py-2 px-3 font-medium">חדר</th>
                    <th className="py-2 px-3 font-medium">מתחקר/ת</th>
                    <th className="py-2 px-3 font-medium">מצב</th>
                    <th className="py-2 px-3 font-medium"></th>
                    <th className="py-2 px-3 font-medium text-center">מצגת</th>
                  </tr>
                </thead>
                <tbody>
                  {w.facilitators.map((f) => {
                    const block = pptBlockReason({
                      facilitatorId: f.facilitatorId, workshopDate: w.dateIso, allScenariosWritten: w.allScenariosWritten,
                    })
                    const rowBusy = busy[f.facilitatorId]
                    return (
                      <tr key={f.roomId} className="border-t border-gray-100 align-top">
                        <td className="py-2 px-3 whitespace-nowrap">חדר {f.roomNumber}</td>
                        <td className="py-2 px-3">
                          {f.name}
                          {f.tentative && <span className="mr-1 px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">?</span>}
                        </td>
                        <td className="py-2 px-3">
                          {!f.template ? <span className="text-gray-400">אין תבנית</span>
                            : !f.deck ? <span className="text-gray-500">טרם נוצרה</span>
                            : <span className="text-gray-700">
                                נוצרה {localShortDate(f.deck.createdAt)}
                                {f.deck.generatedByName && <span className="text-gray-400"> · {f.deck.generatedByName}</span>}
                              </span>}
                          {rowError[f.facilitatorId] && <div className="text-xs text-red-600 mt-1">{rowError[f.facilitatorId]}</div>}
                        </td>
                        <td className="py-2 px-3">
                          {f.template && (
                            <div className="flex flex-wrap gap-2 justify-end">
                              {rowBusy ? <span className="text-xs text-gray-500 py-1.5">{rowBusy}</span> : (
                                <>
                                  {f.deck && (
                                    <button onClick={() => download(f)} disabled={anyBusy} className={primary}>הורדה</button>
                                  )}
                                  <button onClick={() => generate([f])} disabled={anyBusy} className={quiet}>
                                    {f.deck ? "צור מחדש" : "צור"}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span title={block ?? undefined} className="inline-block">
                            <input type="checkbox" checked={f.pptReceived} disabled={!!block}
                              onChange={(e) => !block && togglePpt(f, e.target.checked)}
                              className={`w-4 h-4 accent-navy ${block ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`} />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
              יצירה מחדש מחליפה את המצגת הקודמת של אותו/ה מתחקר/ת. תיבת ״מצגת״ היא אותה תיבה שבדף הסדנה — מסמנים אחרי שבודקים שהמצגת תקינה.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
