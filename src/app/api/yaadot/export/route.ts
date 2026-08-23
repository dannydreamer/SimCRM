import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import ExcelJS from "exceljs"
import {
  MONTHS, MONTH_NAMES_HE, TAKZIVI_ORDER,
  buildAnnualGrid, getAllocations, getPivotRows, sumCategories,
  type PivotRow,
} from "@/lib/pivot-data"
import { TAKZIVI_LABELS } from "@/lib/shiyuch"

// exceljs needs the Node runtime — it is not edge-compatible.
export const runtime = "nodejs"

const HEADER_FILL = "FFEFF2F8"
const RULE        = "FFC6CBDA"

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${String(d.getUTCFullYear()).slice(2)}`
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, size: 11 }
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } }
    cell.border = { bottom: { style: "thin", color: { argb: RULE } } }
    cell.alignment = { horizontal: "right", vertical: "middle" }
  })
  row.height = 20
}

function styleTotals(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.eachCell((cell) => {
    cell.border = { top: { style: "thin", color: { argb: RULE } } }
  })
}

/** The סיכום sheet: 12 month rows × 4 categories, then totals, target and remainder. */
function addSummarySheet(
  wb: ExcelJS.Workbook,
  year: number,
  rows: PivotRow[],
  allocations: Record<string, number>,
  today: Date
) {
  const grid  = buildAnnualGrid(rows, today)
  const sheet = wb.addWorksheet("סיכום", { views: [{ rightToLeft: true }] })

  sheet.columns = [
    { width: 16 },
    // Wide enough for the full labels — "סדנאות חיצוניות בתשלום" is the longest.
    ...TAKZIVI_ORDER.map(() => ({ width: 24 })),
    { width: 12 },
  ]

  styleHeader(sheet.addRow([
    "חודש",
    ...TAKZIVI_ORDER.map((tv) => TAKZIVI_LABELS[tv]),
    "סה\"כ",
  ]))

  for (const m of MONTHS) {
    const byCat = grid.months[m - 1].byCategory
    sheet.addRow([
      `${MONTH_NAMES_HE[m - 1]} ${year}`,
      ...TAKZIVI_ORDER.map((tv) => byCat[tv]),
      sumCategories(byCat),
    ])
  }

  styleTotals(sheet.addRow([
    "סה\"כ",
    ...TAKZIVI_ORDER.map((tv) => grid.totals[tv]),
    sumCategories(grid.totals),
  ]))

  sheet.addRow([
    "יעד שנתי",
    ...TAKZIVI_ORDER.map((tv) => allocations[tv]),
    sumCategories(allocations),
  ]).font = { bold: true }

  sheet.addRow([
    "נותרו",
    ...TAKZIVI_ORDER.map((tv) => allocations[tv] - grid.totals[tv]),
    sumCategories(allocations) - sumCategories(grid.totals),
  ]).font = { bold: true }

  // Rooms already consumed, as distinct from the סה"כ row above, which covers the
  // whole year including everything still scheduled. The label has to say so —
  // an unexplained number under a table that totals differently reads as an error.
  sheet.addRow([])
  sheet.addRow([
    `חדרים שנוצלו עד ${fmtDate(today.toISOString())}`,
    sumCategories(grid.elapsed),
  ]).font = { italic: true }

  return sheet
}

/** One detail sheet per month. Deliberately fewer columns than the screen — no חדרים בפועל, no מודל. */
function addMonthSheet(wb: ExcelJS.Workbook, year: number, month: number, rows: PivotRow[]) {
  const sheet = wb.addWorksheet(`${MONTH_NAMES_HE[month - 1]} ${year}`, {
    views: [{ rightToLeft: true }],
  })

  sheet.columns = [
    { width: 10 },  // תאריך
    { width: 42 },  // שם הקבוצה
    { width: 14 },  // חדרים לספירה
    { width: 24 },  // שיוך תקציבי
    { width: 22 },  // ביטול
    { width: 34 },  // הערות
  ]

  styleHeader(sheet.addRow([
    "תאריך", "שם הקבוצה", "חדרים לספירה", "שיוך תקציבי", "ביטול", "הערות",
  ]))

  for (const r of rows) {
    const row = sheet.addRow([
      fmtDate(r.date),
      r.groupName,
      r.countedRooms,
      TAKZIVI_LABELS[r.shiyuchTakzivi] ?? r.shiyuchTakzivi,
      r.cancelLabel ?? "",
      r.pivotNotes ?? "",
    ])
    // Cancelled workshops carry the same strikethrough they have on screen, so a
    // reader scanning the sheet cannot mistake one for a workshop that ran.
    if (r.cancelled) row.font = { strike: true, color: { argb: "FF8A8F9E" } }
  }

  styleTotals(sheet.addRow([
    "סה\"כ", "", rows.reduce((s, r) => s + r.countedRooms, 0), "", "", "",
  ]))

  return sheet
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles
  if (!roles.includes("MANAGER") && !roles.includes("TECH"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const year  = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear()
  const full  = req.nextUrl.searchParams.get("scope") === "full"
  const today = new Date()

  const [rows, allocations] = await Promise.all([
    getPivotRows(year),
    getAllocations(year),
  ])

  const wb = new ExcelJS.Workbook()
  wb.creator = "SimCRM"
  wb.created = today

  addSummarySheet(wb, year, rows, allocations, today)

  if (full) {
    for (const m of MONTHS) {
      addMonthSheet(wb, year, m, rows.filter((r) => r.month === m))
    }
  }

  const buffer   = await wb.xlsx.writeBuffer()
  const filename = full
    ? `טבלאות פיבוט כולל חודשים ${year}.xlsx`
    : `טבלאות פיבוט סיכום ${year}.xlsx`

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  })
}
