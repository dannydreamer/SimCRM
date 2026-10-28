// Logic checks for the facilitator-deck generator — spec §14 F-06.
//
//   npm run check:deck
//
// No database, no real files. The parsers are exercised on hand-built block
// lists shaped like the centre's Word files, the token engine on small DrawingML
// fragments, and the package handling on a minimal PPTX built in memory. The
// claims most likely to break without anyone noticing:
//
//   1. A token PowerPoint split across runs is still found, and the value takes
//      the formatting of the run the token starts in.
//   2. An empty value removes its paragraph — but never the last paragraph of a
//      text box, which PowerPoint requires.
//   3. The schedule keeps only rows with a time range, and drops התכנסות.
//   4. The scenario body is the participants' section only: never the header
//      lines above it or the facilitator table below.
//   5. A copied scenario slide is wired into every part of the package, and a
//      removed one leaves nothing behind — either mistake makes PowerPoint offer
//      to repair the file.

import JSZip from "jszip"
import { parseSchedule, parseScenario, type DocxBlock } from "../src/lib/deck/docx"
import { applyMarkup, centerClosingLines, charsPerLine, parseMarkup, fillTableRows, fillTokens, fitOneLine, fitScenarioText, fitTable, generateDeck, paragraphText } from "../src/lib/deck/pptx"
import { NS, children, descendants, parseXml } from "../src/lib/deck/xml"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) { failures++; console.log(`FAIL ${name}\n  expected ${e}\n  actual   ${a}`) }
  else console.log(`ok   ${name}`)
}

const p = (text: string): DocxBlock => ({ kind: "p", text })
const table = (...rows: string[][]): DocxBlock => ({ kind: "table", rows })

// ── Schedule ────────────────────────────────────────────────────────────────
const schedule = [
  p("לוח זמנים"),
  table(
    ["\tפעילות\t", "זמן"],
    ["שחקנית:\n\nמתחקר: דניאל פראג", "אימון שחקנים:\n8:15\nשעת הגעת מתחקרים:\n8:30"],
    ["התכנסות ", "9:00-9:30"],
    ["פתיחה ואוריינטציה\n", "9:30-10:00"],
    ["סימולציה 1 - 2*7\n+ שיקופים", "10:00 – 10:20"],
    ["סיכום ומשוב", "12:00-12:30"],
  ),
]
const rows = parseSchedule(schedule)
check("schedule: internal row and התכנסות dropped", rows.map((r) => r.activity),
  ["פתיחה ואוריינטציה", "סימולציה 1 - 2*7\n+ שיקופים", "סיכום ומשוב"])
check("schedule: a multi-line activity keeps its lines", rows[1].activity, "סימולציה 1 - 2*7\n+ שיקופים")
check("schedule: spaces around the dash are dropped", rows[1].time, "10:00–10:20")
check("schedule: column order does not matter",
  parseSchedule([table(["זמן", "פעילות"], ["9:30-10:00", "פתיחה"])]), [{ activity: "פתיחה", time: "9:30-10:00" }])
check("schedule: no header row needed", parseSchedule([table(["פתיחה", "9:30-10:00"])]).length, 1)
check("schedule: no table, no rows", parseSchedule([p("כלום")]), [])

// A day that splits into parallel groups: rows of two cells and of three in one table.
const split = parseSchedule([table(
  ["\t\t\tפעילות\t", "זמן"],
  ["תדרוך שחקנים: דניאל\n\nמתחקרות: אביטל", "אימון שחקנים:\n9:00"],
  ["התכנסות ופתיחה של הקבוצה\nבחדר 1.7", "9:00-9:50"],
  ["קבוצה ב'\nחדר 1.7", "קבוצה א'\nמרכז סימולציה", "חלוקה שלהן לשתי קבוצות "],
  ["המשך הרצאה ב1.7", "פתיחה ואוריינטציה ", "10:00-10:30"],
  ["", "סימולציה +שיקוף\nשלשה חדרים", "10:30-10:50"],
)])
check("schedule: a split day takes the simulation track's column", split.map((r) => r.activity),
  ["התכנסות ופתיחה של הקבוצה\nבחדר 1.7", "פתיחה ואוריינטציה", "סימולציה +שיקוף\nשלשה חדרים"])
check("schedule: only a bare התכנסות is dropped, not an opening that starts with it",
  parseSchedule([table(["התכנסות.", "8:30-9:00"], ["התכנסות ופתיחה", "9:00-9:30"])]).map((r) => r.activity),
  ["התכנסות ופתיחה"])
check("schedule: without a track marker, the cell beside the time",
  parseSchedule([table(["הרצאה", "פתיחה", "10:00-10:30"])]).map((r) => r.activity), ["פתיחה"])

// ── Scenario ────────────────────────────────────────────────────────────────
const scenarioFile = [
  p(" תרחיש 1"),
  p("נושא האימון: בניית אמון עם הורה."),
  p("אוכלוסיית מתאמנות: מנהלות מעונות."),
  p("שם התרחיש: \"אני דורשת לדעת עכשיו!\""),
  p("הדמות: יעל, אם"),
  p("      *******"),
  p("תקציר למשתתפות: \"אני דורשת לדעת עכשיו!\""),
  p("את מנהלת מעון 'אורים ותומים'"),
  p(""),
  p("מטרת הסימולציה: בניית אמון עם יעל."),
  p("לרשותכן:  10  דקות"),
  p("הערה: לפני הפגישה חשבי עם הקבוצה"),
  table(["מטרת תרחיש", "ניהול שיחה לבניית אמון"], ["נקודות לתחקיר", "*פתיחה\n*הקשבה"]),
  p("טקסט אחרי הטבלה"),
]
const sc = parseScenario(scenarioFile)
check("scenario: header fields", [sc.number, sc.topic, sc.population, sc.character],
  [1, "בניית אמון עם הורה.", "מנהלות מעונות.", "יעל, אם"])
check("scenario: title exactly as written, quotes included", sc.title, "\"אני דורשת לדעת עכשיו!\"")
check("scenario: body is brief, goal, minutes and הערה — nothing above, nothing after the table", sc.body,
  ["את מנהלת מעון 'אורים ותומים'", "מטרת הסימולציה: בניית אמון עם יעל.", "לרשותכן: 10 דקות", "הערה: לפני הפגישה חשבי עם הקבוצה"])
check("scenario: the facilitator table, by label", sc.details,
  { "מטרת תרחיש": "ניהול שיחה לבניית אמון", "נקודות לתחקיר": "*פתיחה\n*הקשבה" })
check("scenario: nothing to warn about", sc.warnings, [])

const noName = parseScenario([p("תקציר למשתתפים: לא טוב שירד מהמיטה"), p("אתם צוות חינוכי.")])
check("scenario: no שם התרחיש — the title comes from the brief line", noName.title, "לא טוב שירד מהמיטה")
const noBrief = parseScenario([p("שם התרחיש: ״תתמודדו!״"), p("את בצוות החינוכי.")])
check("scenario: no brief line — body starts after the last header, with a warning",
  [noBrief.body, noBrief.warnings.length], [["את בצוות החינוכי."], 1])
check("scenario: a numbered brief line is still the brief line",
  parseScenario([p("תקציר 1 למשתתפים: \"תתחשבו בי.\""), p("את רכזת.")]).body, ["את רכזת."])

// ── Tokens ──────────────────────────────────────────────────────────────────
const A = `xmlns:a="${NS.a}"`
const run = (t: string, b = "") => `<a:r><a:rPr sz="3200"${b}/><a:t>${t}</a:t></a:r>`
const body = (...paras: string[]) => parseXml(`<a:txBody ${A}>${paras.join("")}</a:txBody>`)
const texts = (doc: ReturnType<typeof parseXml>) => descendants(doc, NS.a, "p").map(paragraphText)

let doc = body(`<a:p>${run("{{organ")}${run("ization}} –", ' b="1"')}${run(" {{group}}")}</a:p>`)
check("tokens: split across runs, and two on one line", [fillTokens(doc, { organization: "אורות", group: "צוות" }), texts(doc)],
  [[], ["אורות – צוות"]])
check("tokens: the value keeps the formatting of the run the token starts in",
  descendants(doc, NS.a, "r").map((r) => [r.textContent, r.getElementsByTagNameNS(NS.a, "rPr")[0].getAttribute("b")]),
  [["אורות", null], [" –", "1"], [" צוות", null]])

doc = body(`<a:p>${run("לשם מה התכנסנו?")}</a:p>`, `<a:p>${run("{{topics}}")}</a:p>`)
fillTokens(doc, { topics: ["בניית אמון", "שיחה מורכבת"] })
check("tokens: a token alone takes one paragraph per line", texts(doc), ["לשם מה התכנסנו?", "בניית אמון", "שיחה מורכבת"])

doc = body(`<a:p>${run("שבירת קרח")}</a:p>`, `<a:p>${run("{{icebreaker_question}}")}</a:p>`)
fillTokens(doc, { icebreaker_question: "  " })
check("tokens: an empty value removes its paragraph", texts(doc), ["שבירת קרח"])

doc = body(`<a:p>${run("{{icebreaker_question}}")}</a:p>`)
fillTokens(doc, { icebreaker_question: "" })
check("tokens: …but the last paragraph of a box is emptied, not removed", texts(doc), [""])

doc = body(`<a:p>${run("{{date}} {{mystery}}")}</a:p>`)
check("tokens: an unknown token is reported and left visible", [fillTokens(doc, { date: "7.5.26" }), texts(doc)],
  [["mystery"], ["7.5.26 {{mystery}}"]])

check("tokens: an inline multi-line value becomes one line",
  (() => { const d = body(`<a:p>${run("נושאים: {{topics}}")}</a:p>`); fillTokens(d, { topics: ["א", "ב"] }); return texts(d) })(),
  ["נושאים: א, ב"])

// ── Table rows ──────────────────────────────────────────────────────────────
const cell = (t: string) => `<a:tc><a:txBody><a:p>${run(t)}</a:p></a:txBody></a:tc>`
const tbl = () => parseXml(`<a:tbl ${A}><a:tr>${cell("פעילות")}${cell("זמן")}</a:tr><a:tr>${cell("{{row.activity}}")}${cell("{{row.time}}")}</a:tr></a:tbl>`)
const rowTexts = (d: ReturnType<typeof parseXml>) =>
  descendants(d, NS.a, "tr").map((tr) => descendants(tr, NS.a, "p").map(paragraphText).join(" | "))

doc = tbl()
fillTableRows(doc, [{ activity: "פתיחה", time: "9:30-10:00" }, { activity: "סימולציה 1\n+ שיקופים", time: "10:00-10:20" }])
check("rows: one per schedule line, header kept, template row gone", rowTexts(doc),
  ["פעילות | זמן", "פתיחה | 9:30-10:00", "סימולציה 1 | + שיקופים | 10:00-10:20"])
doc = tbl()
fillTableRows(doc, [])
check("rows: an empty schedule leaves the header alone", rowTexts(doc), ["פעילות | זמן"])

// ── Scenario text size ──────────────────────────────────────────────────────
const box = { widthEmu: 14303472, heightEmu: 9593395, lineSpacing: 1.15, spaceAfterPt: 10 }
const short = fitScenarioText(box, "תקציר 1 למשתתפים: ״תתמודדו!״", ["משפט קצר.", "לרשותך 7 דקות"])
check("size: a short scenario takes the largest size, title a step above", short, { title: 44, body: 40 })
const sizes = [5, 10, 20, 40].map((n) => fitScenarioText(box, "כותרת", Array(n).fill("א".repeat(120))).body)
check("size: longer text never gets larger", sizes.every((s, i) => i === 0 || s <= sizes[i - 1]), true)
check("size: absurdly long text bottoms out at the smallest step",
  fitScenarioText(box, "כותרת", Array(200).fill("א".repeat(200))), { title: 20, body: 16 })

// ── Scenario closing lines ──────────────────────────────────────────────────
doc = body(`<a:p><a:pPr algn="r"/>${run("{{scenario.body}}")}</a:p>`)
fillTokens(doc, { "scenario.body": ["את מנהלת מעון.", "מטרת הסימולציה: בניית אמון.", "לרשותכן: 10 דקות", "הערה: חשבי עם הקבוצה"] })
centerClosingLines(doc)
check("closing lines: goal and minutes centred, the brief and הערה keep their alignment",
  descendants(doc, NS.a, "p").map((p) => p.getElementsByTagNameNS(NS.a, "pPr")[0]?.getAttribute("algn")), ["r", "ctr", "ctr", "r"])

// ── Scenario markup ─────────────────────────────────────────────────────────
const segs = (l: string) => parseMarkup(l).map((s) => `${s.bold ? "B" : ""}${s.underline ? "U" : ""}:${s.text}`)
check("markup: *bold* and _underline_", segs("את *מנהלת* מעון _אורים_."), [":את ", "B:מנהלת", ": מעון ", "U:אורים", ":."])
check("markup: nested", segs("*_שניהם_* ורגיל"), ["BU:שניהם", ": ורגיל"])
check("markup: a lone marker stays as written", segs("ציון 5*2 בלבד"), [":ציון 5*2 בלבד"])
check("markup: plain text untouched", segs("בלי סימונים"), [":בלי סימונים"])
doc = body(`<a:p>${run("לרשותך *10* דקות")}</a:p>`)
applyMarkup(doc)
check("markup: becomes runs, markers gone, bold set",
  descendants(doc, NS.a, "r").map((r) => [r.textContent, r.getElementsByTagNameNS(NS.a, "rPr")[0].getAttribute("b")]),
  [["לרשותך ", null], ["10", "1"], [" דקות", null]])

// ── Cover line ──────────────────────────────────────────────────────────────
// Daniel's cover: a 1314pt-wide box at 106pt.
check("cover: about 22 characters fit one line at the template's size", charsPerLine(1314, 106), 22)
check("cover: a name that fits keeps the template's size", fitOneLine("אורות – צוות חינוכי", 1314, 106), 106)
const longName = "תיכון מקיף עירוני רבין – מחנכי י״א"
check("cover: a longer name shrinks to fit one line",
  fitOneLine(longName, 1314, 106) < 106 && longName.length <= charsPerLine(1314, fitOneLine(longName, 1314, 106)), true)
check("cover: never below half the template's size", fitOneLine("א".repeat(300), 1314, 106), 53)

// ── Schedule table ──────────────────────────────────────────────────────────
const cols = [580, 350]
const header = [["פעילות"], ["זמן"]]
const day = (n: number) => [header, ...Array.from({ length: n }, () => [["תחקיר מבוסס וידאו"], ["10:20-11:00"]])]
check("table: a short day gets the largest size", fitTable(560, cols, day(4)), 40)
check("table: a longer day gets smaller text", fitTable(560, cols, day(12)) < fitTable(560, cols, day(4)), true)
check("table: a long activity is limited by its column's width",
  fitTable(560, cols, [header, [["פתיחה ואוריינטציה והצגת מטרות היום והכרות קצרה"], ["9:00-9:30"]]]) < 40, true)

// ── The package ─────────────────────────────────────────────────────────────
const P = `xmlns:a="${NS.a}" xmlns:p="${NS.p}" xmlns:r="${NS.r}"`
const slide = (...paras: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${P}><p:cSld><p:spTree><p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="14303472" cy="9593395"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/>${paras.map((t) => `<a:p>${run(t)}</a:p>`).join("")}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
const relsOf = (...rels: [string, string, string][]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rels}">${rels.map(([id, type, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join("")}</Relationships>`

async function miniDeck(): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${NS.ct}"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/></Types>`)
  zip.file("ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ${P}><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst></p:presentation>`)
  zip.file("ppt/_rels/presentation.xml.rels", relsOf(["rId1", "theme", "theme/theme1.xml"], ["rId2", "slide", "slides/slide1.xml"], ["rId3", "slide", "slides/slide2.xml"]))
  zip.file("ppt/slides/slide1.xml", slide("{{organization}} – {{group}}", "{{date}}"))
  zip.file("ppt/slides/_rels/slide1.xml.rels", relsOf(["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"]))
  zip.file("ppt/slides/slide2.xml", slide("תקציר {{scenario.number}} למשתתפים: {{scenario.title}}", "", "{{scenario.body}}"))
  zip.file("ppt/slides/_rels/slide2.xml.rels", relsOf(["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "notesSlide", "../notesSlides/notesSlide1.xml"]))
  zip.file("ppt/notesSlides/notesSlide1.xml", "<p:notes/>")
  zip.file("ppt/notesSlides/_rels/notesSlide1.xml.rels", relsOf(["rId1", "slide", "../slides/slide2.xml"]))
  zip.file("docProps/app.xml", "<Properties><Slides>2</Slides></Properties>")
  return zip.generateAsync({ type: "uint8array" })
}

const data = {
  organization: "אורות", group: "צוות", date: "27.8.26", icebreakerQuestion: "", topics: [], schedule: [],
  scenarios: [
    { title: "״תתמודדו!״", body: ["את בצוות החינוכי.", "לרשותך 7 דקות"] },
    { title: "״לא בא לי לדבר...״", body: ["את יועצת."] },
  ],
}

async function packageChecks() {
  const out = await generateDeck(await miniDeck(), data)
  const zip = await JSZip.loadAsync(out.file)
  const read = async (f: string) => parseXml(await zip.file(f)!.async("string"))
  const pres = await read("ppt/presentation.xml")
  const presRels = await read("ppt/_rels/presentation.xml.rels")
  const types = await read("[Content_Types].xml")
  const order = children(children(pres.documentElement!, NS.p, "sldIdLst")[0], NS.p, "sldId")
  const target = (rId: string) =>
    children(presRels.documentElement!, NS.rels, "Relationship").find((r) => r.getAttribute("Id") === rId)?.getAttribute("Target")
  check("package: nothing unresolved", out.unresolved, [])
  check("package: the copy follows the template in the slide order",
    order.map((s) => target(s.getAttributeNS(NS.r, "id")!)), ["slides/slide1.xml", "slides/slide2.xml", "slides/slide3.xml"])
  check("package: slide ids stay unique", new Set(order.map((s) => s.getAttribute("id"))).size, 3)
  check("package: the copy has a content-type override",
    children(types.documentElement!, NS.ct, "Override").some((o) => o.getAttribute("PartName") === "/ppt/slides/slide3.xml"), true)
  const copyRels = await zip.file("ppt/slides/_rels/slide3.xml.rels")!.async("string")
  check("package: the copy keeps its layout but not the template's speaker notes",
    [copyRels.includes("slideLayout1.xml"), copyRels.includes("notesSlide")], [true, false])
  check("package: each scenario on its own slide, numbered in order",
    [texts(await read("ppt/slides/slide2.xml"))[0], texts(await read("ppt/slides/slide3.xml"))[0]],
    ["תקציר 1 למשתתפים: ״תתמודדו!״", "תקציר 2 למשתתפים: ״לא בא לי לדבר...״"])
  check("package: the body is one paragraph per line", texts(await read("ppt/slides/slide2.xml")).slice(2),
    ["את בצוות החינוכי.", "לרשותך 7 דקות"])
  check("package: other slides are filled too", texts(await read("ppt/slides/slide1.xml")), ["אורות – צוות", "27.8.26"])
  check("package: the slide count is updated", await zip.file("docProps/app.xml")!.async("string"), "<Properties><Slides>3</Slides></Properties>")

  const none = await JSZip.loadAsync((await generateDeck(await miniDeck(), { ...data, scenarios: [] })).file)
  const noneTypes = await none.file("[Content_Types].xml")!.async("string")
  check("package: no scenarios — the slide, its relationship, its notes and their overrides all go", [
    (await none.file("ppt/presentation.xml")!.async("string")).includes('r:id="rId3"'),
    (await none.file("ppt/_rels/presentation.xml.rels")!.async("string")).includes("slide2.xml"),
    none.file("ppt/slides/slide2.xml") !== null,
    none.file("ppt/notesSlides/notesSlide1.xml") !== null,
    noneTypes.includes("slide2.xml") || noneTypes.includes("notesSlide1.xml"),
  ], [false, false, false, false, false])

}

packageChecks().then(() => {
  console.log(failures === 0 ? "\n✓ all checks passed\n" : `\n✗ ${failures} check(s) failed\n`)
  process.exit(failures === 0 ? 0 : 1)
})
