import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  TAKZIVI_ORDER, buildAnnualGrid, getAllocations, getPivotRows,
} from "@/lib/pivot-data"

/** The annual סיכום grid: 12 month rows × 4 שיוך תקציבי columns. Spec §8.12. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles
  if (!roles.includes("MANAGER") && !roles.includes("TECH"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const year  = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear()
  const today = new Date()

  const [rows, allocations] = await Promise.all([
    getPivotRows(year),
    getAllocations(year),
  ])
  const grid = buildAnnualGrid(rows, today)

  return NextResponse.json(
    {
      year,
      today:      today.toISOString(),
      categories: TAKZIVI_ORDER,
      allocations,
      months:     grid.months,
      totals:     grid.totals,
      elapsed:    grid.elapsed,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

/** Annual allocation (יעד שנתי). Manager only — Tech may read the page but not retarget it. */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.roles.includes("MANAGER"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { year, shiyuchTakzivi, allocation } = await req.json()

  if (!year || !shiyuchTakzivi || allocation === undefined)
    return NextResponse.json({ error: "year, shiyuchTakzivi, allocation required" }, { status: 400 })

  const result = await prisma.annualGoal.upsert({
    where:  { year_shiyuchTakzivi: { year: Number(year), shiyuchTakzivi } },
    update: { allocation: Number(allocation) },
    create: { year: Number(year), shiyuchTakzivi, allocation: Number(allocation) },
  })

  return NextResponse.json({ allocation: result.allocation })
}
