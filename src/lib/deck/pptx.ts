// The facilitator-deck engine — spec §14 F-06.
//
// Fills a facilitator's template PPTX with one workshop's data. The template is
// an ordinary deck: `{{tokens}}` typed into slide text mark where values go,
// and slides are found by the tokens they hold, never by name or position.
// Three operations, nothing more:
//
//   1. Replace tokens in text — tolerating a token that PowerPoint has split
//      across several runs, and keeping the formatting of the token's first run.
//   2. Duplicate a table row — the one holding {{row.*}}, once per schedule line.
//   3. Duplicate a slide — the one holding {{scenario.*}}, once per scenario.
//
// A token alone in its paragraph may take several lines (topics, a scenario
// body): the paragraph is repeated once per line. An empty value removes it.

import JSZip from "jszip"
import { NS, child, children, descendants, parseXml, serializeXml, type Document, type Element } from "./xml"
import type { ScheduleRow } from "./docx"

export type DeckScenario = { title: string; body: string[] }

export type DeckData = {
  organization: string
  group: string
  /** Already formatted — the house short date, e.g. "27.8.26". */
  date: string
  /** Optional; empty removes the question line. */
  icebreakerQuestion: string
  topics: string[]
  schedule: ScheduleRow[]
  scenarios: DeckScenario[]
}

export type DeckResult = {
  file: Uint8Array
  /** Tokens in the template with no value — left visible in the deck so they are noticed. */
  unresolved: string[]
}

type Value = string | string[]
type Values = Record<string, Value>

const TOKEN = /\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g

// ─── 1. Tokens in paragraphs ─────────────────────────────────────────────────

function runText(r: Element): string {
  return child(r, NS.a, "t")?.textContent ?? ""
}

function setRunText(r: Element, text: string) {
  let t = child(r, NS.a, "t")
  if (!t) {
    t = r.ownerDocument!.createElementNS(NS.a, "a:t")
    r.appendChild(t)
  }
  while (t.firstChild) t.removeChild(t.firstChild)
  t.appendChild(r.ownerDocument!.createTextNode(text))
}

export function paragraphText(p: Element): string {
  return children(p, NS.a, "r").map(runText).join("")
}

/**
 * Replace every token in one paragraph with a single-line value. The text of a
 * token may span runs; the replacement lands in the run where the token
 * starts and takes its formatting, and the token's remains are cut from the
 * runs after it. Returns the keys that had no value.
 */
function replaceInline(p: Element, lookup: (key: string) => string | undefined): string[] {
  const runs = children(p, NS.a, "r")
  const texts = runs.map(runText)
  const full = texts.join("")
  const matches = [...full.matchAll(TOKEN)]
  const missing: string[] = []
  // Right to left, so earlier offsets stay valid.
  for (const m of matches.reverse()) {
    const value = lookup(m[1])
    if (value === undefined) { missing.push(m[1]); continue }
    const start = m.index!
    const end = start + m[0].length
    let offset = 0
    let first = true
    for (let i = 0; i < runs.length; i++) {
      const from = offset
      const to = offset + texts[i].length
      offset = to
      if (to <= start || from >= end) continue
      const before = texts[i].slice(0, Math.max(0, start - from))
      const after = texts[i].slice(Math.max(0, end - from))
      texts[i] = first ? before + value + after : after
      first = false
    }
  }
  runs.forEach((r, i) => setRunText(r, texts[i]))
  // Runs emptied by a cross-run token are dropped; one run always stays.
  const kept = runs.filter((r, i) => texts[i] !== "" || i === 0)
  for (const r of runs) if (!kept.includes(r)) p.removeChild(r)
  return missing
}

function asLine(v: Value): string {
  return (Array.isArray(v) ? v.join(", ") : v).replace(/\s*\n\s*/g, " ")
}

function asLines(v: Value): string[] {
  return (Array.isArray(v) ? v : [v]).flatMap((s) => s.split("\n")).filter((l) => l.trim() !== "")
}

/** Remove a paragraph — unless it is the last in its text body, which must keep one. Then it is emptied. */
function removeParagraph(p: Element) {
  const parent = p.parentNode as Element
  if (children(parent, NS.a, "p").length > 1) { parent.removeChild(p); return }
  for (const r of children(p, NS.a, "r")) p.removeChild(r)
}

/** Fill every token under `root`. Returns the keys left without a value. */
export function fillTokens(root: Element | Document, values: Values): string[] {
  const missing: string[] = []
  const lookup = (key: string) => (key in values ? asLine(values[key]) : undefined)
  for (const p of descendants(root, NS.a, "p")) {
    const text = paragraphText(p)
    const matches = [...text.matchAll(TOKEN)]
    if (matches.length === 0) continue

    // A token alone in its paragraph: one paragraph per line, none if empty.
    if (matches.length === 1 && text.trim() === matches[0][0]) {
      const key = matches[0][1]
      if (!(key in values)) { missing.push(key); continue }
      const lines = asLines(values[key])
      if (lines.length === 0) { removeParagraph(p); continue }
      let prev = p
      for (const line of lines.slice(1)) {
        const copy = p.cloneNode(true) as Element
        prev.parentNode!.insertBefore(copy, prev.nextSibling)
        replaceInline(copy, () => line)
        prev = copy
      }
      replaceInline(p, () => lines[0])
      continue
    }

    missing.push(...replaceInline(p, lookup))
  }
  return missing
}

// ─── 2. The schedule row ─────────────────────────────────────────────────────

/** Repeat each table row holding {{row.*}} once per schedule line; the template row goes. */
export function fillTableRows(root: Element | Document, rows: ScheduleRow[]): string[] {
  const missing: string[] = []
  for (const tr of descendants(root, NS.a, "tr")) {
    const text = descendants(tr, NS.a, "p").map(paragraphText).join("")
    if (!/\{\{\s*row\./.test(text)) continue
    for (const row of rows) {
      const copy = tr.cloneNode(true) as Element
      tr.parentNode!.insertBefore(copy, tr)
      missing.push(...fillTokens(copy, { "row.activity": row.activity, "row.time": row.time }))
    }
    const tbl = tr.parentNode as Element
    tbl.removeChild(tr)
    if (rows.length > 0) stretchTable(tbl)
  }
  return missing
}

// ─── Scenario text size ──────────────────────────────────────────────────────

// Body sizes to try, largest first, in points — large enough that a short
// scenario fills the slide. The title line is always a step larger than the
// body and bold (spec F-06, "Scenario text size").
const BODY_STEPS = [40, 36, 32, 30, 28, 26, 24, 22, 20, 18, 16]
const TITLE_EXTRA = 4
// Rough metrics for Hebrew text: average glyph width as a share of the size,
// and single line height as a multiple of it. Deliberately pessimistic — a
// little empty space at the bottom beats text running off the slide.
const CHAR_WIDTH = 0.55
const LINE_HEIGHT = 1.2
const EMU_PER_PT = 12700
// PowerPoint's default text insets when the template sets none: 0.1" left and right.
const DEFAULT_SIDE_INSETS_EMU = 2 * 91440

export type TextBox = {
  widthEmu: number
  heightEmu: number
  /** The paragraphs' line spacing, 1 = single. */
  lineSpacing?: number
  /** Space after each paragraph, in points. */
  spaceAfterPt?: number
}

export function fitScenarioText(box: TextBox, title: string, body: string[]) {
  const width = box.widthEmu / EMU_PER_PT
  const height = box.heightEmu / EMU_PER_PT
  const lineHeight = LINE_HEIGHT * (box.lineSpacing ?? 1)
  const after = box.spaceAfterPt ?? 0
  const para = (text: string, size: number) =>
    Math.max(1, Math.ceil((text.length * size * CHAR_WIDTH) / width)) * size * lineHeight + after
  for (const body_ of BODY_STEPS) {
    const title_ = body_ + TITLE_EXTRA
    const needed =
      para(title, title_) +
      para("", body_) + // the blank line under the title
      body.reduce((sum, p) => sum + para(p, body_), 0)
    if (needed <= height) return { title: title_, body: body_ }
  }
  const smallest = BODY_STEPS[BODY_STEPS.length - 1]
  return { title: smallest + TITLE_EXTRA, body: smallest }
}

function setSize(p: Element, sizePt: number, bold: boolean | null) {
  const doc = p.ownerDocument!
  const props: Element[] = []
  for (const r of children(p, NS.a, "r")) {
    let rPr = child(r, NS.a, "rPr")
    if (!rPr) {
      rPr = doc.createElementNS(NS.a, "a:rPr")
      r.insertBefore(rPr, r.firstChild)
    }
    props.push(rPr)
  }
  const end = child(p, NS.a, "endParaRPr")
  if (end) props.push(end)
  for (const rPr of props) {
    rPr.setAttribute("sz", String(sizePt * 100))
    if (bold !== null) rPr.setAttribute("b", bold ? "1" : "0")
  }
}

/** Size the text in the shape holding {{scenario.body}}. Runs before the tokens are filled. */
function sizeScenarioShape(slide: Document, scenario: DeckScenario) {
  for (const sp of descendants(slide, NS.p, "sp")) {
    const paras = descendants(sp, NS.a, "p")
    if (!paras.some((p) => /\{\{\s*scenario\.body\s*\}\}/.test(paragraphText(p)))) continue
    const spPr = child(sp, NS.p, "spPr")
    const xfrm = spPr && child(spPr, NS.a, "xfrm")
    const ext = xfrm && child(xfrm, NS.a, "ext")
    if (!ext) continue
    const titleLine = paras
      .map(paragraphText)
      .find((t) => /\{\{\s*scenario\.title\s*\}\}/.test(t))
      ?.replace(TOKEN, (_, key) => (key === "scenario.title" ? scenario.title : "00")) ?? ""
    const bodyPr = descendants(sp, NS.a, "bodyPr")[0]
    const inset = (attr: string, dflt: number) => Number(bodyPr?.getAttribute(attr) || dflt)
    const bodyPara = paras.find((p) => /\{\{\s*scenario\.body\s*\}\}/.test(paragraphText(p)))!
    const pPr = child(bodyPara, NS.a, "pPr")
    const lnPct = pPr && child(pPr, NS.a, "lnSpc") && descendants(child(pPr, NS.a, "lnSpc")!, NS.a, "spcPct")[0]
    const aftPts = pPr && child(pPr, NS.a, "spcAft") && descendants(child(pPr, NS.a, "spcAft")!, NS.a, "spcPts")[0]
    const size = fitScenarioText(
      {
        widthEmu: Number(ext.getAttribute("cx")) - inset("lIns", DEFAULT_SIDE_INSETS_EMU / 2) - inset("rIns", DEFAULT_SIDE_INSETS_EMU / 2),
        heightEmu: Number(ext.getAttribute("cy")),
        lineSpacing: lnPct ? Number(lnPct.getAttribute("val")) / 100000 : 1,
        spaceAfterPt: aftPts ? Number(aftPts.getAttribute("val")) / 100 : 0,
      },
      titleLine,
      scenario.body.flatMap((b) => b.split("\n")).map((l) => parseMarkup(l).map((seg) => seg.text).join("")),
    )
    for (const p of paras) {
      const isTitle = /\{\{\s*scenario\.title\s*\}\}/.test(paragraphText(p))
      setSize(p, isTitle ? size.title : size.body, isTitle ? true : null)
    }
  }
}

// ─── Scenario closing lines ──────────────────────────────────────────────────

// The goal and the time allowed close the brief and stand apart from it:
// centred, while the brief keeps the template's alignment (spec F-06).
const CLOSING_LINE = /^\s*(מטרת\s|לרשות)/

export function centerClosingLines(root: Element | Document) {
  for (const p of descendants(root, NS.a, "p")) {
    if (!CLOSING_LINE.test(paragraphText(p))) continue
    let pPr = child(p, NS.a, "pPr")
    if (!pPr) {
      pPr = p.ownerDocument!.createElementNS(NS.a, "a:pPr")
      p.insertBefore(pPr, p.firstChild)
    }
    pPr.setAttribute("algn", "ctr")
  }
}

// ─── Scenario markup ─────────────────────────────────────────────────────────

export type Segment = { text: string; bold: boolean; underline: boolean }

/**
 * `*bold*` and `_underline_` in scenario text, typed in the preview. A marker
 * counts only when it has a partner later on the line; a lone `*` or `_` stays
 * as written. The two may nest (`*_both_*`).
 */
export function parseMarkup(line: string): Segment[] {
  const out: Segment[] = []
  let bold = false
  let underline = false
  let text = ""
  const flush = () => {
    if (text) out.push({ text, bold, underline })
    text = ""
  }
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "*" || ch === "_") {
      const on = ch === "*" ? bold : underline
      // Opening needs a closing partner ahead; closing is always honoured.
      if (on || line.indexOf(ch, i + 1) !== -1) {
        flush()
        if (ch === "*") bold = !bold
        else underline = !underline
        continue
      }
    }
    text += ch
  }
  flush()
  return out.length ? out : [{ text: "", bold: false, underline: false }]
}

/** Turn markup into formatting in every paragraph under `root`. Each segment becomes a run cloned from the paragraph's first. */
export function applyMarkup(root: Element | Document) {
  for (const p of descendants(root, NS.a, "p")) {
    const text = paragraphText(p)
    if (!/[*_]/.test(text)) continue
    const segments = parseMarkup(text)
    if (segments.length === 1 && segments[0].text === text) continue
    const runs = children(p, NS.a, "r")
    const model = runs[0]
    for (const seg of segments) {
      const r = model.cloneNode(true) as Element
      setRunText(r, seg.text)
      let rPr = child(r, NS.a, "rPr")
      if (!rPr) {
        rPr = r.ownerDocument!.createElementNS(NS.a, "a:rPr")
        r.insertBefore(rPr, r.firstChild)
      }
      if (seg.bold) rPr.setAttribute("b", "1")
      if (seg.underline) rPr.setAttribute("u", "sng")
      p.insertBefore(r, model)
    }
    for (const r of runs) p.removeChild(r)
  }
}

// ─── Cover line and schedule table size ──────────────────────────────────────

const pt = (emu: number) => emu / EMU_PER_PT
const runSize = (p: Element): number | null => {
  for (const r of children(p, NS.a, "r")) {
    const sz = child(r, NS.a, "rPr")?.getAttribute("sz")
    if (sz) return Number(sz) / 100
  }
  return null
}

/** How many characters fit on one line of `widthPt` at `sizePt`, by the same rough metric. */
export function charsPerLine(widthPt: number, sizePt: number): number {
  return Math.floor(widthPt / (sizePt * CHAR_WIDTH))
}

/**
 * The size at which `text` fits one line of `widthPt`: the template's own size
 * when it already fits, smaller when not — never below half of it, where a
 * name long enough to need more is better wrapped than unreadable.
 */
export function fitOneLine(text: string, widthPt: number, sizePt: number): number {
  if (text.length <= charsPerLine(widthPt, sizePt)) return sizePt
  const fitted = Math.floor(widthPt / (text.length * CHAR_WIDTH))
  return Math.max(Math.ceil(sizePt / 2), fitted)
}

/**
 * Shrink the cover line naming the organization and group so a long name stays
 * on one line instead of wrapping into the date below it. Runs before the
 * tokens are filled; fixed line spacing shrinks with the text.
 */
function fitCoverLine(slide: Document, values: Values) {
  for (const sp of descendants(slide, NS.p, "sp")) {
    const ext = child(child(child(sp, NS.p, "spPr") ?? sp, NS.a, "xfrm") ?? sp, NS.a, "ext")
    if (!ext) continue
    const bodyPr = descendants(sp, NS.a, "bodyPr")[0]
    const insets = Number(bodyPr?.getAttribute("lIns") ?? 91440) + Number(bodyPr?.getAttribute("rIns") ?? 91440)
    const width = pt(Number(ext.getAttribute("cx")) - insets)
    for (const p of descendants(sp, NS.a, "p")) {
      const text = paragraphText(p)
      if (!/\{\{\s*(organization|group)\s*\}\}/.test(text)) continue
      const size = runSize(p)
      if (!size) continue
      const filled = text.replace(TOKEN, (m, key) => (key in values ? asLine(values[key]) : m))
      const fitted = fitOneLine(filled, width, size)
      if (fitted === size) continue
      setSize(p, fitted, null)
      const spcPts = descendants(p, NS.a, "spcPts").find((e) => (e.parentNode as Element)?.localName === "lnSpc")
      if (spcPts) spcPts.setAttribute("val", String(Math.round(Number(spcPts.getAttribute("val")) * fitted / size)))
    }
  }
}

// Table text sizes to try, largest first. The table is then stretched to its
// frame: rows share the frame's height in proportion to their lines.
const TABLE_STEPS = [40, 36, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14]
const TABLE_LINE = 1.3
// PowerPoint's default cell margins: 0.1" left and right, 0.05" top and bottom.
const CELL_MARGIN_X_PT = 2 * 7.2
const CELL_MARGIN_Y_PT = 2 * 3.6

/** Largest size at which every row fits the height and every line fits its column. */
export function fitTable(heightPt: number, colWidthsPt: number[], rows: string[][][]): number {
  const linesOf = (row: string[][]) => Math.max(1, ...row.map((cell) => cell.length))
  for (const size of TABLE_STEPS) {
    const height = rows.reduce((sum, row) => sum + linesOf(row) * size * TABLE_LINE + CELL_MARGIN_Y_PT, 0)
    const wide = rows.every((row) => row.every((cell, c) =>
      cell.every((line) => line.length * size * CHAR_WIDTH <= (colWidthsPt[c] ?? Infinity) - CELL_MARGIN_X_PT)))
    if (height <= heightPt && wide) return size
  }
  return TABLE_STEPS[TABLE_STEPS.length - 1]
}

/** Fill the frame of the table that held {{row.*}}: one text size throughout, rows stretched to the frame's height. */
function stretchTable(tbl: Element) {
  const frame = tbl.parentNode?.parentNode?.parentNode as Element | null // a:tbl ← a:graphicData ← a:graphic ← p:graphicFrame
  const ext = frame && child(child(frame, NS.p, "xfrm") ?? frame, NS.a, "ext")
  if (!ext) return
  const heightEmu = Number(ext.getAttribute("cy"))
  const grid = child(tbl, NS.a, "tblGrid")
  const cols = grid ? children(grid, NS.a, "gridCol").map((g) => pt(Number(g.getAttribute("w")))) : []
  const trs = children(tbl, NS.a, "tr")
  const cells = trs.map((tr) => children(tr, NS.a, "tc").map((tc) =>
    descendants(tc, NS.a, "p").map(paragraphText).filter((t) => t.trim() !== "")))
  const size = fitTable(pt(heightEmu), cols, cells)
  const lines = cells.map((row) => Math.max(1, ...row.map((c) => c.length)))
  const total = lines.reduce((a, b) => a + b, 0)
  trs.forEach((tr, i) => {
    tr.setAttribute("h", String(Math.floor((heightEmu * lines[i]) / total)))
    for (const p of descendants(tr, NS.a, "p")) setSize(p, size, null)
  })
}

// ─── 3. The package: slides, relationships, content types ───────────────────

const REL_SLIDE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
const REL_NOTES = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide"
const CT_SLIDE = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"

async function readXml(zip: JSZip, path: string): Promise<Document> {
  const f = zip.file(path)
  if (!f) throw new Error(`חסר בתבנית: ${path}`)
  return parseXml(await f.async("string"))
}

const relsPathOf = (slidePath: string) => slidePath.replace(/^(.*)\/([^/]+)$/, "$1/_rels/$2.rels")

export async function generateDeck(template: ArrayBuffer | Uint8Array, data: DeckData): Promise<DeckResult> {
  const zip = await JSZip.loadAsync(template)
  const presentation = await readXml(zip, "ppt/presentation.xml")
  const presRels = await readXml(zip, "ppt/_rels/presentation.xml.rels")
  const contentTypes = await readXml(zip, "[Content_Types].xml")

  const relEls = children(presRels.documentElement!, NS.rels, "Relationship")
  const targetOf = (rId: string) => {
    const rel = relEls.find((r) => r.getAttribute("Id") === rId)
    return rel ? "ppt/" + rel.getAttribute("Target")!.replace(/^\/?ppt\//, "").replace(/^\.\//, "") : null
  }
  const sldIdLst = child(presentation.documentElement!, NS.p, "sldIdLst")
  if (!sldIdLst) throw new Error("בתבנית אין שקופיות")
  const slideIds = children(sldIdLst, NS.p, "sldId")

  const base: Values = {
    organization: data.organization,
    group: data.group,
    date: data.date,
    icebreaker_question: data.icebreakerQuestion,
    topics: data.topics,
  }
  const missing = new Set<string>()

  let scenarioSlide: { sldId: Element; path: string; xml: string } | null = null
  for (const sldId of slideIds) {
    const path = targetOf(sldId.getAttributeNS(NS.r, "id") ?? "")
    if (!path) continue
    const xml = await zip.file(path)!.async("string")
    if (!scenarioSlide && /\{\{\s*scenario\./.test(xml)) {
      scenarioSlide = { sldId, path, xml }
      continue
    }
    if (!xml.includes("{{")) continue
    const doc = parseXml(xml)
    fillTableRows(doc, data.schedule).forEach((k) => missing.add(k))
    fitCoverLine(doc, base)
    fillTokens(doc, base).forEach((k) => missing.add(k))
    zip.file(path, serializeXml(doc))
  }

  if (scenarioSlide) {
    const relsXml = (await zip.file(relsPathOf(scenarioSlide.path))?.async("string")) ?? null
    let nextPart = Math.max(0, ...Object.keys(zip.files).map((f) => Number(f.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1] ?? 0))) + 1
    let nextRel = Math.max(0, ...relEls.map((r) => Number(r.getAttribute("Id")!.replace(/\D/g, "")) || 0)) + 1
    let nextId = Math.max(255, ...slideIds.map((s) => Number(s.getAttribute("id")))) + 1
    let after: Element = scenarioSlide.sldId

    data.scenarios.forEach((scenario, i) => {
      const doc = parseXml(scenarioSlide!.xml)
      sizeScenarioShape(doc, scenario)
      fillTokens(doc, {
        ...base,
        "scenario.number": String(i + 1),
        "scenario.title": scenario.title,
        "scenario.body": scenario.body,
      }).forEach((k) => missing.add(k))
      centerClosingLines(doc)
      applyMarkup(doc)
      const xml = serializeXml(doc)

      if (i === 0) { zip.file(scenarioSlide!.path, xml); return }

      // A copy: new part, its relationships (minus the template's speaker
      // notes, which belong to the template alone), a content-type override,
      // a presentation relationship and a place in the slide order.
      const path = `ppt/slides/slide${nextPart++}.xml`
      zip.file(path, xml)
      if (relsXml) {
        const rels = parseXml(relsXml)
        for (const r of children(rels.documentElement!, NS.rels, "Relationship")) {
          if (r.getAttribute("Type") === REL_NOTES) rels.documentElement!.removeChild(r)
        }
        zip.file(relsPathOf(path), serializeXml(rels))
      }
      const override = contentTypes.createElementNS(NS.ct, "Override")
      override.setAttribute("PartName", "/" + path)
      override.setAttribute("ContentType", CT_SLIDE)
      contentTypes.documentElement!.appendChild(override)

      const rId = `rId${nextRel++}`
      const rel = presRels.createElementNS(NS.rels, "Relationship")
      rel.setAttribute("Id", rId)
      rel.setAttribute("Type", REL_SLIDE)
      rel.setAttribute("Target", path.replace(/^ppt\//, ""))
      presRels.documentElement!.appendChild(rel)

      const sldId = presentation.createElementNS(NS.p, "p:sldId")
      sldId.setAttribute("id", String(nextId++))
      sldId.setAttributeNS(NS.r, "r:id", rId)
      sldIdLst.insertBefore(sldId, after.nextSibling)
      after = sldId
    })

    if (data.scenarios.length === 0) await removeSlide(zip, scenarioSlide, sldIdLst, presRels, contentTypes)
  }

  zip.file("ppt/presentation.xml", serializeXml(presentation))
  zip.file("ppt/_rels/presentation.xml.rels", serializeXml(presRels))
  zip.file("[Content_Types].xml", serializeXml(contentTypes))
  await updateSlideCount(zip, children(sldIdLst, NS.p, "sldId").length)

  const file = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })
  return { file, unresolved: [...missing].sort() }
}

/**
 * Drop a slide entirely: its place in the order, its presentation
 * relationship, its part, its relationships, its content-type override, and
 * its speaker notes if it has any. A half-removed slide makes PowerPoint offer
 * to repair the file.
 */
async function removeSlide(
  zip: JSZip,
  slide: { sldId: Element; path: string },
  sldIdLst: Element,
  presRels: Document,
  contentTypes: Document,
) {
  const rId = slide.sldId.getAttributeNS(NS.r, "id")
  sldIdLst.removeChild(slide.sldId)
  for (const r of children(presRels.documentElement!, NS.rels, "Relationship")) {
    if (r.getAttribute("Id") === rId) presRels.documentElement!.removeChild(r)
  }
  const parts = [slide.path]
  const relsFile = zip.file(relsPathOf(slide.path))
  if (relsFile) {
    const rels = parseXml(await relsFile.async("string"))
    for (const r of children(rels.documentElement!, NS.rels, "Relationship")) {
      if (r.getAttribute("Type") !== REL_NOTES) continue
      const notes = "ppt/" + r.getAttribute("Target")!.replace(/^\.\.\//, "")
      parts.push(notes)
      zip.remove(relsPathOf(notes))
    }
    zip.remove(relsPathOf(slide.path))
  }
  for (const part of parts) {
    zip.remove(part)
    for (const o of children(contentTypes.documentElement!, NS.ct, "Override")) {
      if (o.getAttribute("PartName") === "/" + part) contentTypes.documentElement!.removeChild(o)
    }
  }
}

async function updateSlideCount(zip: JSZip, count: number) {
  const f = zip.file("docProps/app.xml")
  if (!f) return
  const xml = await f.async("string")
  zip.file("docProps/app.xml", xml.replace(/<Slides>\d+<\/Slides>/, `<Slides>${count}</Slides>`))
}
