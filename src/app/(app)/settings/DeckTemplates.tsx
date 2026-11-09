"use client"

// תבניות מצגת — each facilitator's deck template, spec §14 F-06. Manager only
// (the settings page is). A template is that facilitator's own deck with
// {{tokens}} typed where the CRM's values go; on upload the system reads them
// back, so a missing or misspelt token shows here before any Tech meets it.

import { useEffect, useState } from "react"
import { downloadFile, formatSize, uploadTemplate, type DeckFileMeta } from "@/lib/deck/transfer"

type TemplateInfo = DeckFileMeta & { tokens: string[]; missing: string[]; unknown: string[] }
type Facilitator = { id: string; name: string; template: TemplateInfo | null }

function localShortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`
}
const tok = (t: string) => `{{${t}}}`

export function DeckTemplates() {
  const [rows, setRows] = useState<Facilitator[] | null>(null)
  const [busy, setBusy] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch("/api/matzgot/templates")
      .then((res) => (res.ok ? res.json() : { facilitators: [] }))
      .then((b) => setRows(b.facilitators))
  }, [])

  const setBusyFor = (id: string, text: string | null) =>
    setBusy((p) => { const n = { ...p }; if (text) n[id] = text; else delete n[id]; return n })
  const setErrorFor = (id: string, text: string | null) =>
    setErrors((p) => { const n = { ...p }; if (text) n[id] = text; else delete n[id]; return n })

  async function upload(f: Facilitator, file: File | undefined) {
    if (!file) return
    setErrorFor(f.id, null)
    try {
      const t = await uploadTemplate(file, f.id, (done, total) => setBusyFor(f.id, `מעלה ${done}/${total}...`))
      setRows((p) => p && p.map((x) => (x.id === f.id ? { ...x, template: t } : x)))
    } catch (e) {
      setErrorFor(f.id, (e as Error).message)
    }
    setBusyFor(f.id, null)
  }

  async function download(f: Facilitator) {
    if (!f.template) return
    setErrorFor(f.id, null)
    try {
      await downloadFile(f.template, (done, total) => setBusyFor(f.id, `מוריד ${done}/${total}...`))
    } catch (e) {
      setErrorFor(f.id, (e as Error).message)
    }
    setBusyFor(f.id, null)
  }

  async function remove(f: Facilitator) {
    if (!f.template || !window.confirm(`להסיר את התבנית של ${f.name}? מצגות שכבר נוצרו ממנה יישארו.`)) return
    setBusyFor(f.id, "מסיר...")
    const res = await fetch(`/api/matzgot/files/${f.template.id}`, { method: "DELETE" })
    if (res.ok) setRows((p) => p && p.map((x) => (x.id === f.id ? { ...x, template: null } : x)))
    else setErrorFor(f.id, "ההסרה נכשלה")
    setBusyFor(f.id, null)
  }

  return (
    <section className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-700">תבניות מצגת</h2>
      </div>
      <div className="px-5 py-3 text-xs text-gray-500 border-b border-gray-100">
        המצגת של כל מתחקר/ת, עם תגיות כמו {tok("organization")} במקום שבו נכנסים נתוני הסדנה. המפעילות יוצרות ממנה מצגות בדף ״מצגות מתחקרים״ של כל סדנה.
      </div>
      {!rows ? (
        <div className="px-5 py-4 text-sm text-gray-400">טוען...</div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-4 text-sm text-gray-400">אין מתחקרים פעילים</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((f) => (
            <div key={f.id} className="px-5 py-3 space-y-1.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium text-gray-800">{f.name}</span>
                  {f.template ? (
                    <span className="text-gray-400 mr-2">
                      {f.template.fileName} · <span dir="ltr">{formatSize(f.template.size)}</span> · {localShortDate(f.template.createdAt)}
                    </span>
                  ) : (
                    <span className="text-gray-400 mr-2">אין תבנית</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {busy[f.id] ? (
                    <span className="text-xs text-gray-500">{busy[f.id]}</span>
                  ) : (
                    <>
                      {f.template && (
                        <>
                          <button onClick={() => download(f)} className="text-xs text-navy hover:underline">הורדה</button>
                          <button onClick={() => remove(f)} className="text-xs text-gray-400 hover:text-red-600">הסרה</button>
                        </>
                      )}
                      <label className="px-3 py-1 border border-gray-300 text-xs rounded hover:bg-gray-50 cursor-pointer">
                        {f.template ? "החלפה" : "העלאה"}
                        <input type="file" accept=".pptx" className="hidden"
                          onChange={(e) => { upload(f, e.target.files?.[0]); e.target.value = "" }} />
                      </label>
                    </>
                  )}
                </div>
              </div>
              {f.template && (
                <div className="text-xs space-y-0.5">
                  <div className="text-gray-500">
                    תגיות: <span dir="ltr">{f.template.tokens.length ? f.template.tokens.map(tok).join(" ") : "—"}</span>
                  </div>
                  {f.template.unknown.length > 0 && (
                    <div className="text-red-600">
                      תגיות לא מוכרות (שגיאת כתיב?) — יופיעו ריקות: <span dir="ltr">{f.template.unknown.map(tok).join(" ")}</span>
                    </div>
                  )}
                  {f.template.missing.length > 0 && (
                    <div className="text-amber-700">
                      חסרות (תקין אם זה מכוון): <span dir="ltr">{f.template.missing.map(tok).join(" ")}</span>
                    </div>
                  )}
                </div>
              )}
              {errors[f.id] && <div className="text-xs text-red-600">{errors[f.id]}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
