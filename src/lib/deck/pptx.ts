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
    tr.parentNode!.removeChild(tr)
  }
  return missing
}

// ─── Scenario text size ──────────────────────────────────────────────────────

// Body sizes to try, largest first, in points. The title line is always a step
// larger than the body and bold (spec F-06, "Scenario text size").
const BODY_STEPS = [32, 28, 26, 24, 22, 20, 18, 16]
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
      scenario.body.flatMap((b) => b.split("\n")),
    )
    for (const p of paras) {
      const isTitle = /\{\{\s*scenario\.title\s*\}\}/.test(paragraphText(p))
      setSize(p, isTitle ? size.title : size.body, isTitle ? true : null)
    }
  }
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
