import { prisma } from "./prisma"
import { actualRooms, cancellationLabel, countedRooms } from "./counted-rooms"
import { MONTHS } from "./months"
import { ShiyuchTakzivi } from "@prisma/client"

/**
 * Shared data layer for טבלאות פיבוט (spec §8.12). The annual grid, the monthly
 * table and the xlsx export are three renderings of one row set, so they read it
 * from here rather than each writing its own query.
 */

export const TAKZIVI_ORDER: ShiyuchTakzivi[] = [
  "OVDEI_HORAA",
  "MANCHI",
  "IRIYAT_YERUSHALAIM_TASHLUM",
  "CHUTZNIIOT_TASHLUM",
]

export { MONTHS, MONTH_NAMES_HE } from "./months"

export type PivotRow = {
  id: string
  date: string
  month: number
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

export function zeroedCategories(): Record<string, number> {
  return Object.fromEntries(TAKZIVI_ORDER.map((tv) => [tv, 0]))
}

/** First instant of a month, and of the month after it. */
function monthBounds(year: number, month: number): [Date, Date] {
  const pad = (n: number) => String(n).padStart(2, "0")
  const from = new Date(`${year}-${pad(month)}-01T00:00:00.000Z`)
  const to = month === 12
    ? new Date(`${year + 1}-01-01T00:00:00.000Z`)
    : new Date(`${year}-${pad(month + 1)}-01T00:00:00.000Z`)
  return [from, to]
}

/**
 * Every workshop in the year (or one month of it), sorted by date then group.
 *
 * Cancelled workshops are included on purpose — one cancelled after איתור צרכים
 * still consumed a slot, and `countedRooms()` decides how much each row counts.
 */
export async function getPivotRows(year: number, month?: number): Promise<PivotRow[]> {
  const [from, to] = month
    ? monthBounds(year, month)
    : [new Date(`${year}-01-01T00:00:00.000Z`), new Date(`${year + 1}-01-01T00:00:00.000Z`)]

  const workshops = await prisma.workshop.findMany({
    where: { date: { gte: from, lt: to } },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      status: true,
      cancelled: true,
      pivotNotes: true,
      countedRoomsOverride: true,
      participantGroup: {
        select: {
          name: true,
          organization: { select: { name: true, shiyuchTakzivi: true } },
        },
      },
      rooms: { where: { cancelled: false }, select: { cancelled: true } },
      scenarios: {
        where: { cancelled: false },
        select: { model: { select: { name: true, orderIndex: true } } },
      },
    },
  })

  const rows: PivotRow[] = workshops.map((w) => {
    // Distinct model names across active scenarios, in the managed list's own
    // order. A scenario with no model set yet contributes nothing.
    const seen = new Map<string, number>()
    for (const s of w.scenarios) {
      if (s.model && !seen.has(s.model.name)) seen.set(s.model.name, s.model.orderIndex)
    }
    const models = [...seen.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "he"))
      .map(([name]) => name)

    return {
      id:                   w.id,
      date:                 w.date.toISOString(),
      // Dates are stored at UTC midnight (they arrive as "YYYY-MM-DD" from a
      // date input), so bucketing on UTC parts is exact in any server timezone.
      month:                w.date.getUTCMonth() + 1,
      groupName:            `${w.participantGroup.organization.name} - ${w.participantGroup.name}`,
      models,
      actualRooms:          actualRooms(w),
      countedRooms:         countedRooms(w),
      countedRoomsOverride: w.countedRoomsOverride,
      shiyuchTakzivi:       w.participantGroup.organization.shiyuchTakzivi,
      cancelled:            w.cancelled,
      cancelLabel:          cancellationLabel(w),
      pivotNotes:           w.pivotNotes,
    }
  })

  rows.sort((a, b) =>
    a.date.localeCompare(b.date) || a.groupName.localeCompare(b.groupName, "he")
  )
  return rows
}

export async function getAllocations(year: number): Promise<Record<string, number>> {
  const goals = await prisma.annualGoal.findMany({ where: { year } })
  const map = new Map(goals.map((g) => [g.shiyuchTakzivi, g.allocation]))
  return Object.fromEntries(TAKZIVI_ORDER.map((tv) => [tv, map.get(tv) ?? 0]))
}

export type AnnualGrid = {
  months: { month: number; byCategory: Record<string, number> }[]
  totals: Record<string, number>
  /** Rooms in workshops that have already happened — the "סה"כ נכון ל‑DD.MM" figure. */
  elapsed: Record<string, number>
}

/** Fold the year's rows into the 12 × 4 סיכום grid. */
export function buildAnnualGrid(rows: PivotRow[], today = new Date()): AnnualGrid {
  const byMonth: Record<number, Record<string, number>> =
    Object.fromEntries(MONTHS.map((m) => [m, zeroedCategories()]))
  const totals  = zeroedCategories()
  const elapsed = zeroedCategories()

  for (const r of rows) {
    byMonth[r.month][r.shiyuchTakzivi] += r.countedRooms
    totals[r.shiyuchTakzivi]           += r.countedRooms
    if (new Date(r.date) < today) elapsed[r.shiyuchTakzivi] += r.countedRooms
  }

  return {
    months: MONTHS.map((m) => ({ month: m, byCategory: byMonth[m] })),
    totals,
    elapsed,
  }
}

export function sumCategories(rec: Record<string, number>): number {
  return TAKZIVI_ORDER.reduce((s, tv) => s + (rec[tv] ?? 0), 0)
}
