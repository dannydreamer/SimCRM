import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getPivotRows, zeroedCategories } from "@/lib/pivot-data"

/** One row per workshop dated in the month, any status, cancelled included. Spec §8.12. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles = session.user.roles
  if (!roles.includes("MANAGER") && !roles.includes("TECH"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const year  = Number(req.nextUrl.searchParams.get("year"))  || new Date().getFullYear()
  const month = Number(req.nextUrl.searchParams.get("month")) || new Date().getMonth() + 1
  if (!Number.isInteger(month) || month < 1 || month > 12)
    return NextResponse.json({ error: "month must be 1-12" }, { status: 400 })

  const rows = await getPivotRows(year, month)

  const byCategory = zeroedCategories()
  for (const r of rows) byCategory[r.shiyuchTakzivi] += r.countedRooms

  return NextResponse.json(
    {
      year,
      month,
      rows,
      total: rows.reduce((s, r) => s + r.countedRooms, 0),
      byCategory,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
