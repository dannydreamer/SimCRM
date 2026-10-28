// Reading the Word files that feed the facilitator deck — spec §14 F-06,
// "Input parsing". Read only; nothing here writes a DOCX.
//
// Two stages, kept apart on purpose: readDocxBlocks() turns the file into a
// flat list of paragraphs and tables (the only part that touches the zip), and
// parseSchedule() / parseScenario() are pure functions over that list, so
// `npm run check:deck` can exercise every parsing rule without a Word file.
//
// Both parses feed an editable preview. They aim to be right for the files the
// centre actually writes, not to be exhaustive: whatever they miss, the user
// fixes in the preview before generating.

import JSZip from "jszip"
import { NS, children, parseXml, type Element } from "./xml"

export type DocxBlock =
  | { kind: "p"; text: string }
  | { kind: "table"; rows: string[][] }

// ─── Stage 1: DOCX → blocks ──────────────────────────────────────────────────

export async function readDocxBlocks(data: ArrayBuffer | Uint8Array): Promise<DocxBlock[]> {
  const zip = await JSZip.loadAsync(data)
  const file = zip.file("word/document.xml")
  if (!file) throw new Error("הקובץ אינו מסמך Word תקין")
  const doc = parseXml(await file.async("string"))
  const body = doc.getElementsByTagNameNS(NS.w, "body")[0] as Element | undefined
  return body ? bodyBlocks(body) : []
}

function bodyBlocks(container: Element): DocxBlock[] {
  const out: DocxBlock[] = []
  for (let n = container.firstChild; n; n = n.nextSibling) {
    if (n.nodeType !== 1) continue
    const el = n as Element
    if (el.namespaceURI !== NS.w) continue
    if (el.localName === "p") out.push({ kind: "p", text: paragraphText(el) })
    else if (el.localName === "tbl") out.push({ kind: "table", rows: tableRows(el) })
    // Content controls wrap ordinary paragraphs and tables.
    else if (el.localName === "sdt") {
      const content = children(el, NS.w, "sdtContent")[0]
      if (content) out.push(...bodyBlocks(content))
    }
  }
  return out
}

/** Visible text of a paragraph: w:t, with tabs and line breaks kept. Deleted text and field codes are skipped. */
function paragraphText(p: Element): string {
  let text = ""
  const walk = (el: Element) => {
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 1) continue
      const c = n as Element
      if (c.namespaceURI !== NS.w) continue
      if (c.localName === "t") text += c.textContent ?? ""
      else if (c.localName === "tab") text += "\t"
      else if (c.localName === "br" || c.localName === "cr") text += "\n"
      else if (c.localName === "delText" || c.localName === "instrText") continue
      else walk(c)
    }
  }
  walk(p)
  return text
}

function tableRows(tbl: Element): string[][] {
  return children(tbl, NS.w, "tr").map((tr) =>
    children(tr, NS.w, "tc").map((tc) =>
      children(tc, NS.w, "p").map(paragraphText).join("\n"),
    ),
  )
}

// ─── Shared text clean-up ────────────────────────────────────────────────────

/** Trim each line, drop empty lines, collapse runs of spaces. Tabs count as spaces. */
export function cleanLines(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/[\t  ]+/g, " ").trim())
    .filter((l) => l !== "")
    .join("\n")
}

// ─── Stage 2a: the schedule ──────────────────────────────────────────────────

export type ScheduleRow = { activity: string; time: string }

// "9:30-10:00", with any dash and loose spacing. A single time ("8:15") is not
// a range — that is how the internal logistics row (actor training, debriefer
// arrival) drops out.
const TIME_RANGE = /^\d{1,2}[:.]\d{2}\s*[-–—]\s*\d{1,2}[:.]\d{2}$/

// Participants arrive during התכנסות; it is not part of the session they see.
const DROPPED_ACTIVITIES = /^התכנסות/

export function parseSchedule(blocks: DocxBlock[]): ScheduleRow[] {
  const tables = blocks.filter((b): b is Extract<DocxBlock, { kind: "table" }> => b.kind === "table")
  const table =
    tables.find((t) => t.rows.length > 0 && hasHeader(t.rows[0])) ??
    tables.find((t) => t.rows.some((r) => r.length >= 2))
  if (!table) return []

  const header = hasHeader(table.rows[0]) ? table.rows[0] : null
  const activityCol = header ? header.findIndex((c) => /פעילות/.test(c)) : 0
  const timeCol = header ? header.findIndex((c) => /זמן/.test(c)) : 1

  const rows: ScheduleRow[] = []
  for (const row of header ? table.rows.slice(1) : table.rows) {
    const activity = cleanLines(row[activityCol] ?? "")
    const time = cleanLines(row[timeCol] ?? "").replace(/\s*([-–—])\s*/g, "$1")
    if (!TIME_RANGE.test(time) || activity === "") continue
    if (DROPPED_ACTIVITIES.test(activity)) continue
    rows.push({ activity, time })
  }
  return rows
}

function hasHeader(row: string[]): boolean {
  return row.some((c) => /פעילות/.test(c)) && row.some((c) => /זמן/.test(c))
}

// ─── Stage 2b: a scenario ────────────────────────────────────────────────────

export type ParsedScenario = {
  number: number | null
  topic: string | null
  population: string | null
  /** שם התרחיש, exactly as written — quotes included. */
  title: string
  character: string | null
  /** The participants' section, one entry per paragraph: brief, goal, הערה, minutes. */
  body: string[]
  /** The facilitator table, by its row labels (מטרת תרחיש, נקודות לתחקיר …). Never on a slide. */
  details: Record<string, string>
  /** Things the parser could not find; shown in the preview. */
  warnings: string[]
}

// Label wording varies between files — gendered endings, a missing ה — so each
// is matched loosely. Anchored at the start of the paragraph.
const LABEL = {
  number: /^תרחיש\s+(\d+)/,
  topic: /^נושא\s+האימון\s*:\s*(.*)$/,
  population: /^אוכלוסי+ת\s+(?:ה)?מתאמנ\S*\s*:\s*(.*)$/,
  title: /^שם\s+התרחיש\s*:\s*(.*)$/,
  character: /^הדמו(?:ת|יות)\s*:\s*(.*)$/,
  brief: /^תקציר(?:\s+\d+)?\s+ל?משתתפ\S*\s*:?\s*(.*)$/,
}

// "*******" on a line of its own separates the header from the brief.
const SEPARATOR = /^[*\s]*\*{3,}[*\s]*$/

export function parseScenario(blocks: DocxBlock[]): ParsedScenario {
  const firstTable = blocks.findIndex((b) => b.kind === "table")
  const paras = blocks
    .slice(0, firstTable === -1 ? blocks.length : firstTable)
    .flatMap((b) => (b.kind === "p" ? [cleanLines(b.text)] : []))
    .filter((t) => t !== "")

  const result: ParsedScenario = {
    number: null, topic: null, population: null, title: "", character: null,
    body: [], details: {}, warnings: [],
  }

  let briefAt = -1
  let briefTitle = ""
  let lastLabelAt = -1
  paras.forEach((text, i) => {
    if (briefAt !== -1) return
    let m: RegExpMatchArray | null
    if ((m = text.match(LABEL.brief))) { briefAt = i; briefTitle = m[1].trim(); return }
    if ((m = text.match(LABEL.number)) && result.number === null) { result.number = Number(m[1]); lastLabelAt = i }
    else if ((m = text.match(LABEL.topic))) { result.topic = m[1].trim(); lastLabelAt = i }
    else if ((m = text.match(LABEL.population))) { result.population = m[1].trim(); lastLabelAt = i }
    else if ((m = text.match(LABEL.title))) { result.title = m[1].trim(); lastLabelAt = i }
    else if ((m = text.match(LABEL.character))) { result.character = m[1].trim(); lastLabelAt = i }
  })

  if (!result.title) {
    result.title = briefTitle
    if (!result.title) result.warnings.push("לא נמצא שם התרחיש")
  }

  const bodyFrom = briefAt !== -1 ? briefAt + 1 : lastLabelAt + 1
  if (briefAt === -1) result.warnings.push("לא נמצאה השורה ׳תקציר למשתתפים׳ — התקציר נלקח מהשורה שאחרי הכותרות")
  result.body = paras.slice(bodyFrom).filter((t) => !SEPARATOR.test(t))
  if (result.body.length === 0) result.warnings.push("לא נמצא תקציר")

  const table = firstTable === -1 ? null : blocks[firstTable]
  if (table && table.kind === "table") {
    for (const row of table.rows) {
      const label = cleanLines(row[0] ?? "")
      const value = cleanLines(row.slice(1).join("\n"))
      if (label) result.details[label] = value
    }
  }

  return result
}
