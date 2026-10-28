"use client"

// The facilitator-deck generator screen — spec §14 F-06.
//
// 1. The template: the pilot's own deck with {{tokens}}, replaced at will.
// 2. A workshop: cover details and topics come from the CRM.
// 3. The inputs: the schedule .docx and one .docx per scenario are read here in
//    the browser — the files never leave it — into an editable preview.
// 4. Generate on the server, download, and optionally share with the Techs.

import { useCallback, useEffect, useState } from "react"
import { readDocxBlocks, parseSchedule, parseScenario, type ScheduleRow } from "@/lib/deck/docx"
import { downloadFile, formatSize, uploadTemplate, type DeckFileMeta } from "@/lib/deck/transfer"
import { shortDate } from "@/lib/actor-training"

type WorkshopOption = {
  id: string; date: string; startTime: string; organization: string; group: string; hasDeck: boolean; shared: boolean
}
type WorkshopDetail = {
  id: string; date: string; startTime: string; organization: string; group: string
  topics: string[]
  scenarios: { id: string; name: string | null; topic: string }[]
  deck: DeckFileMeta | null
}
// One per scenario slide — exactly the workshop's active CRM scenarios, in order.
type ScenarioInput = {
  key: string
  crm: { name: string | null; topic: string }
  fileName: string | null; title: string; body: string; warnings: string[]
}
const blankScenario = (key: string, crm: ScenarioInput["crm"]): ScenarioInput =>
  ({ key, crm, fileName: null, title: "", body: "", warnings: [] })

const card = "border border-gray-200 rounded-lg overflow-hidden"
const cardHead = "bg-gray-50 border-b border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700"
const button = "px-4 py-2 bg-navy text-white text-sm font-medium rounded hover:bg-navy-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
const quiet = "px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-40"
const field = "border border-gray-300 rounded px-3 py-2 text-sm"
const input = `${field} w-full`

function when(iso: string) {
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })
}

export function DeckStudio() {
  const [template, setTemplate] = useState<DeckFileMeta | null>(null)
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)

  const [workshopId, setWorkshopId] = useState("")
  const [workshop, setWorkshop] = useState<WorkshopDetail | null>(null)
  const [icebreaker, setIcebreaker] = useState("")
  const [scheduleFile, setScheduleFile] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])
  const [scenarios, setScenarios] = useState<ScenarioInput[]>([])

  const [generating, setGenerating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [unresolved, setUnresolved] = useState<string[]>([])
  const [deck, setDeck] = useState<DeckFileMeta | null>(null)
  const [deckBusy, setDeckBusy] = useState<string | null>(null)
  const [deckError, setDeckError] = useState<string | null>(null)

  const loadOverview = useCallback(() =>
    fetch("/api/matzgot")
      .then((res) => (res.ok ? res.json() : null))
      .then((b) => {
        if (b) { setTemplate(b.template); setWorkshops(b.workshops) }
        setLoading(false)
      }), [])
  useEffect(() => { loadOverview() }, [loadOverview])

  async function pickWorkshop(id: string) {
    setWorkshopId(id)
    setWorkshop(null)
    setIcebreaker("")
    setScheduleFile(null)
    setSchedule([])
    setScenarios([])
    setFormError(null)
    setScheduleError(null)
    setUnresolved([])
    setDeck(null)
    setDeckError(null)
    if (!id) return
    const res = await fetch(`/api/matzgot/workshops/${id}`)
    if (!res.ok) { setFormError("טעינת הסדנה נכשלה"); return }
    const w = (await res.json()) as WorkshopDetail
    setWorkshop(w)
    setDeck(w.deck)
    setScenarios(w.scenarios.map((s) => blankScenario(s.id, { name: s.name, topic: s.topic })))
  }

  async function onTemplate(file: File | undefined) {
    if (!file) return
    setTemplateError(null)
    try {
      const meta = await uploadTemplate(file, (done, total) => setUploadProgress(`${done}/${total}`))
      setTemplate(meta)
    } catch (e) {
      setTemplateError((e as Error).message)
    }
    setUploadProgress(null)
  }

  async function onScheduleFile(file: File | undefined) {
    if (!file) return
    try {
      const rows = parseSchedule(await readDocxBlocks(await file.arrayBuffer()))
      setSchedule(rows)
      setScheduleFile(file.name)
      setScheduleError(rows.length === 0 ? "לא נמצאו בקובץ שורות עם טווח שעות — אפשר להוסיף ידנית" : null)
    } catch {
      setScheduleError("לא ניתן לקרוא את קובץ לוח הזמנים — האם זה קובץ Word ‏(‎.docx‎)?")
    }
  }

  async function onScenarioFile(i: number, file: File | undefined) {
    if (!file) return
    try {
      const s = parseScenario(await readDocxBlocks(await file.arrayBuffer()))
      setScenarios((prev) => prev.map((x, j) => (j === i
        ? { ...x, fileName: file.name, title: s.title, body: s.body.join("\n"), warnings: s.warnings }
        : x)))
    } catch {
      setScenarios((prev) => prev.map((x, j) => (j === i
        ? { ...x, fileName: file.name, warnings: ["לא ניתן לקרוא את הקובץ — האם זה קובץ Word ‏(‎.docx‎)?"] }
        : x)))
    }
  }

  const setRow = (i: number, patch: Partial<ScheduleRow>) =>
    setSchedule((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const setScenario = (i: number, patch: Partial<ScenarioInput>) =>
    setScenarios((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  async function generate() {
    if (!workshop) return
    const problems: string[] = []
    if (!template) problems.push("אין תבנית")
    if (schedule.length === 0) problems.push("לוח הזמנים ריק")
    scenarios.forEach((s, i) => {
      if (!s.title.trim() || !s.body.trim()) problems.push(`בתרחיש ${i + 1} חסרים שם או תקציר`)
    })
    if (problems.length) { setFormError(problems.join(" · ")); return }

    setGenerating(true)
    setFormError(null)
    const res = await fetch("/api/matzgot/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workshopId: workshop.id,
        icebreakerQuestion: icebreaker,
        schedule,
        scenarios: scenarios.map((s) => ({ title: s.title, body: s.body.split("\n") })),
      }),
    })
    const b = await res.json().catch(() => null)
    setGenerating(false)
    if (!res.ok) { setFormError(b?.error ?? "יצירת המצגת נכשלה"); return }
    setDeck(b.deck)
    setUnresolved(b.unresolved ?? [])
    loadOverview()
  }

  async function download() {
    if (!deck) return
    setDeckError(null)
    try {
      await downloadFile(deck, (done, total) => setDeckBusy(`מוריד ${done}/${total}`))
    } catch (e) {
      setDeckError((e as Error).message)
    }
    setDeckBusy(null)
  }

  async function toggleShare() {
    if (!deck) return
    setDeckBusy("שומר...")
    setDeckError(null)
    const res = await fetch(`/api/matzgot/files/${deck.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shared: !deck.sharedAt }),
    })
    if (res.ok) { setDeck(await res.json()); loadOverview() }
    else setDeckError("השמירה נכשלה")
    setDeckBusy(null)
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">טוען...</div>

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">מצגות מתחקר</h1>
        <p className="text-sm text-gray-500 mt-1">גרסת ניסיון — המסך גלוי רק לך.</p>
      </div>

      {/* 1 · Template */}
      <section className={card}>
        <div className={cardHead}>1 · התבנית</div>
        <div className="px-5 py-4 space-y-3 text-sm">
          {template ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-gray-800 font-medium">{template.fileName}</span>
              <span className="text-gray-400"><span dir="ltr">{formatSize(template.size)}</span> · הועלתה {when(template.createdAt)}</span>
            </div>
          ) : (
            <p className="text-gray-500">עדיין לא הועלתה תבנית.</p>
          )}
          <label className={`${quiet} inline-block cursor-pointer`}>
            {uploadProgress ? `מעלה ${uploadProgress}...` : template ? "החלפת תבנית" : "העלאת תבנית"}
            <input type="file" accept=".pptx" className="hidden" disabled={!!uploadProgress}
              onChange={(e) => { onTemplate(e.target.files?.[0]); e.target.value = "" }} />
          </label>
          {templateError && <p className="text-red-600">{templateError}</p>}
        </div>
      </section>

      {/* 2 · Workshop */}
      <section className={card}>
        <div className={cardHead}>2 · הסדנה</div>
        <div className="px-5 py-4 space-y-3 text-sm">
          <select value={workshopId} onChange={(e) => pickWorkshop(e.target.value)} className={input}>
            <option value="">בחירת סדנה...</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {shortDate(w.date)} · {w.organization} – {w.group}
                {w.hasDeck ? (w.shared ? " · ✓ מצגת (משותפת)" : " · ✓ מצגת") : ""}
              </option>
            ))}
          </select>
          {workshop && (
            <div className="text-gray-600 space-y-1">
              <div>בשקף הפתיחה: <span className="text-gray-900">{workshop.organization} – {workshop.group}</span> · <span className="text-gray-900">{workshop.date}</span></div>
              <div>נושאים: <span className="text-gray-900">{workshop.topics.join(" · ") || "—"}</span></div>
            </div>
          )}
        </div>
      </section>

      {workshop && (
        <>
          {/* 3 · Inputs and preview */}
          <section className={card}>
            <div className={cardHead}>3 · תוכן</div>
            <div className="px-5 py-4 space-y-6 text-sm">
              <div className="space-y-1">
                <label className="font-medium text-gray-700">שאלת שבירת קרח <span className="text-gray-400 font-normal">(לא חובה — ריק = בלי שאלה)</span></label>
                <input value={icebreaker} onChange={(e) => setIcebreaker(e.target.value)} className={input} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-700">לוח זמנים</span>
                  <label className={`${quiet} cursor-pointer`}>
                    {scheduleFile ? "קובץ אחר" : "בחירת קובץ Word"}
                    <input type="file" accept=".docx" className="hidden"
                      onChange={(e) => { onScheduleFile(e.target.files?.[0]); e.target.value = "" }} />
                  </label>
                </div>
                {scheduleFile && <p className="text-xs text-gray-400">{scheduleFile}</p>}
                {schedule.map((r, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <textarea value={r.activity} onChange={(e) => setRow(i, { activity: e.target.value })}
                      rows={Math.max(1, r.activity.split("\n").length)} className={`${field} flex-1 min-w-0`} />
                    <input value={r.time} onChange={(e) => setRow(i, { time: e.target.value })} dir="ltr"
                      className={`${field} w-32 shrink-0 text-center`} />
                    <button onClick={() => setSchedule((p) => p.filter((_, j) => j !== i))}
                      className="px-2 py-2 text-gray-400 hover:text-red-600" title="מחיקת שורה">✕</button>
                  </div>
                ))}
                <button onClick={() => setSchedule((p) => [...p, { activity: "", time: "" }])} className="text-xs text-navy hover:underline">
                  + הוספת שורה
                </button>
                {scheduleError && <p className="text-red-600">{scheduleError}</p>}
              </div>

              {scenarios.length === 0 && (
                <p className="text-gray-500">לסדנה אין תרחישים פעילים — המצגת תיווצר בלי שקף תקציר.</p>
              )}
              {scenarios.map((s, i) => (
                <div key={s.key} className="space-y-2 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-gray-700">
                      תרחיש {i + 1}
                      {s.crm.name ? ` — ${s.crm.name}` : ""} <span className="text-gray-400 font-normal">· {s.crm.topic}</span>
                    </span>
                    <label className={`${quiet} cursor-pointer shrink-0`}>
                      {s.fileName ? "קובץ אחר" : "בחירת קובץ Word"}
                      <input type="file" accept=".docx" className="hidden"
                        onChange={(e) => { onScenarioFile(i, e.target.files?.[0]); e.target.value = "" }} />
                    </label>
                  </div>
                  {s.fileName && <p className="text-xs text-gray-400">{s.fileName}</p>}
                  {s.warnings.map((w) => <p key={w} className="text-xs text-amber-700">{w}</p>)}
                  <input value={s.title} onChange={(e) => setScenario(i, { title: e.target.value })}
                    placeholder="שם התרחיש" className={`${input} font-semibold`} />
                  <textarea value={s.body} onChange={(e) => setScenario(i, { body: e.target.value })}
                    placeholder="תקציר — כל שורה היא פסקה בשקף" rows={Math.min(14, Math.max(4, s.body.split("\n").length + 1))}
                    className={input} />
                </div>
              ))}

              {formError && <p className="text-red-600">{formError}</p>}
              <div className="flex justify-end">
                <button onClick={generate} disabled={generating || !template} className={button}>
                  {generating ? "יוצר מצגת..." : deck ? "יצירה מחדש" : "יצירת מצגת"}
                </button>
              </div>
            </div>
          </section>

          {/* 4 · The deck */}
          {deck && (
            <section className={card}>
              <div className={cardHead}>4 · המצגת</div>
              <div className="px-5 py-4 space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-gray-800 font-medium">{deck.fileName}</span>
                  <span className="text-gray-400"><span dir="ltr">{formatSize(deck.size)}</span> · נוצרה {when(deck.createdAt)}</span>
                </div>
                {unresolved.length > 0 && (
                  <p className="text-amber-700">
                    בתבנית יש תגיות ללא ערך, והן נשארו במצגת כפי שהן: {unresolved.map((t) => `{{${t}}}`).join(", ")}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={download} disabled={!!deckBusy} className={button}>{deckBusy ?? "הורדה"}</button>
                  <button onClick={toggleShare} disabled={!!deckBusy} className={quiet}>
                    {deck.sharedAt ? "ביטול השיתוף עם המפעילות" : "שיתוף עם המפעילות"}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {deck.sharedAt
                    ? "משותפת: המפעילות יכולות להוריד אותה מדף הסדנה, דרך ⋯ בתחתית הדף."
                    : "פרטית: רק את/ה רואה אותה."}
                </p>
                {deckError && <p className="text-red-600">{deckError}</p>}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
